
import { encodeFunctionData, getAddress, parseUnits, type Hex } from "viem";
import { relayService } from "../../relayService";
import { signerController } from "../../signer/SignerController";
import { ERC20_ABI, isNativeToken } from "../constants";
import { ExecuteSwapParams, SwapExecutionResult } from "../types";

// Cache for Relay approval proxy addresses per chain
const approvalProxyCache: Map<number, string> = new Map();

/**
 * Fetch the ApprovalProxy address for a chain from Relay API.
 * This is the contract that needs token approval for Relay swaps.
 */
async function getRelayApprovalProxy(chainId: number): Promise<string | null> {
    if (approvalProxyCache.has(chainId)) {
        return approvalProxyCache.get(chainId)!;
    }

    try {
        const response = await fetch('https://api.relay.link/chains');
        if (!response.ok) {
            console.warn('[RelayExecutor] Failed to fetch Relay chains:', response.status);
            return null;
        }

        const data = await response.json();
        const chains = data.chains || [];

        const chain = chains.find((c: any) => c.id === chainId);
        if (chain) {
            const approvalProxy = chain.contracts?.v3ApprovalProxy || chain.contracts?.approvalProxy;
            if (approvalProxy) {
                approvalProxyCache.set(chainId, approvalProxy);
                console.log(`[RelayExecutor] Found approval proxy for chain ${chainId}: ${approvalProxy}`);
                return approvalProxy;
            }
        }

        console.warn(`[RelayExecutor] No approval proxy found for chain ${chainId}`);
        return null;
    } catch (error) {
        console.error('[RelayExecutor] Error fetching Relay chains:', error);
        return null;
    }
}

export class RelayExecutor {
    private async getPublicClient(chainId: number) {
        return await signerController.getPublicClient(chainId);
    }

    /**
     * Executes a quote from Relay Protocol.
     * Mirrors the proven approach from tiwi-super-app:
     * 1. Fetch ApprovalProxy from Relay API
     * 2. Approve all unique spenders
     * 3. Manually execute each step/item via walletClient
     * 4. Wait for confirmation between steps
     */
    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        try {
            const { quote, fromAddress, fromToken, recipientAddress } = params;
            if (!quote.raw) {
                throw new Error("Missing Relay quote data. Please refresh the quote.");
            }

            console.log(`[RelayExecutor] Preparing Relay execution for ${fromToken.symbol} on chain ${fromToken.chainId}`);

            const walletClient = await signerController.getWalletClient(fromToken.chainId, fromAddress, { skipAuthorize: true });
            const publicClient = await this.getPublicClient(fromToken.chainId);

            // Re-sync chains to the SDK singleton right before execution
            relayService.ensureChains();

            const relayQuote = quote.raw;

            // ── 1. TOKEN APPROVAL (for non-native tokens) ──
            if (!isNativeToken(fromToken.address)) {
                const amountIn = parseUnits(params.fromAmount, fromToken.decimals || 18);

                // Collect ALL spender addresses that may need approval
                const spenderAddresses = new Set<string>();

                // Primary: Fetch the official ApprovalProxy from Relay API
                const approvalProxyAddress = await getRelayApprovalProxy(fromToken.chainId);
                if (approvalProxyAddress) {
                    spenderAddresses.add(approvalProxyAddress.toLowerCase());
                    console.log(`[RelayExecutor] Using Relay ApprovalProxy: ${approvalProxyAddress}`);
                }

                // Fallback: Also check addresses from quote steps
                for (const step of relayQuote.steps || []) {
                    for (const item of step.items || []) {
                        // Check for explicit approval address in quote response
                        if (item.data?.approvalAddress) {
                            spenderAddresses.add(item.data.approvalAddress.toLowerCase());
                        }
                        // Also add the target contract ('to') address
                        if (item.data?.to) {
                            spenderAddresses.add(item.data.to.toLowerCase());
                        }
                    }
                }

                console.log(`[RelayExecutor] Spenders to check: ${[...spenderAddresses].join(', ')}`);

                // Approve each unique spender that needs it
                for (const spender of spenderAddresses) {
                    try {
                        const allowance = await publicClient.readContract({
                            address: getAddress(fromToken.address),
                            abi: ERC20_ABI,
                            functionName: 'allowance',
                            args: [getAddress(fromAddress), getAddress(spender)],
                        }) as bigint;

                        console.log(`[RelayExecutor] Allowance for ${spender}: ${allowance.toString()}, needed: ${amountIn.toString()}`);

                        if (allowance < amountIn) {
                            console.log(`[RelayExecutor] Approving ${fromToken.symbol} for ${spender}...`);
                            const approveData = encodeFunctionData({
                                abi: ERC20_ABI,
                                functionName: 'approve',
                                args: [getAddress(spender), BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
                            });

                            const approveResult = await signerController.executeTransaction({
                                chainFamily: 'evm',
                                to: fromToken.address,
                                data: approveData,
                                chainId: fromToken.chainId,
                            }, fromAddress, { skipAuthorize: true });

                            if (approveResult.status !== 'success') {
                                return { success: false, error: "Token approval failed: " + approveResult.error };
                            }

                            // Wait for approval confirmation on-chain
                            if (approveResult.hash) {
                                try {
                                    await publicClient.waitForTransactionReceipt({ hash: approveResult.hash as Hex, timeout: 30000 });
                                    console.log(`[RelayExecutor] Approval confirmed for ${spender}`);
                                } catch {
                                    // Fallback: simple wait
                                    await new Promise(r => setTimeout(r, 3000));
                                }
                            } else {
                                await new Promise(r => setTimeout(r, 3000));
                            }
                        }
                    } catch (approvalError: any) {
                        console.error(`[RelayExecutor] Approval failed for ${spender}:`, approvalError.message);
                        return { success: false, error: `Token approval failed: ${approvalError.message}` };
                    }
                }
            }

            // ── 2. RELAY TRICK PATCHING & MANUAL STEP EXECUTION ──
            const steps = relayQuote.steps || [];
            const txHashes: string[] = [];

            console.log(`[RelayExecutor] Processing ${steps.length} steps`);

            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                console.log(`[RelayExecutor] Step ${i + 1}/${steps.length}: action=${step.action}, items=${step.items?.length || 0}`);

                if (!step.items || step.items.length === 0) continue;
                if (step.items.every((item: any) => item.status === 'completed')) continue;

                for (let j = 0; j < step.items.length; j++) {
                    const item = step.items[j];
                    if (item.status === 'completed') continue;

                    const tx = item.data;
                    if (!tx || typeof tx !== 'object') {
                        console.warn(`[RelayExecutor] Step[${i}].Item[${j}] has no data, skipping`);
                        continue;
                    }

                    // Apply Relay Trick: patch hex data for taxed swaps OR standard relay trick
                    const isTaxedSwap = relayQuote._isTaxedSwap;
                    const isRelayTrick = relayQuote._isRelayTrick;

                    if ((isTaxedSwap || isRelayTrick) && relayQuote._quoteAmount && relayQuote._originalAmount) {
                        const quoteAmount = relayQuote._quoteAmount;
                        const originalAmount = relayQuote._originalAmount;

                        const quoteHex = BigInt(quoteAmount).toString(16).padStart(64, '0').toLowerCase();
                        const originalHex = BigInt(originalAmount).toString(16).padStart(64, '0').toLowerCase();

                        // Patch hex data (use indexOf like super-app, not regex)
                        if (tx.data) {
                            const dataLower = String(tx.data).toLowerCase();
                            const index = dataLower.indexOf(quoteHex);
                            if (index !== -1) {
                                console.log(`[RelayExecutor] Applying Relay Trick: patching amount in data`);
                                tx.data = tx.data.slice(0, index) + originalHex + tx.data.slice(index + 64);
                            }
                        }

                        // Patch value if it matches
                        if (tx.value && BigInt(tx.value) === BigInt(quoteAmount)) {
                            console.log(`[RelayExecutor] Applying Relay Trick: patching amount in value`);
                            tx.value = originalAmount;
                        }
                    }

                    // Determine if this step is for Solana
                    const stepChainId = tx.chainId ? Number(tx.chainId) : Number(fromToken.chainId);
                    const isSolanaStep = stepChainId === 7565164 || stepChainId === 1399811149;

                    let hash: string;

                    if (isSolanaStep) {
                        // Solana transaction — Relay returns serialized tx in data field
                        // The data may be base64 encoded transaction, or in tx.transaction/tx.psbt
                        const solTxData = tx.data || tx.transaction || item.transaction || '';

                        if (!solTxData) {
                            console.warn(`[RelayExecutor] Step[${i}].Item[${j}] no Solana tx data found, dumping item keys:`, Object.keys(item), Object.keys(tx));
                            // Try to find the transaction data anywhere in the item
                            const fallbackData = JSON.stringify(item);
                            console.warn(`[RelayExecutor] Full item:`, fallbackData.slice(0, 500));
                            throw new Error('Relay did not provide Solana transaction data.');
                        }

                        console.log(`[RelayExecutor] Routing to Solana signer, data length: ${solTxData.length}`);
                        const result = await signerController.executeTransaction({
                            chainFamily: 'solana',
                            to: tx.to || '',
                            data: solTxData,
                            value: tx.value?.toString() || '0',
                            chainId: stepChainId,
                        }, fromAddress, { skipAuthorize: true });
                        if (result.status === 'failed') {
                            throw new Error(result.error || 'Solana transaction failed');
                        }
                        hash = result.hash;
                    } else {
                        // EVM transaction — must have 'to' address
                        if (!tx.to) {
                            console.error(`[RelayExecutor] Step[${i}].Item[${j}] missing "to" address`);
                            throw new Error('Relay did not provide valid transaction data.');
                        }

                        console.log(`[RelayExecutor] Sending EVM tx to ${tx.to}, value: ${tx.value || '0'}`);
                        hash = await walletClient.sendTransaction({
                            to: tx.to as `0x${string}`,
                            data: (tx.data || '0x') as `0x${string}`,
                            value: tx.value ? BigInt(tx.value) : BigInt(0),
                            chain: walletClient.chain,
                        } as any);
                    }

                    txHashes.push(hash);
                    console.log(`[RelayExecutor] Tx broadcast: ${hash}`);

                    // Wait for confirmation before next item (prevents TRANSFER_FROM_FAILED)
                    try {
                        await publicClient.waitForTransactionReceipt({
                            hash: hash as Hex,
                            timeout: 60000,
                        });
                        console.log(`[RelayExecutor] Tx confirmed: ${hash}`);
                    } catch (waitError: any) {
                        console.warn(`[RelayExecutor] Wait error for ${hash}:`, waitError.message);
                        // For intermediate steps, wait a bit extra as fallback
                        if (j < step.items.length - 1 || i < steps.length - 1) {
                            await new Promise(r => setTimeout(r, 2000));
                        }
                    }
                }
            }

            if (txHashes.length === 0) {
                throw new Error('No transactions were executed. Please ensure your wallet is connected and try again.');
            }

            console.log(`[RelayExecutor] Swap completed with ${txHashes.length} transaction(s)`);
            return {
                success: true,
                txHash: txHashes[0],
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
