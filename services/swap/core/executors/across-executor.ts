import { getAddress, type Address, Hex } from 'viem';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';

export class AcrossExecutor implements SwapRouterExecutor {
    canHandle(route: RouterRoute): boolean {
        return route.router === 'across';
    }

    async getSpenderAddress(route: RouterRoute): Promise<string | null> {
        if (route.router !== 'across') return null;

        const rawData = route.raw;
        if (!rawData) return null;

        // 1. Check if there's an explicit approval address in the approval transactions
        if (rawData.approvalTxns && Array.isArray(rawData.approvalTxns) && rawData.approvalTxns.length > 0) {
            // Usually across expects approval to the same contract as the swap
            return rawData.approvalTxns[0].to;
        }

        // 2. Fallback: use the 'to' address of the swap transaction
        if (rawData.swapTx && rawData.swapTx.to) {
            return rawData.swapTx.to;
        }

        return null;
    }

    async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, userAddress, onStatusUpdate, walletClient } = params;

        try {
            if (route.router !== 'across') {
                throw new SwapExecutionError('Invalid route provided', SwapErrorCode.INVALID_ROUTE, 'across');
            }

            if (!userAddress) {
                throw new SwapExecutionError('User address is required', SwapErrorCode.WALLET_NOT_CONNECTED, 'across');
            }

            let activeWallet = walletClient;
            if (!activeWallet) {
                const { getEVMWalletClient } = await import('../utils/wallet-helpers');
                activeWallet = await getEVMWalletClient(route.fromToken?.chainId || 1);
            }

            const rawData = route.raw;
            if (!rawData) {
                throw new SwapExecutionError('Quote data is missing', SwapErrorCode.INVALID_ROUTE, 'across');
            }

            const fromChainId = route.fromToken.chainId;
            const toChainId = route.toToken.chainId;
            const isCrossChain = fromChainId !== toChainId;

            console.log(`[AcrossExecutor] 🚀 Executing Across swap: chain ${fromChainId} -> ${toChainId}`);

            const txHashes: string[] = [];

            // Collect tax before swap
            const { collectEvmTax } = await import('../utils/evm-tax-helper');
            const { taxCollected, taxAmount } = await collectEvmTax(params, 'AcrossExecutor', onStatusUpdate);
            if (taxCollected) {
                console.log(`[AcrossExecutor] Tax of ${taxAmount} collected`);
            }

            // Execute approvals if returned by Across
            if (rawData.approvalTxns && Array.isArray(rawData.approvalTxns) && rawData.approvalTxns.length > 0) {
                onStatusUpdate?.({
                    stage: 'approving',
                    message: 'Approving...',
                    progress: 10
                });

                for (let i = 0; i < rawData.approvalTxns.length; i++) {
                    const approvalTxn = rawData.approvalTxns[i];
                    console.log(`[AcrossExecutor] Executing approval tx ${i + 1}/${rawData.approvalTxns.length}`);

                    const hash = await activeWallet.sendTransaction({
                        to: approvalTxn.to as Address,
                        data: (approvalTxn.data || '0x') as Hex,
                        value: approvalTxn.value ? BigInt(approvalTxn.value) : BigInt(0),
                    });

                    txHashes.push(hash);
                    console.log(`[AcrossExecutor] ✅ Approval tx broadcast: ${hash}`);
                }
            }

            // Execute main swap transaction
            const swapTx = rawData.swapTx;
            if (!swapTx || !swapTx.to) {
                throw new SwapExecutionError('Did not provide valid swapTx details', SwapErrorCode.INVALID_ROUTE, 'across');
            }

            onStatusUpdate?.({
                stage: 'signing',
                message: 'Confirming in wallet...',
                progress: 50
            });

            console.log(`[AcrossExecutor] Executing EVM tx to ${swapTx.to}, value: ${swapTx.value || '0'}`);

            const hash = await activeWallet.sendTransaction({
                to: swapTx.to as Address,
                data: (swapTx.data || '0x') as Hex,
                value: swapTx.value ? BigInt(swapTx.value) : BigInt(0),
            });

            txHashes.push(hash);
            console.log(`[AcrossExecutor] ✅ Swap tx broadcast: ${hash}`);

            onStatusUpdate?.({
                stage: 'confirming',
                message: isCrossChain ? 'Processing...' : 'Reviewing...',
                txHash: hash
            });

            return {
                success: true,
                txHash: hash, // return main swap tx hash
                txHashes,
            };

        } catch (error) {
            console.error('[AcrossExecutor] Execution error:', error);
            const swapError = createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'across');
            onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(swapError), error: swapError });
            throw swapError;
        }
    }
}
