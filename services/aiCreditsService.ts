/**
 * TIWI AI credits — mobile.
 *
 * Mirrors the web super-app's credit model exactly:
 *   • A free monthly allowance (set by admin, read from /api/v1/ai-credit-settings)
 *     that resets on the 1st of each month.
 *   • Paid credits bought with TWC in Starter / Growth / Pro packs. The pack
 *     price is admin-configured; payment is an on-chain ERC20 transfer to the
 *     admin's treasury, and credits are granted only AFTER it confirms.
 *   • One credit is charged per answered message — the server tells us whether
 *     it charged (`credits.charged`), so blocked/empty replies cost nothing.
 *
 * Balances live on-device per wallet (AsyncStorage), the same as the web app
 * keeps them in localStorage per wallet. That makes them advisory rather than
 * server-enforced — matching web behaviour, not improving on it.
 */

import { createTransportForChain } from '@/constants/rpc';
import {
    api,
    type AiCreditBalance,
    type AiCreditPack,
    type AiCreditSettings,
} from '@/lib/mobile/api-client';
import { logNetworkAwareError } from '@/utils/networkErrors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPublicClient, formatUnits, type Address } from 'viem';
import { useWalletStore } from '@/store/walletStore';
import { activityService } from './activityService';
import { apiClient } from './apiClient';
import { getChainById } from './signer/SignerUtils';
import { transactionService } from './transactionService';

export type { AiCreditPack, AiCreditSettings };

// ─── Defaults (used until the admin settings load, or if they fail) ───────────

export const DEFAULT_FREE_MONTHLY_CREDITS = 10;

export const DEFAULT_CREDIT_PACKS: AiCreditPack[] = [
    { id: 'starter', label: 'Starter', credits: 25, twcAmount: 50 },
    { id: 'growth', label: 'Growth', credits: 75, twcAmount: 125 },
    { id: 'pro', label: 'Pro', credits: 180, twcAmount: 250 },
];

export interface PaymentConfig {
    treasuryAddress: string;
    paymentTokenAddress: string;
    paymentTokenSymbol: string;
    paymentTokenDecimals: number;
    paymentChainId: number;
}

export const EMPTY_PAYMENT_CONFIG: PaymentConfig = {
    treasuryAddress: '',
    paymentTokenAddress: '',
    paymentTokenSymbol: 'TWC',
    paymentTokenDecimals: 9,
    paymentChainId: 56,
};

/**
 * Canonical TWC on BSC. Used when the admin hasn't pinned a specific payment
 * token, so configuring just the treasury wallet is enough to enable purchases.
 */
export const CANONICAL_TWC = {
    address: '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596',
    chainId: 56,
    decimals: 9,
} as const;

export const isEvmAddress = (v?: string | null) => /^0x[a-fA-F0-9]{40}$/.test((v || '').trim());

/**
 * The address that actually pays for a pack.
 *
 * Payment is always an ERC20 transfer, so it must come from an EVM address —
 * but the user's active address can be non-EVM (Solana, TON, …) when they're
 * browsing another chain. Fall back to the active wallet group's EVM address
 * so buying credits works from any chain, mirroring the web app's
 * `localEvmAddress` fallback.
 */
export const resolveEvmPayerAddress = (activeAddress?: string | null): string | null => {
    if (isEvmAddress(activeAddress)) return (activeAddress as string).trim();
    try {
        const { walletGroups, activeGroupId } = useWalletStore.getState();
        const group =
            walletGroups.find((g) => g.id === activeGroupId) ||
            walletGroups.find((g) =>
                Object.values(g.addresses).some(
                    (a) => a?.toLowerCase() === (activeAddress || '').toLowerCase(),
                ),
            );
        const evm = group?.addresses?.EVM;
        return isEvmAddress(evm) ? (evm as string) : null;
    } catch {
        return null;
    }
};

const PAY_CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum',
    56: 'BNB Smart Chain',
    137: 'Polygon',
    42161: 'Arbitrum',
    8453: 'Base',
    10: 'Optimism',
    43114: 'Avalanche',
};

export const payChainName = (id: number) => PAY_CHAIN_NAMES[id] || `chain ${id}`;

const EXPLORER_TX: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    56: 'https://bscscan.com/tx/',
    137: 'https://polygonscan.com/tx/',
    42161: 'https://arbiscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
    43114: 'https://snowtrace.io/tx/',
};

export const explorerTxUrl = (chainId: number, hash?: string) =>
    hash && EXPLORER_TX[chainId] ? `${EXPLORER_TX[chainId]}${hash}` : '';

export const shortAddr = (a?: string) =>
    a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '';

/**
 * Compact token amount for the narrow balance tile — TWC balances run into the
 * billions, and the full grouped number wraps onto two lines. Small balances
 * keep their precision so a dust amount never reads as "0".
 */
export const formatCompactAmount = (value: number): string => {
    if (!Number.isFinite(value)) return '0';
    const abs = Math.abs(value);
    const trim = (n: number, digits: number) =>
        Number(n.toFixed(digits)).toLocaleString(undefined, { maximumFractionDigits: digits });

    if (abs >= 1e12) return `${trim(value / 1e12, 2)}T`;
    if (abs >= 1e9) return `${trim(value / 1e9, 2)}B`;
    if (abs >= 1e6) return `${trim(value / 1e6, 2)}M`;
    if (abs >= 1e3) return `${trim(value / 1e3, 2)}K`;
    if (abs >= 1) return trim(value, 2);
    if (abs > 0) return trim(value, 6);
    return '0';
};

// ─── Credit balance (server-owned) ───────────────────────────────────────────

export interface Receipt {
    reference: string;
    packLabel: string;
    credits: number;
    twcAmount: number;
    tokenSymbol: string;
    chainId: number;
    from: string;
    to: string;
    txHash?: string;
    timestamp: number;
}

/**
 * The balance is NOT computed on the device. It lives in Supabase keyed by
 * wallet and is spent by `/api/v1/ai/chat` as it answers, so a credit used in
 * the web super-app is already gone when the phone next looks. Everything here
 * either reads that number or caches the last one seen.
 */
export type CreditBalance = AiCreditBalance;

export interface CreditSummary {
    monthlyLeft: number;
    paidLeft: number;
    totalLeft: number;
    usedTotal: number;
}

export const emptyBalance = (freeLimit = DEFAULT_FREE_MONTHLY_CREDITS): CreditBalance => ({
    freeLimit,
    freeUsed: 0,
    paidCredits: 0,
    paidUsed: 0,
    monthlyLeft: freeLimit,
    paidLeft: 0,
    totalLeft: freeLimit,
});

export const getCreditSummary = (balance: CreditBalance): CreditSummary => ({
    monthlyLeft: Math.max(0, balance.monthlyLeft),
    paidLeft: Math.max(0, balance.paidLeft),
    totalLeft: Math.max(0, balance.totalLeft),
    usedTotal: balance.freeUsed + balance.paidUsed,
});

/**
 * Last-known balance, per wallet. Purely a cache so the sheet has something to
 * show (and the composer stays enabled) while offline — the server overwrites
 * it on the next successful call.
 */
const balanceCacheKey = (address?: string | null) =>
    `@tiwi/ai_credit_balance_${address || 'guest'}`;

export const loadCachedBalance = async (
    address?: string | null,
): Promise<CreditBalance | null> => {
    try {
        const raw = await AsyncStorage.getItem(balanceCacheKey(address));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed as CreditBalance;
    } catch {
        return null;
    }
};

export const saveCachedBalance = async (
    address: string | null | undefined,
    balance: CreditBalance,
): Promise<void> => {
    try {
        await AsyncStorage.setItem(balanceCacheKey(address), JSON.stringify(balance));
    } catch {
        /* a failed cache write must never break the chat */
    }
};

// ─── Pending claims ─────────────────────────────────────────────────────────
//
// The user pays FIRST, then the server verifies that payment and grants the
// credits. If the claim call fails in between (dropped connection, app killed),
// real TWC has left the wallet with nothing to show for it. So every payment is
// written down before it's claimed and retried until it lands. The claim is
// idempotent on the transaction hash, so retrying can never double-credit.

interface PendingClaim {
    walletAddress: string;
    packId: string;
    txHash: string;
    reference?: string;
    createdAt: number;
}

const pendingClaimsKey = (address?: string | null) =>
    `@tiwi/ai_credit_pending_claims_${address || 'guest'}`;

async function readPendingClaims(address?: string | null): Promise<PendingClaim[]> {
    try {
        const raw = await AsyncStorage.getItem(pendingClaimsKey(address));
        const parsed = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? (parsed as PendingClaim[]) : [];
    } catch {
        return [];
    }
}

async function writePendingClaims(
    address: string | null | undefined,
    claims: PendingClaim[],
): Promise<void> {
    try {
        if (claims.length === 0) {
            await AsyncStorage.removeItem(pendingClaimsKey(address));
            return;
        }
        await AsyncStorage.setItem(pendingClaimsKey(address), JSON.stringify(claims));
    } catch {
        /* ignore */
    }
}

async function addPendingClaim(claim: PendingClaim): Promise<void> {
    const existing = await readPendingClaims(claim.walletAddress);
    if (existing.some((c) => c.txHash.toLowerCase() === claim.txHash.toLowerCase())) return;
    await writePendingClaims(claim.walletAddress, [...existing, claim]);
}

async function dropPendingClaim(address: string, txHash: string): Promise<void> {
    const existing = await readPendingClaims(address);
    await writePendingClaims(
        address,
        existing.filter((c) => c.txHash.toLowerCase() !== txHash.toLowerCase()),
    );
}

/**
 * Retry any payment whose credits were never confirmed. Called whenever the
 * balance is refreshed, so a purchase interrupted mid-claim self-heals the next
 * time the app can reach the server.
 *
 * Returns the latest balance if any claim went through.
 */
export const retryPendingClaims = async (
    address?: string | null,
): Promise<CreditBalance | null> => {
    if (!address) return null;
    const pending = await readPendingClaims(address);
    if (pending.length === 0) return null;

    let latest: CreditBalance | null = null;
    for (const claim of pending) {
        try {
            const res = await api.ai.claimCredits({
                walletAddress: claim.walletAddress,
                packId: claim.packId,
                txHash: claim.txHash,
                reference: claim.reference,
            });
            if (res?.success) {
                latest = res.balance ?? latest;
                await dropPendingClaim(address, claim.txHash);
            }
            // A 400 here means the server rejected the payment as invalid, not
            // that it's unreachable — keep it queued rather than silently
            // discarding a real payment, so support can see it.
        } catch (error) {
            logNetworkAwareError('[AiCredits] pending claim retry failed:', error);
            break; // still offline — try again next refresh
        }
    }
    return latest;
};

/** Read the authoritative balance. Returns null when unreachable. */
export const fetchCreditBalance = async (
    address?: string | null,
): Promise<CreditBalance | null> => {
    try {
        const res = await api.ai.creditBalance(address);
        return res?.balance ?? null;
    } catch (error) {
        logNetworkAwareError('[AiCredits] balance fetch failed:', error);
        return null;
    }
};

// ─── Admin-managed pricing ───────────────────────────────────────────────────

export interface LoadedCreditSettings {
    freeMonthlyCredits: number;
    packs: AiCreditPack[];
    payment: PaymentConfig;
}

export const fetchCreditSettings = async (): Promise<LoadedCreditSettings> => {
    try {
        const { settings } = await api.ai.creditSettings();
        return {
            freeMonthlyCredits: Number.isFinite(settings?.freeMonthlyCredits)
                ? settings.freeMonthlyCredits
                : DEFAULT_FREE_MONTHLY_CREDITS,
            packs: Array.isArray(settings?.packs) && settings.packs.length > 0
                ? settings.packs
                : DEFAULT_CREDIT_PACKS,
            payment: {
                treasuryAddress: settings?.treasuryAddress || '',
                paymentTokenAddress: settings?.paymentTokenAddress || '',
                paymentTokenSymbol: settings?.paymentTokenSymbol || 'TWC',
                paymentTokenDecimals: Number.isFinite(settings?.paymentTokenDecimals)
                    ? settings.paymentTokenDecimals
                    : 9,
                paymentChainId: Number.isFinite(settings?.paymentChainId)
                    ? settings.paymentChainId
                    : 56,
            },
        };
    } catch {
        // Never break the AI panel on a settings read failure.
        return {
            freeMonthlyCredits: DEFAULT_FREE_MONTHLY_CREDITS,
            packs: DEFAULT_CREDIT_PACKS,
            payment: EMPTY_PAYMENT_CONFIG,
        };
    }
};

// ─── On-chain reads ──────────────────────────────────────────────────────────

const ERC20_READ_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
] as const;

/**
 * Use the app's standard health-ranked fallback transport rather than a single
 * endpoint. A lone Alchemy call that 429s would otherwise throw and make the
 * billing sheet report "No TWC detected" for a wallet that actually holds TWC.
 */
function readClientFor(chainId: number) {
    return createPublicClient({
        chain: getChainById(chainId),
        transport: createTransportForChain(chainId),
    });
}

/** A token row from the wallet balance indexer, narrowed to what we need. */
export interface IndexedTokenBalance {
    symbol?: string;
    address?: string;
    chainId?: number | string;
    balanceFormatted?: string;
    balance?: string;
}

/**
 * Find the payment token in the aggregated balance list. Matches on
 * contract address + chain first, falling back to the symbol (TWC is also
 * listed as TIWICAT by some sources).
 */
export const findIndexedPayTokenBalance = (
    tokens: IndexedTokenBalance[] | undefined | null,
    payment: PaymentConfig,
): number | null => {
    if (!tokens?.length) return null;
    const token = resolvePayToken(payment);
    const wantedAddress = token.address.toLowerCase();
    const wantedSymbols = new Set([token.symbol.toUpperCase(), 'TWC', 'TIWICAT']);

    const match =
        tokens.find(
            (t) =>
                (t.address || '').toLowerCase() === wantedAddress &&
                Number(t.chainId) === token.chainId,
        ) || tokens.find((t) => wantedSymbols.has((t.symbol || '').toUpperCase()));

    if (!match) return null;
    const value = Number(match.balanceFormatted ?? match.balance ?? '0');
    return Number.isFinite(value) ? value : null;
};

/** Resolve which token/chain a purchase actually pays in. */
export const resolvePayToken = (payment: PaymentConfig) => ({
    address: (isEvmAddress(payment.paymentTokenAddress)
        ? payment.paymentTokenAddress
        : CANONICAL_TWC.address) as Address,
    chainId: payment.paymentChainId || CANONICAL_TWC.chainId,
    symbol: payment.paymentTokenSymbol || 'TWC',
    decimals: isEvmAddress(payment.paymentTokenAddress)
        ? payment.paymentTokenDecimals
        : CANONICAL_TWC.decimals,
});

/**
 * Read the wallet's real TWC balance straight from chain. The aggregated
 * indexer frequently omits TWC (which showed "0 TWC" on web), so the billing
 * sheet always reads it directly.
 */
export const readPayTokenBalance = async (
    walletAddress: string,
    payment: PaymentConfig,
): Promise<string | null> => {
    const payer = resolveEvmPayerAddress(walletAddress);
    if (!payer) return null;
    const token = resolvePayToken(payment);
    try {
        const client = readClientFor(token.chainId);
        const raw = await client.readContract({
            address: token.address,
            abi: ERC20_READ_ABI,
            functionName: 'balanceOf',
            args: [payer as Address],
        });
        return formatUnits(raw as bigint, token.decimals);
    } catch {
        return null;
    }
};

// ─── Purchase ────────────────────────────────────────────────────────────────

export type PurchaseResult =
    | { ok: true; receipt: Receipt; balance: CreditBalance | null }
    | { ok: false; error: string };

export interface PurchaseParams {
    pack: AiCreditPack;
    walletAddress: string;
    payment: PaymentConfig;
    /** Progress messages for the billing sheet ("Preparing payment…", …). */
    onProgress?: (message: string) => void;
}

/**
 * Buy a credit pack: verify the treasury + price, confirm the paying wallet
 * really holds enough of the token, transfer to the treasury, and only then
 * report success so the caller can grant credits.
 *
 * The transfer goes through `transactionService.sendToken`, the same local
 * signing path Send/Multi-Send use — so it works with the in-app wallet
 * without a separate keystore prompt here.
 */
export const purchaseCreditPack = async ({
    pack,
    walletAddress,
    payment,
    onProgress,
}: PurchaseParams): Promise<PurchaseResult> => {
    if (!walletAddress) {
        return { ok: false, error: 'Connect a wallet to buy AI credits with TWC.' };
    }

    // Payment is REQUIRED — credits are never granted without a confirmed
    // transfer, so an unconfigured treasury disables purchases entirely.
    if (!isEvmAddress(payment.treasuryAddress)) {
        return {
            ok: false,
            error: 'AI credit purchases aren’t available yet — the payment wallet hasn’t been configured. Please try again later.',
        };
    }
    if (!(pack.twcAmount > 0)) {
        return { ok: false, error: 'This pack has no price set. Please try again later.' };
    }

    // The paying address must be EVM — resolve it from the active wallet even
    // when the user is currently browsing a non-EVM chain.
    const payer = resolveEvmPayerAddress(walletAddress);
    if (!payer) {
        return {
            ok: false,
            error: 'This wallet has no EVM address, so it can’t pay for AI credits here.',
        };
    }

    const token = resolvePayToken(payment);
    const treasury = payment.treasuryAddress as Address;

    // Ask the server to price the pack. It resolves the price from the admin
    // settings row and never trusts a client-supplied amount, so this is also
    // what produces the canonical reference id.
    let reference = `TIWI-AI-${pack.id.toUpperCase()}-${payer.slice(0, 6)}-${Date.now()}`;
    let credits = pack.credits;
    let twcAmount = pack.twcAmount;
    try {
        const quote = await api.ai.creditQuote(payer, pack.id);
        if (quote?.success && quote.purchase) {
            reference = quote.purchase.reference || reference;
            if (Number.isFinite(quote.purchase.credits)) credits = quote.purchase.credits;
            if (Number.isFinite(quote.purchase.twcAmount)) twcAmount = quote.purchase.twcAmount;
        }
    } catch {
        // Quote endpoint unavailable → fall back to the admin pack we already
        // loaded. Same tradeoff the web app makes.
    }

    onProgress?.('Preparing payment…');

    // Read the token's REAL decimals + balance. A wrong admin `decimals`
    // (18 vs TWC's 9) would otherwise request an impossible amount that the
    // signer rejects with an opaque failure.
    let realDecimals = token.decimals;
    let onchainBalance: bigint | null = null;
    try {
        const client = readClientFor(token.chainId);
        try {
            const d = await client.readContract({
                address: token.address,
                abi: ERC20_READ_ABI,
                functionName: 'decimals',
            });
            realDecimals = Number(d);
        } catch {
            /* keep the configured decimals */
        }
        onchainBalance = (await client.readContract({
            address: token.address,
            abi: ERC20_READ_ABI,
            functionName: 'balanceOf',
            args: [payer as Address],
        })) as bigint;
    } catch {
        /* balance check is best-effort */
    }

    if (onchainBalance !== null) {
        const held = Number(formatUnits(onchainBalance, realDecimals));
        if (twcAmount > held) {
            return {
                ok: false,
                error: `Not enough ${token.symbol} in ${shortAddr(payer)}: this pack costs ${twcAmount} ${token.symbol} but that wallet holds ${held.toLocaleString(undefined, { maximumFractionDigits: 2 })}. Switch to the wallet holding your ${token.symbol}.`,
            };
        }
    }

    onProgress?.(`Sending ${twcAmount} ${token.symbol}…`);

    try {
        const result = await transactionService.sendToken({
            tokenAddress: token.address,
            symbol: token.symbol,
            decimals: realDecimals,
            recipientAddress: treasury,
            amount: String(twcAmount),
            chainId: token.chainId,
            isNative: false,
        });

        if (result.status !== 'success') {
            return { ok: false, error: result.error || 'Payment failed on-chain.' };
        }

        const receipt: Receipt = {
            reference,
            packLabel: pack.label,
            credits,
            twcAmount,
            tokenSymbol: token.symbol,
            chainId: token.chainId,
            from: payer,
            to: treasury,
            txHash: result.hash,
            timestamp: Date.now(),
        };

        // Record the purchase so it shows up as "TIWI AI credits" in the
        // activities board. Best-effort — never blocks the receipt UI.
        void recordPurchaseActivity(receipt);

        // Credits are granted by the SERVER, which re-verifies this transfer
        // on-chain before crediting the shared ledger. That's what makes the
        // pack usable from the web app too — and why the device never adds
        // credits itself.
        onProgress?.('Confirming your credits…');
        // Written down BEFORE the claim so an interrupted call is retried
        // instead of losing the user's payment.
        await addPendingClaim({
            walletAddress: payer,
            packId: pack.id,
            txHash: result.hash,
            reference,
            createdAt: Date.now(),
        });
        try {
            const claim = await api.ai.claimCredits({
                walletAddress: payer,
                packId: pack.id,
                txHash: result.hash,
                reference,
            });
            if (!claim?.success) {
                return {
                    ok: false,
                    error:
                        claim?.error ||
                        'Payment sent, but the credits could not be confirmed. Reopen this panel in a moment — the payment is recorded on-chain.',
                };
            }
            await dropPendingClaim(payer, result.hash);
            return { ok: true, receipt, balance: claim.balance ?? null };
        } catch (error) {
            logNetworkAwareError('[AiCredits] claim failed:', error);
            return {
                ok: false,
                error:
                    'Payment sent, but we could not reach the server to add your credits. They will appear once you reconnect.',
            };
        }
    } catch (error: unknown) {
        const err = error as { shortMessage?: string; message?: string };
        console.error('[AI-credits payment] failed:', error);
        return { ok: false, error: err?.shortMessage || err?.message || 'TWC credit purchase failed.' };
    }
};

async function recordPurchaseActivity(receipt: Receipt): Promise<void> {
    try {
        await apiClient.logTransaction({
            walletAddress: receipt.from,
            transactionHash: receipt.txHash || '',
            chainId: receipt.chainId,
            type: 'AISubscription',
            fromTokenSymbol: receipt.tokenSymbol,
            amount: String(receipt.twcAmount),
            amountFormatted: `${receipt.twcAmount} ${receipt.tokenSymbol}`,
            routerName: `TIWI AI · ${receipt.packLabel} (${receipt.credits} credits)`,
            blockTimestamp: new Date(receipt.timestamp).toISOString(),
        });
    } catch {
        /* ignore */
    }
    try {
        await activityService.logTransaction(
            receipt.from,
            'sent',
            'AI credits purchased',
            `You bought ${receipt.credits} TIWI AI credits for ${receipt.twcAmount} ${receipt.tokenSymbol}`,
            receipt.txHash,
            {
                symbol: receipt.tokenSymbol,
                amount: String(receipt.twcAmount),
                chainId: receipt.chainId,
            },
        );
    } catch {
        /* ignore */
    }
}

// ─── Receipt text ────────────────────────────────────────────────────────────

export const receiptText = (r: Receipt): string =>
    [
        'TIWI AI — Payment Receipt',
        '',
        `Pack:         ${r.packLabel}`,
        `Credits:      ${r.credits} AI credits`,
        `Amount paid:  ${r.twcAmount} ${r.tokenSymbol}`,
        `Network:      ${payChainName(r.chainId)}`,
        `From:         ${r.from}`,
        `To:           ${r.to}`,
        r.txHash ? `Tx hash:      ${r.txHash}` : '',
        `Reference:    ${r.reference}`,
        `Date:         ${new Date(r.timestamp).toLocaleString()}`,
        '',
        'app.tiwiprotocol.xyz',
    ]
        .filter(Boolean)
        .join('\n');
