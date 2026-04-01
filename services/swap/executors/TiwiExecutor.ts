import { signerController } from '@/services/signer/SignerController';
import { ExecuteSwapParams, SwapExecutionResult } from '../types';

const SOLANA_CHAIN_IDS = [7565164, 1399811149];

/**
 * TiwiExecutor
 * Handles transactions pre-built by the Tiwi Routing Engine (V1 SDK).
 * Supports both EVM and Solana chains.
 */
export class TiwiExecutor {
    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        const { quote, fromAddress, fromToken } = params;
        const txReq = (quote as any).transactionRequest;
        const rawData = (quote as any).raw;

        const chainId = Number(fromToken.chainId);
        const isSolana = SOLANA_CHAIN_IDS.includes(chainId);

        if (isSolana) {
            // Dump the entire quote structure to find where the tx data lives
            console.log('[TiwiExecutor] Solana quote keys:', Object.keys(quote));
            console.log('[TiwiExecutor] Solana quote.raw keys:', rawData ? Object.keys(rawData) : 'no raw');
            console.log('[TiwiExecutor] Solana quote.transactionRequest:', txReq ? Object.keys(txReq) : 'no txReq');
            if (rawData) {
                // Log all string values that could be transaction data
                for (const [k, v] of Object.entries(rawData)) {
                    if (typeof v === 'string' && v.length > 50) {
                        console.log(`[TiwiExecutor] raw.${k}: (${v.length} chars) ${v.slice(0, 80)}...`);
                    } else if (typeof v === 'object' && v !== null) {
                        console.log(`[TiwiExecutor] raw.${k}: object with keys:`, Object.keys(v));
                    }
                }
            }

            // Search for serialized transaction in multiple possible locations
            const solanaTransaction = rawData?.transaction
                || rawData?.swapTransaction
                || rawData?.serializedTransaction
                || rawData?.txn
                || rawData?.base64Transaction
                || txReq?.data
                || txReq?.transaction
                || (quote as any).transaction
                || (quote as any).swapTransaction;

            if (!solanaTransaction) {
                return {
                    success: false,
                    error: 'No Solana transaction data found in quote. Check logs for quote structure.',
                };
            }

            try {
                console.log('[TiwiExecutor] Executing Solana transaction via Jupiter');

                const result = await signerController.executeTransaction({
                    chainFamily: 'solana',
                    to: '',
                    data: solanaTransaction,
                    value: '0',
                    chainId: chainId,
                }, fromAddress);

                if (result.status === 'success') {
                    return { success: true, txHash: result.hash };
                } else {
                    return { success: false, error: result.error || 'Solana transaction failed' };
                }
            } catch (error: any) {
                console.warn('[TiwiExecutor] Solana execution failed:', error.message);
                return { success: false, error: error.message || 'Solana execution error' };
            }
        }

        // EVM flow
        if (!txReq) {
            return {
                success: false,
                error: 'No transaction request found in quote.',
            };
        }

        try {
            console.log('[TiwiExecutor] Executing EVM transaction request');

            const result = await signerController.executeTransaction({
                chainFamily: 'evm',
                to: txReq.to,
                data: txReq.data || '0x',
                value: txReq.value?.toString() || '0',
                chainId: chainId,
            }, fromAddress);

            if (result.status === 'success') {
                return { success: true, txHash: result.hash };
            } else {
                return { success: false, error: result.error || 'Transaction failed' };
            }
        } catch (error: any) {
            console.warn('[TiwiExecutor] EVM execution failed:', error.message);
            return { success: false, error: error.message || 'Tiwi execution error' };
        }
    }
}
