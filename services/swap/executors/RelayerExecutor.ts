import { apiClient } from '../../apiClient';
import { signerController } from '../../signer/SignerController';
import { ExecuteSwapParams, SwapExecutionResult } from '../types';

/**
 * Relayer Executor handles swaps where the transaction is broadcasted by the Tiwi backend.
 * The user signs a payload (EIP-712 or raw tx) and we send it to the relayer endpoint.
 */
export class RelayerExecutor {
    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        const { fromAddress, quote } = params;

        try {
            // Since this is a mobile app with imported/local keys, clicking "Swap Tokens" is the authorization.
            // We skip additional biometric prompts inside the signer for a "direct" experience.
            const walletClient = await signerController.getWalletClient(params.fromToken.chainId, fromAddress, { skipAuthorize: true });

            // 1. Extract signature payload from quote
            // We prioritize EIP-712 typed data which is the protocol standard for relayers
            const eip712Data = quote.raw?.eip712 || quote.raw?.typedData || quote.raw?.data?.eip712;
            const quoteId = quote.quoteId || quote.raw?.quoteId || quote.raw?.id;

            console.log(`[RelayerExecutor] Direct Signing for Quote: ${quoteId}`);

            let signature: string;

            if (eip712Data) {
                // Direct EIP-712 Signature
                const { domain, types, message, primaryType } = eip712Data;
                signature = await walletClient.signTypedData({
                    domain,
                    types,
                    primaryType,
                    message,
                } as any);
            } else {
                // Direct Quote Authorization Signature
                // Sign the quote ID as a message for the relayer to authorize execution
                const authMessage = quoteId || `Tiwi Swap: ${params.fromAmount} ${params.fromToken.symbol} -> ${params.toToken.symbol}`;
                signature = await walletClient.signMessage({
                    message: authMessage,
                });
            }

            // 2. Submit signed authorization to relayer
            const result = await apiClient.executeRelayerSwap({
                signature,
                quoteId: quoteId,
                chainId: params.fromToken.chainId,
                fromAddress
            });

            if (result.success) {
                return { success: true, txHash: result.txHash };
            } else {
                return { success: false, error: result.error || "Relayer execution failed" };
            }

        } catch (error: any) {
            console.error("[RelayerExecutor] execution failed", error);
            return { success: false, error: error.message };
        }
    }
}
