
import { type Address, Hex, parseUnits } from 'viem';
import { VersionedTransaction, PublicKey, TransactionMessage, TransactionInstruction, AddressLookupTableAccount } from '@solana/web3.js';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';
import { getSolanaWallet, getSolanaConnection } from '../utils/wallet-helpers';
import { base64ToBytes } from '../utils/base64';
import { getCachedPublicClient } from '@/services/swap/core/platform/viem-clients';
import { getAllowance, approveToken } from '@/services/swap/core/utils/allowance';

// Solana chain ID
const SOLANA_CHAIN_ID = 7565164;
// Relay's API reports Solana with its OWN chain id in step.chainId (not the app's 7565164).
// Both must count as "Solana" when deciding which steps to sign, or a non-Solana step's payload
// gets fed to atob() → "string to be decoded is not correctly encoded".
const RELAY_SOLANA_CHAIN_ID = 792703809;
const isSolanaStepChain = (id?: number): boolean => id === SOLANA_CHAIN_ID || id === RELAY_SOLANA_CHAIN_ID;

// Cache for Relay approval proxy addresses per chain
const approvalProxyCache: Map<number, string> = new Map();

/**
 * Fetch the ApprovalProxy address for a chain from Relay API
 * This is the contract that needs token approval for Relay swaps
 */
async function getRelayApprovalProxy(chainId: number): Promise<string | null> {
    // Check cache first
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

        // Find the chain and get its approval proxy
        const chain = chains.find((c: any) => c.id === chainId);
        if (chain) {
            // Prefer v3ApprovalProxy, fallback to approvalProxy
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

/**
 * Relay executor implementation
 */
export class RelayExecutor implements SwapRouterExecutor {
    /**
     * Check if this executor can handle the given route
     */
    canHandle(route: RouterRoute): boolean {
        return route.router === 'relay';
    }

    /**
     * Get the spender address for token approval if needed
     */
    async getSpenderAddress(route: RouterRoute): Promise<string | null> {
        if (route.router !== 'relay') return null;

        const fromChainId = route.fromToken.chainId;

        // Solana does not need ERC20 approval
        if (fromChainId === 7565164) return null;

        const relayQuote = route.raw;

        // 1. Check for explicit approval address in quote response (PRIORITY)
        for (const step of relayQuote?.steps || []) {
            for (const item of step.items || []) {
                if (item.data?.approvalAddress) {
                    return item.data.approvalAddress;
                }
            }
        }

        // 2. Try to get official proxy from Relay API
        const approvalProxyAddress = await getRelayApprovalProxy(fromChainId);
        if (approvalProxyAddress) return approvalProxyAddress;

        // 3. Final fallback: use 'to' address from first item
        for (const step of relayQuote?.steps || []) {
            for (const item of step.items || []) {
                if (item.data?.to) {
                    return item.data.to;
                }
            }
        }

        return null;
    }

    /**
     * Execute a swap using Relay
     */
    async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, userAddress, onStatusUpdate, walletClient } = params;

        try {
            if (route.router !== 'relay') {
                throw new SwapExecutionError('Invalid route provided', SwapErrorCode.INVALID_ROUTE, 'relay');
            }

            if (!userAddress) {
                throw new SwapExecutionError('User address is required', SwapErrorCode.WALLET_NOT_CONNECTED, 'relay');
            }

            const relayQuote = route.raw;
            if (!relayQuote || !relayQuote.steps) {
                throw new SwapExecutionError('Quote data missing steps', SwapErrorCode.INVALID_ROUTE, 'relay');
            }

            // Check if source chain is Solana
            const fromChainId = route.fromToken.chainId;
            const toChainId = route.toToken.chainId;
            const isCrossChain = fromChainId !== toChainId;
            const isSolanaSource = fromChainId === SOLANA_CHAIN_ID;
            const isSolanaDest = toChainId === SOLANA_CHAIN_ID;

            console.log(`[RelayExecutor] 🚀 Executing Relay swap: chain ${fromChainId} -> ${toChainId}`);
            console.log(`[RelayExecutor] Cross-chain: ${isCrossChain}, Solana source: ${isSolanaSource}, Solana dest: ${isSolanaDest}`);
            console.log(`[RelayExecutor] Steps: ${relayQuote.steps?.length || 0}`);

            // Solana SOURCE signs with a Solana wallet - branch BEFORE creating any EVM wallet
            // client, else getEVMWalletClient(7565164) throws "Chain 7565164 is not an EVM chain".
            if (isSolanaSource) {
                return this.executeSolanaSwap(params);
            }

            // EVM source: build the EVM wallet client now (Solana source already returned above).
            let activeWallet = walletClient;
            if (!activeWallet) {
                const { getEVMWalletClient } = await import('../utils/wallet-helpers');
                activeWallet = await getEVMWalletClient(fromChainId || 1);
            }

            // EVM execution path (handles EVM-only and EVM -> Solana cross-chain)
            onStatusUpdate?.({ stage: 'preparing', message: isCrossChain ? 'Preparing cross-chain swap...' : 'Preparing...' });

            // 1. Check and handle allowance first (Safety Net)
            // Relay multicall contracts require approval for the token being swapped
            const fromTokenAddress = route.fromToken.address;
            const isNative = !fromTokenAddress ||
                fromTokenAddress.toLowerCase() === '0x0000000000000000000000000000000000000000'.toLowerCase() ||
                fromTokenAddress.toLowerCase() === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase();

            if (!isNative) {
                // Get the correct ApprovalProxy address from Relay API
                // This is the contract that actually needs token approval for Relay swaps
                const approvalProxyAddress = await getRelayApprovalProxy(fromChainId);

                // Collect spender addresses: prioritize ApprovalProxy, fallback to transaction addresses
                const spenderAddresses = new Set<string>();

                // Primary: Use the official ApprovalProxy from Relay API
                if (approvalProxyAddress) {
                    spenderAddresses.add(approvalProxyAddress.toLowerCase());
                    console.log(`[RelayExecutor] Using Relay ApprovalProxy: ${approvalProxyAddress}`);
                }

                // Explicit approval address(es) from the quote steps (these are real spenders).
                for (const step of relayQuote.steps || []) {
                    for (const item of step.items || []) {
                        if (item.data?.approvalAddress) {
                            spenderAddresses.add(item.data.approvalAddress.toLowerCase());
                        }
                    }
                }

                // ONLY if no proper spender was found, fall back to the call targets ('to').
                // Previously we ALWAYS added every 'to' as a spender, which approved the token
                // to unrelated contracts (even the token itself) - a pile of redundant signatures.
                if (spenderAddresses.size === 0) {
                    for (const step of relayQuote.steps || []) {
                        for (const item of step.items || []) {
                            if (item.data?.to) spenderAddresses.add(item.data.to.toLowerCase());
                        }
                    }
                }

                // Use max uint256 for approval to avoid "SafeERC20: low-level call failed" errors
                const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
                const fromAmountWei = parseUnits(route.fromToken.amount, route.fromToken.decimals || 18);
                const publicClient = getCachedPublicClient(fromChainId);

                // Approve each unique spender that needs it
                for (const spenderAddress of spenderAddresses) {
                    try {
                        onStatusUpdate?.({ stage: 'approving', message: 'Checking allowance...' });
                        const currentAllowance = await getAllowance(fromChainId, fromTokenAddress, userAddress, spenderAddress);

                        if (currentAllowance < fromAmountWei) {
                            console.log(`[RelayExecutor] 🔓 Approving ${spenderAddress} for token ${fromTokenAddress}`);
                            onStatusUpdate?.({ stage: 'approving', message: 'Approving Relay to use your tokens...' });

                            // Approve max uint256 for better compatibility with Relay multicall
                            const approveTx = await approveToken(activeWallet, fromTokenAddress, spenderAddress, maxApproval);
                            onStatusUpdate?.({ stage: 'approving', message: 'Waiting for approval...' });
                            await publicClient.waitForTransactionReceipt({ hash: approveTx });
                            console.log(`[RelayExecutor] ✅ Approval confirmed for ${spenderAddress}`);
                        } else {
                            console.log(`[RelayExecutor] ✅ Already approved for ${spenderAddress}`);
                        }
                    } catch (approvalError: any) {
                        console.error(`[RelayExecutor] ❌ Approval failed for ${spenderAddress}:`, approvalError.message);
                        throw new SwapExecutionError(
                            `Token approval failed: ${approvalError.message}`,
                            SwapErrorCode.APPROVAL_REJECTED,
                            'relay'
                        );
                    }
                }
            }

            // Collect tax before swap
            const { collectEvmTax } = await import('../utils/evm-tax-helper');
            const { taxCollected, taxAmount } = await collectEvmTax(params, 'RelayExecutor', onStatusUpdate);
            if (taxCollected) {
                console.log(`[RelayExecutor] Tax of ${taxAmount} collected`);
            }

            const txHashes: string[] = [];
            const steps = relayQuote.steps;

            console.log(`[RelayExecutor] Processing ${steps.length} EVM steps`);
            console.log(`[RelayExecutor] Steps data:`, JSON.stringify(steps, null, 2).slice(0, 1500));

            if (!steps || steps.length === 0) {
                throw new SwapExecutionError(
                    'No steps returned for this swap. The bridge may not support this route.',
                    SwapErrorCode.INVALID_ROUTE,
                    'relay'
                );
            }

            // Iteratively execute steps
            const publicClient = getCachedPublicClient(fromChainId);

            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];

                console.log(`[RelayExecutor] EVM Step ${i + 1}/${steps.length}:`, {
                    id: step.id,
                    action: step.action,
                    description: step.description,
                    itemsCount: step.items?.length || 0,
                });

                if (!step.items || step.items.length === 0) {
                    console.warn(`[RelayExecutor] EVM Step ${i + 1} has no items`);
                    continue;
                }

                // Skip completed items (if status already exists)
                if (step.items?.every((item: any) => item.status === 'completed')) {
                    console.log(`[RelayExecutor] EVM Step ${i + 1} already completed`);
                    continue;
                }

                onStatusUpdate?.({
                    stage: 'signing',
                    message: 'Confirming in wallet...',
                    progress: (i / steps.length) * 100
                });

                for (let j = 0; j < step.items.length; j++) {
                    const item = step.items[j];

                    console.log(`[RelayExecutor] EVM Item ${j + 1}/${step.items.length}:`, {
                        status: item.status,
                        hasData: !!item.data,
                        dataType: typeof item.data,
                    });

                    if (item.status === 'completed') continue;

                    // Relay v2 response has transaction data nested in item.data object
                    const txData = item.data;
                    if (txData && typeof txData === 'object') {
                        // Extract transaction fields from nested data object
                        const tx = txData as { to?: string; data?: string; value?: string; from?: string };

                        // Apply Relay Trick patching if it's a taxed swap
                        if (relayQuote._isTaxedSwap && relayQuote._quoteAmount && relayQuote._originalAmount) {
                            const quoteAmount = relayQuote._quoteAmount;
                            const originalAmount = relayQuote._originalAmount;

                            // Patch hex data: replace 95% amount with 100%
                            const quoteHex = BigInt(quoteAmount).toString(16).padStart(64, '0').toLowerCase();
                            const originalHex = BigInt(originalAmount).toString(16).padStart(64, '0').toLowerCase();

                            if (tx.data) {
                                const dataLower = tx.data.toLowerCase();
                                const index = dataLower.indexOf(quoteHex);
                                if (index !== -1) {
                                    console.log(`[RelayExecutor] 🧙‍♂️ Applying Relay Trick: patching amount in data`);
                                    tx.data = (tx.data.slice(0, index) + originalHex + tx.data.slice(index + 64)) as Hex;
                                }
                            }

                            // Also patch value if it matches
                            if (tx.value && BigInt(tx.value) === BigInt(quoteAmount)) {
                                console.log(`[RelayExecutor] 🧙‍♂️ Applying Relay Trick: patching amount in value`);
                                tx.value = originalAmount;
                            }
                        }

                        if (!tx.to) {
                            console.error('[RelayExecutor] EVM Step item missing "to" address:', {
                                itemKeys: Object.keys(item),
                                dataKeys: Object.keys(txData),
                            });
                            throw new SwapExecutionError(
                                'Relay did not provide valid transaction data.',
                                SwapErrorCode.INVALID_ROUTE,
                                'relay'
                            );
                        }

                        console.log(`[RelayExecutor] Executing EVM tx to ${tx.to}, value: ${tx.value || '0'}`);

                        // Execute transaction
                        const hash = await activeWallet.sendTransaction({
                            to: tx.to as Address,
                            data: (tx.data || '0x') as Hex,
                            value: tx.value ? BigInt(tx.value) : BigInt(0),
                        });

                        txHashes.push(hash);
                        console.log(`[RelayExecutor] ✅ EVM tx broadcast: ${hash}`);

                        onStatusUpdate?.({
                            stage: 'confirming',
                            message: 'Reviewing...',
                            txHash: hash
                        });

                        // ✅ CRITICAL: Wait for each transaction to be confirmed before moving to the next item
                        // This prevents "Simulation Failed (TRANSFER_FROM_FAILED)" in subsequent items
                        try {
                            await publicClient.waitForTransactionReceipt({
                                hash: hash as Hex,
                                timeout: 60000
                            });
                            console.log(`[RelayExecutor] ✅ EVM tx confirmed: ${hash}`);
                        } catch (waitError: any) {
                            console.warn(`[RelayExecutor] Wait error for ${hash}:`, waitError.message);
                            // If it's just a timeout, we might want to continue if it's the last item,
                            // but for Relay we usually need consecutive confirmations.
                            if (j < step.items.length - 1 || i < steps.length - 1) {
                                // For intermediate steps, we really need the confirmation
                                // However, if it's cross-chain, sometimes Relay returns early.
                                // We'll wait a bit extra just in case
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            }
                        }
                    } else {
                        console.warn('[RelayExecutor] EVM item has no data or data is not an object:', typeof txData);
                    }
                }
            }

            // CRITICAL: Ensure at least one transaction was executed
            if (txHashes.length === 0) {
                console.error('[RelayExecutor] ❌ No EVM transactions were executed!');
                throw new SwapExecutionError(
                    'No transactions were executed. Please ensure your wallet is connected and try again.',
                    SwapErrorCode.EXECUTION_FAILED,
                    'relay'
                );
            }

            console.log(`[RelayExecutor] ✅ EVM swap completed with ${txHashes.length} transaction(s)`);
            return {
                success: true,
                txHash: txHashes[0],
                txHashes,
            };

        } catch (error) {
            console.error('[RelayExecutor] Execution error:', error);
            const swapError = createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'relay');
            onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(swapError), error: swapError });
            throw swapError;
        }
    }

    /**
     * Execute swap for Solana source chain
     */
    private async executeSolanaSwap(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, onStatusUpdate } = params;
        const relayQuote = route.raw;

        try {
            onStatusUpdate?.({ stage: 'preparing', message: 'Preparing Solana transaction...' });

            const wallet = await getSolanaWallet();
            const connection = await getSolanaConnection();

            if (!wallet.isConnected || !wallet.publicKey) {
                throw new SwapExecutionError(
                    'Solana wallet not connected',
                    SwapErrorCode.WALLET_NOT_CONNECTED,
                    'relay'
                );
            }

            const txHashes: string[] = [];
            const steps = relayQuote.steps || [];

            console.log(`[RelayExecutor] Processing ${steps.length} steps for Solana swap`);
            console.log(`[RelayExecutor] Raw steps data:`, JSON.stringify(steps, null, 2).slice(0, 1500));

            if (steps.length === 0) {
                throw new SwapExecutionError(
                    'Relay returned no steps for this swap. The bridge may not support this route.',
                    SwapErrorCode.INVALID_ROUTE,
                    'relay-solana'
                );
            }

            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                console.log(`[RelayExecutor] Step ${i + 1}/${steps.length}:`, {
                    id: step.id,
                    action: step.action,
                    description: step.description,
                    itemsCount: step.items?.length || 0,
                    chainId: step.chainId,
                });

                // Skip steps for non-Solana chains (the bridge settles the destination). Recognize
                // BOTH the app's Solana id and Relay's own Solana id so real Solana steps aren't
                // skipped and non-Solana payloads never reach the Solana tx decoder.
                if (step.chainId && !isSolanaStepChain(step.chainId)) {
                    console.log(`[RelayExecutor] Skipping step ${i + 1} - destination chain step (chainId: ${step.chainId}), bridge handles automatically`);
                    continue;
                }

                if (!step.items || step.items.length === 0) {
                    console.warn(`[RelayExecutor] Step ${i + 1} has no items`);
                    continue;
                }

                if (step.items?.every((item: any) => item.status === 'completed')) {
                    console.log(`[RelayExecutor] Step ${i + 1} already completed`);
                    continue;
                }

                onStatusUpdate?.({
                    stage: 'signing',
                    message: 'Confirming in wallet...',
                    progress: (i / steps.length) * 100
                });

                for (let j = 0; j < step.items.length; j++) {
                    const item = step.items[j];
                    console.log(`[RelayExecutor] Item ${j + 1}/${step.items.length}:`, {
                        status: item.status,
                        hasData: !!item.data,
                        dataType: typeof item.data,
                        hasTransaction: !!item.transaction,
                    });

                    if (item.status === 'completed') continue;

                    // Relay returns Solana transactions as base64 encoded
                    // In v2 response, transaction might be in various locations
                    let txBase64: string | undefined;

                    // Try different possible locations for transaction data
                    if (typeof item.data === 'string') {
                        txBase64 = item.data;
                    } else if (typeof item.data === 'object' && item.data) {
                        const dataObj = item.data as any;
                        // Check various possible field names
                        txBase64 = dataObj.transaction || dataObj.tx || dataObj.serializedTransaction || dataObj.signedTransaction;

                        // Log the actual structure for debugging
                        if (!txBase64) {
                            console.log(`[RelayExecutor] item.data object keys:`, Object.keys(dataObj));
                        }
                    }

                    // Also check direct item properties
                    if (!txBase64) {
                        txBase64 = item.transaction || item.tx || item.serializedTransaction;
                    }

                    let transaction: VersionedTransaction;

                    if (txBase64 && !txBase64.trim().startsWith('0x')) {
                        console.log(`[RelayExecutor] Found transaction data (${txBase64.length} chars), decoding...`);

                        // Lenient decode (URL-safe/padding tolerant). If this item isn't actually a
                        // Solana tx (e.g. a stray non-Solana payload), skip it rather than crash the swap.
                        try {
                            transaction = VersionedTransaction.deserialize(base64ToBytes(txBase64));
                        } catch (decodeErr) {
                            console.warn(`[RelayExecutor] Item ${j + 1} is not a decodable Solana tx, skipping:`, decodeErr);
                            continue;
                        }
                    } else if (item.data && Array.isArray((item.data as any).instructions)) {
                        console.log(`[RelayExecutor] Found instructions array, building VersionedTransaction manually...`);
                        const dataObj = item.data as any;
                        const ixs = dataObj.instructions.map((ix: any) => new TransactionInstruction({
                            programId: new PublicKey(ix.programId),
                            keys: ix.keys.map((k: any) => ({
                                pubkey: new PublicKey(k.pubkey),
                                isSigner: k.isSigner,
                                isWritable: k.isWritable
                            })),
                            data: Buffer.from(ix.data, 'hex')
                        }));

                        const lutAddresses = dataObj.addressLookupTableAddresses || [];
                        const lookups: AddressLookupTableAccount[] = [];
                        for (const addr of lutAddresses) {
                            const accInfo = await connection.getAddressLookupTable(new PublicKey(addr));
                            if (accInfo.value) lookups.push(accInfo.value);
                        }

                        const { blockhash } = await connection.getLatestBlockhash('confirmed');
                        const messageV0 = new TransactionMessage({
                            payerKey: wallet.publicKey,
                            recentBlockhash: blockhash,
                            instructions: ixs
                        }).compileToV0Message(lookups);

                        transaction = new VersionedTransaction(messageV0);
                    } else {
                        // Check if this is an EVM-style transaction (for cross-chain, bridge handles EVM side)
                        const dataObj = item.data as any;
                        if (dataObj && typeof dataObj === 'object' && (dataObj.to || dataObj.chainId)) {
                            // This is an EVM step - bridge handles this automatically, skip with log
                            console.log(`[RelayExecutor] Skipping EVM step (bridge handles destination chain): chainId=${dataObj.chainId}, to=${dataObj.to}`);
                            continue;
                        }

                        console.error('[RelayExecutor] Could not find transaction data in item:', {
                            itemKeys: Object.keys(item),
                            dataType: typeof item.data,
                            dataKeys: item.data && typeof item.data === 'object' ? Object.keys(item.data) : 'N/A',
                            itemSample: JSON.stringify(item).slice(0, 500),
                        });
                        throw new SwapExecutionError(
                            'Relay did not provide Solana transaction data. Please try a different token pair or try again later.',
                            SwapErrorCode.INVALID_ROUTE,
                            'relay-solana'
                        );
                    }

                    onStatusUpdate?.({
                        stage: 'signing',
                        message: 'Confirming in wallet...'
                    });

                    console.log('[RelayExecutor] Requesting wallet signature...');
                    const signedTx = await wallet.signTransaction(transaction);
                    console.log('[RelayExecutor] Transaction signed, broadcasting...');

                    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
                        skipPreflight: true,
                        maxRetries: 5
                    });

                    txHashes.push(signature);
                    console.log(`[RelayExecutor] ✅ Solana tx broadcast: ${signature}`);

                    onStatusUpdate?.({
                        stage: 'confirming',
                        message: 'Reviewing...',
                        txHash: signature
                    });

                    // For cross-chain swaps, don't block on confirmation - bridge monitors the tx
                    // Just do a quick check (10s timeout) to catch immediate failures
                    const isCrossChainSwap = route.fromToken.chainId !== route.toToken.chainId;

                    if (isCrossChainSwap) {
                        console.log(`[RelayExecutor] Cross-chain swap - not blocking on confirmation, bridge handles it`);
                        // Quick status check with timeout (don't block)
                        try {
                            const status = await Promise.race([
                                connection.getSignatureStatus(signature),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
                            ]) as any;

                            if (status?.value?.err) {
                                throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
                            }
                            console.log(`[RelayExecutor] ✅ Solana tx status: ${status?.value?.confirmationStatus || 'pending'}`);
                        } catch (statusError: any) {
                            if (statusError.message !== 'timeout') {
                                console.warn(`[RelayExecutor] Status check error (non-fatal):`, statusError.message);
                            }
                            // Continue anyway - bridge will handle confirmation
                        }
                    } else {
                        // Same-chain swap - wait for confirmation with timeout
                        try {
                            const latestBlockhash = await connection.getLatestBlockhash('confirmed');
                            const confirmation = await Promise.race([
                                connection.confirmTransaction({
                                    signature,
                                    blockhash: latestBlockhash.blockhash,
                                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                                }, 'confirmed'),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('Confirmation timeout')), 60000))
                            ]) as any;

                            if (confirmation?.value?.err) {
                                throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
                            }
                            console.log(`[RelayExecutor] ✅ Solana tx confirmed: ${signature}`);
                        } catch (confirmError: any) {
                            // For same-chain, log but don't fail if tx was broadcast
                            console.warn(`[RelayExecutor] Confirmation issue (tx was broadcast): ${confirmError.message}`);
                        }
                    }
                }
            }

            // CRITICAL: Ensure at least one transaction was executed
            if (txHashes.length === 0) {
                console.error('[RelayExecutor] ❌ No Solana transactions were executed!');
                throw new SwapExecutionError(
                    'No transactions were executed. Please ensure your Solana wallet is connected and try again.',
                    SwapErrorCode.EXECUTION_FAILED,
                    'relay-solana'
                );
            }

            console.log(`[RelayExecutor] ✅ Solana swap completed with ${txHashes.length} transaction(s)`);
            return {
                success: true,
                txHash: txHashes[0],
                txHashes,
            };

        } catch (error: any) {
            console.error('[RelayExecutor] Solana execution error:', error);
            throw createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'relay-solana');
        }
    }
}
