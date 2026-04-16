import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { buildEventInjection, buildInjectedScript } from '@/lib/dapp/injectedProvider';
import { getActiveChainId, handleDAppMessage, toHex } from '@/lib/dapp/providerBridge';
import { TIWI_ICON_DATA_URI } from '@/lib/dapp/tiwiIcon';
import { useWalletStore } from '@/store/walletStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Keyboard,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';

const HOME_URL = 'about:blank';
const HOME_TITLE = 'New Tab';
const SEARCH_ENGINE = 'https://www.google.com/search?q=';

interface Shortcut {
    label: string;
    url: string;
    icon?: any; // local require() or { uri: string } — overrides favicon fetch
}

const TIWI_LOGO = require('../assets/images/tiwi-logo.svg');

const SHORTCUTS: Shortcut[] = [
    { label: 'Tiwi Protocol', url: 'https://app.tiwiprotocol.xyz', icon: TIWI_LOGO },
    { label: 'CDS Labs', url: 'https://cdslabs.xyz' },
    { label: 'Uniswap', url: 'https://app.uniswap.org' },
    { label: 'OpenSea', url: 'https://opensea.io' },
    { label: 'DeFiLlama', url: 'https://defillama.com' },
    { label: 'CoinGecko', url: 'https://www.coingecko.com' },
    { label: 'Etherscan', url: 'https://etherscan.io' },
    { label: 'BscScan', url: 'https://bscscan.com' },
    { label: 'DexScreener', url: 'https://dexscreener.com' },
];

// ─── Tab model ──────────────────────────────────────────────────────────
//
// Each open page is its own tab with its own WebView instance. The active
// tab drives the toolbar and is the only one visible — inactive tabs are
// kept mounted (display: 'none') so navigation history and DOM state
// survive a switch.

interface BrowserTab {
    id: string;
    url: string;
    title: string;
    query: string;
    canGoBack: boolean;
    loading: boolean;
    // Path to a temp-file snapshot of the current page. Refreshed on each
    // page load and whenever the switcher is opened, so the grid reflects
    // what the user last saw — same UX as Safari / Chrome.
    thumbnail?: string;
}

function makeTab(): BrowserTab {
    return {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        url: HOME_URL,
        title: HOME_TITLE,
        query: '',
        canGoBack: false,
        loading: false,
    };
}

// ─── Browsing history ──────────────────────────────────────────────────
//
// Saved across launches in AsyncStorage. The toolbar's search input
// surfaces matching entries as type-ahead suggestions — same UX as
// every desktop and mobile browser.

const HISTORY_KEY = '@tiwi/browser_history';
const TABS_KEY = '@tiwi/browser_tabs';
const MAX_HISTORY = 200;
const MAX_SUGGESTIONS = 5;

interface HistoryEntry {
    url: string;
    title: string;
    visitCount: number;
    lastVisited: number;
}

function normalizeInput(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return HOME_URL;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    const looksLikeDomain = /^[^\s]+\.[a-z]{2,}(\/|$)/i.test(trimmed);
    if (looksLikeDomain) return `https://${trimmed}`;

    return `${SEARCH_ENGINE}${encodeURIComponent(trimmed)}`;
}

function originOf(url: string): string {
    try {
        const m = url.match(/^(https?:\/\/[^/]+)/i);
        return m ? m[1] : url;
    } catch {
        return url;
    }
}

function faviconUrl(url: string, size = 128): string | null {
    const domain = shortDomain(url);
    if (!domain) return null;
    return `https://www.google.com/s2/favicons?sz=${size}&domain=${domain}`;
}

function ShortcutIcon({ url, label, icon, style, textStyle }: {
    url: string;
    label: string;
    icon?: any;
    style: any;
    textStyle: any;
}) {
    const [failed, setFailed] = useState(false);
    const src = icon ?? (faviconUrl(url) ? { uri: faviconUrl(url)! } : null);
    if (failed || !src) {
        return (
            <View style={style}>
                <Text style={textStyle}>{label[0]}</Text>
            </View>
        );
    }
    return (
        <View style={style}>
            <ExpoImage
                source={src}
                style={shortcutImageStyle}
                contentFit="contain"
                onError={() => setFailed(true)}
                transition={150}
            />
        </View>
    );
}

const shortcutImageStyle = { width: 32, height: 32 };

function shortDomain(url: string): string {
    if (!url || url === HOME_URL) return '';
    try {
        const m = url.match(/^https?:\/\/([^/]+)/i);
        return m ? m[1].replace(/^www\./, '') : url;
    } catch {
        return url;
    }
}

export default function BrowserScreen() {
    const router = useRouter();
    const { top, bottom } = useSafeAreaInsets();
    const { url: incomingUrl } = useLocalSearchParams<{ url?: string }>();

    const [tabs, setTabs] = useState<BrowserTab[]>(() => [makeTab()]);
    const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);
    const [showSwitcher, setShowSwitcher] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [searchFocused, setSearchFocused] = useState(false);
    // Tracks whether we've finished pulling persisted tabs out of
    // AsyncStorage. The save effect waits on this flag so we never
    // clobber the stored tabs with the freshly-mounted default.
    const tabsHydratedRef = useRef(false);
    const [hydrated, setHydrated] = useState(false);
    const incomingUrlHandledRef = useRef(false);

    // Hydrate persisted tabs once on mount. If the user had pages open
    // before navigating away or closing the app, they reappear here.
    // Each WebView re-loads from `tab.url`; scroll position is lost, but
    // every browser does this when the tab is evicted from memory.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(TABS_KEY);
                if (!cancelled && raw) {
                    const parsed = JSON.parse(raw);
                    const restored: BrowserTab[] | undefined = Array.isArray(parsed?.tabs)
                        ? parsed.tabs
                        : undefined;
                    if (restored && restored.length) {
                        // Reset transient flags so an interrupted load
                        // doesn't ghost a forever-spinning indicator.
                        const sanitized = restored.map((t) => ({
                            ...t,
                            loading: false,
                            canGoBack: false,
                        }));
                        setTabs(sanitized);
                        const savedActive: string | undefined = parsed?.activeTabId;
                        if (savedActive && sanitized.some((t) => t.id === savedActive)) {
                            setActiveTabId(savedActive);
                        } else {
                            setActiveTabId(sanitized[sanitized.length - 1].id);
                        }
                    }
                }
            } catch {
                /* fall through with the default single home tab */
            } finally {
                if (!cancelled) {
                    tabsHydratedRef.current = true;
                    setHydrated(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Persist tabs whenever they change post-hydration. We strip the
    // transient `loading` flag so a saved page never reloads as
    // "loading" forever if the app dies mid-fetch.
    useEffect(() => {
        if (!tabsHydratedRef.current) return;
        const payload = {
            tabs: tabs.map((t) => ({ ...t, loading: false })),
            activeTabId,
        };
        AsyncStorage.setItem(TABS_KEY, JSON.stringify(payload)).catch(() => {});
    }, [tabs, activeTabId]);

    // Open an incoming URL (e.g. block-explorer link tapped from another
    // screen) in a fresh tab. Wait for hydration so we don't race the
    // restore from AsyncStorage and end up with an orphan tab.
    useEffect(() => {
        if (!hydrated || incomingUrlHandledRef.current) return;
        const raw = typeof incomingUrl === 'string' ? incomingUrl : '';
        if (!raw) return;
        incomingUrlHandledRef.current = true;
        const target = normalizeInput(raw);
        const t = makeTab();
        setTabs((prev) => [
            ...prev,
            { ...t, url: target, query: target, title: shortDomain(target) || target, loading: true },
        ]);
        setActiveTabId(t.id);
    }, [hydrated, incomingUrl]);

    // Hydrate browsing history once on mount.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(HISTORY_KEY);
                if (!cancelled && raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) setHistory(parsed);
                }
            } catch {
                /* fall through with empty history */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Upsert an entry (called whenever a real page finishes loading).
    const recordHistory = (url: string, title: string) => {
        if (!url || url === HOME_URL || /^about:/i.test(url)) return;
        setHistory((prev) => {
            const now = Date.now();
            const idx = prev.findIndex((h) => h.url === url);
            let next: HistoryEntry[];
            if (idx >= 0) {
                const existing = prev[idx];
                next = [
                    { ...existing, title: title || existing.title, visitCount: existing.visitCount + 1, lastVisited: now },
                    ...prev.slice(0, idx),
                    ...prev.slice(idx + 1),
                ];
            } else {
                next = [{ url, title: title || shortDomain(url), visitCount: 1, lastVisited: now }, ...prev];
            }
            const trimmed = next.slice(0, MAX_HISTORY);
            AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed)).catch(() => {});
            return trimmed;
        });
    };

    // One WebView ref per tab. We can't useRef inside .map(), so we keep
    // them in a long-lived Map keyed by tab id.
    const webViewRefs = useRef<Map<string, WebView | null>>(new Map());

    // Capturing a WebView directly is unreliable across platforms, so we
    // wrap each one in a View and snapshot the wrapper instead.
    const containerRefs = useRef<Map<string, View | null>>(new Map());

    const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
    const activeWebView = () => webViewRefs.current.get(activeTab.id) || null;

    const { address, activeChain, activeNetworkId } = useWalletStore();
    const chainIdHex = useMemo(() => toHex(getActiveChainId()), [activeChain, activeNetworkId]);

    const injectedScript = useMemo(
        () => buildInjectedScript({ address, chainIdHex, iconDataUri: TIWI_ICON_DATA_URI }),
        // Rebuild when identity changes so newly loaded pages see the right values.
        [address, chainIdHex],
    );

    // Propagate chain/account changes into every loaded page without a reload.
    useEffect(() => {
        const js = buildEventInjection('chainChanged', chainIdHex);
        webViewRefs.current.forEach((ref, id) => {
            const tab = tabs.find((t) => t.id === id);
            if (ref && tab && tab.url !== HOME_URL) ref.injectJavaScript(js);
        });
    }, [chainIdHex, tabs]);

    useEffect(() => {
        const js = buildEventInjection('accountsChanged', address ? [address] : []);
        webViewRefs.current.forEach((ref, id) => {
            const tab = tabs.find((t) => t.id === id);
            if (ref && tab && tab.url !== HOME_URL) ref.injectJavaScript(js);
        });
    }, [address, tabs]);

    // ─── Tab helpers ────────────────────────────────────────────────────
    const patchTab = (id: string, patch: Partial<BrowserTab>) => {
        setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    };

    const addTab = () => {
        const t = makeTab();
        setTabs((prev) => [...prev, t]);
        setActiveTabId(t.id);
        setShowSwitcher(false);
    };

    const closeTab = (id: string) => {
        webViewRefs.current.delete(id);
        setTabs((prev) => {
            const filtered = prev.filter((t) => t.id !== id);
            if (filtered.length === 0) {
                const t = makeTab();
                setActiveTabId(t.id);
                return [t];
            }
            if (id === activeTabId) {
                setActiveTabId(filtered[filtered.length - 1].id);
            }
            return filtered;
        });
    };

    const switchTab = (id: string) => {
        setActiveTabId(id);
        setShowSwitcher(false);
    };

    // Snapshot the active tab's WebView. Hidden tabs (display:none) won't
    // capture reliably, so we only ever snapshot the active one.
    const captureTabThumbnail = async (tabId: string) => {
        const ref = containerRefs.current.get(tabId);
        if (!ref) return;
        try {
            const uri = await captureRef(ref, {
                format: 'jpg',
                quality: 0.4,
                result: 'tmpfile',
            });
            patchTab(tabId, { thumbnail: uri });
        } catch (e) {
            // Captures occasionally fail mid-navigation; ignore — the
            // next onLoadEnd will retry.
        }
    };

    const handleOpenSwitcher = () => {
        if (activeTab.url !== HOME_URL) {
            // Capture immediately so the grid shows the latest view.
            captureTabThumbnail(activeTab.id);
        }
        setShowSwitcher(true);
    };

    // ─── Active-tab handlers ───────────────────────────────────────────
    const handleSubmit = () => {
        const target = normalizeInput(activeTab.query);
        Keyboard.dismiss();
        patchTab(activeTab.id, { url: target, loading: target !== HOME_URL });
    };

    const handleShortcutPress = (url: string) => {
        patchTab(activeTab.id, { url, query: url, title: shortDomain(url) || url });
    };

    const handleNavigationStateChange = (tabId: string) => (state: WebViewNavigation) => {
        patchTab(tabId, {
            canGoBack: state.canGoBack,
            query: state.url && state.url !== HOME_URL ? state.url : '',
            title: state.title || shortDomain(state.url) || HOME_TITLE,
        });
        // Only persist once the navigation has finished — `loading: false`
        // arrives via onLoadEnd and corresponds to the same `state.url`.
        if (state.url && !state.loading && state.url !== HOME_URL) {
            recordHistory(state.url, state.title || shortDomain(state.url));
        }
    };

    // Type-ahead suggestions: case-insensitive contains-match against the
    // visited URLs and titles. Ranked by visit count then recency.
    const suggestions = useMemo<HistoryEntry[]>(() => {
        const q = activeTab.query.trim().toLowerCase();
        if (!q || q.length < 1) return [];
        // If the user is already on a URL that exactly matches the query,
        // hide the dropdown — there's nothing useful to suggest.
        if (q === activeTab.url.toLowerCase()) return [];
        const scored = history
            .filter((h) => h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q))
            .sort((a, b) => b.visitCount - a.visitCount || b.lastVisited - a.lastVisited);
        return scored.slice(0, MAX_SUGGESTIONS);
    }, [activeTab.query, activeTab.url, history]);

    const handleSuggestionPress = (entry: HistoryEntry) => {
        Keyboard.dismiss();
        setSearchFocused(false);
        patchTab(activeTab.id, { url: entry.url, query: entry.url, title: entry.title });
    };

    const handleBack = () => {
        if (activeTab.canGoBack && activeWebView()) {
            activeWebView()!.goBack();
            return true;
        }
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/' as any);
        }
        return true;
    };

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
        return () => sub.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab.canGoBack, activeTab.id]);

    const handleReload = () => {
        activeWebView()?.reload();
    };

    const handleHome = () => {
        patchTab(activeTab.id, {
            url: HOME_URL,
            query: '',
            title: HOME_TITLE,
            canGoBack: false,
            loading: false,
        });
    };

    const handleMessage = (tabId: string) => (event: WebViewMessageEvent) => {
        const tab = tabs.find((t) => t.id === tabId);
        if (!tab) return;
        const ref = webViewRefs.current.get(tabId);
        handleDAppMessage(event.nativeEvent.data, {
            webviewRef: { current: ref } as any,
            origin: originOf(tab.url),
            injectEvent: (ev, data) => {
                ref?.injectJavaScript(buildEventInjection(ev, data));
            },
        });
    };

    const isHome = activeTab.url === HOME_URL;

    return (
        <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: top }]}>
            <CustomStatusBar />

            <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack} style={styles.iconButton} hitSlop={8}>
                    <Ionicons name="chevron-back" size={22} color={colors.titleText} />
                </TouchableOpacity>

                <View style={styles.searchBar}>
                    <Ionicons name="search" size={16} color={colors.mutedText} />
                    <TextInput
                        value={activeTab.query}
                        onChangeText={(v) => patchTab(activeTab.id, { query: v })}
                        onSubmitEditing={handleSubmit}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => {
                            // Delay so a tap on a suggestion can fire first.
                            setTimeout(() => setSearchFocused(false), 120);
                        }}
                        placeholder="Search or enter URL"
                        placeholderTextColor={colors.mutedText}
                        style={styles.searchInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="web-search"
                        returnKeyType="go"
                        selectTextOnFocus
                    />
                    {activeTab.query.length > 0 && (
                        <TouchableOpacity
                            onPress={() => patchTab(activeTab.id, { query: '' })}
                            hitSlop={8}
                        >
                            <Ionicons name="close-circle" size={16} color={colors.mutedText} />
                        </TouchableOpacity>
                    )}
                </View>

                {isHome ? (
                    <TouchableOpacity
                        onPress={() => router.replace('/(tabs)' as any)}
                        style={styles.iconButton}
                        hitSlop={8}
                    >
                        <ExpoImage source={TIWI_LOGO} style={styles.tiwiHomeIcon} contentFit="contain" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={handleReload} style={styles.iconButton} hitSlop={8}>
                        <Ionicons name="refresh" size={20} color={colors.titleText} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Type-ahead suggestion dropdown. Anchored just under the toolbar. */}
            {searchFocused && suggestions.length > 0 && (
                <View style={styles.suggestionsWrap} pointerEvents="box-none">
                    <View style={styles.suggestionsList}>
                        {suggestions.map((s) => {
                            const fav = faviconUrl(s.url, 64);
                            return (
                                <TouchableOpacity
                                    key={s.url}
                                    onPress={() => handleSuggestionPress(s)}
                                    activeOpacity={0.7}
                                    style={styles.suggestionRow}
                                >
                                    {fav ? (
                                        <ExpoImage
                                            source={{ uri: fav }}
                                            style={styles.suggestionFavicon}
                                            contentFit="contain"
                                        />
                                    ) : (
                                        <View style={styles.suggestionFaviconFallback} />
                                    )}
                                    <View style={styles.suggestionTextWrap}>
                                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                                            {s.title}
                                        </Text>
                                        <Text style={styles.suggestionUrl} numberOfLines={1}>
                                            {shortDomain(s.url)}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Page area: home UI for the active tab when on home, otherwise
                all WebViews are mounted with display:none for inactive ones. */}
            <View style={styles.pageArea}>
                {isHome && (
                    <View style={styles.homeContainer}>
                        <Text style={styles.homeTitle}>Explore</Text>
                        <Text style={styles.homeSubtitle}>Search the web or jump into a DApp</Text>
                        <View style={styles.shortcutsGrid}>
                            {SHORTCUTS.map((s) => (
                                <TouchableOpacity
                                    key={s.url}
                                    style={styles.shortcut}
                                    onPress={() => handleShortcutPress(s.url)}
                                    activeOpacity={0.7}
                                >
                                    <ShortcutIcon
                                        url={s.url}
                                        label={s.label}
                                        icon={s.icon}
                                        style={styles.shortcutIcon}
                                        textStyle={styles.shortcutInitial}
                                    />
                                    <Text style={styles.shortcutLabel}>{s.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {tabs.map((tab) => {
                    if (tab.url === HOME_URL) return null;
                    const visible = tab.id === activeTabId;
                    return (
                        <View
                            key={tab.id}
                            ref={(r) => {
                                containerRefs.current.set(tab.id, r);
                            }}
                            collapsable={false}
                            style={[
                                styles.webContainer,
                                { display: visible ? 'flex' : 'none' },
                            ]}
                            pointerEvents={visible ? 'auto' : 'none'}
                        >
                            <WebView
                                ref={(r) => {
                                    webViewRefs.current.set(tab.id, r);
                                }}
                                source={{ uri: tab.url }}
                                onNavigationStateChange={handleNavigationStateChange(tab.id)}
                                onLoadStart={() => patchTab(tab.id, { loading: true })}
                                onLoadEnd={() => {
                                    patchTab(tab.id, { loading: false });
                                    // Give the page a beat to paint, then snapshot.
                                    if (tab.id === activeTabId) {
                                        setTimeout(() => captureTabThumbnail(tab.id), 600);
                                    }
                                }}
                                onMessage={handleMessage(tab.id)}
                                injectedJavaScriptBeforeContentLoaded={injectedScript}
                                javaScriptEnabled
                                domStorageEnabled
                                originWhitelist={['*']}
                                style={styles.webView}
                            />
                            {visible && tab.loading && (
                                <View style={styles.loadingOverlay} pointerEvents="none">
                                    <ActivityIndicator size="small" color={colors.primaryCTA} />
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>

            {/* Bottom action bar: home, new tab, tab switcher */}
            <View style={[styles.bottomBar, { paddingBottom: Math.max(bottom, 8) }]}>
                <TouchableOpacity onPress={handleHome} style={styles.bottomButton} hitSlop={6}>
                    <Ionicons name="home-outline" size={22} color={colors.titleText} />
                </TouchableOpacity>
                <TouchableOpacity onPress={addTab} style={styles.bottomButton} hitSlop={6}>
                    <Ionicons name="add" size={26} color={colors.titleText} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleOpenSwitcher}
                    style={styles.bottomButton}
                    hitSlop={6}
                >
                    <View style={styles.tabsBadge}>
                        <Text style={styles.tabsBadgeText}>{tabs.length}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Tab switcher modal */}
            <Modal
                visible={showSwitcher}
                animationType="fade"
                transparent
                onRequestClose={() => setShowSwitcher(false)}
            >
                <View style={[styles.switcherBackdrop, { paddingTop: top + 12 }]}>
                    <View style={styles.switcherHeader}>
                        <Text style={styles.switcherTitle}>{tabs.length} {tabs.length === 1 ? 'Tab' : 'Tabs'}</Text>
                        <TouchableOpacity onPress={() => setShowSwitcher(false)} hitSlop={8}>
                            <Text style={styles.switcherDone}>Done</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.switcherGrid} showsVerticalScrollIndicator={false}>
                        {tabs.map((tab) => {
                            const isActive = tab.id === activeTabId;
                            const tabIsHome = tab.url === HOME_URL;
                            const favicon = tabIsHome ? null : faviconUrl(tab.url, 64);
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    onPress={() => switchTab(tab.id)}
                                    activeOpacity={0.85}
                                    style={[
                                        styles.tabCard,
                                        isActive && { borderColor: colors.primaryCTA },
                                    ]}
                                >
                                    <View style={styles.tabCardHeader}>
                                        {favicon ? (
                                            <ExpoImage
                                                source={{ uri: favicon }}
                                                style={styles.tabCardFavicon}
                                                contentFit="contain"
                                                transition={120}
                                            />
                                        ) : (
                                            <View style={styles.tabCardFaviconFallback}>
                                                <Ionicons name="home" size={10} color={colors.primaryCTA} />
                                            </View>
                                        )}
                                        <Text style={styles.tabCardTitle} numberOfLines={1}>
                                            {tab.title || HOME_TITLE}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => closeTab(tab.id)}
                                            hitSlop={8}
                                            style={styles.tabCardClose}
                                        >
                                            <Ionicons name="close" size={16} color={colors.mutedText} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.tabCardPreview}>
                                        {tab.thumbnail ? (
                                            <ExpoImage
                                                source={{ uri: tab.thumbnail }}
                                                style={styles.tabCardPreviewImage}
                                                contentFit="cover"
                                                transition={150}
                                            />
                                        ) : tabIsHome ? (
                                            <View style={styles.tabCardPreviewPlaceholder}>
                                                <Ionicons name="home-outline" size={28} color={colors.primaryCTA} />
                                                <Text style={styles.tabCardUrl} numberOfLines={1}>
                                                    Start page
                                                </Text>
                                            </View>
                                        ) : favicon ? (
                                            <View style={styles.tabCardPreviewPlaceholder}>
                                                <ExpoImage
                                                    source={{ uri: faviconUrl(tab.url, 128) || undefined }}
                                                    style={styles.tabCardPreviewFavicon}
                                                    contentFit="contain"
                                                />
                                                <Text style={styles.tabCardUrl} numberOfLines={1}>
                                                    {shortDomain(tab.url)}
                                                </Text>
                                            </View>
                                        ) : (
                                            <View style={styles.tabCardPreviewPlaceholder}>
                                                <Text style={styles.tabCardInitial}>
                                                    {(shortDomain(tab.url)[0] || '?').toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    <View style={[styles.switcherFooter, { paddingBottom: Math.max(bottom, 12) }]}>
                        <TouchableOpacity onPress={addTab} style={styles.switcherNewTab} activeOpacity={0.7}>
                            <Ionicons name="add" size={22} color={colors.bg} />
                            <Text style={styles.switcherNewTabLabel}>New Tab</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    iconButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    searchInput: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: colors.titleText,
        padding: 0,
    },
    pageArea: {
        flex: 1,
        position: 'relative',
    },
    tiwiHomeIcon: {
        width: 24,
        height: 24,
    },
    suggestionsWrap: {
        paddingHorizontal: 12,
    },
    suggestionsList: {
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        overflow: 'hidden',
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.bgStroke,
    },
    suggestionFavicon: {
        width: 18,
        height: 18,
        borderRadius: 4,
    },
    suggestionFaviconFallback: {
        width: 18,
        height: 18,
        borderRadius: 4,
        backgroundColor: colors.bgStroke,
    },
    suggestionTextWrap: {
        flex: 1,
    },
    suggestionTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: colors.titleText,
    },
    suggestionUrl: {
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        color: colors.mutedText,
        marginTop: 1,
    },
    homeContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    homeTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 22,
        color: colors.titleText,
    },
    homeSubtitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: colors.mutedText,
        marginTop: 4,
        marginBottom: 24,
    },
    shortcutsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    shortcut: {
        width: '28%',
        alignItems: 'center',
        gap: 8,
    },
    shortcutIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shortcutInitial: {
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
        color: colors.primaryCTA,
    },
    shortcutLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
        textAlign: 'center',
    },
    webContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    webView: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 8,
        right: 12,
    },
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingTop: 8,
        paddingHorizontal: 24,
        borderTopWidth: 0.5,
        borderTopColor: colors.bgStroke,
        backgroundColor: colors.bg,
    },
    bottomButton: {
        width: 44,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabsBadge: {
        minWidth: 24,
        height: 24,
        paddingHorizontal: 6,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: colors.titleText,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabsBadgeText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
        color: colors.titleText,
    },
    switcherBackdrop: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    switcherHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    switcherTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    switcherDone: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.primaryCTA,
    },
    switcherGrid: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    tabCard: {
        width: '47%',
        height: 200,
        borderRadius: 14,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        padding: 8,
        gap: 6,
        overflow: 'hidden',
    },
    tabCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tabCardFavicon: {
        width: 14,
        height: 14,
        borderRadius: 3,
    },
    tabCardFaviconFallback: {
        width: 14,
        height: 14,
        borderRadius: 3,
        backgroundColor: colors.bgStroke,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabCardTitle: {
        flex: 1,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.titleText,
    },
    tabCardClose: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgStroke,
    },
    tabCardPreview: {
        flex: 1,
        borderRadius: 8,
        backgroundColor: colors.bg,
        overflow: 'hidden',
    },
    tabCardPreviewImage: {
        width: '100%',
        height: '100%',
    },
    tabCardPreviewPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 8,
    },
    tabCardPreviewFavicon: {
        width: 36,
        height: 36,
    },
    tabCardInitial: {
        fontFamily: 'Manrope-Bold',
        fontSize: 28,
        color: colors.primaryCTA,
    },
    tabCardUrl: {
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        color: colors.mutedText,
        textAlign: 'center',
    },
    switcherFooter: {
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: 0.5,
        borderTopColor: colors.bgStroke,
    },
    switcherNewTab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: colors.primaryCTA,
    },
    switcherNewTabLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.bg,
    },
});
