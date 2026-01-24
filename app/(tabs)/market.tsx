/**
 * Market Screen
 * Displays Spot and Perp trading markets with filtering and search
 * Matches Figma designs exactly (node-id: 3279-113358, 3279-113736, 3279-113554)
 */

import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { fetchMarketData, filterTokensBySubTab, searchTokens } from '@/services/marketService';
import { MarketSubTab, MarketToken, MarketType } from '@/types/market';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_CONTENT_WIDTH = 353; // From Figma design
const CONTENT_WIDTH = Math.min(SCREEN_WIDTH - 40, MAX_CONTENT_WIDTH); // 20px padding on each side

// Icons
const SearchIcon = require('../../assets/swap/search-01.svg');
const ArrowLeftIcon = require('../../assets/swap/arrow-left-02.svg');

// Line indicator for active tab
const imgLine327 = 'https://www.figma.com/api/mcp/asset/2040f48a-ef4a-465d-85f9-1bc8eb6c0987';
const imgLine340 = 'https://www.figma.com/api/mcp/asset/a1a2844d-92df-45f5-9b95-980536c19b61';

const subTabs: { id: MarketSubTab; label: string }[] = [
    { id: 'favorite', label: 'Favourite' },
    { id: 'top', label: 'Top' },
    { id: 'spotlight', label: 'Spotlight' },
    { id: 'new', label: 'New' },
    { id: 'gainers', label: 'Gainers' },
    { id: 'losers', label: 'Losers' },
];

import { TokenListItem } from '@/components/sections/Market/TokenListItem';

export default function MarketScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const [marketType, setMarketType] = useState<MarketType>('spot');
    const [activeSubTab, setActiveSubTab] = useState<MarketSubTab>('top');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [marketData, setMarketData] = useState<{ spot: MarketToken[]; perp: MarketToken[] }>({
        spot: [],
        perp: [],
    });
    const [isLoading, setIsLoading] = useState(true);

    // Load market data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await fetchMarketData();
                setMarketData(data);
            } catch (error) {
                console.error('Failed to load market data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // Get current tokens based on market type
    const currentTokens = marketType === 'spot' ? marketData.spot : marketData.perp;

    // Filter tokens by sub-tab and search
    const filteredTokens = React.useMemo(() => {
        let tokens = filterTokensBySubTab(currentTokens, activeSubTab);
        if (searchQuery.trim()) {
            tokens = searchTokens(tokens, searchQuery);
        }
        return tokens;
    }, [currentTokens, activeSubTab, searchQuery]);

    const handleTokenPress = (token: MarketToken) => {
        const symbolParam = token.symbol.toLowerCase();
        router.push(`/market/${symbolParam}` as any);
    };

    const handleSearchPress = () => {
        setIsSearchVisible(true);
    };

    const handleSearchBack = () => {
        setIsSearchVisible(false);
        setSearchQuery('');
    };

    // Search Screen
    if (isSearchVisible) {
        return (
            <View style={[styles.container, { backgroundColor: colors.bg }]}>
                <CustomStatusBar />

                {/* Header with Search Bar */}
                <View style={[styles.headerContainer, { paddingTop: top }]}>
                    <View style={styles.searchBarContainer}>
                        {/* Search Bar */}
                        <View style={styles.searchBar}>
                            <TouchableOpacity onPress={handleSearchBack}>
                                <Image
                                    source={ArrowLeftIcon}
                                    style={styles.iconMedium}
                                    contentFit="contain"
                                />
                            </TouchableOpacity>
                            <View style={styles.searchInputContainer}>
                                <View style={styles.verticalDividerWrapper}>
                                    <Image
                                        source={{ uri: imgLine340 }}
                                        style={styles.verticalDivider}
                                        contentFit="contain"
                                    />
                                </View>
                                <TextInput
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Search Coin Pairs"
                                    placeholderTextColor={colors.mutedText}
                                    autoFocus
                                    style={styles.textInput}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Top Tokens Label */}
                    <View style={styles.topTokensLabelContainer}>
                        <Text style={styles.topTokensLabel}>Top Tokens</Text>
                    </View>
                </View>

                {/* Token List */}
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: bottom + 20 }
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ width: CONTENT_WIDTH, maxWidth: '100%' }}>
                        {filteredTokens.map((token) => (
                            <TokenListItem
                                key={token.id}
                                token={token}
                                onPress={() => handleTokenPress(token)}
                            />
                        ))}
                        {filteredTokens.length === 0 && (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No tokens found</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </View>
        );
    }

    // Main Market Screen
    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Header with Tabs */}
            <View style={[styles.headerContainer, { paddingTop: top }]}>
                {/* Spot/Perp Tabs */}
                <View style={styles.mainTabsContainer}>
                    <View style={styles.tabsLeft}>
                        {/* Spot Tab */}
                        <TouchableOpacity
                            onPress={() => setMarketType('spot')}
                            style={styles.tabButton}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: marketType === 'spot' ? colors.primaryCTA : colors.mutedText }
                                ]}
                            >
                                Spot
                            </Text>
                            {marketType === 'spot' && (
                                <View style={styles.activeTabIndicatorWrapper}>
                                    <Image
                                        source={{ uri: imgLine327 }}
                                        style={styles.activeTabIndicator}
                                        contentFit="contain"
                                    />
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Perp Tab */}
                        <TouchableOpacity
                            onPress={() => setMarketType('perp')}
                            style={styles.tabButton}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: marketType === 'perp' ? colors.primaryCTA : colors.mutedText }
                                ]}
                            >
                                Perp
                            </Text>
                            {marketType === 'perp' && (
                                <View style={styles.activeTabIndicatorWrapper}>
                                    <Image
                                        source={{ uri: imgLine327 }}
                                        style={styles.activeTabIndicator}
                                        contentFit="contain"
                                    />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Search Icon */}
                    <TouchableOpacity
                        onPress={handleSearchPress}
                        style={styles.iconMedium}
                    >
                        <Image
                            source={SearchIcon}
                            style={styles.iconFull}
                            contentFit="contain"
                        />
                    </TouchableOpacity>
                </View>

                {/* Sub-Tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.subTabsContent}
                >
                    {subTabs.map((tab) => {
                        const isActive = activeSubTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setActiveSubTab(tab.id)}
                                style={[
                                    styles.subTabButton,
                                    { backgroundColor: isActive ? '#081f02' : colors.bgSemi }
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.subTabText,
                                        {
                                            fontFamily: isActive ? 'Manrope-SemiBold' : 'Manrope-Medium',
                                            color: isActive ? colors.primaryCTA : colors.bodyText
                                        }
                                    ]}
                                >
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Token List */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: bottom + 100 } // Extra padding for tab bar
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ width: CONTENT_WIDTH, maxWidth: '100%' }}>
                    {isLoading ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Loading...</Text>
                        </View>
                    ) : (
                        filteredTokens.map((token) => (
                            <TokenListItem
                                key={token.id}
                                token={token}
                                onPress={() => handleTokenPress(token)}
                            />
                        ))
                    )}
                    {!isLoading && filteredTokens.length === 0 && (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No tokens found</Text>
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

    headerContainer: {
        backgroundColor: colors.bg,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.bgStroke,
    },
    searchBarContainer: {
        paddingHorizontal: 20,
        paddingVertical: 0,
    },
    searchBar: {
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 20,
        padding: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconMedium: {
        width: 24,
        height: 24,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    verticalDividerWrapper: {
        width: 16,
        height: 1,
    },
    verticalDivider: {
        width: '100%',
        height: 1,
        transform: [{ rotate: '90deg' }],
    },
    textInput: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
        padding: 0,
    },
    topTokensLabelContainer: {
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    topTokensLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        lineHeight: 20,
        color: colors.mutedText,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: Math.max(20, (SCREEN_WIDTH - CONTENT_WIDTH) / 2),
        paddingTop: 0,
        alignItems: 'center',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    mainTabsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 0,
    },
    tabsLeft: {
        flexDirection: 'row',
        gap: 16,
    },
    tabButton: {
        flexDirection: 'column',
        gap: 10,
        alignItems: 'center',
        paddingVertical: 0,
    },
    tabText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        lineHeight: 20,
    },
    activeTabIndicatorWrapper: {
        height: 1.5,
        width: '100%',
    },
    activeTabIndicator: {
        width: '100%',
        height: 1.5,
    },
    iconFull: {
        width: '100%',
        height: '100%',
    },
    subTabsContent: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        gap: 8,
    },
    subTabButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 100,
    },
    subTabText: {
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 0.012,
    },
});
