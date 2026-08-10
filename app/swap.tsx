import {
    ChainOption,
    ChainSelectSheet,
    ChainSelectorCard,
    ExpiresSection,
    LimitAssetSheet,
    LimitWhenPriceCard,
    SwapConfirmButton,
    BscGasSelector,
    RecipientAddressSheet,
    truncateAddress,
    SwapDetailsCard,
    SwapDirectionButton,
    SwapHeader,
    SwapLoadingOverlay,
    SwapSettingsSheet,
    SwapSuccessModal,
    SwapTabs,
    SwapTokenCard,
    TokenOption,
    UnifiedAssetSelectSheet,
    SwapKeyboard
} from '@/components/sections/Swap';
import { Ionicons } from '@expo/vector-icons';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { WalletModal } from '@/components/ui/wallet-modal';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useTokenPrefetch } from '@/hooks/useTokenPrefetch';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { activityService } from '@/services/activityService';
import { api } from '@/lib/mobile/api-client';
import { getChainById } from '@/services/signer/SignerUtils';
import { securityGuard } from '@/services/securityGuard';
import { executeSwap, fetchSwapQuote } from '@/services/swap';
import { isNativeToken } from '@/services/swap/constants';
import { BASIS_POINTS, GasTokenType, getTaxRate } from '@/services/swap/core/config/tax-config';
import { listReadySecondLegs, completeSecondLeg } from '@/services/swap/core/executors/cross-chain-postswap-executor';
import { isAddressChainCompatible } from '@/services/swap/core/utils/wallet-display';
import { isSameTokenAddress, MORALIS_NATIVE_ADDRESS, NATIVE_TOKEN_ADDRESS } from '@/utils/wallet';
import { useLocaleStore } from '@/store/localeStore';
import { useCustomTokenStore } from '@/store/customTokenStore';
import { useSecurityStore } from '@/store/securityStore';
import { useSwapStore } from '@/store/swapStore';
import { useWalletStore } from '@/store/walletStore';
import { formatCompactNumber, formatFiatValue, formatTokenAmount } from '@/utils/formatting';
import { useRequireBackup } from '@/hooks/useRequireBackup';
import { useTokenDetail } from '@/hooks/useTokenDetail';
import TokenOverviewCard from '@/components/sections/Swap/TokenOverviewCard';
import { resolveMarketToken } from '@/utils/market-token-resolver';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SwapScreen() {
    const { bottom } = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();

    // Backup gate — checked at action-time (swap button press), not on page mount.
    const { requireBackup, BackupRequiredModal } = useRequireBackup();
    const params = useLocalSearchParams<{
        assetId?: string;
        symbol?: string;
        name?: string;
        balance?: string;
        usdValue?: string;
        chainId?: string;
        logo?: string;
        priceUSD?: string;
        // Pool-page deep link: a full pair plus (optionally) the pool to route
        // through. Mirrors the web's buildSwapHref.
        fromTokenAddress?: string;
        fromChainId?: string;
        fromSymbol?: string;
        fromLogo?: string;
        fromDecimals?: string;
        toTokenAddress?: string;
        toChainId?: string;
        toSymbol?: string;
        toLogo?: string;
        toDecimals?: string;
        poolAddress?: string;
        preferredRouter?: string;
        /**
         * Set by the Market / Spotlight lists. Those rows come from the
         * aggregate market feed, where `address` is a provider slug
         * ("bitcoin") and `chainId` is always 1 — not something the engine can
         * quote. `1` means "look this asset up before seeding it".
         */
        needsResolve?: string;
        /**
         * 'listing' | 'spotlight' — set only when the row was tapped from a
         * curated tab. Gates the admin-authored token overview below the CTA.
         */
        infoSource?: string;
    }>();

    // Prefetch top chain tokens
    useTokenPrefetch();

    const { data: chains } = useChains();

    const {
        activeTab,
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount,
        toAmount,
        toFiatAmount,
        setActiveTab,
        setFromChain,
        setToChain,
        setFromToken,
        setToToken,
        setPinnedPool,
        setFromAmount,
        setToAmount,
        setToFiatAmount,
        swapDirection,
        isFormValid,
        hasValidQuote,
        setSwapQuote,
        swapQuote,
        quoteStep,
        setQuoteStep,
        whenPrice,
        setWhenPrice,
        expiresOption,
        setExpiresOption,
        slippage,
        setSlippage,
        useRelayer,
        setUseRelayer,
        isChainSheetVisible,
        openChainSheet,
        closeChainSheet,
        chainSheetTarget,
        selectedGasTokenType,
        setSelectedGasTokenType,
        selectedGasToken,
        setSelectedGasToken,
        resetSwapState,
    } = useSwapStore();

    const [fromFiatAmount, setFromFiatAmount] = useState('$0.00');
    /** The input amount the current quote was fetched for — see the From-fiat effect. */
    const [quotedFromAmount, setQuotedFromAmount] = useState('');
    const queryClient = useQueryClient();

    const { currency, region } = useLocaleStore();

    // UI state
    const {
        isWalletModalVisible: isGlobalWalletModalVisible,
        setWalletModalVisible: setGlobalWalletModalVisible
    } = useWalletStore();
    const [isSettingsSheetVisible, setIsSettingsSheetVisible] = useState(false);
    const [assetSheetTarget, setAssetSheetTarget] = useState<'from' | 'to' | null>(null);
    const [assetSheetInitialStep, setAssetSheetInitialStep] = useState<'chains' | 'tokens'>('chains');
    const [isLimitAssetSheetVisible, setIsLimitAssetSheetVisible] = useState(false);
    const [whenPriceTarget, setWhenPriceTarget] = useState<'from' | 'to'>('to');

    const [isLoadingQuote, setIsLoadingQuote] = useState(false);
    const [customExpiryValue, setCustomExpiryValue] = useState('');
    const [customExpiryUnit, setCustomExpiryUnit] = useState<'hours' | 'days' | 'months'>('days');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isStale, setIsStale] = useState(false);
    const [isLoadingSwap, setIsLoadingSwap] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState<number>(0);
    const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
    const [isComingSoonVisible, setIsComingSoonVisible] = useState(false);
    const [swapErrorMessage, setSwapErrorMessage] = useState<string | null>(null);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    /** Live stage from the swap engine ("Approving…", "Confirming…", …). */
    const [swapStage, setSwapStage] = useState<string | null>(null);
    /** Token picker for the BSC "Other token" fee tier. */
    const [isGasTokenSheetVisible, setIsGasTokenSheetVisible] = useState(false);
    /**
     * Optional "send to" override. null = deliver to my own wallet.
     * This is what makes cross-VM swaps possible when the wallet has no address
     * on the destination chain — the engine's cross-VM guard needs a recipient
     * that is valid there or it refuses the swap.
     */
    const [recipientAddress, setRecipientAddress] = useState<string | null>(null);
    const [isRecipientSheetVisible, setIsRecipientSheetVisible] = useState(false);

    const scrollViewRef = React.useRef<ScrollView>(null);
    /** Aborts a superseded in-flight quote. */
    const quoteAbortRef = React.useRef<AbortController | null>(null);
    /** Signature of the last requested quote, to skip duplicate fetches. */
    const lastQuoteKeyRef = React.useRef<string>('');

    useEffect(() => {
        if (isKeyboardVisible) {
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 150, animated: true });
            }, 50);
        }
    }, [isKeyboardVisible]);

    const { address, walletGroups, activeGroupId } = useWalletStore();

    // Map chainId to wallet chain type
    const getChainTypeFromId = (chainId: any): string => {
        if (typeof chainId !== 'number') return 'EVM';
        if (chainId === 7565164 || chainId === 1399811149) return 'SOLANA';
        if (chainId === 728126428) return 'TRON';
        if (chainId === 1100 || chainId === 99999) return 'TON';
        if (chainId === 118 || chainId === 99998) return 'COSMOS';
        if (chainId === 249339) return 'OSMOSIS';
        if (chainId === 8000001) return 'INJECTIVE';
        if (chainId === 8000003) return 'JUNO';
        if (chainId === 8000004) return 'STRIDE';
        if (chainId === 8000005) return 'DYDX';
        if (chainId === 8000006) return 'KUJIRA';
        if (chainId === 8000007) return 'SECRET';
        if (chainId === 8000008) return 'CELESTIA';
        if (chainId === 8000009) return 'ARCHWAY';
        if (chainId === 8000010) return 'SAGA';
        if (chainId === 8000011) return 'NEUTRON';
        if (chainId === 8000012) return 'NIBIRU';
        if (chainId === 101) return 'SUI';
        if (chainId === 637) return 'APTOS';
        if (chainId === 8332) return 'BITCOIN';
        if (chainId === 23448594291968334) return 'STARKNET';
        return 'EVM';
    };

    // Get wallet address for a specific chain
    const getAddressForChain = useCallback((chainId: any) => {
        const group = walletGroups.find(g => g.id === activeGroupId);
        if (!group) return address || '';
        const chainType = getChainTypeFromId(chainId);
        return (group.addresses as any)?.[chainType] || address || '';
    }, [walletGroups, activeGroupId, address]);

    /**
     * The address the swap output goes to.
     *
     * A user-set recipient wins; otherwise it's our own address on the
     * destination chain (which may be '' when the wallet has no key for that
     * chain — in that case the swap needs a pasted recipient and the engine
     * will say so rather than deliver somewhere unrecoverable).
     */
    // A recipient is only valid for the chain it was entered for. If the user
    // changes the destination, drop an address that no longer fits rather than
    // quoting (and worse, delivering) to an address of the wrong family.
    useEffect(() => {
        if (!recipientAddress || !toToken?.chainId) return;
        if (!isAddressChainCompatible(recipientAddress, Number(toToken.chainId))) {
            setRecipientAddress(null);
        }
    }, [recipientAddress, toToken?.chainId]);

    const resolveRecipient = useCallback((chainId: any) => {
        return recipientAddress || getAddressForChain(chainId);
    }, [recipientAddress, getAddressForChain]);

    // Determine if this is a bridge (cross-chain) or same-chain swap
    const isBridge = useMemo(() => {
        if (!fromChain || !toChain) return false;
        return fromChain.id !== toChain.id;
    }, [fromChain, toChain]);
    const { isTransactionRiskEnabled } = useSecurityStore();
    const { data: balanceData } = useWalletBalances();

    // Tokens the user toggled off in Manage Tokens must read as zero-balance
    // on the swap card — surfacing the real balance would let them Max-in a
    // position they're intentionally treating as unavailable.
    const hiddenWalletTokens = useCustomTokenStore(s => s.hiddenWalletTokens);
    const customTokensByWallet = useCustomTokenStore(s => s.tokensByWallet);
    const swapWalletKey = activeGroupId || address || 'default';
    // Native tokens come back from the balance API under a chain-specific
    // sentinel (e.g. 0xeeee... for Moralis) while swap defaults use 0x0000...
    // Add both variants whenever either is hidden so native-address mismatches
    // don't leak past the hidden check.
    const addKeysFor = (set: Set<string>, chainId: number, address: string) => {
        const lower = address.toLowerCase();
        set.add(`${chainId}-${lower}`);
        if (lower === NATIVE_TOKEN_ADDRESS || lower === MORALIS_NATIVE_ADDRESS) {
            set.add(`${chainId}-${NATIVE_TOKEN_ADDRESS}`);
            set.add(`${chainId}-${MORALIS_NATIVE_ADDRESS}`);
        }
    };

    const hiddenKeySet = useMemo(() => {
        const set = new Set<string>();
        (hiddenWalletTokens[swapWalletKey] || []).forEach(r => {
            addKeysFor(set, r.chainId, r.address);
        });
        (customTokensByWallet[swapWalletKey] || []).forEach(ct => {
            if (ct.hidden) addKeysFor(set, ct.chainId, ct.address);
        });
        return set;
    }, [hiddenWalletTokens, customTokensByWallet, swapWalletKey]);

    const isTokenHidden = useCallback((addr?: string, cid?: number) => {
        if (!addr || cid == null) return false;
        return hiddenKeySet.has(`${cid}-${addr.toLowerCase()}`);
    }, [hiddenKeySet]);

    // 1. Sync Balances for selected tokens
    useEffect(() => {
        if (!balanceData) return;

        if (fromToken) {
            const hidden = isTokenHidden(fromToken.address, fromToken.chainId);
            const walletToken = balanceData.tokens.find(
                t => isSameTokenAddress(t.address, fromToken.address) && t.chainId === fromToken.chainId
            );
            if (hidden) {
                setFromToken({
                    ...fromToken,
                    balanceToken: `0 ${fromToken.symbol}`,
                    balanceFiat: '$0.00',
                });
            } else if (walletToken) {
                setFromToken({
                    ...fromToken,
                    balanceToken: `${parseFloat(walletToken.balanceFormatted || '0').toFixed(6)} ${fromToken.symbol}`,
                    balanceFiat: `$${parseFloat(walletToken.usdValue || '0').toFixed(2)}`
                });
            }
        }

        if (toToken) {
            const hidden = isTokenHidden(toToken.address, toToken.chainId);
            const walletToken = balanceData.tokens.find(
                t => isSameTokenAddress(t.address, toToken.address) && t.chainId === toToken.chainId
            );
            if (hidden) {
                setToToken({
                    ...toToken,
                    balanceToken: `0 ${toToken.symbol}`,
                    balanceFiat: '$0.00',
                });
            } else if (walletToken) {
                setToToken({
                    ...toToken,
                    balanceToken: `${parseFloat(walletToken.balanceFormatted || '0').toFixed(6)} ${toToken.symbol}`,
                    balanceFiat: `$${parseFloat(walletToken.usdValue || '0').toFixed(2)}`
                });
            }
        }
    }, [balanceData, fromToken?.address, fromToken?.chainId, toToken?.address, toToken?.chainId, isTokenHidden]);

    // 2. Fetch Prices Updates (BNB & TWC) silently in background
    useEffect(() => {
        // Skip default price updates if we're pre-populating from params.
        // Both deep-link shapes must be covered: this effect is declared BEFORE
        // them, so on mount it still sees the default BNB/TWC pair.
        if (hasParams && !paramsAppliedRef.current) return;
        if (hasPairParams && !pairParamsAppliedRef.current) return;
        if (needsResolve && !resolveAppliedRef.current) return;

        const updatePrices = async () => {
            try {
                // Silently update chain icons if missing
                if (chains && fromChain && !fromChain.icon) {
                    const real = chains.find(c => c.id === fromChain.id);
                    if (real) setFromChain({ ...fromChain, icon: real.logoURI });
                }
                if (chains && toChain && !toChain.icon) {
                    const real = chains.find(c => c.id === toChain.id);
                    if (real) setToChain({ ...toChain, icon: real.logoURI });
                }

                // Silently update token info if it's our defaults.
                // The chain has to match too: every native coin is spelled with
                // the zero address, so an address-only test would stamp BNB's
                // price onto SOL, AVAX, TRX… whenever one of those is the
                // selected "From" token.
                const isDefaultBnb =
                    fromToken?.address === "0x0000000000000000000000000000000000000000" &&
                    Number(fromToken?.chainId) === 56;
                const isDefaultTwc =
                    toToken?.address?.toLowerCase() === "0xda1060158f7d593667cce0a15db346bb3ffb3596" &&
                    Number(toToken?.chainId) === 56;

                if (isDefaultBnb || isDefaultTwc) {
                    const [bnbRes, twcRes] = await Promise.all([
                        api.tokens.list({ address: '0x0000000000000000000000000000000000000000', chains: [56], limit: 1 }),
                        api.tokens.list({ address: '0xDA1060158F7D593667CCE0A15DB346BB3FFB3596', chains: [56], limit: 1 })
                    ]);

                    // `liquidity` is carried through as well as the price: it's
                    // sent to the route API as liquidityUSD, and without it the
                    // very first quote a user sees (the default BNB→TWC pair)
                    // pays for a server-side DexScreener lookup — seconds, not
                    // milliseconds. This response already contains it.
                    // Re-read the CURRENT selection before writing. `fromToken`
                    // in this closure is whatever was selected when the effect
                    // ran; a deep link (or the user) can change it while the
                    // fetch is in flight, and merging the stale value would put
                    // the default BNB/TWC pair back on screen.
                    const live = useSwapStore.getState();
                    const stillDefaultBnb =
                        live.fromToken?.address === "0x0000000000000000000000000000000000000000" &&
                        Number(live.fromToken?.chainId) === 56;
                    const stillDefaultTwc =
                        live.toToken?.address?.toLowerCase() === "0xda1060158f7d593667cce0a15db346bb3ffb3596" &&
                        Number(live.toToken?.chainId) === 56;

                    if (isDefaultBnb && stillDefaultBnb && bnbRes.tokens?.[0]) {
                        const bnb = bnbRes.tokens[0];
                        setFromToken({
                            ...live.fromToken!,
                            priceUSD: bnb.priceUSD,
                            liquidity: bnb.liquidity ?? live.fromToken!.liquidity,
                            tvl: bnb.marketCap ? `$${formatCompactNumber(bnb.marketCap)}` : live.fromToken!.tvl,
                        });
                    }
                    if (isDefaultTwc && stillDefaultTwc && twcRes.tokens?.[0]) {
                        const twc = twcRes.tokens[0];
                        setToToken({
                            ...live.toToken!,
                            priceUSD: twc.priceUSD,
                            liquidity: twc.liquidity ?? live.toToken!.liquidity,
                            tvl: twc.marketCap ? `$${formatCompactNumber(twc.marketCap)}` : live.toToken!.tvl,
                        });
                    }
                }
            } catch (err) {
                console.warn('[SwapScreen] Background price update failed:', err);
            }
        };

        updatePrices();
    }, [chains, fromChain?.id, toChain?.id]);

    // 2a. Pre-populate BOTH sides when deep-linked from a liquidity pool page.
    // Same params the web's buildSwapHref emits. When the pool is a real
    // on-chain TIWI pair it also carries poolAddress + preferredRouter, which
    // pins routing to that pair for as long as the user leaves the pair alone.
    const hasPairParams = !!(params.fromTokenAddress && params.toTokenAddress && params.fromChainId);
    const pairParamsAppliedRef = React.useRef(false);

    useEffect(() => {
        if (!hasPairParams || !chains || pairParamsAppliedRef.current) return;

        const fromChainId = Number(params.fromChainId);
        const toChainId = Number(params.toChainId || params.fromChainId);
        const srcChain = chains.find((c: any) => Number(c.id) === fromChainId);
        const dstChain = chains.find((c: any) => Number(c.id) === toChainId);
        if (!srcChain || !dstChain) return;

        pairParamsAppliedRef.current = true;

        const toChainOption = (c: any) => ({ id: c.id, name: c.name, icon: c.logoURI });
        const seed = (addr: string, sym: string, logo: string | undefined, dec: string | undefined, cid: number) => ({
            id: `${cid}-${addr}`,
            symbol: sym,
            name: sym,
            icon: logo,
            address: addr,
            chainId: cid,
            decimals: dec ? Number(dec) : 18,
            balanceToken: '0.00',
            balanceFiat: '$0.00',
            priceUSD: '0',
        }) as any;

        setFromChain(toChainOption(srcChain));
        setToChain(toChainOption(dstChain));
        // setFromToken/setToToken clear any pool pin, so pin AFTER seeding.
        setFromToken(seed(params.fromTokenAddress!, params.fromSymbol || '', params.fromLogo, params.fromDecimals, fromChainId));
        setToToken(seed(params.toTokenAddress!, params.toSymbol || '', params.toLogo, params.toDecimals, toChainId));

        if (params.poolAddress && params.preferredRouter) {
            setPinnedPool(params.poolAddress, params.preferredRouter);
        }

        // The link carries no liquidity and only the pool's stored decimals.
        // Enrich both sides from the token list for the same reasons as the
        // single-token path below (quote latency + correct amount scaling).
        const enrich = async (addr: string, cid: number, apply: (real: any) => void) => {
            try {
                const res = await api.tokens.list({ address: addr, chains: [cid], limit: 1 });
                const real = res?.tokens?.[0];
                if (real) apply(real);
            } catch (e) {
                console.warn('[SwapScreen] Pool deep-link enrich failed:', e);
            }
        };
        // Merge onto the LIVE token, and only while it is still the one this
        // link asked for — the user may have picked something else meanwhile.
        const stillSelected = (side: 'from' | 'to', addr: string) => {
            const t = side === 'from' ? useSwapStore.getState().fromToken : useSwapStore.getState().toToken;
            return t && (t.address || '').toLowerCase() === addr.toLowerCase() ? t : null;
        };
        void enrich(params.fromTokenAddress!, fromChainId, (real) => {
            const live = stillSelected('from', params.fromTokenAddress!);
            if (!live) return;
            setFromToken({
                ...live,
                decimals: real.decimals ?? live.decimals,
                liquidity: real.liquidity,
                priceUSD: real.priceUSD || live.priceUSD || '0',
            } as any);
        });
        void enrich(params.toTokenAddress!, toChainId, (real) => {
            const live = stillSelected('to', params.toTokenAddress!);
            if (!live) return;
            setToToken({
                ...live,
                decimals: real.decimals ?? live.decimals,
                liquidity: real.liquidity,
                priceUSD: real.priceUSD || live.priceUSD || '0',
            } as any);
        });
    }, [hasPairParams, chains]);

    // 2b. Pre-populate from a Market / Spotlight row.
    //
    // Those rows describe an *asset* (BTC, XRP), not a token: the aggregate
    // market feed reports `address` as the provider's slug and `chainId` as 1
    // for everything. So the row is seeded straight away — the user sees what
    // they tapped, immediately — while `resolveMarketToken` finds the real
    // (chain, contract) behind it. Resolution takes a round-trip or two, but
    // the "To" side is deliberately cleared here, so no quote can fire before
    // the real token has landed.
    const needsResolve = !hasPairParams && params.needsResolve === '1' && !!params.symbol;

    // Reads /api/v1/token-info, which merges the admin `about`/`links` from the
    // Listing / Spotlight tables (and falls back to them when the market
    // providers can't resolve the token at all).
    const { data: tokenOverview, isLoading: isTokenOverviewLoading } = useTokenDetail({
        address: fromToken?.address,
        chainId: fromToken?.chainId,
        symbol: fromToken?.symbol,
        enabled: !!fromToken?.address && !!fromToken?.chainId,
    });

    /**
     * The overview shows whenever this token's (chainId, address) matches a
     * Listing or Spotlight row — wherever it was opened from. The API only
     * returns `about`/`links` for curated rows, so their presence IS the match;
     * the `infoSource` route param is no longer what decides it.
     */
    const showTokenOverview = Boolean(
        (tokenOverview?.about || '').trim() || tokenOverview?.links?.length,
    );

    const resolveAppliedRef = React.useRef(false);
    const [isResolvingMarketToken, setIsResolvingMarketToken] = useState(false);
    /** Measured height of the pinned CTA footer — reserved as scroll padding. */
    const [footerHeight, setFooterHeight] = useState(0);
    /**
     * Tied to unmount, not to the effect. The effect re-runs whenever the chain
     * registry refetches, and a per-run cleanup flag would abandon an in-flight
     * resolution — leaving the From card stuck on the unresolved seed.
     */
    const resolveCancelledRef = React.useRef(false);
    useEffect(() => () => { resolveCancelledRef.current = true; }, []);

    useEffect(() => {
        if (!needsResolve || !chains || resolveAppliedRef.current) return;
        resolveAppliedRef.current = true;

        const symbol = params.symbol!;
        const seeded = {
            id: params.assetId || symbol,
            symbol,
            name: params.name || symbol,
            icon: params.logo,
            // No address yet — deliberately. An unresolved row must never look
            // routable to the quote/balance code.
            address: '',
            chainId: 0,
            decimals: 18,
            balanceToken: '0.00',
            balanceFiat: '$0.00',
            priceUSD: params.priceUSD || '0',
        } as any;

        setFromChain(null);
        setFromToken(seeded);
        setToChain(null);
        setToToken(null);
        setIsResolvingMarketToken(true);

        resolveMarketToken(
            {
                symbol,
                name: params.name,
                address: params.assetId,
                chainId: params.chainId ? Number(params.chainId) : undefined,
                priceUSD: params.priceUSD,
                logo: params.logo,
            },
            { chains },
        )
            .then((resolved) => {
                if (resolveCancelledRef.current) return;

                if (!resolved) {
                    // No on-chain representation we can route (XMR-style assets
                    // and most tokenised funds). Say so rather than leaving a
                    // token that fails at quote time.
                    resetSwapState();
                    Alert.alert(
                        'Not available to swap',
                        `${symbol} isn't tradable on any chain we route yet. Pick another token to get started.`,
                    );
                    return;
                }

                const chain = chains.find((c: any) => Number(c.id) === resolved.chainId);
                if (!chain) {
                    resetSwapState();
                    Alert.alert(
                        'Not available to swap',
                        `${symbol} lives on a chain this app doesn't support yet.`,
                    );
                    return;
                }

                const applied = {
                    ...seeded,
                    id: `${resolved.chainId}-${resolved.address}`,
                    symbol: resolved.symbol,
                    name: resolved.name,
                    icon: resolved.logoURI || params.logo,
                    address: resolved.address,
                    chainId: resolved.chainId,
                    decimals: resolved.decimals ?? 18,
                    priceUSD: resolved.priceUSD || seeded.priceUSD,
                    liquidity: resolved.liquidity,
                } as any;

                setFromChain({ id: chain.id, name: chain.name, icon: chain.logoURI });
                setFromToken(applied);

                // The index's search results don't always carry decimals, and
                // the 18 above is only a placeholder — a wrong value mis-scales
                // the amount, so the quote would be for the wrong size entirely.
                // The by-address lookup is a different server path and usually
                // has them.
                if (resolved.decimals == null) {
                    api.tokens
                        .list({ address: resolved.address, chains: [resolved.chainId], limit: 1 })
                        .then((res) => {
                            const real = res?.tokens?.[0];
                            if (resolveCancelledRef.current || real?.decimals == null) return;
                            const live = useSwapStore.getState().fromToken;
                            if (!live || (live.address || '').toLowerCase() !== resolved.address.toLowerCase()) return;
                            setFromToken({ ...live, decimals: real.decimals } as any);
                        })
                        .catch(() => {});
                }
            })
            .catch((e) => {
                if (resolveCancelledRef.current) return;
                console.warn('[SwapScreen] Market token resolve failed:', e);
                resetSwapState();
                Alert.alert('Something went wrong', `Couldn't look up ${symbol}. Please try again.`);
            })
            .finally(() => {
                if (!resolveCancelledRef.current) setIsResolvingMarketToken(false);
            });
    }, [needsResolve, chains]);

    // 2c. Pre-populate from params if coming from asset detail
    const hasParams = !hasPairParams && !needsResolve && !!(params.symbol && params.chainId);
    const paramsAppliedRef = React.useRef(false);

    useEffect(() => {
        if (hasParams && chains && !paramsAppliedRef.current) {
            const chain = chains.find(c => String(c.id) === params.chainId);

            if (chain) {
                paramsAppliedRef.current = true;
                const chainOption = {
                    id: chain.id,
                    name: chain.name,
                    icon: chain.logoURI
                };
                setFromChain(chainOption);

                const seeded = {
                    id: params.assetId || params.symbol,
                    symbol: params.symbol!,
                    name: params.name || params.symbol!,
                    icon: params.logo,
                    balanceToken: params.balance || '0.00',
                    balanceFiat: params.usdValue || '$0.00',
                    priceUSD: params.priceUSD || '0',
                    address: params.assetId || '',
                    chainId: chainOption.id,
                    decimals: 18,
                } as any;
                setFromToken(seeded);
                setToChain(null);
                setToToken(null);

                // The deep-link params carry no `liquidity` and no real
                // `decimals` — the 18 above is a placeholder. Enrich from the
                // token list (the same source the asset sheet uses):
                //   • `liquidity` → sent as liquidityUSD, without which every
                //     quote for this token pays a slow server-side lookup.
                //   • `decimals`  → a hardcoded 18 mis-scales the amount for any
                //     token that isn't 18dp (USDC/USDT are 6, TWC is 9), so the
                //     quote is for the wrong size entirely.
                if (seeded.address) {
                    api.tokens
                        .list({ address: seeded.address, chains: [chainOption.id], limit: 1 })
                        .then((res) => {
                            const real = res?.tokens?.[0];
                            if (!real) return;
                            setFromToken({
                                ...seeded,
                                decimals: real.decimals ?? seeded.decimals,
                                liquidity: real.liquidity,
                                priceUSD: real.priceUSD || seeded.priceUSD,
                            } as any);
                        })
                        .catch((e) => console.warn('[SwapScreen] Deep-link token enrich failed:', e));
                }
            }
        }
    }, [hasParams, chains]);

    const handleOpenAssetSheet = (target: 'from' | 'to', initialStep: 'chains' | 'tokens' = 'tokens') => {
        setAssetSheetTarget(target);
        setAssetSheetInitialStep(initialStep);
    };

    const handleCloseAssetSheet = () => setAssetSheetTarget(null);

    const handleAssetSelect = (chain: ChainOption, token: TokenOption) => {
        if (assetSheetTarget === 'from') {
            setFromChain(chain);
            setFromToken(token);
        } else {
            setToChain(chain);
            setToToken(token);
        }
        setFromAmount('');
        setToAmount('');
        setFromFiatAmount('$0.00');
        setToFiatAmount('$0.00');
        setSwapQuote(null);
        handleCloseAssetSheet();
    };

    /**
     * Gas-token pick for the BSC fee tier.
     *
     * Picking TWC or BNB snaps to their own (cheaper) tier rather than leaving
     * the user on the 0.30% "other" rate for a token that has a dedicated one.
     * Any other BEP-20 sets OTHER_BSC with that token attached. Clears the quote
     * because the tier changes the fee the routing engine prices in.
     */
    const handleGasTokenSelect = (_chain: ChainOption, token: TokenOption) => {
        const symbol = token.symbol?.toUpperCase();

        if (symbol === 'TWC') {
            setSelectedGasTokenType(GasTokenType.TWC);
        } else if (symbol === 'BNB' || symbol === 'WBNB') {
            setSelectedGasTokenType(GasTokenType.BNB);
        } else {
            setSelectedGasTokenType(GasTokenType.OTHER_BSC);
            setSelectedGasToken(token);
        }

        setSwapQuote(null);
        setIsGasTokenSheetVisible(false);
    };

    const handleChainOptionSelect = (option: any) => {
        const chain: ChainOption = {
            id: option.id,
            name: option.name,
            icon: option.icon,
        };

        if (chainSheetTarget === 'from') {
            setFromChain(chain);
        } else if (chainSheetTarget === 'to') {
            setToChain(chain);
        }
        setSwapQuote(null);
        closeChainSheet();
    };

    const handleLimitAssetSelect = (target: 'from' | 'to') => {
        setWhenPriceTarget(target);
        setIsLimitAssetSheetVisible(false);
    };

    const handleKeyboardPress = (key: string) => {
        if (key === 'CLEAR') {
            setFromAmount('');
            return;
        }
        if (key === 'DELETE') {
            setFromAmount(fromAmount.slice(0, -1));
            return;
        }

        if (key === '.' && fromAmount.includes('.')) return;

        if (key === '.' && (!fromAmount || fromAmount === '')) {
            setFromAmount('0.');
            return;
        }

        if (fromAmount.includes('.')) {
            const [, dec] = fromAmount.split('.');
            if (dec && dec.length >= 6) return;
        }

        setFromAmount(fromAmount + key);
    };

    const parseBalanceToken = (balanceStr: string): number => {
        const parts = balanceStr.trim().split(/\s+/);
        let num = parseFloat(parts[0] || '0');
        const suffix = (parts[1] || '').toUpperCase();
        if (suffix === 'B') num *= 1e9;
        else if (suffix === 'M') num *= 1e6;
        else if (suffix === 'K') num *= 1e3;
        return num;
    };

    const handlePercentagePress = (percentage: number) => {
        if (!fromToken?.balanceToken) return;
        const maxBal = parseBalanceToken(fromToken.balanceToken);
        if (maxBal <= 0) return;
        let val = maxBal * percentage / 100;

        // On Max, leave room for the protocol fee. The engine transfers it ON
        // TOP of the swap amount, so a true 100% would leave nothing to pay it
        // with. Rate comes from the same config the executors charge from — not
        // a hardcoded number — and only applies where a SEPARATE fee transfer
        // actually happens (ERC-20 input on an EVM chain).
        if (percentage === 100) {
            const chainId = Number(fromChain?.id) || 56;
            const isEvm = ![7565164, 1399811149, 728126428, 1100, 99999, 118, 99998, 249339, 8000001, 8000003, 8000004, 8000005, 8000006, 8000007, 8000008, 8000009, 8000010, 8000011, 8000012, 101, 637, 8332, 23448594291968334].includes(chainId);
            const feeIsInline = useSwapStore.getState().swapQuote?.route?.fees?.taxMode === 'inline';
            if (isEvm && !feeIsInline && !isNativeToken(fromToken.address)) {
                const feeRate = getTaxRate(chainId, selectedGasTokenType) / BASIS_POINTS;
                val = val / (1 + feeRate);
            }
        }

        setFromAmount(val.toFixed(6).replace(/\.?0+$/, ''));
    };

    /**
     * Where the drag slider's knob sits: the typed amount as a share of balance.
     * Max lands a hair under 100% on chains where the protocol fee is reserved
     * out of the balance (see handlePercentagePress), so treat "within a
     * rounding whisker of the reservable max" as a full 100 — otherwise the knob
     * would stick at 99% right after tapping Max.
     */
    const fromHasBalance = useMemo(
        () => parseBalanceToken(fromToken?.balanceToken || '0') > 0,
        [fromToken?.balanceToken],
    );

    const fromPercentOfBalance = useMemo(() => {
        const maxBal = parseBalanceToken(fromToken?.balanceToken || '0');
        const current = parseFloat(fromAmount || '0');
        if (!(maxBal > 0) || !(current > 0)) return 0;
        const pct = (current / maxBal) * 100;
        return pct >= 99.5 ? 100 : Math.min(100, Math.max(0, pct));
    }, [fromAmount, fromToken?.balanceToken]);

    const handleSliderChange = (percent: number) => {
        if (percent <= 0) { setFromAmount(''); return; }
        handlePercentagePress(percent);
    };


    const handleSwapDirection = () => {
        swapDirection();
    };

    const updateQuote = useCallback(async (isRefresh = false) => {
        if (!fromAmount || parseFloat(fromAmount) <= 0 || !fromToken || !toToken) {
            setSwapQuote(null);
            setToAmount('');
            setToFiatAmount('$0.00');
            setLastFetchTime(0);
            setIsStale(false);
            lastQuoteKeyRef.current = '';
            return;
        }

        // Duplicate-request guard (ported from useSwapQuote). The pair MUST be
        // part of the key — otherwise changing one token while keeping the same
        // amount produces an identical key, the fetch is skipped, and the
        // previous pair's quote stays on screen. The pinned pool belongs in the
        // key too: arriving from a pool page onto an already-quoted pair must
        // re-quote, since the route is now forced through that pair.
        const pinnedPool = useSwapStore.getState().pinnedPoolAddress || '';
        const quoteKey = `${fromAmount}-${fromToken.chainId}:${fromToken.address}->${toToken.chainId}:${toToken.address}-${slippage}-${pinnedPool}`;
        if (!isRefresh && quoteKey === lastQuoteKeyRef.current) {
            return;
        }
        lastQuoteKeyRef.current = quoteKey;

        // Cancel any quote still in flight. Without this a slow request could
        // land AFTER a newer one and overwrite the fresh rate with a stale one,
        // and rapid typing left several requests racing.
        quoteAbortRef.current?.abort();
        const abortController = new AbortController();
        quoteAbortRef.current = abortController;

        // Staged progress copy, ported from useSwapQuote. Routing genuinely
        // takes a few seconds on thin pairs, and a silent skeleton reads as a
        // hung screen — this tells the user what the router is doing.
        const stepTimers: any[] = [];
        setQuoteStep('Searching routes...');
        stepTimers.push(setTimeout(() => setQuoteStep('Scanning DEXes...'), 1200));
        stepTimers.push(setTimeout(() => setQuoteStep('Tiwiculating best price...'), 3500));
        stepTimers.push(setTimeout(() => setQuoteStep('Verifying liquidity...'), 8000));
        stepTimers.push(setTimeout(() => setQuoteStep('Finalizing best route...'), 15000));
        stepTimers.push(setTimeout(() => setQuoteStep('Searching deeper for better rates...'), 25000));
        const clearStepTimers = () => stepTimers.forEach(clearTimeout);

        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoadingQuote(true);
            setIsStale(false); // Reset stale on manual change
        }
        try {
            const fromAddr = getAddressForChain(fromToken.chainId);
            const toAddr = resolveRecipient(toToken.chainId);
            // No token-specific client-side overrides here — the web app has
            // none. Fee-on-transfer tokens (TWC and friends) are handled where
            // they should be: the backend routes them, and the executors run
            // with isFeeOnTransfer so they call the
            // …SupportingFeeOnTransferTokens router functions. The old
            // client-side forced 10% slippage and price-derived output override
            // showed a number the route would never actually deliver.
            const fetchedQuote = await fetchSwapQuote(
                fromAmount, fromToken, toToken, fromAddr, toAddr, slippage,
                { signal: abortController.signal },
            );

            // A newer quote superseded this one while it was in flight.
            if (abortController.signal.aborted) return;

            if (fetchedQuote) {
                setSwapQuote(fetchedQuote);
                setQuotedFromAmount(fromAmount);
                setLastFetchTime(Date.now());
                setToAmount(fetchedQuote.toAmount);
                setIsStale(false);

                // Prefer the route's own USD figure (route.toToken.amountUSD),
                // which is what the web card shows. It reflects the actual
                // routed output; a local price × amount multiply drifts from it
                // on taxed tokens and thin pools. Fall back to the price calc
                // only when the route carries no USD value.
                const routeToUsd = parseFloat(fetchedQuote.toAmountUSD || fetchedQuote.fiatAmount || '0');
                if (routeToUsd > 0) {
                    setToFiatAmount(formatFiatValue(routeToUsd, region, currency));
                } else if (toToken.priceUSD && parseFloat(fetchedQuote.toAmount) > 0) {
                    const toUsdValue = parseFloat(fetchedQuote.toAmount) * parseFloat(toToken.priceUSD);
                    setToFiatAmount(formatFiatValue(toUsdValue, region, currency));
                } else {
                    setToFiatAmount('$0.00');
                }
            }
        } catch (error: any) {
            // An abort is not a failure — a newer quote replaced this one.
            if (abortController.signal.aborted || error?.name === 'AbortError') return;

            console.error('Failed to fetch quote:', error);
            // Allow an immediate retry of the same input after a failure.
            lastQuoteKeyRef.current = '';
            // Don't clear quote on background refresh failure, just mark as stale
            if (!isRefresh) {
                setSwapQuote(null);
            }
            setIsStale(true);
        } finally {
            clearStepTimers();
            if (!abortController.signal.aborted) {
                setIsLoadingQuote(false);
                setIsRefreshing(false);
                setQuoteStep('');
            }
        }
    }, [fromAmount, fromToken, toToken, address, region, currency, slippage, resolveRecipient]);

    useEffect(() => {
        // 200ms matches useSwapQuote's default delay. Mobile sat at 500ms, so
        // every quote started 300ms later than the web app's for no reason.
        const timer = setTimeout(() => {
            updateQuote(false);
        }, 200);
        return () => clearTimeout(timer);
    }, [fromAmount, fromToken, toToken, slippage, updateQuote]);

    // 60-second Heartbeat Auto-Refresh — fires only after the user has been
    // idle for 60s. Including fromAmount/fromToken/toToken/slippage in deps
    // means every keystroke or token change resets the clock, so the heartbeat
    // never fights with active typing or interrupts mid-input.
    useEffect(() => {
        if (!swapQuote || isLoadingQuote || isRefreshing || isLoadingSwap) return;

        const interval = setInterval(() => {
            console.log("[Swap] 60s idle, refreshing quote...");
            updateQuote(true);
        }, 60000);

        return () => clearInterval(interval);
    }, [swapQuote, isLoadingQuote, isRefreshing, isLoadingSwap, fromAmount, fromToken, toToken, slippage, updateQuote]);

    // Update From Fiat whenever amount or token changes.
    //
    // Prefer the route's own `fromAmountUSD` — the same figure the "To" side
    // already uses, and what the web card shows (app/swap/page.tsx's
    // fromTokenUSD). A local `amount × priceUSD` multiply comes from the balance
    // store's price feed, which is a DIFFERENT source than the router's, so on a
    // taxed token in a thin pool (TWC) the two disagree and the From value reads
    // wrong while the quoted To value reads right. The multiply stays as the
    // fallback for when there's no quote yet, or the amount has been edited
    // since — an in-flight quote's USD belongs to the previous amount.
    useEffect(() => {
        const amountNum = parseFloat(fromAmount || '0');
        if (!fromAmount || !(amountNum > 0)) {
            setFromFiatAmount('$0.00');
            return;
        }
        try {
            const routeFromUsd = parseFloat(swapQuote?.fromAmountUSD || '0');
            if (quotedFromAmount === fromAmount && routeFromUsd > 0) {
                setFromFiatAmount(formatFiatValue(routeFromUsd, region, currency));
                return;
            }
            if (!fromToken?.priceUSD) {
                setFromFiatAmount('$0.00');
                return;
            }
            const usdValue = amountNum * parseFloat(fromToken.priceUSD);
            setFromFiatAmount(formatFiatValue(usdValue, region, currency));
        } catch (e) {
            setFromFiatAmount('$0.00');
        }
    }, [fromAmount, fromToken, region, currency, swapQuote, quotedFromAmount]);

    /**
     * A cross-chain swap into a taxed token (TWC) runs in two legs: bridge to a stable on the
     * destination chain, then swap that stable locally. The bridge is asynchronous, so if the
     * app was closed or the wait timed out mid-swap, leg 2 is still owed. Offer to finish it
     * rather than either losing it or popping an unexplained signature prompt on mount.
     */
    useEffect(() => {
        if (!address) return;
        let cancelled = false;

        (async () => {
            try {
                const ready = await listReadySecondLegs();
                if (cancelled || ready.length === 0) return;

                const leg = ready[0];
                Alert.alert(
                    'Finish your swap',
                    `${leg.amount} ${leg.record.stable.symbol} from your earlier swap has arrived. ` +
                    `Finish converting it to ${leg.record.toToken.symbol}?`,
                    [
                        { text: 'Later', style: 'cancel' },
                        {
                            text: 'Finish',
                            onPress: async () => {
                                setIsLoadingSwap(true);
                                try {
                                    const result = await completeSecondLeg(leg, (s) => setSwapStage(s.message));
                                    if (!result.success) throw result.error || new Error('Swap did not complete.');
                                    queryClient.invalidateQueries({ queryKey: ['walletBalances'] });
                                    setIsSuccessModalVisible(true);
                                } catch (e: any) {
                                    setSwapErrorMessage(cleanErrorMessage(e));
                                } finally {
                                    setIsLoadingSwap(false);
                                    setSwapStage(null);
                                }
                            },
                        },
                    ],
                );
            } catch (e) {
                console.warn('[Swap] Pending second-leg check failed:', e);
            }
        })();

        return () => { cancelled = true; };
    }, [address, queryClient]);

    const isInsufficientBalanceError = (error: any): boolean => {
        const msg = (error?.message || error?.reason || '').toLowerCase();
        return (
            msg.includes('insufficient') ||
            msg.includes('exceeds balance') ||
            msg.includes('not enough') ||
            msg.includes('underflow') ||
            msg.includes('transfer amount exceeds') ||
            msg.includes('exceeds allowance') ||
            msg.includes('insufficient funds for gas') ||
            msg.includes('gas required exceeds') ||
            msg.includes('out of gas')
        );
    };

    const cleanErrorMessage = (error: any): string => {
        const msg = error?.message || 'Swap failed. Please try again.';
        // Extract just the reason from viem's verbose errors
        const reasonMatch = msg.match(/reverted with reason:\s*([^\n.]+)/i);
        if (reasonMatch) return `Transaction failed: ${reasonMatch[1].trim()}`;
        const detailsMatch = msg.match(/Details:\s*([^\n]+)/i);
        if (detailsMatch) return detailsMatch[1].trim();
        // Truncate overly long messages (viem dumps full tx data)
        if (msg.length > 150) return msg.slice(0, 150) + '...';
        return msg;
    };

    const isGasError = (error: any): boolean => {
        const msg = (error?.message || '').toLowerCase();
        return (
            msg.includes('insufficient funds for transfer') ||
            msg.includes('insufficient funds for gas') ||
            msg.includes('total cost') ||
            msg.includes('gas * gas fee + value')
        );
    };

    const handleConfirmSwap = async () => {
        if (!requireBackup()) return;
        if (!fromAmount || !fromToken || !toToken || !address) return;

        // Validation mirrors the web app's executeSwapTransaction exactly.
        // Deliberately NO minimum-USD gate, NO balance pre-check and NO
        // pre-flight gas simulation: the web app has none of those, and each
        // of them refused swaps that go through fine on web (a $0.05 dust
        // swap; a fee-on-transfer token whose estimateGas always reverts; a
        // balance check that didn't know the route collects its fee inline).
        // The executors surface the real on-chain reason if a swap can't run.

        const swapAmount = parseFloat(fromAmount);
        if (!(swapAmount > 0)) {
            setSwapErrorMessage('Please enter a valid amount');
            return;
        }

        if (!swapQuote?.route) {
            setSwapErrorMessage('Still preparing a secure route. Please try again in a moment.');
            return;
        }

        // Quote expiry — the backend emits `expiresAt` in unix SECONDS.
        const expiresAt = swapQuote.expiresAt ?? swapQuote.route?.expiresAt;
        if (expiresAt && Math.floor(Date.now() / 1000) >= Number(expiresAt)) {
            setSwapErrorMessage('Quote has expired. Please get a new quote.');
            return;
        }

        setIsLoadingSwap(true);

        try {
            // The full amount the user typed is what gets swapped. The protocol
            // fee is owned end-to-end by the engine (collectEvmTax): tier-aware
            // on BSC, charged ON TOP rather than deducted, skipped entirely when
            // the aggregator already skims it inline, and charged once across a
            // multi-leg swap. The screen must not touch it.
            const actualSwapAmount = fromAmount;

            // Security Check: Token Risk
            if (isTransactionRiskEnabled) {
                try {
                    const toTokenRisk = await securityGuard.checkTokenRisk(toToken.address, Number(fromChain?.id) || 1);
                    if (!toTokenRisk.isSafe) {
                        setIsLoadingSwap(false);
            setSwapStage(null); // Pause loading for alert
                        Alert.alert(
                            'Security Warning',
                            `Tiwi Protocol detected risks with ${toToken.symbol}:\n\n${toTokenRisk.warnings.join('\n')}\n\nDo you want to proceed anyway?`,
                            [
                                { text: 'Cancel', style: 'cancel', onPress: () => setIsLoadingSwap(false) },
                                {
                                    text: 'Proceed',
                                    style: 'destructive',
                                    onPress: () => performExecution(actualSwapAmount)
                                }
                            ]
                        );
                        return;
                    }
                } catch (e) {
                    console.error('Security check failed:', e);
                }
            }

            await performExecution(actualSwapAmount);

        } catch (error: any) {
            console.error("Swap sequence failed:", error.message, error);
            setIsLoadingSwap(false);
            setSwapStage(null);
            if (isGasError(error)) {
                const chain = getChainById(Number(fromChain?.id) || 1);
                const gasToken = chain.nativeCurrency?.symbol || 'ETH';
                setSwapErrorMessage(`Not enough ${gasToken} on ${chain.name} to pay for gas fees. Please add ${gasToken} to cover transaction costs.`);
            } else if (isInsufficientBalanceError(error)) {
                setSwapErrorMessage(`Not enough ${fromToken.symbol} to complete this swap. Please try with a lower amount.`);
            } else {
                setSwapErrorMessage(cleanErrorMessage(error));
            }
        }
    };

    const performExecution = async (adjustedAmount?: string) => {
        const swapFromAmount = adjustedAmount || fromAmount;
        if (!swapFromAmount || !fromToken || !toToken || !address) return;
        setIsLoadingSwap(true);
        try {
            if (!swapQuote) throw new Error('No swap quote available');

            // Token approvals are handled by the swap engine. Each executor
            // knows its own spender (Relay's ApprovalProxy, a DEX router, the
            // TiwiProtocolDEX contract, …) via getSpenderAddress/
            // ensureTokenApproval, and approves max once per (token, spender).
            // The screen used to guess Relay's spender set by decoding calldata
            // and querying api.relay.link, which both over-approved and missed
            // every non-Relay router.

            const fromAddr = getAddressForChain(fromToken.chainId);
            const toAddr = resolveRecipient(toToken.chainId);
            const result = await executeSwap(
                swapFromAmount,
                fromToken,
                toToken,
                fromAddr,
                toAddr,
                swapQuote,
                (status) => setSwapStage(status.message),
            );

            const txHash = result?.txHash;
            if (!txHash) {
                throw new Error('Swap did not return a transaction hash.');
            }
            const chainId = Number(fromChain?.id) || 56;

            // No receipt re-verification here — matching the web app. Every
            // executor already waits for its own confirmation (and reverts are
            // raised from inside it), so a second 60s wait only added latency,
            // and on non-EVM chains it was looking up an EVM receipt for a
            // Solana signature / Cosmos hash / Sui digest that will never exist.

            // 1. Log detailed transaction to backend for indexing
            try {
                await api.wallet.logTransaction({
                    walletAddress: address,
                    transactionHash: txHash,
                    chainId: chainId,
                    type: activeTab === 'limit' ? 'ContractCall' : 'Swap',
                    fromTokenAddress: fromToken.address,
                    fromTokenSymbol: fromToken.symbol,
                    toTokenAddress: toToken.address,
                    toTokenSymbol: toToken.symbol,
                    amount: swapFromAmount,
                    amountFormatted: `${swapFromAmount} ${fromToken.symbol}`,
                    // The OUTPUT amount. Without it `to_amount_formatted` stays
                    // empty and a pool's Transactions table renders "0.8968 USDT
                    // → TWC" with no number on the receiving side. Prefer the
                    // quote's own figure over the on-screen value, which may have
                    // been re-formatted for display.
                    toAmountFormatted: swapQuote?.toAmount || toAmount || undefined,
                    usdValue: parseFloat(fromFiatAmount.replace(/[^0-9.]/g, '') || '0'),
                    routerName: swapQuote?.router || 'relay',
                    // Tag the TIWI liquidity pool this swap traded against, so it shows
                    // in that pool's Transactions table and counts toward its volume.
                    // Without this, pool swaps made on mobile were invisible to the pool.
                    poolAddress: (swapQuote as any)?.raw?.pairAddress || undefined,
                });
            } catch (err) {
                console.warn('[Swap] Backend logging failed:', err);
            }

            // 2. Log activity + trigger push notification
            await activityService.logTransaction(
                address,
                'swap',
                activeTab === 'limit' ? 'Limit Order Placed' : 'Swap Successful',
                `You swapped ${fromAmount} ${fromToken.symbol} for ${toAmount} ${toToken.symbol}`,
                txHash,
                {
                    fromToken: fromToken.symbol,
                    toToken: toToken.symbol,
                    fromAmount,
                    toAmount,
                    chainId,
                    symbol: toToken.symbol,
                    amount: toAmount,
                    router: swapQuote?.router
                }
            );

            setIsLoadingSwap(false);
            setSwapStage(null);
            setIsSuccessModalVisible(true);

            // Immediately refresh wallet balances so new amounts show up
            queryClient.invalidateQueries({ queryKey: ['walletBalances'] });

        } catch (error: any) {
            console.error('Swap execution failed:', error.message, error);
            setIsLoadingSwap(false);
            setSwapStage(null);
            if (isGasError(error)) {
                const chain = getChainById(Number(fromChain?.id) || 1);
                const gasToken = chain.nativeCurrency?.symbol || 'ETH';
                setSwapErrorMessage(`Not enough ${gasToken} on ${chain.name} to pay for gas fees. Please add ${gasToken} to cover transaction costs.`);
            } else if (isInsufficientBalanceError(error)) {
                setSwapErrorMessage(`Not enough ${fromToken.symbol} to complete this swap. Please try with a lower amount.`);
            } else {
                setSwapErrorMessage(cleanErrorMessage(error));
            }
        }
    };

    const handleSuccessDone = () => {
        setIsSuccessModalVisible(false);
        setFromAmount('');
        setToAmount('');
        setFromFiatAmount('$0.00');
        setToFiatAmount('$0.00');
        setSwapQuote(null);
    };

    return (
        <View style={styles.container}>
            <CustomStatusBar />

            <View style={styles.flex1}>
                <WalletModal
                    visible={isGlobalWalletModalVisible}
                    onClose={() => setGlobalWalletModalVisible(false)}
                    onReferralPress={() => { setGlobalWalletModalVisible(false); router.push('/referral' as any); }}
                    onSettingsPress={() => { setGlobalWalletModalVisible(false); router.push('/settings' as any); }}
                    onDisconnectPress={() => { setGlobalWalletModalVisible(false); }}
                />

                <SwapSettingsSheet
                    visible={isSettingsSheetVisible}
                    onClose={() => setIsSettingsSheetVisible(false)}
                />

                <ChainSelectSheet
                    visible={isChainSheetVisible}
                    selectedChainId={chainSheetTarget === 'from' ? (fromChain?.id || null) : (toChain?.id || null)}
                    onSelect={handleChainOptionSelect}
                    onClose={closeChainSheet}
                />

                <RecipientAddressSheet
                    visible={isRecipientSheetVisible}
                    onClose={() => setIsRecipientSheetVisible(false)}
                    onSave={(addr) => { setRecipientAddress(addr); setSwapQuote(null); }}
                    currentAddress={recipientAddress}
                    toChainId={toToken ? Number(toToken.chainId) : undefined}
                    toChainName={toChain?.name}
                />

                {/* Gas-token picker for the BSC "Other" fee tier. Opens straight
                    on BSC's token list — the tier only applies to BEP-20s. */}
                <UnifiedAssetSelectSheet
                    visible={isGasTokenSheetVisible}
                    initialStep="tokens"
                    initialChainId={56}
                    selectedTokenId={selectedGasToken?.id}
                    onSelect={handleGasTokenSelect}
                    onClose={() => setIsGasTokenSheetVisible(false)}
                />

                <UnifiedAssetSelectSheet
                    visible={!!assetSheetTarget}
                    initialStep={assetSheetInitialStep}
                    initialChainId={
                        assetSheetTarget === 'from' ? fromChain?.id :
                            assetSheetTarget === 'to' ? toChain?.id : null
                    }
                    selectedTokenId={
                        assetSheetTarget === 'from' ? fromToken?.id :
                            assetSheetTarget === 'to' ? toToken?.id : null
                    }
                    onSelect={handleAssetSelect}
                    onClose={handleCloseAssetSheet}
                />

                <LimitAssetSheet
                    visible={isLimitAssetSheetVisible}
                    fromToken={fromToken}
                    toToken={toToken}
                    fromChainName={fromChain?.name}
                    toChainName={toChain?.name}
                    fromChainIcon={fromChain?.icon}
                    toChainIcon={toChain?.icon}
                    selectedTarget={whenPriceTarget}
                    onClose={() => setIsLimitAssetSheetVisible(false)}
                    onSelect={handleLimitAssetSelect}
                />

                <SwapLoadingOverlay visible={isLoadingSwap} stage={swapStage} />

                <SwapSuccessModal
                    visible={isSuccessModalVisible}
                    onDone={handleSuccessDone}
                    activeTab={activeTab}
                />

                {/* Coming Soon Modal */}
                <Modal
                    visible={isComingSoonVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setIsComingSoonVisible(false)}
                >
                    <View style={styles.comingSoonOverlay}>
                        <View style={styles.comingSoonModal}>
                            <Ionicons name="construct-outline" size={48} color={colors.primaryCTA} />
                            <Text style={styles.comingSoonTitle}>Feature In Progress</Text>
                            <Text style={styles.comingSoonText}>
                                This swap route is currently being optimized. Our team is actively working to support this pair. Please try a different token or check back soon.
                            </Text>
                            <TouchableOpacity
                                style={styles.comingSoonButton}
                                onPress={() => setIsComingSoonVisible(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.comingSoonButtonText}>Got it</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Insufficient Balance Modal */}
                <Modal
                    visible={!!swapErrorMessage}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setSwapErrorMessage(null)}
                >
                    <TouchableOpacity
                        style={styles.comingSoonOverlay}
                        activeOpacity={1}
                        onPress={() => setSwapErrorMessage(null)}
                    >
                        <View style={styles.comingSoonModal}>
                            <Ionicons name="wallet-outline" size={48} color="#FF6B6B" />
                            <Text style={styles.comingSoonTitle}>Swap Failed</Text>
                            <Text style={styles.comingSoonText} numberOfLines={4}>
                                {swapErrorMessage}
                            </Text>
                            <TouchableOpacity
                                style={[styles.comingSoonButton, { backgroundColor: '#FF6B6B' }]}
                                onPress={() => setSwapErrorMessage(null)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.comingSoonButtonText}>Got it</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>

                <ScrollView
                    ref={scrollViewRef}
                    style={styles.flex1}
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingBottom: isKeyboardVisible
                                ? 400
                                : (footerHeight || (bottom || 16) + 88) + 24,
                        }
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <SwapHeader
                        onWalletPress={() => setGlobalWalletModalVisible(true)}
                        onSettingsPress={() => setIsSettingsSheetVisible(true)}
                    />

                    <View style={styles.contentPadding}>
                        <SwapTabs activeTab={activeTab} onChange={setActiveTab} />

                        <View style={styles.spacerLarge} />

                        <View style={styles.cardsContainer}>
                            <SwapTokenCard
                                variant="from"
                                tokenSelected={!!fromToken}
                                tokenSymbol={fromToken?.symbol}
                                tokenChain={
                                    isResolvingMarketToken
                                        ? 'Finding best chain…'
                                        : (fromChain?.name || 'Select Chain')
                                }
                                tokenIcon={fromToken?.icon}
                                chainBadgeIcon={fromChain?.icon}
                                amount={fromAmount}
                                fiatAmount={fromFiatAmount}
                                balanceText={fromToken?.balanceToken || '0.00'}
                                onAmountChange={setFromAmount}
                                onTokenPress={() => handleOpenAssetSheet('from', 'chains')}
                                onMaxPress={() => handlePercentagePress(100)}
                                onInputPress={() => setIsKeyboardVisible(true)}
                                percentOfBalance={fromPercentOfBalance}
                                onPercentChange={handleSliderChange}
                                sliderDisabled={!fromHasBalance}
                            />

                            <View style={styles.toCardWrapper}>
                                <SwapTokenCard
                                    variant="to"
                                    tokenSelected={!!toToken}
                                    tokenSymbol={toToken?.symbol}
                                    tokenChain={toChain?.name}
                                    tokenIcon={toToken?.icon}
                                    chainBadgeIcon={toChain?.icon}
                                    amount={formatTokenAmount(toAmount)}
                                    fiatAmount={toFiatAmount}
                                    balanceText={toToken?.balanceToken || '0.00'}
                                    onTokenPress={() => handleOpenAssetSheet('to', 'chains')}
                                    isLoadingQuote={isLoadingQuote}
                                    isRefreshing={isRefreshing}
                                    isStale={isStale}
                                    quoteStep={quoteStep}
                                    // Destination address is picked from the "To"
                                    // label itself — same place the destination
                                    // token/chain is chosen.
                                    onRecipientPress={() => setIsRecipientSheetVisible(true)}
                                    // Always show where the output actually lands —
                                    // the custom recipient if set, otherwise our own
                                    // address on the destination chain.
                                    recipientLabel={(() => {
                                        const dest = resolveRecipient(toToken?.chainId);
                                        return dest ? truncateAddress(dest, 6, 4) : null;
                                    })()}
                                />
                            </View>

                            <SwapDirectionButton onPress={handleSwapDirection} />
                        </View>

                        {activeTab === 'limit' && (
                            <View style={styles.limitExtraWrapper}>
                                <LimitWhenPriceCard
                                    tokenSymbol={whenPriceTarget === 'from' ? fromToken?.symbol : toToken?.symbol}
                                    tokenSelected={whenPriceTarget === 'from' ? !!fromToken : !!toToken}
                                    tokenIcon={whenPriceTarget === 'from' ? fromToken?.icon : toToken?.icon}
                                    chainBadgeIcon={whenPriceTarget === 'from' ? fromChain?.icon : toChain?.icon}
                                    amount={whenPrice}
                                    fiatAmount="$0.00"
                                    balanceText={whenPriceTarget === 'from' ? (fromToken?.balanceToken || '0.00') : (toToken?.balanceToken || '0.00')}
                                    onAmountChange={setWhenPrice}
                                    onTokenPress={() => setIsLimitAssetSheetVisible(true)}
                                />
                            </View>
                        )}

                        {/* BSC-only: the fee tier is priced into the quote AND read
                            back at execution, so it must be chosen before quoting. */}
                        {Number(fromChain?.id) === 56 && (
                            <View style={styles.gasSelectorWrapper}>
                                <BscGasSelector
                                    selectedType={selectedGasTokenType}
                                    onSelectType={setSelectedGasTokenType}
                                    selectedToken={
                                        selectedGasToken
                                            ? {
                                                symbol: selectedGasToken.symbol,
                                                name: selectedGasToken.name,
                                                icon: selectedGasToken.icon,
                                            }
                                            : null
                                    }
                                    onPickOtherToken={() => setIsGasTokenSheetVisible(true)}
                                />
                            </View>
                        )}

                        <SwapDetailsCard
                            gasFee={swapQuote?.gasFee}
                            slippageTolerance={`${swapQuote?.slippage || slippage}%`}
                            twcFee={swapQuote?.twcFee}
                            source={swapQuote?.source}
                            chainId={Number(fromChain?.id) || undefined}
                            isLoading={isLoadingQuote}
                            isRefreshing={isRefreshing}
                            isStale={isStale}
                            lastFetchTime={lastFetchTime}
                        />

                        {activeTab === 'limit' && (
                            <View style={styles.expiresWrapper}>
                                <ExpiresSection
                                    selectedOption={expiresOption}
                                    onSelect={setExpiresOption}
                                    customValue={customExpiryValue}
                                    customUnit={customExpiryUnit}
                                    onCustomChange={(val, unit) => {
                                        setCustomExpiryValue(val);
                                        setCustomExpiryUnit(unit);
                                    }}
                                />
                            </View>
                        )}

                        <View style={styles.spacerLarge} />

                        {showTokenOverview && (
                            <TokenOverviewCard
                                about={tokenOverview?.about}
                                links={tokenOverview?.links}
                                socials={tokenOverview?.socials}
                                symbol={fromToken?.symbol}
                                name={tokenOverview?.name || fromToken?.name}
                                logo={tokenOverview?.logoURI || params.logo}
                                address={fromToken?.address}
                                chainId={fromToken?.chainId}
                                isLoading={isTokenOverviewLoading}
                            />
                        )}
                    </View>
                </ScrollView>

                {/* CTA pinned to the bottom of the screen — the content above
                    scrolls behind it. Rendered before SwapKeyboard so the custom
                    keypad still overlays it when open. */}
                <View
                    style={[
                        styles.ctaFooter,
                        // Match the top inset to the bottom one so the button sits
                        // centred in the bar rather than hugging its top edge.
                        { paddingTop: (bottom || 16), paddingBottom: (bottom || 16) },
                    ]}
                    onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
                >
                    <SwapConfirmButton
                        disabled={!isFormValid() || !swapQuote || isLoadingSwap || isRefreshing || isLoadingQuote}
                        loading={isLoadingSwap}
                        onPress={handleConfirmSwap}
                        isRefreshing={isRefreshing}
                        isStale={isStale}
                        activeTab={activeTab}
                        hasValidQuote={hasValidQuote()}
                        title={isBridge ? 'Bridge' : 'Swap'}
                    />
                </View>

                <SwapKeyboard
                    visible={isKeyboardVisible}
                    onClose={() => setIsKeyboardVisible(false)}
                    onKeyPress={handleKeyboardPress}
                    onPercentagePress={handlePercentagePress}
                    onMaxPress={() => handlePercentagePress(100)}
                />
            </View>
            {BackupRequiredModal}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    flex1: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    contentPadding: {
        paddingHorizontal: 20,
        alignItems: 'center',
        width: '100%',
        paddingBottom: 40
    },
    spacerLarge: {
        marginTop: 32,
    },
    ctaFooter: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        alignItems: 'center',
        backgroundColor: colors.bg,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
    },
    sectionLabelWrapper: {
        width: '100%',
        marginBottom: 16,
        marginTop: 32,
    },
    sectionLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        lineHeight: 14,
    },
    cardsContainer: {
        width: '100%',
        position: 'relative',
        gap: 4
    },
    toCardWrapper: {
        marginTop: 4,
    },
    limitExtraWrapper: {
        marginTop: 6,
        width: '100%',
    },
    expiresWrapper: {
        marginTop: 16,
        width: '100%',
    },
    gasSelectorWrapper: {
        marginTop: 16,
        width: '100%',
    },
    comingSoonOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    comingSoonModal: {
        width: '100%',
        backgroundColor: '#111810',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#1F261E',
        padding: 32,
        alignItems: 'center',
        gap: 12,
    },
    comingSoonTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
        color: '#FFFFFF',
    },
    comingSoonText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        lineHeight: 20,
    },
    comingSoonButton: {
        width: '100%',
        height: 48,
        backgroundColor: colors.primaryCTA,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    comingSoonButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#010501',
    },
});
