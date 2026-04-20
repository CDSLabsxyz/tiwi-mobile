import { DISPERSE_CONTRACTS } from '@/constants/contracts';
import { SendTokenParams, transactionService } from '@/services/transactionService';
import { useWalletStore } from '@/store/walletStore';
import { waitForReceiptSuccess } from '@/utils/txReceipt';
import { useCallback, useState } from 'react';
import { parseUnits } from 'viem';
import { useSendTransaction, useWriteContract } from 'wagmi';

const DISPERSE_ABI = [
    {
        name: 'disperseEther',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
            { name: 'recipients', type: 'address[]' },
            { name: 'values', type: 'uint256[]' },
        ],
        outputs: [],
    },
    {
        name: 'disperseTokenSimple',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'recipients', type: 'address[]' },
            { name: 'values', type: 'uint256[]' },
        ],
        outputs: [],
    },
] as const;

export const useTransactionExecution = () => {
    const { address: activeAddress } = useWalletStore();
    const [isExecuting, setIsExecuting] = useState(false);
    const [lastHash, setLastHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Wagmi hooks for external wallets
    const { writeContractAsync } = useWriteContract();
    const { sendTransactionAsync } = useSendTransaction();

    const execute = useCallback(async (params: SendTokenParams) => {
        // Metadata Guard: Ensure we have the minimum requirements for a valid transaction
        if (params.decimals === undefined || params.decimals === null) {
            throw new Error('Token decimals are missing. Cannot calculate amount safely.');
        }
        if (!params.isNative && (!params.tokenAddress || params.tokenAddress === 'native')) {
            throw new Error('Contract address is missing for ERC20 transfer.');
        }

        setIsExecuting(true);
        setError(null);
        setLastHash(null);

        try {
            const { walletGroups } = useWalletStore.getState();
            const wallet = walletGroups.find(g =>
                Object.values(g.addresses).some(addr => addr?.toLowerCase() === activeAddress?.toLowerCase())
            );
            const isLocal = wallet?.source === 'local' || wallet?.source === 'internal' || wallet?.source === 'imported';

            if (isLocal) {
                const result = await transactionService.sendToken(params);
                if (result.status === 'success') {
                    setLastHash(result.hash);
                    return result.hash;
                } else {
                    throw new Error(result.error || 'Transaction failed');
                }
            } else {
                let hash: `0x${string}`;
                if (params.isNative) {
                    hash = await sendTransactionAsync({
                        to: params.recipientAddress as `0x${string}`,
                        value: parseUnits(params.amount, params.decimals),
                        chainId: params.chainId,
                    });
                } else {
                    // Logic for single ERC20 transfer via external wallet
                    const ERC20_ABI_TRANSFER = [{
                        name: 'transfer',
                        type: 'function',
                        stateMutability: 'nonpayable',
                        inputs: [{ name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }],
                        outputs: [{ name: '', type: 'bool' }],
                    }] as const;

                    hash = await writeContractAsync({
                        address: params.tokenAddress as `0x${string}`,
                        abi: ERC20_ABI_TRANSFER,
                        functionName: 'transfer',
                        args: [params.recipientAddress as `0x${string}`, parseUnits(params.amount, params.decimals)],
                        chainId: params.chainId,
                    });
                }
                if (hash && params) {
                    // Broadcast ≠ success — wait for the receipt before logging.
                    // A reverted tx would otherwise be recorded as a Transfer
                    // that never happened.
                    const mined = await waitForReceiptSuccess({ hash, chainId: params.chainId });
                    if (mined === false) {
                        throw new Error('Transaction reverted on-chain');
                    }
                    if (mined === true) {
                        try {
                            const { apiClient } = require('@/services/apiClient');
                            await apiClient.logTransaction({
                                walletAddress: activeAddress!,
                                transactionHash: hash,
                                chainId: params.chainId,
                                type: 'Transfer',
                                fromTokenAddress: params.tokenAddress,
                                fromTokenSymbol: params.symbol,
                                amount: params.amount,
                                amountFormatted: `${params.amount} ${params.symbol}`,
                                routerName: 'Tiwi Transfer',
                            });
                        } catch (e) {
                            console.error('[useTransactionExecution] Failed to log transfer:', e);
                        }
                    }
                }
                setLastHash(hash);
                return hash;
            }
        } catch (err: any) {
            setError(err.message || 'Transaction failed');
            throw err;
        } finally {
            setIsExecuting(false);
        }
    }, [activeAddress, writeContractAsync, sendTransactionAsync]);

    const executeMulti = useCallback(async (params: Omit<SendTokenParams, 'recipientAddress' | 'amount'> & { recipients: string[]; amounts: string[] }) => {
        // Metadata Guard
        if (params.decimals === undefined || params.decimals === null) {
            throw new Error('Token decimals are missing for multi-send.');
        }

        setIsExecuting(true);
        setError(null);
        setLastHash(null);

        try {
            const { walletGroups } = useWalletStore.getState();
            const wallet = walletGroups.find(g =>
                Object.values(g.addresses).some(addr => addr?.toLowerCase() === activeAddress?.toLowerCase())
            );
            const isLocal = wallet?.source === 'local' || wallet?.source === 'internal' || wallet?.source === 'imported';

            if (isLocal) {
                const result = await transactionService.multiSend(params);
                if (result.status === 'success') {
                    // Confirm the disperse actually mined successfully before
                    // logging. Approve can land fine but the disperse call
                    // revert (allowance race, OOG, bad recipient) — we don't
                    // want that to show up as "Sent Successfully".
                    const mined = await waitForReceiptSuccess({ hash: result.hash, chainId: params.chainId });
                    if (mined === false) {
                        throw new Error('Multi-send reverted on-chain');
                    }
                    if (mined === true) {
                        try {
                            const { apiClient } = require('@/services/apiClient');
                            await apiClient.logTransaction({
                                walletAddress: activeAddress!,
                                transactionHash: result.hash,
                                chainId: params.chainId,
                                type: 'Transfer',
                                fromTokenAddress: params.tokenAddress,
                                fromTokenSymbol: params.symbol,
                                // For multi-send we could sum the amounts or just log the intent
                                amount: params.amounts.reduce((a, b) => (parseFloat(a) + parseFloat(b)).toString(), '0'),
                                amountFormatted: `Multi-send ${params.symbol}`,
                                routerName: 'Tiwi Multi-Send',
                            });
                        } catch (e) {
                            console.error('[useTransactionExecution] Failed to log multi-send:', e);
                        }
                    }
                    setLastHash(result.hash);
                    return result.hash;
                } else {
                    throw new Error(result.error || 'Multi-send failed');
                }
            } else {
                const disperseAddress = DISPERSE_CONTRACTS[params.chainId];
                if (!disperseAddress) throw new Error(`Disperse contract not found for chain ${params.chainId}`);

                const amountsBI = params.amounts.map(a => parseUnits(a, params.decimals));
                const totalAmountBI = amountsBI.reduce((a, b) => a + b, 0n);

                let hash: `0x${string}`;
                if (params.isNative) {
                    hash = await writeContractAsync({
                        address: disperseAddress as `0x${string}`,
                        abi: DISPERSE_ABI,
                        functionName: 'disperseEther',
                        args: [params.recipients as `0x${string}`[], amountsBI],
                        value: totalAmountBI,
                        chainId: params.chainId,
                    });
                } else {
                    hash = await writeContractAsync({
                        address: disperseAddress as `0x${string}`,
                        abi: DISPERSE_ABI,
                        functionName: 'disperseTokenSimple',
                        args: [params.tokenAddress as `0x${string}`, params.recipients as `0x${string}`[], amountsBI],
                        chainId: params.chainId,
                    });
                }

                // Log to backend — only after we know the tx actually landed.
                if (hash) {
                    const mined = await waitForReceiptSuccess({ hash, chainId: params.chainId });
                    if (mined === false) {
                        throw new Error('Multi-send reverted on-chain');
                    }
                    if (mined !== true) {
                        // Unknown — skip logging. Tx hash is still returned
                        // so the caller can show a pending state if desired.
                        setLastHash(hash);
                        return hash;
                    }
                    try {
                        const { apiClient } = require('@/services/apiClient');
                        await apiClient.logTransaction({
                            walletAddress: activeAddress!,
                            transactionHash: hash,
                            chainId: params.chainId,
                            type: 'Transfer',
                            fromTokenAddress: params.tokenAddress,
                            fromTokenSymbol: params.symbol,
                            amount: params.amounts.reduce((a, b) => (parseFloat(a) + parseFloat(b)).toString(), '0'),
                            amountFormatted: `Multi-send ${params.symbol}`,
                            routerName: 'Tiwi Multi-Send (Disperse)',
                        });
                    } catch (e) {
                        console.error('[useTransactionExecution] Failed to log external multi-send:', e);
                    }
                }

                setLastHash(hash);
                return hash;
            }
        } catch (err: any) {
            setError(err.message || 'Multi-send failed');
            throw err;
        } finally {
            setIsExecuting(false);
        }
    }, [activeAddress, writeContractAsync]);

    return {
        execute,
        executeMulti,
        isExecuting,
        lastHash,
        error
    };
};
