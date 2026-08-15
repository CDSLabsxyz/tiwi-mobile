
import { getAddress, type Address, Hex, Hash } from 'viem';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor, SwapExecutionStatus } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';
import { getTONWallet, getSolanaWallet, getSolanaConnection } from '../utils/wallet-helpers';
import { base64ToBytes } from '../utils/base64';
import { VersionedTransaction } from '@solana/web3.js';
import { apiUrl } from '@/services/swap/core/platform/api-base';

/**
 * Rubic executor implementation
 */
export class RubicExecutor implements SwapRouterExecutor {
    /**
     * Check if this executor can handle the given route
     */
    canHandle(route: RouterRoute): boolean {
        return route.router === 'rubic';
    }

    /**
     * Get the spender address for token approval if needed
     */
    async getSpenderAddress(route: RouterRoute): Promise<string | null> {
        if (route.router !== 'rubic') return null;

        const trade = route.raw;
        if (!trade) return null;

        // Rubic provides approvalAddress or contractAddress
        return trade.approvalAddress || trade.contractAddress || null;
    }

    /**
     * Execute a swap using Rubic
     */
    async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, userAddress, recipientAddress, onStatusUpdate, walletClient } = params;

        try {
            if (route.router !== 'rubic') {
                throw new SwapExecutionError('Invalid route provided', SwapErrorCode.INVALID_ROUTE, 'rubic');
            }

            if (!userAddress) {
                throw new SwapExecutionError('User address is required', SwapErrorCode.WALLET_NOT_CONNECTED, 'rubic');
            }

            const trade = route.raw;
            if (!trade) {
                throw new SwapExecutionError('Trade data missing', SwapErrorCode.INVALID_ROUTE, 'rubic');
            }

            const fromChainId = route.fromToken.chainId;
            const toChainId = route.toToken.chainId;
            const isCrossChain = fromChainId !== toChainId;

            onStatusUpdate?.({ stage: 'preparing', message: 'Preparing trade...' });

            // Handle based on chain type
            // For now, let's focus on EVM. If it's TRON or Solana, we'd need different logic.
            const fromChain = route.fromToken.chainId;

            // Check if it's EVM (most common)
            // Standard EVM chains are numeric. Solana/TRON might have string IDs or very large ones in our registry.
            // In our registry: Solana is 7565164, TON is 1100, TRON is 728126428, Cosmos Hub is 118.

            if (fromChain === 7565164) {
                // Solana execution
                return this.executeSolanaTrade(params);
            } else if (fromChain === 728126428) {
                // TRON execution
                return this.executeTronTrade(params);
            } else if (fromChain === 1100) {
                // TON execution
                return this.executeTonTrade(params);
            }

            // Default to EVM
            return this.executeEVMTrade(params);

        } catch (error) {
            console.error('[RubicExecutor] Execution error:', error);
            const swapError = createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'rubic');
            onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(swapError), error: swapError });
            throw swapError;
        }
    }

    /**
     * Fetch the signable swap transaction from Rubic's /routes/swap endpoint.
     *
     * Replays the exact normalized request the adapter stored on `trade.rubicSwapRequest`
     * (correct blockchain names, native-token addresses, and HUMAN-readable amount) so the
     * built tx matches the quote the user was shown. Falls back to legacy top-level fields
     * for older cached routes.
     */
    /**
     * True only when `trade` already holds an executable transaction. Rubic's /quoteBest returns
     * `transaction: {}` (an empty but TRUTHY object) - the real calldata/serialized tx (`.data`)
     * arrives only from /routes/swap. A plain `!trade.transaction` check misses the empty object
     * and skips the swap fetch, leaving nothing to sign.
     */
    private hasTxData(trade: any): boolean {
        const t = trade?.transaction ?? trade?.tx;
        if (typeof t === 'string') return t.length > 0;
        return !!(t && (t.data || t.serializedTransaction || t.transaction || t.to));
    }

    /**
     * Ensure the wallet's wSOL ATA holds at least `fromAmount` SOL before a Rubic Solana swap.
     * Rubic accepts only the wSOL mint for Solana native and does NOT wrap - so a native-SOL wallet
     * must wrap first, else the embedded Jupiter swap fails with InsufficientFunds (6024). Sends one
     * wrap tx (create ATA + transfer lamports + syncNative). Skips if the wallet already has enough.
     */
    private async ensureWrappedSol(
        connection: any,
        wallet: any,
        fromAmount: string | undefined,
        route: RouterRoute,
        onStatusUpdate?: (s: SwapExecutionStatus) => void,
    ): Promise<void> {
        if (route.fromToken.chainId !== 7565164) return; // Solana source only
        const addr = String(route.fromToken.address || '').toLowerCase();
        const NATIVE_MARKERS = ['', 'native', '11111111111111111111111111111111', 'so11111111111111111111111111111111111111112'];
        if (!NATIVE_MARKERS.includes(addr)) return; // an SPL token (already has its own ATA) - nothing to wrap

        const { Transaction, SystemProgram } = await import('@solana/web3.js');
        const { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createSyncNativeInstruction, getAccount, NATIVE_MINT } = await import('@solana/spl-token');
        const owner = wallet.publicKey;
        const wsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, owner);
        const needed = BigInt(Math.round(parseFloat(String(fromAmount || '0')) * 1e9)); // SOL → lamports
        if (needed <= BigInt(0)) return;

        let have = BigInt(0);
        try { have = (await getAccount(connection, wsolAta)).amount; } catch { /* no wSOL ATA yet */ }
        if (have >= needed) return; // already wrapped enough

        onStatusUpdate?.({ stage: 'signing', message: 'Wrapping SOL for the swap...' });
        const tx = new Transaction().add(
            createAssociatedTokenAccountIdempotentInstruction(owner, wsolAta, owner, NATIVE_MINT),
            SystemProgram.transfer({ fromPubkey: owner, toPubkey: wsolAta, lamports: needed - have }),
            createSyncNativeInstruction(wsolAta),
        );
        tx.feePayer = owner;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        const signed = await wallet.signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(sig, 'confirmed');
    }

    private async fetchRubicSwapTx(trade: any, fromAddress: string, receiver?: string): Promise<any> {
        const req = trade.rubicSwapRequest || {
            srcTokenBlockchain: trade.fromProviderId,
            dstTokenBlockchain: trade.toProviderId,
            srcTokenAddress: trade.srcTokenAddress,
            dstTokenAddress: trade.dstTokenAddress,
            srcTokenAmount: trade.srcTokenAmount,
            id: trade.id,
            referrer: 'tiwi-super-app',
        };

        // Route through our server-side proxy - Rubic's API sends no CORS headers,
        // so a direct browser fetch is blocked. See app/api/v1/rubic-swap/route.ts.
        const response = await fetch(apiUrl('/api/v1/rubic-swap'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...req, fromAddress, ...(receiver ? { receiver } : {}) }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new SwapExecutionError(
                `Rubic swap API failed: ${response.status} - ${errorText}`,
                SwapErrorCode.EXECUTION_FAILED,
                'rubic'
            );
        }

        const swapData = await response.json();
        return { ...trade, ...swapData };
    }

    /**
     * Execute EVM trade
     */
    private async executeEVMTrade(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, userAddress, onStatusUpdate, walletClient } = params;
        let trade = route.raw;

        const chainId = route.fromToken.chainId;
        const toChainId = route.toToken.chainId;
        const isCrossChain = chainId !== toChainId;

        // Ensure wallet is on the correct chain
        const { ensureCorrectChain } = await import('../utils/wallet-helpers');
        await ensureCorrectChain(chainId);

        // Check if transaction data exists; if not, fetch it from Rubic swap endpoint
        if (!this.hasTxData(trade) && trade.id) {
            onStatusUpdate?.({ stage: 'preparing', message: 'Fetching swap instructions...' });
            trade = await this.fetchRubicSwapTx(
                trade,
                userAddress,
                isCrossChain ? (params.recipientAddress || userAddress) : undefined
            );
        }

        // Check for approval first (if not native)
        const approvalAddress = trade.approvalAddress || trade.contractAddress;

        if (approvalAddress && route.fromToken.address !== '0x0000000000000000000000000000000000000000' && route.fromToken.address !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
            // Perform token approval if needed
            onStatusUpdate?.({ stage: 'approving', message: 'Processing...' });
            // Token approval is handled by the sendTransaction if allowance is insufficient
        }

        onStatusUpdate?.({ stage: 'signing', message: 'Confirming in wallet...' });

        if (!walletClient) {
            throw new SwapExecutionError('Wallet client is required for execution', SwapErrorCode.WALLET_NOT_CONNECTED, 'rubic');
        }

        // Collect tax before swap
        const { collectEvmTax } = await import('../utils/evm-tax-helper');
        const { taxCollected, taxAmount } = await collectEvmTax(params, 'RubicExecutor', onStatusUpdate);
        if (taxCollected) {
            console.log(`[RubicExecutor] Tax of ${taxAmount} collected`);
        }

        // Rubic trade object structure depends on the trade type
        const txData = trade.transaction || trade.tx || trade;

        if (!txData.to && !trade.contractAddress) {
            throw new SwapExecutionError('Missing transaction target address', SwapErrorCode.INVALID_ROUTE, 'rubic');
        }

        const hash = await walletClient.sendTransaction({
            to: (txData.to || trade.contractAddress) as Address,
            data: txData.data as Hex,
            value: txData.value ? BigInt(txData.value) : BigInt(0),
        });

        onStatusUpdate?.({
            stage: 'confirming',
            message: isCrossChain ? 'Processing...' : 'Reviewing...',
            txHash: hash
        });

        return {
            success: true,
            txHash: hash,
            txHashes: [hash],
        };
    }

    /**
     * Execute TRON trade (STUB)
     */
    private async executeTronTrade(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, userAddress, onStatusUpdate } = params;

        onStatusUpdate?.({ stage: 'preparing', message: 'Preparing TRON transaction...' });

        // This would require window.tronWeb
        if (typeof window !== 'undefined' && (window as any).tronWeb) {
            const tronWeb = (window as any).tronWeb;
            let trade = route.raw;

            // Check if transaction data exists; if not, fetch it (API v2 pattern)
            if (!this.hasTxData(trade) && trade.id) {
                onStatusUpdate?.({ stage: 'preparing', message: 'Fetching swap instructions...' });
                const isCrossChain = route.fromToken.chainId !== route.toToken.chainId;
                trade = await this.fetchRubicSwapTx(
                    trade,
                    userAddress,
                    isCrossChain ? (params.recipientAddress || userAddress) : undefined
                );
            }

            onStatusUpdate?.({ stage: 'signing', message: 'Confirming in wallet...' });

            try {
                // Rubic API v2 might return different structure, e.g. trade.transaction containing raw data
                const tx = trade.transaction || trade.tx || trade.data;
                if (!tx) {
                    throw new Error('Transaction data missing from response');
                }

                // If tx is string/hex (likely), use it. If object, sign it.
                // tronWeb.trx.sign() usually takes an object.
                // If it's a raw transaction object:
                const signedTx = await tronWeb.trx.sign(tx);
                const receipt = await tronWeb.trx.sendRawTransaction(signedTx);

                const hash = receipt.txid || receipt.transaction?.txID;

                onStatusUpdate?.({ stage: 'completed', message: 'TRON swap successful', txHash: hash });

                return {
                    success: true,
                    txHash: hash,
                };
            } catch (e: any) {
                throw new SwapExecutionError(e.message || 'TRON transaction failed', SwapErrorCode.TRANSACTION_FAILED, 'rubic');
            }
        } else {
            throw new SwapExecutionError('TRON wallet (TronLink) not found', SwapErrorCode.WALLET_NOT_CONNECTED, 'rubic');
        }
    }

    /**
     * Execute Solana trade
     */
    private async executeSolanaTrade(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, userAddress, fromAmount, onStatusUpdate } = params;
        let trade = route.raw;

        try {
            onStatusUpdate?.({ stage: 'preparing', message: 'Preparing Solana transaction...' });
            const wallet = await getSolanaWallet();
            const connection = await getSolanaConnection();

            // Check if transaction data exists; if not, fetch it from Rubic swap endpoint
            if (!this.hasTxData(trade) && trade.id) {
                onStatusUpdate?.({ stage: 'preparing', message: 'Fetching swap instructions...' });
                const isCrossChain = route.fromToken.chainId !== route.toToken.chainId;
                trade = await this.fetchRubicSwapTx(
                    trade,
                    wallet.publicKey?.toBase58() || userAddress,
                    isCrossChain ? (params.recipientAddress || userAddress) : undefined
                );
            }

            // Rubic requires the wSOL mint for Solana native but its tx does NOT wrap native SOL - it
            // swaps wSOL directly, so a native-SOL wallet hits Jupiter InsufficientFunds (6024). Fund
            // the wSOL ATA with the swap amount first (no-op if the wallet already holds enough wSOL).
            await this.ensureWrappedSol(connection, wallet, fromAmount, route, onStatusUpdate);

            // Rubic returns the Solana tx either as a raw base64 string OR wrapped in an object
            // (like its EVM shape: { data, ... }). Extract the base64 string from either form.
            const txRaw = trade.transaction || trade.tx;
            let transactionBase64: unknown = typeof txRaw === 'string'
                ? txRaw
                : (txRaw?.data ?? txRaw?.serializedTransaction ?? txRaw?.transaction ?? txRaw?.tx);
            // Last resort: Rubic may nest the serialized tx under an unexpected key. A base64 Solana
            // tx is a long string - grab the first long string value from the object.
            if (typeof transactionBase64 !== 'string' && txRaw && typeof txRaw === 'object') {
                transactionBase64 = Object.values(txRaw).find((v) => typeof v === 'string' && v.length > 100);
            }
            if (typeof transactionBase64 !== 'string' || !transactionBase64) {
                console.error('[RubicExecutor] Unexpected Solana tx shape from Rubic:', JSON.stringify(txRaw)?.slice(0, 400));
                throw new Error('Rubic returned the Solana transaction in an unexpected format');
            }

            onStatusUpdate?.({ stage: 'signing', message: 'Confirming in wallet...' });

            // Lenient base64 decode: strict atob() rejects URL-safe alphabet (-/_), whitespace, or
            // missing padding → "string to be decoded is not correctly encoded". Normalize first.
            const transactionBuffer = base64ToBytes(transactionBase64);
            const transaction = VersionedTransaction.deserialize(transactionBuffer);

            const signedTransaction = await wallet.signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTransaction.serialize());

            onStatusUpdate?.({ stage: 'confirming', message: 'Reviewing...', txHash: signature });
            await connection.confirmTransaction(signature, 'confirmed');

            return { success: true, txHash: signature };
        } catch (error: any) {
            throw createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'rubic-solana');
        }
    }

    /**
     * Execute TON trade
     */
    private async executeTonTrade(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, userAddress, onStatusUpdate } = params;
        let trade = route.raw;

        try {
            onStatusUpdate?.({ stage: 'preparing', message: 'Preparing TON transaction...' });
            const tonConnectUI = await getTONWallet();

            // TON source txs are built server-side by Rubic; fetch the signable message.
            if (!this.hasTxData(trade) && trade.id) {
                onStatusUpdate?.({ stage: 'preparing', message: 'Fetching swap instructions...' });
                const isCrossChain = route.fromToken.chainId !== route.toToken.chainId;
                trade = await this.fetchRubicSwapTx(
                    trade,
                    userAddress,
                    isCrossChain ? (params.recipientAddress || userAddress) : undefined
                );
            }

            const transaction = trade.transaction || trade.tx;
            if (!transaction) {
                throw new Error('TON transaction data missing');
            }

            onStatusUpdate?.({ stage: 'signing', message: 'Confirming in wallet...' });
            const result = await tonConnectUI.sendTransaction(transaction);
            const hash = result.boc || 'transaction_sent';

            return { success: true, txHash: hash };
        } catch (error: any) {
            throw createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'rubic-ton');
        }
    }
}
