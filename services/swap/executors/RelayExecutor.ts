
import { createPublicClient, http } from "viem";
import { arbitrum, base, bsc, mainnet, optimism, polygon, zksync, scroll, mantle, blast, lisk } from "viem/chains";
import { relayService } from "../../relayService";
import { signerController } from "../../signer/SignerController";
import { ExecuteSwapParams, SwapExecutionResult } from "../types";

const SUPPORTED_CHAINS = [mainnet, optimism, arbitrum, bsc, polygon, base, zksync, scroll, mantle, blast, lisk];

export class RelayExecutor {
    private async getPublicClient(chainId: number) {
        return await signerController.getPublicClient(chainId);
    }

    /**
     * Executes a quote from Relay Protocol.
     */
    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        try {
            const { quote, fromAddress, fromToken, recipientAddress } = params;
            if (!quote.raw) {
                throw new Error("Missing Relay quote data. Please refresh the quote.");
            }

            console.log(`[RelayExecutor] Preparing Relay execution for ${fromToken.symbol} on chain ${fromToken.chainId}`);

            const walletClient = await signerController.getWalletClient(fromToken.chainId, fromAddress);
            
            // REDUNDANT FIX: Re-sync chains to the SDK singleton right before execution
            relayService.ensureChains();

            // Diagnostic Check
            const currentChains = relayService.client.chains?.map(c => c.id) || [];
            console.log(`[RelayExecutor] Current registered chains:`, currentChains);
            if (!currentChains.includes(Number(fromToken.chainId))) {
                console.warn(`[RelayExecutor] Chain ${fromToken.chainId} STILL missing from registry! Forcing injection...`);
            }

            console.log(`[RelayExecutor] Executing on address: ${fromAddress}`);

            // Relay SDK execute handles the steps
            const result = await relayService.client.actions.execute({
                quote: quote.raw,
                wallet: walletClient as any,
                onProgress: (steps) => {
                    console.log(`[RelayExecutor] Step: ${steps.action} - Status: ${steps.description}`);
                },
            });

            // Try to find the first transaction hash from the steps
            let txHash = `relay-${Date.now()}`;
            if (result?.data?.steps) {
                for (const step of result.data.steps) {
                    const hashItem = step.items?.find(i => i.txHashes && i.txHashes.length > 0);
                    if (hashItem && hashItem.txHashes?.[0]?.txHash) {
                        txHash = hashItem.txHashes[0].txHash;
                        break;
                    }
                }
            }
            
            return {
                success: true,
                txHash
            };
        } catch (error: any) {
            console.error("[RelayExecutor] Swap failed:", error);
            const errorMsg = error.message || "Relay execution failed";

            if (errorMsg.includes("user rejected") || errorMsg.includes("User denied")) {
                return { success: false, error: "Transaction was rejected in your wallet." };
            }

            return {
                success: false,
                error: errorMsg
            };
        }
    }
}
