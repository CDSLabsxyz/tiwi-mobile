/**
 * UnifiedSwapManager
 *
 * Port of `tiwi-user-app/hooks/useSwapExecution.ts`. It owns no routing logic -
 * the route comes from the backend and is settled by `services/swap/core`, the
 * executor engine copied from the web app. This class does the three things the
 * web hook does around that call:
 *
 *   1. The cross-VM recipient guard (fund-safety).
 *   2. Hand the engine its signing material as `walletClient`.
 *   3. Surface a resolved `{ success: false }` as a failure, not a success.
 *
 * There is deliberately NO local router dispatch and NO fallback executor set:
 * if the engine has nothing registered for a router, that is the same hard error
 * the web app raises ("No executor found for router: …"). A silent fallback to a
 * different, weaker executor would settle the swap on terms the user never saw
 * quoted.
 */

import { swapExecutor } from '@/services/swap/core';
import type { RouterRoute } from '@/services/swap/core/router-types';
import type { SwapExecutionStatus } from '@/services/swap/core/types';
import { formatErrorMessage } from '@/services/swap/core/utils/error-handler';
import { buildSignerMaterial } from '@/services/swap/core/platform/signer-material';
import { isAddressChainCompatible } from '@/services/swap/core/utils/wallet-display';
import { toCoreToken } from './route-adapter';
import { ExecuteSwapParams, SwapExecutionResult } from './types';

export interface ExecuteSwapOptions {
    /** Progress callback - mirrors the web toast stages. */
    onStatusUpdate?: (status: SwapExecutionStatus) => void;
    /**
     * Skip the Tiwi fee for THIS execution. Set on the 2nd leg of a multi-leg
     * swap so the platform fee is only ever charged once (on leg 1).
     */
    skipTax?: boolean;
}

export class UnifiedSwapManager {
    async execute(params: ExecuteSwapParams, options?: ExecuteSwapOptions): Promise<SwapExecutionResult> {
        const { fromAmount, fromToken, toToken, fromAddress, recipientAddress, quote } = params;

        const route = quote.route as RouterRoute | undefined;
        if (!route || !route.router) {
            return {
                success: false,
                error: 'Still preparing a secure route. Please try again in a moment.',
            };
        }

        try {
            // Cross-VM fund-safety guard: when the destination chain uses a
            // different address format than the source (TRON/TON/Solana/…), we
            // MUST have a recipient valid on the destination. Otherwise the
            // executors fall back to the source-VM address and funds are
            // delivered somewhere that cannot exist on the destination chain
            // (unrecoverable). EVM↔EVM is unaffected - the same 0x address is
            // valid on any EVM chain, so the source address passes this itself.
            if (Number(fromToken.chainId) !== Number(toToken.chainId)) {
                const recipientUsable =
                    !!recipientAddress && isAddressChainCompatible(recipientAddress, Number(toToken.chainId));
                const sourceUsable =
                    !!fromAddress && isAddressChainCompatible(fromAddress, Number(toToken.chainId));

                if (!recipientUsable && !sourceUsable) {
                    throw new Error(
                        `This cross-chain swap to ${toToken.symbol} needs a destination wallet ` +
                        `address on the ${toToken.symbol} network. Please set a recipient address ` +
                        `before swapping.`,
                    );
                }
            }

            // The engine reads every signature off this one object: a viem
            // WalletClient for EVM, or the chain-family signer material for
            // Solana / Sui / TON / TRON / Cosmos / Injective.
            const walletClient = await buildSignerMaterial(Number(fromToken.chainId), fromAddress);

            const result = await swapExecutor.execute({
                route,
                fromToken: toCoreToken(fromToken),
                toToken: toCoreToken(toToken),
                fromAmount,
                userAddress: fromAddress,
                recipientAddress,
                slippage: quote.slippage,
                isFeeOnTransfer: true,
                skipTax: options?.skipTax,
                onStatusUpdate: options?.onStatusUpdate,
                walletClient,
            });

            // An executor can RESOLVE with { success: false } (e.g.
            // CrossChainPreSwap bailing on a dust amount or a missing leg-2
            // route) instead of throwing. Don't paint that as a success.
            if (!result.success || !result.txHash) {
                const failure =
                    result.error instanceof Error
                        ? result.error
                        : new Error((result.error as any)?.message || 'Swap did not complete. Please try again.');
                options?.onStatusUpdate?.({
                    stage: 'failed',
                    message: formatErrorMessage(failure),
                    error: failure,
                });
                return { success: false, error: formatErrorMessage(failure) };
            }

            return { success: true, txHash: result.txHash };
        } catch (error: any) {
            console.error('[UnifiedSwapManager] Swap execution failed:', error);
            return { success: false, error: formatErrorMessage(error) };
        }
    }
}

export const unifiedSwapManager = new UnifiedSwapManager();
