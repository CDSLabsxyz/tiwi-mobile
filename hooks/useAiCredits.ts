/**
 * AI credit balance + billing for the mobile chat.
 *
 * Free credits are device-local so guests can chat without a wallet. Paid
 * credits live in Supabase keyed by wallet. This hook:
 *
 *   • reads local free credits and server paid credits,
 *   • caches the last paid balance so the sheet still shows something offline,
 *   • loads the admin-managed pricing (allowance, packs, treasury/token),
 *   • drives purchases, which pay on-chain and then let the SERVER grant the
 *     credits after it re-verifies the transfer.
 */

import {
    DEFAULT_CREDIT_PACKS,
    DEFAULT_FREE_MONTHLY_CREDITS,
    EMPTY_PAYMENT_CONFIG,
    combineLocalFreeWithPaid,
    emptyBalance,
    fetchCreditBalance,
    fetchCreditSettings,
    findIndexedPayTokenBalance,
    formatCompactAmount,
    getCreditSummary,
    loadLocalFreeBalance,
    loadCachedBalance,
    purchaseCreditPack,
    readPayTokenBalance,
    retryPendingClaims,
    saveCachedBalance,
    spendLocalFreeCredit,
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
     * Adopt the paid balance returned by the chat route after a paid credit
     * spend. Local free credits are merged in on-device.
     */
    applyServerBalance: (balance: CreditBalance | null | undefined) => void;
    spendFreeCredit: () => Promise<boolean>;

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

    const adoptPaidBalance = useCallback(
        async (paidBalance: CreditBalance | null | undefined, fromServer: boolean) => {
            const localFree = await loadLocalFreeBalance(freeMonthlyCredits);
            const next = combineLocalFreeWithPaid(localFree, paidBalance);
            setBalanceStale(!fromServer);
            setBalanceReady(true);
            setBalance(next);
            if (fromServer && paidBalance) void saveCachedBalance(address, paidBalance);
        },
        [address, freeMonthlyCredits],
    );

    /**
     * Pull the authoritative balance. Any purchase whose credits were never
     * confirmed gets retried first, so an interrupted payment self-heals here.
     */
    const refreshBalance = useCallback(async () => {
        const claimed = await retryPendingClaims(address);
        if (claimed) {
            await adoptPaidBalance(claimed, true);
            return;
        }
        const fresh = address ? await fetchCreditBalance(address) : null;
        if (fresh) {
            await adoptPaidBalance(fresh, true);
            return;
        }
        // Paid ledger unreachable - keep local free credits working and use the
        // last paid balance we saw, if any.
        const cached = address ? await loadCachedBalance(address) : null;
        await adoptPaidBalance(cached, false);
    }, [address, adoptPaidBalance]);

    useEffect(() => {
        let cancelled = false;
        const key = address || 'guest';
        loadedKeyRef.current = null;
        setBalanceReady(false);
        setBillingMessage(null);

        (async () => {
            // Show local free + cached paid immediately, then let the server
            // correct the paid side.
            const cached = address ? await loadCachedBalance(address) : null;
            const localFree = await loadLocalFreeBalance(freeMonthlyCredits);
            if (cancelled) return;
            setBalance(combineLocalFreeWithPaid(localFree, cached));
            setBalanceStale(!!cached);
            setBalanceReady(true);
            loadedKeyRef.current = key;
            await refreshBalance();
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const localFree = await loadLocalFreeBalance(freeMonthlyCredits);
            if (!cancelled) setBalance((current) => combineLocalFreeWithPaid(localFree, current));
        })();
        return () => {
            cancelled = true;
        };
    }, [freeMonthlyCredits]);

    const applyServerBalance = useCallback(
        (next: CreditBalance | null | undefined) => {
            if (!next) return;
            void adoptPaidBalance(next, true);
        },
        [adoptPaidBalance],
    );

    const spendFreeCredit = useCallback(async () => {
        const localFree = await spendLocalFreeCredit(freeMonthlyCredits);
        if (!localFree) return false;
        setBalance((current) => combineLocalFreeWithPaid(localFree, current));
        setBalanceReady(true);
        setBalanceStale(false);
        return true;
    }, [freeMonthlyCredits]);

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
    // hide a balance the indexer already knows about - and vice versa.
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
                    // didn't - re-read so any credit that did land shows up.
                    void refreshBalance();
                    return null;
                }
                const { receipt } = result;
                setLastReceipt(receipt);
                if (result.balance) {
                    await adoptPaidBalance(result.balance, true);
                } else {
                    void refreshBalance();
                }
                setBillingMessage(
                    `Payment confirmed - ${receipt.credits} credits added.${receipt.txHash ? ` Tx: ${receipt.txHash.slice(0, 10)}…` : ''}`,
                );
                void refreshPayTokenBalance();
                return receipt;
            } finally {
                setBuyingPackId(null);
            }
        },
        [address, adoptPaidBalance, payment, paySymbol, refreshBalance, refreshPayTokenBalance],
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
        spendFreeCredit,
        buyingPackId,
        billingMessage,
        setBillingMessage,
        buy,
        lastReceipt,
    };
}
