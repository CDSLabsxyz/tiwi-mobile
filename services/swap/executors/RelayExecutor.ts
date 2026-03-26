
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
            const relayQuote = quote.raw;

            // RELAY TRICK: Surgical Patching 
            // We search the hex data for the 98% quote amount and replace it with the 100% original amount.
            // This prevents "Return amount is not enough" errors because the minAmountOut was based on 98%.
            if (relayQuote._isRelayTrick && relayQuote._quoteAmount && relayQuote._originalAmount) {
                const quoteAmount = relayQuote._quoteAmount;
                const originalAmount = relayQuote._originalAmount;

                const quoteHex = BigInt(quoteAmount).toString(16).padStart(64, '0').toLowerCase();
                const originalHex = BigInt(originalAmount).toString(16).padStart(64, '0').toLowerCase();

                console.log(`[RelayExecutor] 🧙‍♂️ Applying Relay Trick Patching (${quoteAmount} -> ${originalAmount})`);

                let patchCount = 0;

                // Iterate through steps and items to find and patch the amount in tx data
                relayQuote.steps?.forEach((step: any) => {
                    step.items?.forEach((item: any) => {
                        const tx = item.data;
                        if (tx && typeof tx === 'object') {
                            // 1. Patch hex data
                            if (tx.data) {
                                let dataStr = String(tx.data).toLowerCase();
                                // We use a Global regex for the hex amount to catch it if it appears multiple times
                                const regex = new RegExp(quoteHex, 'g');
                                if (regex.test(dataStr)) {
                                    tx.data = dataStr.replace(regex, originalHex);
                                    patchCount++;
                                    console.log(`[RelayExecutor] 🩹 Patched hex data globally`);
                                }
                            }
                            // 2. Patch value if it matches the quote
                            if (tx.value && BigInt(tx.value) === BigInt(quoteAmount)) {
                                console.log(`[RelayExecutor] 🩹 Patched amount in transaction value`);
                                tx.value = originalAmount;
                            }
                        }
                    });
                });

                if (patchCount === 0) {
                    console.warn(`[RelayExecutor] ⚠️ Relay Trick patch attempted but NO matching amount found in tx data!`);
                    const sample = relayQuote.steps?.[0]?.items?.[0]?.data?.data;
                    if (sample) console.log(`[RelayExecutor] Sample Hex: ${String(sample).slice(0, 74)}...`);
                } else {
                    console.log(`[RelayExecutor] ✅ Successfully applied ${patchCount} patches.`);
                }

                // Also update the display amount in the quote metadata (for SDK simulation)
                if (relayQuote.details?.currencyIn) {
                    relayQuote.details.currencyIn.amount = originalAmount;
                }
            }

            const result = await relayService.client.actions.execute({
                quote: relayQuote,
                wallet: walletClient as any,
                onProgress: (progress) => {
                    const action = progress.currentStep?.action || 'Processing';
                    const description = progress.currentStep?.description || 'Wait a moment...';
                    console.log(`[RelayExecutor] Step: ${action} - Status: ${description}`);
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
