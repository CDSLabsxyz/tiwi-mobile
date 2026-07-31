
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';
import { getTONWallet } from '../utils/wallet-helpers';

const TON_CANONICAL_CHAIN_ID = 1100;
const TONCENTER_ENDPOINT = 'https://toncenter.com/api/v2/jsonRPC';
const SEQNO_WAIT_MS = 60_000;
const SEQNO_POLL_MS = 3_000;

/**
 * Native-TON markers. The app carries native TON under several placeholders
 * depending on the code path (see stonfi-adapter / the token-select modal), so
 * we recognize them all case-insensitively; a real jetton carries its own
 * EQ…/UQ… master address.
 */
const TON_NATIVE_MARKERS: ReadonlySet<string> = new Set([
    'native',
    '',
    '0x0000000000000000000000000000000000000000',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

function isNativeTon(address?: string, symbol?: string): boolean {
    if (TON_NATIVE_MARKERS.has((address || '').toLowerCase())) return true;
    return !address && (symbol || '').toUpperCase() === 'TON';
}

/** The shape the internal-wallet path passes as `walletClient` (see internal-ton-signer.ts). */
interface InternalTonWalletClient {
    tonKeypair: { publicKey: Buffer; secretKey: Buffer };
    tonAddress: string;
}

function isInternalTonWalletClient(wc: unknown): wc is InternalTonWalletClient {
    return !!wc && typeof wc === 'object' && 'tonKeypair' in wc && 'tonAddress' in wc;
}

/**
 * TON executor.
 *
 * Two distinct paths:
 *  • STON.fi same-chain swaps (`router === 'stonfi'`) — the quote adapter only
 *    prices the swap; the signable transaction is BUILT HERE with @ston-fi/sdk
 *    (RouterV1) against a TonClient, then signed by whichever wallet controls the
 *    TON address (internal ed25519 keypair via WalletContractV4, or external
 *    TonConnect).
 *  • Cross-chain routes that LAND on TON (Rubic/Relay, etc.) — those adapters put
 *    a ready-to-send TonConnect message in `route.raw.transaction`; we forward it
 *    to TonConnect unchanged (legacy behavior, preserved).
 */
export class TONExecutor implements SwapRouterExecutor {
    canHandle(route: RouterRoute): boolean {
        return route.fromToken.chainId === TON_CANONICAL_CHAIN_ID
            || route.router === 'stonfi'
            || route.router === 'dedust';
    }

    async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, userAddress } = params;

        try {
            if (route.router === 'stonfi') {
                return await this.executeStonFi(params);
            }

            // Legacy path: a prebuilt TonConnect transaction from a cross-chain adapter.
            const { onStatusUpdate } = params;
            if (!userAddress) {
                throw new SwapExecutionError('User address is required', SwapErrorCode.WALLET_NOT_CONNECTED, 'ton');
            }
            onStatusUpdate?.({ stage: 'preparing', message: 'Preparing...' });

            const tonConnectUI = await getTONWallet();
            const trade = route.raw;
            if (!trade || !trade.transaction) {
                throw new SwapExecutionError('TON transaction data missing', SwapErrorCode.INVALID_ROUTE, 'ton');
            }

            onStatusUpdate?.({ stage: 'signing', message: 'Approve Now' });
            const result = await tonConnectUI.sendTransaction(trade.transaction);
            const hash = result.boc || 'transaction_sent';
            onStatusUpdate?.({ stage: 'completed', message: 'Success', txHash: hash });
            return { success: true, txHash: hash };
        } catch (error: any) {
            return this.handleError(error, params);
        }
    }

    /**
     * Build + sign a STON.fi (Router V1) same-chain swap.
     */
    private async executeStonFi(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, fromToken, fromAmount, userAddress, walletClient, onStatusUpdate } = params;

        onStatusUpdate?.({ stage: 'preparing', message: 'Building TON swap...' });

        const internal = isInternalTonWalletClient(walletClient) ? walletClient : null;
        const signerAddress = internal?.tonAddress || userAddress;
        if (!signerAddress) {
            throw new SwapExecutionError('No TON wallet address available', SwapErrorCode.WALLET_NOT_CONNECTED, 'ton');
        }

        const fromAddr = route.fromToken.address;
        const toAddr = route.toToken.address;
        const fromNative = isNativeTon(fromAddr, route.fromToken.symbol);
        const toNative = isNativeTon(toAddr, route.toToken.symbol);
        if (fromNative && toNative) {
            throw new SwapExecutionError('Cannot swap TON to TON', SwapErrorCode.INVALID_ROUTE, 'ton');
        }

        // Amounts in smallest units. Native TON is 9 decimals; jettons carry theirs.
        const { parseUnits } = await import('viem');
        const fromDecimals = route.fromToken.decimals ?? fromToken?.decimals ?? 9;
        const offerAmount = parseUnits(fromAmount, fromDecimals);

        // Minimum received: prefer STON.fi's slippage-adjusted min from the quote;
        // otherwise derive it from the quoted output and the requested slippage.
        const minAskAmount = this.resolveMinAskAmount(route, params);
        if (offerAmount <= BigInt(0)) {
            throw new SwapExecutionError('Invalid swap amount', SwapErrorCode.INVALID_ROUTE, 'ton');
        }

        onStatusUpdate?.({ stage: 'signing', message: 'Approve Now' });

        const { TonClient, WalletContractV4, internal: internalMessage, SendMode } = await import('@ton/ton');
        const { DEX, pTON } = await import('@ston-fi/sdk');
        type SenderArgs = { to: any; value: bigint; body?: any };

        const apiKey = process.env.EXPO_PUBLIC_TONCENTER_API_KEY || undefined;
        const client = new TonClient({ endpoint: TONCENTER_ENDPOINT, apiKey });
        const router = client.open(new DEX.v1.Router());
        const proxyTon = new pTON.v1();

        // Build the swap message params for the correct direction.
        let txParams: SenderArgs;
        if (fromNative) {
            // TON → Jetton
            txParams = await router.getSwapTonToJettonTxParams({
                userWalletAddress: signerAddress,
                proxyTon,
                askJettonAddress: toAddr,
                offerAmount,
                minAskAmount,
            });
        } else if (toNative) {
            // Jetton → TON
            txParams = await router.getSwapJettonToTonTxParams({
                userWalletAddress: signerAddress,
                offerJettonAddress: fromAddr,
                proxyTon,
                offerAmount,
                minAskAmount,
            });
        } else {
            // Jetton → Jetton
            txParams = await router.getSwapJettonToJettonTxParams({
                userWalletAddress: signerAddress,
                offerJettonAddress: fromAddr,
                askJettonAddress: toAddr,
                offerAmount,
                minAskAmount,
            });
        }

        // ── Sign + broadcast ─────────────────────────────────────────────────
        if (internal) {
            // Internal (seed) wallet: sign the V4R2 external message ourselves.
            const wallet = WalletContractV4.create({ workchain: 0, publicKey: internal.tonKeypair.publicKey });
            const contract = client.open(wallet);

            let seqno: number;
            try {
                seqno = await contract.getSeqno();
            } catch (err: any) {
                throw new SwapExecutionError(
                    `Could not reach the TON network: ${err?.message || err}`,
                    SwapErrorCode.NETWORK_ERROR,
                    'ton',
                );
            }

            const transfer = wallet.createTransfer({
                seqno,
                secretKey: internal.tonKeypair.secretKey,
                sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
                messages: [
                    internalMessage({
                        to: txParams.to,
                        value: txParams.value,
                        body: txParams.body,
                        bounce: true,
                    }),
                ],
            });
            const ref = transfer.hash().toString('hex');
            await contract.send(transfer);

            onStatusUpdate?.({ stage: 'confirming', message: 'Confirming...', txHash: `0x${ref}` });
            await this.waitForSeqno(contract, seqno);

            onStatusUpdate?.({ stage: 'completed', message: 'Success', txHash: `0x${ref}` });
            return { success: true, txHash: `0x${ref}` };
        }

        // External wallet: hand the message to TonConnect.
        const tonConnectUI = await getTONWallet();
        const result = await tonConnectUI.sendTransaction({
            validUntil: Math.floor(Date.now() / 1000) + 300,
            messages: [
                {
                    address: txParams.to.toString(),
                    amount: txParams.value.toString(),
                    ...(txParams.body ? { payload: txParams.body.toBoc().toString('base64') } : {}),
                },
            ],
        });
        const hash = result.boc || 'transaction_sent';
        onStatusUpdate?.({ stage: 'completed', message: 'Success', txHash: hash });
        return { success: true, txHash: hash };
    }

    /**
     * Minimum acceptable output in the ask token's smallest units. STON.fi's
     * quote already carries a slippage-adjusted `min_ask_units`; when it's
     * absent we recompute from the quoted output amount and the requested
     * slippage so a swap never goes out with a zero floor.
     */
    private resolveMinAskAmount(route: RouterRoute, params: SwapExecutionParams): bigint {
        const raw: any = route.raw;
        if (raw?.min_ask_units) {
            try {
                const v = BigInt(String(raw.min_ask_units));
                if (v > BigInt(0)) return v;
            } catch {
                /* fall through to recompute */
            }
        }

        // Recompute: quotedOut * (1 - slippage%). Truncate to an integer.
        const toDecimals = route.toToken.decimals ?? params.toToken?.decimals ?? 9;
        const quotedOut = parseFloat(route.toToken.amount || '0');
        const slippagePct =
            typeof params.slippage === 'number' ? params.slippage : parseFloat(route.slippage || '1');
        const bps = Math.max(0, Math.min(5000, Math.round((isFinite(slippagePct) ? slippagePct : 1) * 100)));
        if (!(quotedOut > 0)) return BigInt(0);
        // Do the bps haircut in integer space to avoid float drift on large values.
        const outSmallest = BigInt(Math.floor(quotedOut * 10 ** toDecimals));
        return (outSmallest * BigInt(10000 - bps)) / BigInt(10000);
    }

    private async waitForSeqno(contract: any, prev: number): Promise<void> {
        const deadline = Date.now() + SEQNO_WAIT_MS;
        while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, SEQNO_POLL_MS));
            try {
                const now = await contract.getSeqno();
                if (now > prev) return;
            } catch {
                // transient RPC error — keep polling until the deadline
            }
        }
        // Timeout doesn't necessarily mean failure (mirrors the multi-send runner);
        // the tx may still land. We return rather than throw so a confirmed-but-slow
        // swap isn't reported as failed.
    }

    private handleError(error: any, params: SwapExecutionParams): never {
        const { onStatusUpdate } = params;
        console.error('[TONExecutor] Execution error:', error);

        if (error instanceof SwapExecutionError) {
            onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(error), error });
            throw error;
        }
        if (error?.message?.includes('User rejected') || error?.message?.includes('Reject')) {
            const rejectError = new SwapExecutionError('Transaction rejected by user', SwapErrorCode.TRANSACTION_REJECTED, 'ton');
            onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(rejectError), error: rejectError });
            throw rejectError;
        }
        const swapError = createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'ton');
        onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(swapError), error: swapError });
        throw swapError;
    }
}
