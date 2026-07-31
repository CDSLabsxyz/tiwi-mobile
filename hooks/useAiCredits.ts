/**
 * AI credit balance + billing for the mobile chat.
 *
 * The balance is NOT owned here. It lives in Supabase keyed by wallet and is
 * spent by `/api/v1/ai/chat` as it answers, so the same wallet sees the same
 * number in the web super-app and on the phone. This hook:
 *
 *   • reads that balance on mount and after each answer,
 *   • caches the last one so the sheet still shows something offline,
 *   • loads the admin-managed pricing (allowance, packs, treasury/token),
 *   • drives purchases, which pay on-chain and then let the SERVER grant the
 *     credits after it re-verifies the transfer.
 */

import {
    DEFAULT_CREDIT_PACKS,
    DEFAULT_FREE_MONTHLY_CREDITS,
    EMPTY_PAYMENT_CONFIG,
    emptyBalance,
    fetchCreditBalance,
    fetchCreditSettings,
    findIndexedPayTokenBalance,
    formatCompactAmount,
    getCreditSummary,
    loadCachedBalance,
    purchaseCreditPack,
    readPayTokenBalance,
    retryPendingClaims,
    saveCachedBalance,
    type AiCreditPack,
    type CreditBalance,
    type CreditSummary,
    type IndexedTokenBalance,
    type PaymentConfig,
    type Receipt,
} from '@/services/aiCreditsService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface AiCreditsApi {
    balance: CreditBalance;
    summary: CreditSummary;
    freeMonthlyCredits: number;
    packs: AiCreditPack[];
    payment: PaymentConfig;

    /** False until the first balance read (or its cached fallback) lands. */
    balanceReady: boolean;
    /** True when the last balance shown came from cache, not the server. */
    balanceStale: boolean;
    refreshBalance: () => Promise<void>;

    /** Payment-token balance for the billing sheet. */
    payTokenBalanceLabel: string;
    paySymbol: string;

    /**
     * Adopt the balance returned by the chat route. The server already spent
     * the credit — this only mirrors the result, it never deducts locally.
     */
    applyServerBalance: (balance: CreditBalance | null | undefined) => void;

    buyingPackId: string | null;
    billingMessage: string | null;
    setBillingMessage: (message: string | null) => void;
    buy: (pack: AiCreditPack) => Promise<Receipt | null>;

    lastReceipt: Receipt | null;
}

export function useAiCredits(
    address?: string | null,
    walletTokens?: IndexedTokenBalance[] | null,
): AiCreditsApi {
    const [balance, setBalance] = useState<CreditBalance>(() => emptyBalance());
    const [balanceReady, setBalanceReady] = useState(false);
    const [balanceStale, setBalanceStale] = useState(false);
    const [freeMonthlyCredits, setFreeMonthlyCredits] = useState(DEFAULT_FREE_MONTHLY_CREDITS);
    const [packs, setPacks] = useState<AiCreditPack[]>(DEFAULT_CREDIT_PACKS);
    const [payment, setPayment] = useState<PaymentConfig>(EMPTY_PAYMENT_CONFIG);
    const [payTokenBalance, setPayTokenBalance] = useState<string | null>(null);
    const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
    const [billingMessage, setBillingMessage] = useState<string | null>(null);
    const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);

    // Guards cache writes until this wallet's balance has actually loaded, so
    // switching accounts can't stamp one wallet's number onto another's key.
    const loadedKeyRef = useRef<string | null>(null);

    // ── Admin pricing ───────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const settings = await fetchCreditSettings();
            if (cancelled) return;
            setFreeMonthlyCredits(settings.freeMonthlyCredits);
            setPacks(settings.packs);
            setPayment(settings.payment);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const adoptBalance = useCallback(
        (next: CreditBalance, fromServer: boolean) => {
            setBalance(next);
            setBalanceStale(!fromServer);
            setBalanceReady(true);
            if (fromServer) void saveCachedBalance(address, next);
        },
        [address],
    );

    /**
     * Pull the authoritative balance. Any purchase whose credits were never
     * confirmed gets retried first, so an interrupted payment self-heals here.
     */
    const refreshBalance = useCallback(async () => {
        const claimed = await retryPendingClaims(address);
        if (claimed) {
            adoptBalance(claimed, true);
            return;
        }
        const fresh = await fetchCreditBalance(address);
        if (fresh) {
            adoptBalance(fresh, true);
            return;
        }
        // Unreachable — fall back to the last number we saw rather than
        // blocking the composer on a flaky connection.
        const cached = await loadCachedBalance(address);
        adoptBalance(cached ?? emptyBalance(freeMonthlyCredits), false);
    }, [address, adoptBalance, freeMonthlyCredits]);

    useEffect(() => {
        let cancelled = false;
        const key = address || 'guest';
        loadedKeyRef.current = null;
        setBalanceReady(false);
        setBillingMessage(null);

        (async () => {
            // Show the cached number immediately so the UI isn't blank, then
            // let the server correct it.
            const cached = await loadCachedBalance(address);
            if (cancelled) return;
            if (cached) {
                setBalance(cached);
                setBalanceStale(true);
                setBalanceReady(true);
            }
            loadedKeyRef.current = key;
            await refreshBalance();
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address]);

    const applyServerBalance = useCallback(
        (next: CreditBalance | null | undefined) => {
            if (!next) return;
            adoptBalance(next, true);
        },
        [adoptBalance],
    );

    // ── Payment token balance ───────────────────────────────────────────────
    const refreshPayTokenBalance = useCallback(async () => {
        if (!address) {
            setPayTokenBalance(null);
            return;
        }
        setPayTokenBalance(await readPayTokenBalance(address, payment));
    }, [address, payment]);

    useEffect(() => {
        void refreshPayTokenBalance();
    }, [refreshPayTokenBalance]);

    const paySymbol = payment.paymentTokenSymbol || 'TWC';

    // Prefer whichever source reports a positive balance, so a flaky RPC can't
    // hide a balance the indexer already knows about — and vice versa.
    const onChainValue = payTokenBalance != null ? Number(payTokenBalance) : null;
    const indexedValue = useMemo(
        () => findIndexedPayTokenBalance(walletTokens, payment),
        [walletTokens, payment],
    );
    const bestBalance =
        onChainValue != null && onChainValue > 0
            ? onChainValue
            : indexedValue != null && indexedValue > 0
                ? indexedValue
                : onChainValue != null
                    ? onChainValue
                    : indexedValue;

    const payTokenBalanceLabel = !address
        ? 'Connect wallet'
        : bestBalance != null
            ? `${formatCompactAmount(bestBalance)} ${paySymbol}`
            : `No ${paySymbol} detected`;

    const buy = useCallback(
        async (pack: AiCreditPack): Promise<Receipt | null> => {
            if (!address) {
                setBillingMessage(`Connect a wallet to buy AI credits with ${paySymbol}.`);
                return null;
            }
            setBuyingPackId(pack.id);
            setBillingMessage(null);
            try {
                const result = await purchaseCreditPack({
                    pack,
                    walletAddress: address,
                    payment,
                    onProgress: setBillingMessage,
                });
                if (!result.ok) {
                    setBillingMessage(result.error);
                    // The payment may have gone through even when the claim
                    // didn't — re-read so any credit that did land shows up.
                    void refreshBalance();
                    return null;
                }
                const { receipt } = result;
                setLastReceipt(receipt);
                if (result.balance) {
                    adoptBalance(result.balance, true);
                } else {
                    void refreshBalance();
                }
                setBillingMessage(
                    `Payment confirmed — ${receipt.credits} credits added.${receipt.txHash ? ` Tx: ${receipt.txHash.slice(0, 10)}…` : ''}`,
                );
                void refreshPayTokenBalance();
                return receipt;
            } finally {
                setBuyingPackId(null);
            }
        },
        [address, adoptBalance, payment, paySymbol, refreshBalance, refreshPayTokenBalance],
    );

    const summary = useMemo(() => getCreditSummary(balance), [balance]);

    return {
        balance,
        summary,
        freeMonthlyCredits,
        packs,
        payment,
        balanceReady,
        balanceStale,
        refreshBalance,
        payTokenBalanceLabel,
        paySymbol,
        applyServerBalance,
        buyingPackId,
        billingMessage,
        setBillingMessage,
        buy,
        lastReceipt,
    };
}
