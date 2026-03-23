import { transactionService } from '@/services/transactionService';
import { ExecuteSwapParams, SwapExecutionResult } from '../types';

/**
 * TiwiExecutor
 * Handles transactions pre-built by the Tiwi Routing Engine (V1 SDK).
 * It expects a 'transactionRequest' object in the quote.
 */
export class TiwiExecutor {
    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        const { quote, fromAddress } = params;
        const txReq = (quote as any).transactionRequest;

        if (!txReq) {
            return {
                success: false,
                error: 'No transaction request found in quote for Tiwi execution.'
            };
        }

        try {
            console.log('[TiwiExecutor] Executing transaction request from SDK');

            // Format for transactionService
            const result = await transactionService.sendTransaction({
                to: txReq.to,
                data: txReq.data,
                value: txReq.value || '0',
                chainId: params.fromToken.chainId,
                from: fromAddress,
            });

            if (result.status === 'success') {
                return {
                    success: true,
                    txHash: result.hash,
                };
            } else {
                return {
                    success: false,
                    error: result.error || 'Transaction failed',
                };
            }
        } catch (error: any) {
            console.error('[TiwiExecutor] execution failed:', error);
            return {
                success: false,
                error: error.message || 'Tiwi execution error',
            };
        }
    }
}
