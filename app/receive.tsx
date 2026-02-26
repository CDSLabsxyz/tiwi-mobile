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
import { useWalletStore } from '@/store/walletStore';
import { truncateAddress } from '@/utils/wallet';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    chainType: 'evm' | 'solana' | 'bitcoin';
}

export default function ReceiveScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();
    const params = useLocalSearchParams<{ tokenId?: string }>();
    const { connectedWallets } = useWalletStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChainFilter, setSelectedChainFilter] = useState<number | null>(null);
    const [selectedToken, setSelectedToken] = useState<DisplayToken | null>(null);
    const [copied, setCopied] = useState(false);

    // Determine supported chain types based on connected wallets
    const supportedChainTypes = useMemo(() =>
        connectedWallets.map(w => w.chainType),
        [connectedWallets]);

    const { data: chains } = useChains(supportedChainTypes);

    // IDs for fetching tokens
    const fetchChainIds = useMemo(() => {
        if (selectedChainFilter) return [selectedChainFilter];
        return chains?.map(c => c.id) || [];
    }, [selectedChainFilter, chains]);

    // Fetch tokens from API
    const { data: response, isLoading: isFetchingTokens } = useTokens({
        chains: fetchChainIds,
        query: searchQuery,
        limit: 50,
        enabled: fetchChainIds.length > 0
    });
    const apiTokens = response?.tokens;

    // Computed list of tokens to show
    const displayTokens = useMemo(() => {
        if (!apiTokens) return [];

        return apiTokens.map(t => ({
            symbol: t.symbol,
            name: t.name,
            logoURI: t.logoURI,
            chainId: t.chainId,
            address: t.address,
            chainType: t.chainId === 1399811149 ? 'solana' : 'evm'
        })) as DisplayToken[];
    }, [apiTokens]);

    // Get actual wallet address based on chain type
    const getAddressForToken = (token: DisplayToken) => {
        const wallet = connectedWallets.find(w => w.chainType === token.chainType);
        return wallet ? wallet.address : connectedWallets[0]?.address || 'No Wallet Connected';
    };

    const handleTokenSelect = (token: DisplayToken) => {
        setSelectedToken(token);
    };

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
            // Fallback to copy if sharing fails
            await handleCopy();
            Alert.alert('Copied', 'Wallet address copied to clipboard');
        }
    };

    const handleBackPress = () => {
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

    const handleIrisScanPress = () => {
        console.log('Iris scan pressed');
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
                    />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[
                        styles.qrScrollContent,
                        { paddingBottom: (bottom || 16) + 24 }
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.qrMainContent}>
                        <View style={styles.warningBanner}>
                            <Text style={styles.warningText}>
                                <Text>Only send </Text>
                                <Text style={styles.warningBold}>
                                    {selectedToken.name} ({selectedToken.symbol})
                                </Text>
                                <Text> via </Text>
                                <Text style={styles.warningBold}>{chain?.name || 'its native network'}</Text>
                                <Text> to this address. Other assets will be lost forever.</Text>
                            </Text>
                        </View>

                        <View style={styles.qrSection}>
                            <View style={styles.qrContainer}>
                                <QRCode
                                    value={address}
                                    size={254}
                                    color="#000000"
                                    backgroundColor="#FFFFFF"
                                />
                            </View>

                            <View style={styles.addressContainer}>
                                <Text style={styles.addressText}>{address}</Text>
                            </View>

                            <View style={styles.actionButtons}>
                                <View style={styles.actionButtonWrapper}>
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={handleCopy}
                                        style={styles.actionButton}
                                    >
                                        <Image
                                            source={CheckmarkIcon}
                                            style={[styles.actionIcon, { opacity: copied ? 1 : 0 }]}
                                            contentFit="contain"
                                        />
                                        {!copied && (
                                            <Image
                                                source={CopyIcon}
                                                style={[styles.actionIcon, { position: 'absolute' }]}
                                                contentFit="contain"
                                            />
                                        )}
                                    </TouchableOpacity>
                                    <Text style={styles.actionLabel}>Copy</Text>
                                </View>

                                <View style={styles.actionButtonWrapper}>
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={handleShare}
                                        style={styles.actionButton}
                                    >
                                        <Image
                                            source={ShareIcon}
                                            style={styles.actionIcon}
                                            contentFit="contain"
                                        />
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
                    walletAddress={connectedWallets[0]?.address || ""}
                    onIrisScanPress={handleIrisScanPress}
                    // showCopy
                    onCopyPress={() => {
                        const addr = connectedWallets[0]?.address || "";
                        Clipboard.setStringAsync(addr);
                        Alert.alert('Copied', 'Wallet address copied to clipboard');
                    }}
                    showBackButton
                    onBackPress={handleBackPress}
                />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.listScrollContent,
                    { paddingBottom: (bottom || 16) + 24 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.listMainContent}>
                    <Text style={styles.title}>Receive Asset</Text>

                    {/* Search Bar */}
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

                    {/* Chain Filter Bar */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.chainFilterBar}
                        contentContainerStyle={styles.chainFilterContent}
                    >
                        <TouchableOpacity
                            onPress={() => handleChainFilter(null)}
                            style={[styles.chainFilterItem, !selectedChainFilter && styles.chainFilterItemActive]}
                        >
                            <Text style={[styles.chainFilterText, !selectedChainFilter && styles.chainFilterTextActive]}>All</Text>
                        </TouchableOpacity>
                        {chains?.map((chain) => (
                            <TouchableOpacity
                                key={chain.id}
                                onPress={() => handleChainFilter(chain.id)}
                                style={[styles.chainFilterItem, selectedChainFilter === chain.id && styles.chainFilterItemActive]}
                            >
                                <Image source={chain.logoURI || chain.logo} style={styles.chainFilterIcon} />
                                <Text style={[styles.chainFilterText, selectedChainFilter === chain.id && styles.chainFilterTextActive]}>{chain.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Token List */}
                    {isFetchingTokens ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator color={colors.primaryCTA} />
                            <Text style={styles.loadingText}>Searching tokens...</Text>
                        </View>
                    ) : (
                        <View style={styles.tokenList}>
                            {displayTokens.length > 0 ? (
                                displayTokens.map((item, index) => {
                                    const chain = chains?.find(c => c.id === item.chainId);
                                    const address = getAddressForToken(item);

                                    return (
                                        <TouchableOpacity
                                            key={`${item.chainId}-${item.symbol}-${index}`}
                                            activeOpacity={0.8}
                                            onPress={() => handleTokenSelect(item)}
                                            style={styles.tokenItem}
                                        >
                                            <View style={styles.tokenInfo}>
                                                <View style={styles.tokenIconWrapper}>
                                                    <View style={styles.tokenIconContainer}>
                                                        <Image
                                                            source={item.symbol.toUpperCase() === 'TIWICAT' ? require('../assets/home/tiwicat.svg') : item.logoURI}
                                                            style={styles.tokenIcon}
                                                            contentFit="cover"
                                                        />
                                                    </View>
                                                    <View style={styles.chainBadge}>
                                                        <Image
                                                            source={chain?.logoURI || chain?.logo}
                                                            style={styles.chainIcon}
                                                            contentFit="contain"
                                                        />
                                                    </View>
                                                </View>

                                                <View style={styles.tokenDetails}>
                                                    <Text style={styles.tokenSymbol}>{item.symbol}</Text>
                                                    <Text style={styles.tokenAddress}>{truncateAddress(address)}</Text>
                                                </View>
                                            </View>

                                            <View style={styles.tokenRight}>
                                                <TouchableOpacity onPress={handleIrisScanPress} style={styles.irisScanButton}>
                                                    <Image source={IrisScanIcon} style={styles.irisScanIcon} contentFit="contain" />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => {
                                                    Clipboard.setStringAsync(address);
                                                    Alert.alert('Copied', 'Address copied to clipboard');
                                                }} style={styles.copyButton}>
                                                    <Image source={CopyIcon} style={styles.copyIcon} contentFit="contain" />
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            ) : (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No tokens found</Text>
                                </View>
                            )}
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
