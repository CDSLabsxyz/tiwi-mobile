/**
 * Receive Screen
 * Displays token list with search, then QR code view for selected token
 * Matches Figma designs exactly (node-id: 3279-119208, 3279-119753)
 */

import { WalletHeader } from '@/components/sections/Wallet/WalletHeader';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useTokens } from '@/hooks/useTokens';
import { useToastStore } from '@/store/useToastStore';
import { useWalletStore, ChainType } from '@/store/walletStore';
import { truncateAddress, NATIVE_TOKEN_ADDRESS, MORALIS_NATIVE_ADDRESS } from '@/utils/wallet';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatTokenQuantity, formatUSDPrice, getColorFromSeed } from '@/utils/formatting';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { getTokenLogo } from '@/services/tokenLogoService';

const CopyIcon = require('../assets/wallet/copy-01.svg');
const CheckmarkIcon = require('../assets/swap/checkmark-circle-01.svg');
const SearchIcon = require('../assets/swap/search-01.svg');
const ShareIcon = require('../assets/wallet/share-08.svg');
const IrisScanIcon = require('../assets/home/iris-scan.svg');

interface DisplayToken {
    symbol: string;
    name: string;
    logoURI: string;
    chainId: number;
    address: string;
    chainType: ChainType;
}

export default function ReceiveScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();
    const params = useLocalSearchParams<{
        tokenId?: string;
        symbol?: string;
        name?: string;
        logoURI?: string;
        chainId?: string;
        address?: string;
        isAutoSelected?: string;
    }>();
    const { walletGroups, activeAddress, activeChain } = useWalletStore();
    const { data: balanceData } = useWalletBalances();

    const { showToast } = useToastStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChainFilter, setSelectedChainFilter] = useState<number | null>(null);
    const [selectedToken, setSelectedToken] = useState<DisplayToken | null>(null);
    const [copied, setCopied] = useState(false);

    // Dynamic pre-population logic (Direct from Asset Page)
    useEffect(() => {
        if (params.isAutoSelected === 'true' && params.symbol && !selectedToken) {
            const cid = Number(params.chainId || 1);
            setSelectedToken({
                symbol: params.symbol,
                name: params.name || '',
                logoURI: params.logoURI || '',
                chainId: cid,
                address: params.address || '',
                chainType: WALLET_CHAINS.find(wc => wc.id === cid)?.chain || 'EVM'
            });
        }
    }, [params]);

    const { data: chains } = useChains();

    // Chain options from wallet addresses for filter chips (Canonical IDs)
    const WALLET_CHAINS: { id: number; chain: ChainType; name: string; icon: any }[] = [
        { id: 1, chain: 'EVM', name: 'Ethereum', icon: require('../assets/home/chains/ethereum.svg') },
        { id: 56, chain: 'EVM', name: 'BSC', icon: require('../assets/home/chains/bsc.svg') },
        { id: 137, chain: 'EVM', name: 'Polygon', icon: require('../assets/home/chains/polygon.svg') },
        { id: 8453, chain: 'EVM', name: 'Base', icon: require('../assets/home/chains/base.png') },
        { id: 10, chain: 'EVM', name: 'Optimism', icon: require('../assets/home/chains/optimism.png') },
        { id: 42161, chain: 'EVM', name: 'Arbitrum', icon: require('../assets/home/chains/ethereum.svg') }, // Use ETH icon for Arbitrum
        { id: 43114, chain: 'EVM', name: 'Avalanche', icon: require('../assets/home/chains/avalanche.svg') },
        { id: 7565164, chain: 'SOLANA', name: 'Solana', icon: require('../assets/home/chains/solana.svg') },
        { id: 728126428, chain: 'TRON', name: 'TRON', icon: require('../assets/home/chains/tron.png') },
        { id: 1100, chain: 'TON', name: 'TON', icon: require('../assets/home/chains/ton.jpg') },
        { id: 118, chain: 'COSMOS', name: 'Cosmos Hub', icon: require('../assets/home/chains/cosmos.svg') },
    ];

    // Only show chains that the wallet has addresses for
    const activeGroup = walletGroups.find(g => g.id === useWalletStore.getState().activeGroupId);
    const availableChains = useMemo(() => {
        if (!activeGroup) return WALLET_CHAINS;
        return WALLET_CHAINS.filter(wc => !!activeGroup.addresses?.[wc.chain]);
    }, [activeGroup]);

    // IDs for fetching tokens
    const fetchChainIds = useMemo(() => {
        if (selectedChainFilter) return [selectedChainFilter];
        return chains?.map(c => c.id) || [];
    }, [selectedChainFilter, chains]);

    // Fetch tokens — same approach as swap token selector
    // 1. Search tokens
    const { data: searchResponse, isLoading: isSearchingTokens } = useTokens({
        chains: fetchChainIds,
        query: searchQuery,
        limit: 50,
        enabled: searchQuery.trim().length > 0
    });

    // 2. Default tokens for selected chain (or all chains)
    const { data: defaultResponse, isLoading: isLoadingDefaults } = useTokens({
        chains: selectedChainFilter ? [selectedChainFilter] : undefined,
        limit: 50,
        enabled: !searchQuery.trim(),
    });

    // ── Unified Token Logic (Inspired by Swap Selector) ───────────────────
    const displayTokens = useMemo(() => {
        const TWC_ADDRESS = '0xda1060158f7d593667cce0a15db346bb3ffb3596'.toLowerCase();
        const NATIVE_ADDRS = [NATIVE_TOKEN_ADDRESS, MORALIS_NATIVE_ADDRESS];

        // 1. Get tokens from API
        const rawTokens = searchQuery.trim()
            ? (searchResponse?.tokens || [])
            : (defaultResponse?.tokens || []);

        // 2. Map to unified objects
        const mappedApiTokens = rawTokens.map(t => {
            const walletToken = balanceData?.tokens.find(
                wt => wt.address.toLowerCase() === t.address.toLowerCase() && wt.chainId === t.chainId
            );
            const chainInfo = chains?.find(c => c.id === t.chainId);
            const hasBalance = !!walletToken;
            const balanceNum = parseFloat(walletToken?.balanceFormatted || '0');
            const priceNum = parseFloat(t.priceUSD || '0');
            const totalUSD = balanceNum * priceNum;

            return {
                id: `${t.chainId}-${t.address}`,
                symbol: t.symbol,
                name: t.name,
                logoURI: getTokenLogo(t.symbol, t.chainId, t.address) || t.logoURI || (t as any).logo,
                chainIcon: chainInfo?.logoURI,
                address: t.address,
                chainId: t.chainId,
                decimals: t.decimals ?? 18,
                balanceToken: hasBalance
                    ? `${formatTokenQuantity(walletToken!.balanceFormatted)} ${t.symbol}`
                    : `0 ${t.symbol}`,
                balanceFiat: totalUSD > 0 ? formatUSDPrice(totalUSD) : '$0.00',
                isOwned: hasBalance,
                usdValueNum: totalUSD,
                _liquidity: parseFloat(t.liquidity?.toString() || '0'),
                _verified: !!(t as any).verified,
                chainType: WALLET_CHAINS.find(wc => wc.id === t.chainId)?.chain || 'EVM'
            };
        });

        // 3. Add wallet tokens that might not be in API results
        const ownedTokensOnChain = (balanceData?.tokens || [])
            .filter(wt => {
                if (selectedChainFilter) return wt.chainId === selectedChainFilter;
                return true;
            })
            .filter(wt => {
                // Deduplicate with API results
                return !mappedApiTokens.some(at => at.address.toLowerCase() === wt.address.toLowerCase() && at.chainId === wt.chainId);
            })
            .map(wt => {
                const chainInfo = chains?.find(c => c.id === wt.chainId);
                const usdVal = parseFloat(wt.usdValue || '0');
                return {
                    id: `${wt.chainId}-${wt.address}`,
                    symbol: wt.symbol,
                    name: wt.name,
                    logoURI: getTokenLogo(wt.symbol, wt.chainId, wt.address) || wt.logoURI,
                    chainIcon: chainInfo?.logoURI,
                    address: wt.address,
                    chainId: wt.chainId,
                    decimals: wt.decimals ?? 18,
                    balanceToken: `${formatTokenQuantity(wt.balanceFormatted)} ${wt.symbol}`,
                    balanceFiat: usdVal > 0 ? formatUSDPrice(usdVal) : '$0.00',
                    isOwned: true,
                    usdValueNum: usdVal,
                    _liquidity: 0,
                    _verified: true,
                    chainType: WALLET_CHAINS.find(wc => wc.id === wt.chainId)?.chain || 'EVM'
                };
            });

        const allTokens = [...mappedApiTokens, ...ownedTokensOnChain];

        // 4. Strict chain filter and search filter
        const filtered = allTokens.filter(t => {
            if (selectedChainFilter && t.chainId !== selectedChainFilter) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address.toLowerCase().includes(q);
            }

            // Spam filtering (similar to Swap sheet)
            const name = t.name?.toLowerCase() || '';
            const symbol = t.symbol?.toLowerCase() || '';
            const address = t.address?.toLowerCase() || '';

            if (address.endsWith('pump') || name.includes('pump.fun')) return false;
            if (/[\u4e00-\u9fa5]/.test(name)) return false; // Hide Chinese spam

            const spamKw = ['.com', '.xyz', 'claim', 'airdrop', 'visit', 'free', 'reward', 'voucher'];
            if (spamKw.some(k => name.includes(k) || symbol.includes(k))) return false;

            return true;
        });

        // 5. Deduplicate by chain+symbol
        const seen = new Map<string, any>();
        filtered.forEach(t => {
            const key = `${t.chainId}-${t.symbol.toUpperCase()}`;
            const existing = seen.get(key);
            if (!existing || (t.isOwned && !existing.isOwned) || (t._liquidity > existing._liquidity)) {
                seen.set(key, t);
            }
        });

        // 6. Final Sort: Ownership, Native priority, Solana ecosystem priority, then market metrics
        return Array.from(seen.values()).sort((a, b) => {
            // Owned tokens always first
            if (a.isOwned && !b.isOwned) return -1;
            if (!a.isOwned && b.isOwned) return 1;

            // Solana specific ecosystem priority for non-owned tokens
            if ((selectedChainFilter === 7565164 || a.chainId === 7565164) && !a.isOwned && !b.isOwned) {
                const solPrio = (t: any) => {
                    const symbol = t.symbol.toUpperCase();
                    const addr = t.address?.toLowerCase();
                    if (t.isNative || symbol === 'SOL') return 100; // SOL
                    if (addr === 'epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v' || symbol === 'USDC') return 90; // USDC
                    if (addr === 'es9vmfrzadcstmdamrjs4nhaf79ppu36hmrf6s5je6m' || symbol === 'USDT') return 80; // USDT
                    return 0;
                };
                const pA = solPrio(a);
                const pB = solPrio(b);
                if (pA !== pB) return pB - pA;
            }

            // Native priority (general)
            const aN = NATIVE_ADDRS.includes(a.address.toLowerCase()) || a.isNative;
            const bN = NATIVE_ADDRS.includes(b.address.toLowerCase()) || b.isNative;
            if (aN && !bN) return -1;
            if (!aN && bN) return 1;

            // TWC next
            if (a.address.toLowerCase() === TWC_ADDRESS && b.address.toLowerCase() !== TWC_ADDRESS) return -1;
            if (a.address.toLowerCase() !== TWC_ADDRESS && b.address.toLowerCase() === TWC_ADDRESS) return 1;

            // Verified / Liquidity
            if (a._verified && !b._verified) return -1;
            if (!a._verified && b._verified) return 1;
            return b._liquidity - a._liquidity;
        });
    }, [searchResponse, defaultResponse, balanceData, selectedChainFilter, chains, searchQuery]);

    // Get actual wallet address based on chain type
    const getAddressForToken = (token: any) => {
        const targetChain = String(token.chainType || 'EVM').toUpperCase() as ChainType;
        const activeGroupId = useWalletStore.getState().activeGroupId;
        const group = walletGroups.find(g => g.id === activeGroupId);
        if (group && group.addresses[targetChain]) {
            return group.addresses[targetChain]!;
        }
        return activeAddress || 'No Address';
    };

    const handleTokenSelect = (token: any) => {
        setSelectedToken({
            symbol: token.symbol,
            name: token.name,
            logoURI: token.logoURI,
            chainId: token.chainId,
            address: token.address,
            chainType: token.chainType
        });
    };

    const isSearching = searchQuery.trim().length > 0;

    const renderToken = (item: any, key: string) => {
        const chain = chains?.find(c => c.id === item.chainId);
        const address = getAddressForToken(item);
        return (
            <TokenRow
                key={key}
                item={item}
                chain={chain}
                address={address}
                onSelect={handleTokenSelect}
                isSearching={isSearching}
            />
        );
    };

    // ── Extracted so each row can track its own logo error state ──
    const TokenRow = React.memo(({ item, chain, address, onSelect, isSearching }: {
        item: any; chain: any; address: string; onSelect: (t: any) => void; isSearching: boolean;
    }) => {
        const [logoError, setLogoError] = useState(false);
        const handleLogoError = useCallback(() => setLogoError(true), []);

        const isTiwicat = item.symbol.toUpperCase() === 'TIWICAT';
        const logoSource = isTiwicat
            ? require('../assets/home/tiwicat.svg')
            : (item.logoURI && !logoError ? { uri: item.logoURI } : null);

        // Hide non-owned tokens with failed logos unless user is searching
        if (!logoSource && !item.isOwned && !isSearching) return null;

        const chainLogoUri = chain?.logoURI || (chain as any)?.logo;

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onSelect(item)}
                style={styles.tokenItem}
            >
                <View style={styles.tokenInfo}>
                    <View style={styles.tokenIconWrapper}>
                        <View style={styles.tokenIconContainer}>
                            {logoSource ? (
                                <Image
                                    source={logoSource}
                                    style={styles.tokenIcon}
                                    contentFit="cover"
                                    onError={isTiwicat ? undefined : handleLogoError}
                                />
                            ) : (
                                <View style={[styles.tokenIcon, {
                                    backgroundColor: getColorFromSeed(item.symbol),
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderRadius: 16,
                                }]}>
                                    <Text style={{ fontFamily: 'Manrope-Bold', fontSize: 14, color: '#FFFFFF' }}>
                                        {item.symbol.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>
                        {chainLogoUri ? (
                            <View style={styles.chainBadge}>
                                <Image
                                    source={{ uri: chainLogoUri }}
                                    style={styles.chainIcon}
                                    contentFit="contain"
                                />
                            </View>
                        ) : null}
                    </View>
                    <View style={styles.tokenDetails}>
                        <Text style={styles.tokenSymbol}>{item.symbol}</Text>
                        <Text style={styles.tokenAddress}>{truncateAddress(address)}</Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={async () => {
                        await Clipboard.setStringAsync(address);
                        showToast('Address copied', 'success');
                    }}
                    style={styles.copyButton}
                >
                    <Image source={CopyIcon} style={styles.copyIcon} contentFit="contain" />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    });

    const handleCopy = async () => {
        if (!selectedToken) return;
        const address = getAddressForToken(selectedToken);
        try {
            await Clipboard.setStringAsync(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy address:', error);
        }
    };

    const handleShare = async () => {
        if (!selectedToken) return;
        const address = getAddressForToken(selectedToken);
        try {
            const shareMessage = `My ${selectedToken.symbol} (${selectedToken.name}) wallet address:\n\n${address}`;
            await Share.share({
                message: shareMessage,
                title: 'Share Wallet Address'
            });
        } catch (error: any) {
            console.error('Failed to share address:', error);
            await Clipboard.setStringAsync(address);
            showToast('Wallet address copied to clipboard', 'success');
        }
    };

    const handleBackPress = () => {
        if (params.isAutoSelected === 'true') {
            router.back();
            return;
        }
        if (selectedToken) {
            setSelectedToken(null);
        } else {
            router.back();
        }
    };

    const handleSettingsPress = () => {
        const currentRoute = pathname || '/receive';
        router.push(`/settings?returnTo=${encodeURIComponent(currentRoute)}` as any);
    };

    const handleHomePress = () => {
        router.replace('/(tabs)' as any);
    };

    const handleIrisScanPress = () => {
        showToast('Self-Sovereign Identity verification initiated', 'pending');
    };

    const handleChainFilter = (chainId: number | null) => {
        setSelectedChainFilter(chainId);
    };

    // If token is selected, show QR code view
    if (selectedToken) {
        const address = getAddressForToken(selectedToken);
        const chain = chains?.find(c => String(c.id) === String(selectedToken.chainId));

        return (
            <View style={[styles.container, { backgroundColor: colors.bg }]}>
                <CustomStatusBar />
                <View style={[styles.header, { paddingTop: top || 0 }]}>
                    <WalletHeader
                        walletAddress={address}
                        onIrisScanPress={handleIrisScanPress}
                        onCopyPress={handleCopy}
                        showBackButton
                        onBackPress={handleBackPress}
                        showHome
                        onHomePress={handleHomePress}
                    />
                </View>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[styles.qrScrollContent, { paddingBottom: (bottom || 16) + 24 }]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.qrMainContent}>
                        <View style={styles.warningBanner}>
                            <Text style={styles.warningText}>
                                <Text>Only send </Text>
                                <Text style={styles.warningBold}>{selectedToken.name} ({selectedToken.symbol})</Text>
                                <Text> via </Text>
                                <Text style={styles.warningBold}>{chain?.name || 'its native network'}</Text>
                                <Text> to this address. Other assets will be lost forever.</Text>
                            </Text>
                        </View>
                        <View style={styles.qrSection}>
                            <View style={styles.qrContainer}>
                                <QRCode value={address} size={254} color="#000000" backgroundColor="#FFFFFF" />
                            </View>
                            <View style={styles.addressContainer}>
                                <Text style={styles.addressText}>{address}</Text>
                            </View>
                            <View style={styles.actionButtons}>
                                <View style={styles.actionButtonWrapper}>
                                    <TouchableOpacity activeOpacity={0.8} onPress={handleCopy} style={styles.actionButton}>
                                        <Image source={CheckmarkIcon} style={[styles.actionIcon, { opacity: copied ? 1 : 0 }]} contentFit="contain" />
                                        {!copied && <Image source={CopyIcon} style={[styles.actionIcon, { position: 'absolute' }]} contentFit="contain" />}
                                    </TouchableOpacity>
                                    <Text style={styles.actionLabel}>Copy</Text>
                                </View>
                                <View style={styles.actionButtonWrapper}>
                                    <TouchableOpacity activeOpacity={0.8} onPress={handleShare} style={styles.actionButton}>
                                        <Image source={ShareIcon} style={styles.actionIcon} contentFit="contain" />
                                    </TouchableOpacity>
                                    <Text style={styles.actionLabel}>Share</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    // Token list view
    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <WalletHeader
                    walletAddress={activeAddress || ""}
                    onIrisScanPress={handleIrisScanPress}
                    onCopyPress={() => { Clipboard.setStringAsync(activeAddress || ""); showToast('Address copied to clipboard', 'success'); }}
                    showBackButton
                    onBackPress={handleBackPress}
                    showHome
                    onHomePress={handleHomePress}
                    showSettings
                    onSettingsPress={handleSettingsPress}
                />
            </View>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.listScrollContent, { paddingBottom: (bottom || 16) + 24 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.listMainContent}>
                    <Text style={styles.title}>Receive Asset</Text>
                    <View style={styles.searchBar}>
                        <Image source={SearchIcon} style={styles.searchIcon} contentFit="contain" />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search token or address"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            style={styles.searchInput}
                        />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chainFilterBar} contentContainerStyle={styles.chainFilterContent}>
                        <TouchableOpacity onPress={() => handleChainFilter(null)} style={[styles.chainFilterItem, !selectedChainFilter && styles.chainFilterItemActive]}>
                            <Text style={[styles.chainFilterText, !selectedChainFilter && styles.chainFilterTextActive]}>All</Text>
                        </TouchableOpacity>
                        {availableChains.map((wc) => (
                            <TouchableOpacity key={wc.id} onPress={() => handleChainFilter(wc.id)} style={[styles.chainFilterItem, selectedChainFilter === wc.id && styles.chainFilterItemActive]}>
                                <Image source={wc.icon} style={styles.chainFilterIcon} contentFit="contain" />
                                <Text style={[styles.chainFilterText, selectedChainFilter === wc.id && styles.chainFilterTextActive]}>{wc.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    {isSearchingTokens || isLoadingDefaults ? (
                        <View style={styles.loadingContainer}>
                            <TIWILoader size={100} />
                            <Text style={styles.loadingText}>{searchQuery.trim() ? 'Searching tokens...' : 'Loading tokens...'}</Text>
                        </View>
                    ) : (
                        <View style={styles.tokenList}>
                            {displayTokens.length > 0 ? (
                                (() => {
                                    const owned = displayTokens.filter(t => t.isOwned);
                                    const others = displayTokens.filter(t => !t.isOwned);
                                    return (
                                        <>
                                            {owned.length > 0 && (
                                                <>
                                                    <Text style={styles.sectionHeader}>Your Assets</Text>
                                                    {owned.map((item, index) => renderToken(item, `owned-${index}`))}
                                                </>
                                            )}
                                            {others.length > 0 && (
                                                <>
                                                    <Text style={styles.sectionHeader}>Other Tokens</Text>
                                                    {others.map((item, index) => renderToken(item, `other-${index}`))}
                                                </>
                                            )}
                                        </>
                                    );
                                })()
                            ) : !selectedChainFilter || displayTokens.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No tokens found</Text>
                                </View>
                            ) : null}
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        backgroundColor: colors.bg,
    },
    scrollView: {
        flex: 1,
    },
    sectionHeader: {
        fontSize: 14,
        fontFamily: 'Manrope-Bold',
        color: colors.primaryCTA,
        marginTop: 20,
        marginBottom: 12,
        paddingHorizontal: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    qrScrollContent: {
        paddingTop: 24,
        alignItems: 'center',
    },
    listScrollContent: {
        paddingTop: 24,
        alignItems: 'center',
    },
    qrMainContent: {
        width: 357,
        maxWidth: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 40,
    },
    listMainContent: {
        width: '100%',
        paddingHorizontal: 20,
        gap: 20,
    },
    warningBanner: {
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 152, 0, 0.2)',
    },
    warningText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        lineHeight: 20,
        color: '#FF9800',
        textAlign: 'center',
    },
    warningBold: {
        fontFamily: 'Manrope-Bold',
    },
    qrSection: {
        alignItems: 'center',
        gap: 24,
    },
    qrContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    addressContainer: {
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    addressText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        textAlign: 'center',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 20,
    },
    actionButtonWrapper: {
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        width: 56,
        height: 56,
        backgroundColor: colors.bgCards,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    actionIcon: {
        width: 24,
        height: 24,
    },
    actionLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.titleText,
    },
    title: {
        fontFamily: 'Manrope-Bold',
        fontSize: 24,
        color: colors.titleText,
        marginBottom: 8,
        textAlign: 'center',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 52,
    },
    searchIcon: {
        width: 20,
        height: 20,
        marginRight: 12,
        opacity: 0.5,
    },
    searchInput: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 15,
        color: colors.titleText,
    },
    chainFilterBar: {
        flexGrow: 0,
        marginBottom: 8,
    },
    chainFilterContent: {
        gap: 12,
        paddingRight: 20,
    },
    chainFilterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCards,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 100,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        gap: 8,
    },
    chainFilterItemActive: {
        backgroundColor: colors.primaryCTA,
        borderColor: colors.primaryCTA,
    },
    chainFilterIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    chainFilterText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.bodyText,
    },
    chainFilterTextActive: {
        color: colors.bg,
    },
    tokenList: {
        gap: 16,
    },
    tokenItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    tokenInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    tokenIconWrapper: {
        width: 48,
        height: 48,
        position: 'relative',
    },
    tokenIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 24,
        backgroundColor: '#1f261e',
        overflow: 'hidden',
    },
    tokenIcon: {
        width: '100%',
        height: '100%',
    },
    chainBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 20,
        height: 20,
        borderRadius: 9,
        backgroundColor: '#1f261e',
        borderWidth: 1.5,
        borderColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chainIcon: {
        width: "100%",
        height: "100%",
        borderRadius: 9,
    },
    tokenDetails: {
        gap: 2,
    },
    tokenSymbol: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.titleText,
    },
    tokenName: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: colors.bodyText,
        opacity: 0.7,
    },
    tokenRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    tokenAddress: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        opacity: 0.6,
    },
    irisScanButton: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    irisScanIcon: {
        width: 30,
        height: 30,
    },
    copyButton: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copyIcon: {
        width: 24,
        height: 24,
        opacity: 0.8,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        opacity: 0.5,
    },
});
