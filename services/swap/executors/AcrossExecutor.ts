
import { createPublicClient, http } from "viem";
import { arbitrum, base, bsc, mainnet, optimism, polygon, zksync, scroll, mantle, blast, lisk } from "viem/chains";
import { acrossService } from "../../acrossService";
import { signerController } from "../../signer/SignerController";
import { ExecuteSwapParams, SwapExecutionResult } from "../types";

const SUPPORTED_CHAINS = [mainnet, optimism, arbitrum, bsc, polygon, base, zksync, scroll, mantle, blast, lisk];

export class AcrossExecutor {
    private async getPublicClient(chainId: number) {
        return await signerController.getPublicClient(chainId);
    }

    /**
     * Executes a quote from Across Protocol.
     * This follows the intent-based flow: 
     * 1. Check/Approve SpokePool to spend input tokens
     * 2. Deposit funds into the SpokePool
     */
    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        try {
            const { quote, fromAddress, fromToken, toToken } = params;
            if (!quote.raw) {
                throw new Error("Missing Across quote data. Please refresh the quote.");
            }

            console.log(`[AcrossExecutor] Preparing Across execution for ${fromToken.symbol} on chain ${fromToken.chainId}`);

            const walletClient = await signerController.getWalletClient(fromToken.chainId, fromAddress, { skipAuthorize: true });
            const originClient = await this.getPublicClient(fromToken.chainId);
            const destinationClient = await this.getPublicClient(toToken.chainId);

            let txHash: string | undefined;

            console.log(`[AcrossExecutor] Executing on address: ${fromAddress}`);
            console.log(`[AcrossExecutor] To: ${quote.txTo || 'N/A'}, Value: ${quote.txValue || '0'}`);

            // Across distinguishes between "Swap Quotes" (aggregator + bridge) 
            // and "Basic Quotes" (pure bridge intents).

            // Check if it's a swap quote (has steps or is from getSwapQuote)
            const isSwapQuote = !!(quote.raw.steps || quote.raw.tx);

            if (isSwapQuote) {
                console.log("[AcrossExecutor] Executing Swap Quote (Aggregator + Bridge)...");
                const response = await acrossService.client.executeSwapQuote({
                    swapQuote: quote.raw,
                    walletClient: walletClient as any,
                    originClient: originClient as any,
                    destinationClient: destinationClient as any,
                    onProgress: (p) => console.log(`[AcrossExecutor] Progress: ${p.step} - ${p.status}`),
                });
                txHash = response.swapTxReceipt?.transactionHash;
            } else {
                console.log("[AcrossExecutor] Executing Basic Quote (Bridge Intent)...");
                const response = await acrossService.client.executeQuote({
                    deposit: quote.raw.deposit,
                    walletClient: walletClient as any,
                    originClient: originClient as any,
                    destinationClient: destinationClient as any,
                    onProgress: (p) => console.log(`[AcrossExecutor] Progress: ${p.step} - ${p.status}`),
                });
                txHash = response.depositTxReceipt?.transactionHash;
            }

            if (!txHash) {
                throw new Error("Transaction was sent but no hash was returned. Please check your activity tab.");
            }

            console.log("[AcrossExecutor] Execution successful:", txHash);

            return {
                success: true,
                txHash
            };
        } catch (error: any) {
            console.error("[AcrossExecutor] Swap failed:", error);
            const errorMsg = error.message || "Across execution failed";

            if (errorMsg.includes("user rejected") || errorMsg.includes("User denied")) {
                return { success: false, error: "Transaction was rejected in your wallet." };
            }

            if (errorMsg.includes("amount of gas") || errorMsg.includes("gas limit")) {
                return {
                    success: false,
                    error: "Gas estimation failed. Ensure you have enough BNB/ETH for gas and that your swap amount is valid."
                };
            }

            return {
                success: false,
                error: errorMsg
            };
        }
    }
}
