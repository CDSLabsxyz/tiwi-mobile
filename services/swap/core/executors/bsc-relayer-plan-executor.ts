/**
 * BSC Relayer (plan API) Executor — mobile
 *
 * The relayer path, driven by the server instead of by this file.
 *
 * This app used to carry its own copy of the relayer logic (contract addresses,
 * tax tiers, router choice, fee sizing, step ordering), hand-ported from the web
 * app. It drifted: onto the dead V2 contract, onto the non-fee-on-transfer
 * PancakeSwap functions, and onto a balance check that let a user pay the $0.50
 * service fee and then watch the swap revert. None of that could be fixed
 * without an app-store release.
 *
 * So this file holds none of those decisions. It asks
 * `POST /api/v1/relayer/swap/plan` for an ordered list of unsigned transactions
 * and signs them. Relayer economics now change server-side.
 *
 * The model is unchanged:
 *   1. The relayer releases $0.10 of BNB to the user — server-side, inside the
 *      plan call, before this file sees anything.
 *   2. The relayer receives $0.50 of the selected token — the `fee` step.
 *   3. The swap goes forward — the `tax`, `approve` and `swap` steps.
 *
 * Unlike the web build this is ON by default (set EXPO_PUBLIC_RELAYER_PLAN_API=0
 * to disable): there is no working local relayer path here to fall back to.
 */

import { type Address, type Hex, type PublicClient } from 'viem';
import { bsc } from 'viem/chains';
import { getCachedPublicClient } from '@/services/swap/core/platform/viem-clients';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { GasTokenType } from '@/services/swap/core/config/tax-config';
import { useSwapStore } from '@/services/swap/core/platform/swap-store';
import { apiUrl } from '@/services/swap/core/platform/api-base';

const BSC_CHAIN_ID = 56;

const PANCAKESWAP_V2_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

const NATIVE_ADDRESSES = new Set([
    '0x0000000000000000000000000000000000000000',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

const isNativeToken = (addr?: string | null) =>
    !!addr && NATIVE_ADDRESSES.has(addr.toLowerCase());

/** On unless explicitly disabled — the local alternative is the broken copy. */
export function isRelayerPlanApiEnabled(): boolean {
    return process.env.EXPO_PUBLIC_RELAYER_PLAN_API !== '0';
}

type RelayerStepId = 'fee' | 'tax' | 'approve' | 'swap';

interface RelayerStep {
    id: RelayerStepId;
    label: string;
    to: Address;
    data: Hex;
    value: string;
    chainId: number;
    mustVerify: boolean;
}

interface RelayerPlan {
    version: number;
    planId: string;
    steps: RelayerStep[];
    meta: {
        sponsored: boolean;
        serviceFeeToken: string;
        taxRateBps: number;
        minAmountOutWei: string;
        [k: string]: unknown;
    };
}

/** Per-step copy. Kept client-side so it stays localisable. */
const STEP_MESSAGE: Record<RelayerStepId, string> = {
    fee: 'Confirm the service fee...',
    tax: 'Confirm the fee...',
    approve: 'Approving...',
    swap: 'Confirm in wallet',
};

export class BscRelayerPlanExecutor implements SwapRouterExecutor {
    private publicClient: PublicClient;

    constructor() {
        this.publicClient = getCachedPublicClient(BSC_CHAIN_ID);
    }

    /**
     * BSC same-chain, ERC20 in, and a gas token that isn't BNB. Choosing BNB
     * means the user pays their own gas at the flat 0.25% — the direct path.
     */
    canHandle(route: RouterRoute): boolean {
        if (!isRelayerPlanApiEnabled()) return false;

        if (route.fromToken.chainId !== BSC_CHAIN_ID) return false;
        if (route.toToken.chainId !== BSC_CHAIN_ID) return false;

        // Native BNB has no ERC20 interface — the native executor owns that case.
        if (isNativeToken(route.fromToken.address)) return false;

        const { selectedGasTokenType } = useSwapStore.getState();
        if (selectedGasTokenType === GasTokenType.BNB) return false;

        return true;
    }

    /** Tokens are approved to the DEX router; no relayer contract is a spender. */
    async getSpenderAddress(_route: RouterRoute): Promise<string | null> {
        return PANCAKESWAP_V2_ROUTER;
    }

    async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const {
            fromToken,
            toToken,
            fromAmount,
            userAddress,
            recipientAddress,
            walletClient,
            onStatusUpdate,
            slippage,
            route,
        } = params;

        let activeWallet = walletClient;
        if (!activeWallet) {
            const { getEVMWalletClient } = await import('../utils/wallet-helpers');
            activeWallet = await getEVMWalletClient(BSC_CHAIN_ID);
        }

        const { selectedGasTokenType, selectedGasToken } = useSwapStore.getState();

        onStatusUpdate?.({ stage: 'preparing', message: 'Preparing...' });

        try {
            // 1. Ask the server for the plan. It performs the balance checks,
            //    prices the fee, quotes the route and releases the drip — so by
            //    the time it returns, the wallet can pay for the signatures below.
            const plan = await this.requestPlan({
                userWallet: userAddress,
                fromToken,
                toToken,
                fromAmount,
                recipientAddress,
                selectedGasTokenType,
                selectedGasToken,
                slippage: slippage ?? (route?.slippage ? parseFloat(route.slippage) : undefined),
            });

            console.log(
                `[BscRelayerPlanExecutor] plan ${plan.planId.slice(0, 12)}…: ` +
                `${plan.steps.map((s) => s.id).join(' → ')} (sponsored=${plan.meta.sponsored})`,
            );

            // 2. Sign each step in order. The order is the server's: the fee must
            //    clear before the swap, or a completed swap leaves an unrepaid
            //    drip and blocks the wallet from ever drawing another.
            const txHashes: string[] = [];
            let swapTxHash: string | undefined;

            for (const step of plan.steps) {
                onStatusUpdate?.({
                    stage: step.id === 'approve' ? 'approving' : 'signing',
                    message: STEP_MESSAGE[step.id] || step.label,
                });

                const hash = (await activeWallet.sendTransaction({
                    to: step.to,
                    data: step.data,
                    account: userAddress as Address,
                    chain: bsc,
                })) as Hex;

                if (step.id === 'swap') {
                    swapTxHash = hash;
                    onStatusUpdate?.({ stage: 'confirming', message: 'Reviewing...', txHash: hash });
                }

                const receipt = await this.publicClient.waitForTransactionReceipt({
                    hash,
                    timeout: 90_000,
                });
                if (receipt.status !== 'success') {
                    throw new Error(`The "${step.label}" transaction reverted on-chain.`);
                }

                txHashes.push(hash);

                // 3. Only the fee step is verified server-side, and it must be
                //    confirmed before we go on: it is what settles the drip.
                if (step.mustVerify) {
                    await this.reportStep(plan.planId, step.id, hash);
                }
            }

            if (!swapTxHash) {
                // A plan with no swap step is a server bug, not a user-facing state.
                throw new Error('The relayer plan contained no swap step.');
            }

            onStatusUpdate?.({ stage: 'completed', message: 'Success', txHash: swapTxHash });

            return {
                success: true,
                txHash: swapTxHash,
                txHashes,
                actualToAmount: route?.toToken?.amount,
            };
        } catch (error: any) {
            console.error('[BscRelayerPlanExecutor] Swap failed:', error);

            const { formatErrorMessage } = await import('../utils/error-handler');
            onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(error), error });

            throw error;
        }
    }

    /**
     * POST /api/v1/relayer/swap/plan.
     *
     * The server's message is surfaced verbatim: refusals here are things the
     * user can act on ("lower the amount", "you already have an unsettled
     * drip"), and rewording them client-side is how those became
     * "Gas estimation failed" in the first place.
     */
    private async requestPlan(input: {
        userWallet: string;
        fromToken: SwapExecutionParams['fromToken'];
        toToken: SwapExecutionParams['toToken'];
        fromAmount: string;
        recipientAddress?: string;
        selectedGasTokenType: GasTokenType;
        selectedGasToken: any;
        slippage?: number;
    }): Promise<RelayerPlan> {
        const res = await fetch(apiUrl('/api/v1/relayer/swap/plan'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userWallet: input.userWallet,
                fromToken: {
                    address: input.fromToken.address,
                    decimals: input.fromToken.decimals,
                    symbol: input.fromToken.symbol,
                },
                toToken: {
                    address: input.toToken.address,
                    decimals: input.toToken.decimals,
                    symbol: input.toToken.symbol,
                },
                fromAmount: input.fromAmount,
                recipient: input.recipientAddress,
                gasTokenType: input.selectedGasTokenType,
                gasToken: input.selectedGasToken?.address
                    ? {
                        address: input.selectedGasToken.address,
                        decimals: input.selectedGasToken.decimals,
                        symbol: input.selectedGasToken.symbol,
                    }
                    : undefined,
                chainId: BSC_CHAIN_ID,
                slippagePct: input.slippage,
            }),
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.steps?.length) {
            throw new Error(body?.error || `The relayer could not plan this swap (HTTP ${res.status}).`);
        }
        return body as RelayerPlan;
    }

    /**
     * POST /api/v1/relayer/swap/step.
     *
     * Retries once on a 503: the only retryable failure is the receipt not
     * having propagated to the server's RPC yet, which a moment usually fixes.
     */
    private async reportStep(planId: string, stepId: RelayerStepId, txHash: string): Promise<void> {
        for (let attempt = 0; attempt < 2; attempt++) {
            const res = await fetch(apiUrl('/api/v1/relayer/swap/step'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId, stepId, txHash }),
            });
            if (res.ok) return;

            const body = await res.json().catch(() => ({}));
            if (!body?.retryable || attempt === 1) {
                throw new Error(body?.error || `Could not confirm the ${stepId} step.`);
            }
            await new Promise((r) => setTimeout(r, 3000));
        }
    }
}
