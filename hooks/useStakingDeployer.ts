/**
 * useStakingDeployer (mobile)
 *
 * On-chain seam for the staking pool creator, mirroring the web
 * `hooks/useStakingDeployer.ts` surface (`createPool`, `payCreationFee`,
 * `emergencyWithdrawRewards`) but using the mobile "API builds unsigned tx →
 * device signs" pattern for the deploy step.
 *
 *   createPool:
 *     1. POST /api/v1/mobile/staking/tx { action: 'create', … } → unsigned steps
 *     2. Sign + broadcast each step in order (local signer, or wagmi for external)
 *     3. Decode `PoolDeployed` from the createPool receipt → new pool address
 *   payCreationFee:        ERC20 transfer(treasury, amount) — device-signed
 *   emergencyWithdrawRewards: pool.emergencyWithdrawRewards(to) — device-signed
 *
 * The server never holds keys; it only assembles calldata (or the client encodes
 * a trivial ERC20/pool call). Signing happens on-device through `signerController`
 * (internal / imported wallets) or the connected AppKit wallet (external).
 *
 * Persisting pool metadata + ownership (staking_pools / user_staking_pools) is
 * handled by the caller (StakingPoolCreator), matching the web component.
 */

import { useCallback, useState } from 'react';
import {
    createPublicClient,
    decodeEventLog,
    encodeFunctionData,
    http,
    parseUnits,
    type Address,
    type Hash,
} from 'viem';
import { bsc, mainnet, polygon, arbitrum, base, optimism, avalanche } from 'viem/chains';
import { useAccount, useSendTransaction, useSwitchChain } from 'wagmi';
import { api } from '@/lib/mobile/api-client';
import { signerController } from '@/services/signer/SignerController';
import { useWalletStore } from '@/store/walletStore';
import { RPC_CONFIG, RPC_TRANSPORT_OPTIONS } from '@/constants/rpc';

const CHAIN_MAP: Record<number, any> = {
    1: mainnet, 56: bsc, 137: polygon, 42161: arbitrum, 8453: base, 10: optimism, 43114: avalanche,
};

export const CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum', 56: 'BNB Smart Chain', 137: 'Polygon', 42161: 'Arbitrum',
    8453: 'Base', 10: 'Optimism', 43114: 'Avalanche',
};

// Minimal ABI fragment to decode the pool address out of the createPool receipt.
const POOL_DEPLOYED_EVENT_ABI = [
    {
        anonymous: false,
        name: 'PoolDeployed',
        type: 'event',
        inputs: [
            { indexed: true, name: 'poolAddress', type: 'address' },
            { indexed: true, name: 'creator', type: 'address' },
            { indexed: true, name: 'stakingToken', type: 'address' },
            { indexed: false, name: 'rewardToken', type: 'address' },
            { indexed: false, name: 'poolReward', type: 'uint256' },
            { indexed: false, name: 'rewardDurationSeconds', type: 'uint256' },
            { indexed: false, name: 'maxTvl', type: 'uint256' },
        ],
    },
] as const;

const ERC20_TRANSFER_ABI = [
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
] as const;

const POOL_EMERGENCY_WITHDRAW_ABI = [
    {
        name: 'emergencyWithdrawRewards',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'to', type: 'address' }],
        outputs: [],
    },
] as const;

export interface CreatePoolParams {
    chainId: number;
    stakingToken: Address;
    rewardToken: Address;
    /** Total reward tokens, human units. */
    poolReward: string;
    /** Emission window in seconds. */
    rewardDurationSeconds: number;
    /** Max TVL (staking-token cap), human units. */
    maxTvl: string;
    stakingDecimals?: number;
    rewardDecimals?: number;
    /** EVM address that signs; falls back to the active wallet. */
    walletAddress?: Address;
}

export interface CreatePoolResult {
    poolAddress: Address;
    txHash: Hash;
    /** Deployer/factory contract that emitted PoolDeployed. */
    deployerAddress?: Address;
}

export interface PayCreationFeeParams {
    chainId: number;
    tokenAddress: Address;
    treasury: Address;
    /** Fee amount, human units. */
    amount: string;
    decimals: number;
    walletAddress?: Address;
}

export type CreatePoolStatus = 'idle' | 'building' | 'approving' | 'creating' | 'paying' | 'error';

function publicClientFor(chainId: number) {
    const chain = CHAIN_MAP[chainId] || bsc;
    const rpc = RPC_CONFIG?.[chainId];
    return createPublicClient({ chain, transport: rpc ? http(rpc, RPC_TRANSPORT_OPTIONS) : http() });
}

export function useStakingDeployer() {
    const { address: wagmiAddress } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();
    const { switchChainAsync } = useSwitchChain();

    const [status, setStatus] = useState<CreatePoolStatus>('idle');
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setStatus('idle');
        setError(null);
    }, []);

    /** Resolve the signing address + whether it's a local (in-app) wallet. */
    const resolveSigner = useCallback((override?: Address) => {
        const walletStore = useWalletStore.getState();
        const activeGroup = walletStore.walletGroups.find(g => g.id === walletStore.activeGroupId);
        // Prefer the caller-supplied EVM address, then the group's EVM address,
        // then the active/legacy address.
        const signerAddress =
            override ||
            (activeGroup?.addresses?.EVM as Address | undefined) ||
            (walletStore.activeAddress as Address | undefined) ||
            (wagmiAddress as Address | undefined);
        if (!signerAddress) throw new Error('No wallet connected');

        const owningGroup = walletStore.walletGroups.find(g =>
            Object.values(g.addresses).some(a => a?.toLowerCase() === signerAddress.toLowerCase()),
        ) || activeGroup;
        const isLocal =
            owningGroup?.type === 'mnemonic' ||
            owningGroup?.type === 'privateKey' ||
            owningGroup?.source === 'internal' ||
            owningGroup?.source === 'imported';

        return { signerAddress, isLocal };
    }, [wagmiAddress]);

    /**
     * Sign + broadcast a single unsigned step and wait for its receipt.
     * `skipAuthorize` suppresses the biometric prompt (used for non-final
     * steps in a multi-step create where one prompt covers the batch).
     */
    const signAndSend = useCallback(async (
        step: { to: string; data: string; value?: string; chainId: number; label?: string },
        signerAddress: Address,
        isLocal: boolean,
        opts?: { skipAuthorize?: boolean },
    ): Promise<{ hash: Hash; receipt: any }> => {
        let hash: Hash;
        if (isLocal) {
            const exec = await signerController.executeTransaction(
                {
                    chainFamily: 'evm',
                    to: step.to,
                    data: step.data,
                    value: step.value || '0',
                    chainId: step.chainId,
                },
                signerAddress,
                { skipAuthorize: !!opts?.skipAuthorize },
            );
            if (exec.status !== 'success' || !exec.hash) {
                throw new Error(exec.error || 'Transaction failed');
            }
            hash = exec.hash as Hash;
        } else {
            try {
                await switchChainAsync({ chainId: step.chainId });
            } catch {
                /* wallet may already be on-chain, or reject — surface at send time */
            }
            hash = await sendTransactionAsync({
                to: step.to as Address,
                data: step.data as `0x${string}`,
                value: BigInt(step.value || '0'),
                chainId: step.chainId,
            });
        }

        const receipt = await publicClientFor(step.chainId).waitForTransactionReceipt({ hash });
        if (receipt?.status === 'reverted') {
            throw new Error(`Transaction reverted${step.label ? ` (${step.label})` : ''}`);
        }
        return { hash, receipt };
    }, [sendTransactionAsync, switchChainAsync]);

    /**
     * Deploy a brand-new TiwiStakingPool. Approves the reward token then calls
     * the deployer, both built server-side. Returns the new pool address.
     */
    const createPool = useCallback(async (params: CreatePoolParams): Promise<CreatePoolResult> => {
        setError(null);
        setStatus('building');
        try {
            const { signerAddress, isLocal } = resolveSigner(params.walletAddress);

            const { steps, meta } = await api.staking.buildTx({
                action: 'create',
                chainId: params.chainId,
                userWallet: signerAddress,
                stakingToken: params.stakingToken,
                rewardToken: params.rewardToken,
                poolReward: params.poolReward,
                rewardDurationSeconds: params.rewardDurationSeconds,
                maxTvl: params.maxTvl,
                stakingDecimals: params.stakingDecimals,
                rewardDecimals: params.rewardDecimals,
            });
            if (!steps?.length) throw new Error('Server returned no transaction steps');

            const deployerAddress = String((meta as any)?.deployerAddress || '').toLowerCase();

            let lastReceipt: any = null;
            let lastHash: Hash | null = null;
            for (let i = 0; i < steps.length; i++) {
                const isCreateStep = i === steps.length - 1;
                setStatus(isCreateStep ? 'creating' : 'approving');
                // One biometric prompt covers the batch — authorize on the final
                // (create) step only.
                const { hash, receipt } = await signAndSend(
                    steps[i], signerAddress, isLocal, { skipAuthorize: !isCreateStep },
                );
                lastHash = hash;
                lastReceipt = receipt;
            }

            // Decode PoolDeployed → new pool contract address.
            let poolAddress: Address | null = null;
            for (const log of (lastReceipt?.logs || [])) {
                if (deployerAddress && String(log.address).toLowerCase() !== deployerAddress) continue;
                try {
                    const decoded = decodeEventLog({
                        abi: POOL_DEPLOYED_EVENT_ABI, data: log.data, topics: log.topics,
                    });
                    if (decoded.eventName === 'PoolDeployed') {
                        poolAddress = (decoded.args as any).poolAddress as Address;
                        break;
                    }
                } catch {
                    /* not the event we're after */
                }
            }
            if (!poolAddress) throw new Error('Pool created but PoolDeployed event not found in receipt');

            setStatus('idle');
            return {
                poolAddress,
                txHash: lastHash as Hash,
                deployerAddress: ((meta as any)?.deployerAddress as Address) || undefined,
            };
        } catch (e: any) {
            const message = e?.message?.includes('User rejected') ? 'Transaction rejected' : (e?.message || 'Failed to create pool');
            setError(message);
            setStatus('error');
            throw new Error(message);
        }
    }, [resolveSigner, signAndSend]);

    /** Pay the admin-set creation fee: ERC20 transfer(treasury, amount). */
    const payCreationFee = useCallback(async (params: PayCreationFeeParams): Promise<Hash> => {
        const { signerAddress, isLocal } = resolveSigner(params.walletAddress);
        const data = encodeFunctionData({
            abi: ERC20_TRANSFER_ABI,
            functionName: 'transfer',
            args: [params.treasury, parseUnits(params.amount, params.decimals)],
        });
        setStatus('paying');
        try {
            const { hash } = await signAndSend(
                { to: params.tokenAddress, data, value: '0', chainId: params.chainId, label: 'creation fee' },
                signerAddress, isLocal,
            );
            setStatus('idle');
            return hash;
        } catch (e: any) {
            setStatus('error');
            throw new Error(e?.message?.includes('User rejected') ? 'Fee payment rejected' : (e?.message || 'Fee payment failed'));
        }
    }, [resolveSigner, signAndSend]);

    /** Withdraw reward funds from a rejected pool: pool.emergencyWithdrawRewards(to). */
    const emergencyWithdrawRewards = useCallback(async (params: {
        chainId: number; poolAddress: Address; walletAddress?: Address;
    }): Promise<Hash> => {
        const { signerAddress, isLocal } = resolveSigner(params.walletAddress);
        const data = encodeFunctionData({
            abi: POOL_EMERGENCY_WITHDRAW_ABI,
            functionName: 'emergencyWithdrawRewards',
            args: [signerAddress],
        });
        const { hash } = await signAndSend(
            { to: params.poolAddress, data, value: '0', chainId: params.chainId, label: 'withdraw rewards' },
            signerAddress, isLocal,
        );
        return hash;
    }, [resolveSigner, signAndSend]);

    return {
        createPool,
        payCreationFee,
        emergencyWithdrawRewards,
        reset,
        status,
        error,
    };
}
