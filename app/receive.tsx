/**
 * Receive Screen
 * Displays token list with search, then QR code view for selected token
 * Matches Figma designs exactly (node-id: 3279-119208, 3279-119753)
 */

import { WalletHeader } from '@/components/sections/Wallet/WalletHeader';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { fetchWalletData, type PortfolioItem } from '@/services/walletService';
import { mapAssetToTokenOption } from '@/utils/assetMapping';
import { getChainOptionWithFallback } from '@/utils/chainUtils';
import { WALLET_ADDRESS, truncateAddress } from '@/utils/wallet';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CopyIcon = require('../assets/wallet/copy-01.svg');
const CheckmarkIcon = require('../assets/swap/checkmark-circle-01.svg');
const SearchIcon = require('../assets/swap/search-01.svg');
const ShareIcon = require('../assets/wallet/share-08.svg');

interface TokenWithAddress {
    token: ReturnType<typeof mapAssetToTokenOption>;
    address: string;
    chainId: string;
    asset: PortfolioItem;
}

export default function ReceiveScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();
    const params = useLocalSearchParams<{ tokenId?: string }>();

    const [tokens, setTokens] = useState<TokenWithAddress[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedToken, setSelectedToken] = useState<TokenWithAddress | null>(null);
    const [copied, setCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load tokens on mount
    useEffect(() => {
        loadTokens();
    }, []);

    // Handle token selection from URL params
    useEffect(() => {
        if (params.tokenId && tokens.length > 0) {
            const token = tokens.find(t => t.asset.id === params.tokenId);
            if (token) {
                setSelectedToken(token);
            }
        }
    }, [params.tokenId, tokens]);

    const loadTokens = async () => {
        setIsLoading(true);
        try {
            const walletData = await fetchWalletData(WALLET_ADDRESS);
            const tokensData: TokenWithAddress[] = walletData.portfolio.map((asset) => {
                const token = mapAssetToTokenOption(asset, asset.balance, asset.usdValue);
                // For now, use main wallet address. In production, this would be chain-specific
                let address = WALLET_ADDRESS;
                if (asset.chainId === 'aegis') {
                    // Solana-like address format (mock)
                    address = 'Re9d3o52i092j9g9iu2ngmu0939i4ti938hT432';
                }
                return {
                    token: token!,
                    address,
                    chainId: asset.chainId,
                    asset,
                };
            });
            setTokens(tokensData);
        } catch (error) {
            console.error('Failed to load tokens:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter tokens based on search
    const filteredTokens = tokens.filter(
        (item) =>
            item.token?.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.token?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Handle token selection - show QR code view
    const handleTokenSelect = (token: TokenWithAddress) => {
        setSelectedToken(token);
    };

    // Handle copy with visual feedback
    const handleCopy = async () => {
        if (!selectedToken) return;
        try {
            await Clipboard.setStringAsync(selectedToken.address);
            setCopied(true);
            setTimeout(() => {
                setCopied(false);
            }, 2000);
        } catch (error) {
            console.error('Failed to copy address:', error);
            Alert.alert('Error', 'Failed to copy address');
        }
    };

    // Handle share functionality
    const handleShare = async () => {
        if (!selectedToken) return;
        try {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                const shareMessage = `My ${selectedToken.token?.symbol} (${selectedToken.token?.name}) wallet address:\n\n${selectedToken.address}`;
                await Sharing.shareAsync(shareMessage);
            } else {
                await Clipboard.setStringAsync(selectedToken.address);
                Alert.alert('Copied', 'Wallet address copied to clipboard');
            }
        } catch (error: any) {
            if (error?.code !== 'ERR_CANCELLED') {
                console.error('Failed to share address:', error);
                try {
                    await Clipboard.setStringAsync(selectedToken.address);
                    Alert.alert('Copied', 'Wallet address copied to clipboard');
                } catch (clipboardError) {
                    Alert.alert('Error', 'Failed to share or copy address');
                }
            }
        }
    };

    // Handle back press
    const handleBackPress = () => {
        if (selectedToken) {
            setSelectedToken(null);
        } else {
            router.back();
        }
    };

    // Handle settings press
    const handleSettingsPress = () => {
        const currentRoute = pathname || '/receive';
        router.push(`/settings?returnTo=${encodeURIComponent(currentRoute)}` as any);
    };

    // Handle iris scan press
    const handleIrisScanPress = () => {
        console.log('Iris scan pressed');
    };

    // Handle copy from token list
    const handleTokenCopy = async (token: TokenWithAddress) => {
        try {
            await Clipboard.setStringAsync(token.address);
            Alert.alert('Copied', 'Address copied to clipboard');
        } catch (error) {
            console.error('Failed to copy address:', error);
            Alert.alert('Error', 'Failed to copy address');
        }
    };

    // If token is selected, show QR code view
    if (selectedToken) {
        const chainOption = getChainOptionWithFallback(selectedToken.chainId as any);

        return (
            <View style={[styles.container, { backgroundColor: colors.bg }]}>
                <CustomStatusBar />

                {/* Sticky Header */}
                <View style={[styles.header, { paddingTop: top || 0 }]}>
                    <WalletHeader
                        walletAddress={WALLET_ADDRESS}
                        onIrisScanPress={handleIrisScanPress}
                        onSettingsPress={handleSettingsPress}
                        showBackButton
                        onBackPress={handleBackPress}
                    />
                </View>

                {/* Scrollable Content */}
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[
                        styles.qrScrollContent,
                        { paddingBottom: (bottom || 16) + 24 }
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Main Content Container */}
                    <View style={styles.qrMainContent}>
                        {/* Warning Banner */}
                        <View style={styles.warningBanner}>
                            <Text style={styles.warningText}>
                                <Text>Only send </Text>
                                <Text style={styles.warningBold}>
                                    {selectedToken.token?.name} ({selectedToken.token?.symbol})
                                </Text>
                                <Text> to this address. other assets will be lost forever.</Text>
                            </Text>
                        </View>

                        {/* QR Code Section */}
                        <View style={styles.qrSection}>
                            {/* QR Code Container */}
                            <View style={styles.qrContainer}>
                                <QRCode
                                    value={selectedToken.address}
                                    size={254}
                                    color="#000000"
                                    backgroundColor={colors.bodyText}
                                />
                            </View>

                            {/* Address Text - Wrapped */}
                            <Text style={styles.addressText}>
                                {selectedToken.address}
                            </Text>

                            {/* Action Buttons */}
                            <View style={styles.actionButtons}>
                                {/* Copy Button */}
                                <View style={styles.actionButtonWrapper}>
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={handleCopy}
                                        style={styles.actionButton}
                                    >
                                        {copied ? (
                                            <Image
                                                source={CheckmarkIcon}
                                                style={styles.actionIcon}
                                                contentFit="contain"
                                            />
                                        ) : (
                                            <Image
                                                source={CopyIcon}
                                                style={styles.actionIcon}
                                                contentFit="contain"
                                            />
                                        )}
                                    </TouchableOpacity>
                                    <Text style={styles.actionLabel}>Copy</Text>
                                </View>

                                {/* Share Button */}
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

            {/* Sticky Header */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <WalletHeader
                    walletAddress={WALLET_ADDRESS}
                    onIrisScanPress={handleIrisScanPress}
                    onSettingsPress={handleSettingsPress}
                    showBackButton
                    onBackPress={handleBackPress}
                />
            </View>

            {/* Scrollable Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.listScrollContent,
                    { paddingBottom: (bottom || 16) + 24 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Main Content Container */}
                <View style={styles.listMainContent}>
                    {/* Title */}
                    <Text style={styles.title}>Receive Asset</Text>

                    {/* Search Bar */}
                    <View style={styles.searchBar}>
                        <View style={styles.searchIconContainer}>
                            <Image
                                source={SearchIcon}
                                style={styles.searchIcon}
                                contentFit="contain"
                            />
                        </View>
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search"
                            placeholderTextColor="rgba(255, 255, 255, 0.7)"
                            style={styles.searchInput}
                        />
                    </View>

                    {/* Token List */}
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <Text style={styles.loadingText}>Loading tokens...</Text>
                        </View>
                    ) : (
                        <View style={styles.tokenList}>
                            {filteredTokens.map((item) => {
                                const chain = getChainOptionWithFallback(item.chainId as any);
                                const truncatedAddr = truncateAddress(item.address);

                                return (
                                    <TouchableOpacity
                                        key={item.asset.id}
                                        activeOpacity={0.8}
                                        onPress={() => handleTokenSelect(item)}
                                        style={styles.tokenItem}
                                    >
                                        {/* Left: Token Info */}
                                        <View style={styles.tokenInfo}>
                                            {/* Token Icon with Chain Badge */}
                                            <View style={styles.tokenIconWrapper}>
                                                <View style={styles.tokenIconContainer}>
                                                    <Image
                                                        source={item.token.icon}
                                                        style={styles.tokenIcon}
                                                        contentFit="cover"
                                                    />
                                                </View>
                                                {/* Chain Badge */}
                                                <View style={styles.chainBadge}>
                                                    <Image
                                                        source={chain.icon}
                                                        style={styles.chainIcon}
                                                        contentFit="contain"
                                                    />
                                                </View>
                                            </View>

                                            {/* Token Symbol and Address */}
                                            <View style={styles.tokenDetails}>
                                                <View style={styles.symbolRow}>
                                                    <Text style={styles.tokenSymbol}>
                                                        {item.token.symbol}
                                                    </Text>
                                                </View>
                                                <Text style={styles.tokenAddress}>
                                                    {truncatedAddr}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Right: Action Icons */}
                                        <View style={styles.tokenActions}>
                                            {/* QR Code Icon */}
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={() => handleTokenSelect(item)}
                                                style={styles.qrIconButton}
                                            >
                                                <Image
                                                    source={require('../assets/home/iris-scan.svg')}
                                                    style={styles.qrIcon}
                                                    contentFit="contain"
                                                />
                                            </TouchableOpacity>

                                            {/* Copy Icon */}
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={() => handleTokenCopy(item)}
                                                style={styles.copyIconButton}
                                            >
                                                <Image
                                                    source={CopyIcon}
                                                    style={styles.copyIcon}
                                                    contentFit="contain"
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
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
        gap: 85,
    },
    listMainContent: {
        width: 353,
        maxWidth: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 21,
    },
    warningBanner: {
        width: 329,
        backgroundColor: '#2b1f0d',
        borderRadius: 16,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    warningText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        lineHeight: 20,
        color: colors.titleText,
        textAlign: 'center',
        width: 329,
    },
    warningBold: {
        fontFamily: 'Manrope-Bold',
        fontWeight: 'bold',
    },
    qrSection: {
        width: 274,
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
    },
    qrContainer: {
        width: 274,
        height: 274,
        backgroundColor: colors.bodyText,
        borderRadius: 16,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addressText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        lineHeight: 20,
        color: colors.bodyText,
        textAlign: 'center',
        width: '100%',
        maxWidth: 274,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
    },
    actionButtonWrapper: {
        width: 100,
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        width: '100%',
        backgroundColor: colors.bgSemi,
        borderRadius: 12,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIcon: {
        width: 24,
        height: 24,
    },
    actionLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        textAlign: 'center',
    },
    title: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 20,
        lineHeight: 20,
        color: colors.titleText,
        textAlign: 'center',
        textTransform: 'capitalize',
    },
    searchBar: {
        width: '100%',
        height: 48,
        backgroundColor: colors.bgSemi,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        gap: 5,
    },
    searchIconContainer: {
        width: 16,
        height: 16,
    },
    searchIcon: {
        width: '100%',
        height: '100%',
    },
    searchInput: {
        flex: 1,
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.titleText,
        padding: 0,
        margin: 0,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        color: colors.bodyText,
    },
    tokenList: {
        width: '100%',
        flexDirection: 'column',
        gap: 0,
    },
    tokenItem: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 0,
    },
    tokenInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        width: 203,
    },
    tokenIconWrapper: {
        width: 57,
        height: 57,
        position: 'relative',
    },
    tokenIconContainer: {
        width: 57,
        height: 57,
        borderRadius: 28.5,
        backgroundColor: '#1f261e',
        borderWidth: 1,
        borderColor: '#7c7c7c',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tokenIcon: {
        width: 56,
        height: 56,
    },
    chainBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#1f261e',
        borderWidth: 1,
        borderColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    chainIcon: {
        width: 47,
        height: 47,
    },
    tokenDetails: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0,
        width: 106,
    },
    symbolRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 4,
    },
    tokenSymbol: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.bodyText,
    },
    tokenAddress: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    tokenActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
    },
    qrIconButton: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qrIcon: {
        width: 30,
        height: 30,
    },
    copyIconButton: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copyIcon: {
        width: 24,
        height: 24,
    },
});
