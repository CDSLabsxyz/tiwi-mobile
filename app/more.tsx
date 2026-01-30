import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { SearchableItem, searchItems } from '@/utils/search';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MoreAction {
    id: string;
    label: string;
    icon: any;
    route?: string;
    category: 'recommended' | 'popular' | 'coming-soon';
    disabled?: boolean;
}

// All actions available in the More page
const allActions: MoreAction[] = [
    // Recommended
    {
        id: 'swap',
        label: 'Swap',
        icon: require('../assets/home/exchange-01.svg'),
        route: '/swap',
        category: 'recommended',
    },
    {
        id: 'stake',
        label: 'Stake',
        icon: require('../assets/home/stake-1.svg'),
        route: '/stake',
        category: 'recommended',
    },
    {
        id: 'pool',
        label: 'Pool',
        icon: require('../assets/home/coins-02-1.svg'),
        route: '/pool',
        category: 'recommended',
    },
    {
        id: 'analytics',
        label: 'Analytics',
        icon: require('../assets/home/more/analytics-01.svg'),
        route: '/analytics',
        category: 'recommended',
    },
    {
        id: 'history',
        label: 'History',
        icon: require('../assets/home/transaction-history.svg'),
        route: '/history',
        category: 'recommended',
    },
    // Popular
    {
        id: 'market',
        label: 'Market',
        icon: require('../assets/home/market-analysis.svg'),
        route: '/market',
        category: 'popular',
    },
    {
        id: 'earn',
        label: 'Earn',
        icon: require('../assets/home/coins-01.svg'),
        route: '/earn',
        category: 'popular',
    },
    {
        id: 'wallet',
        label: 'Wallet',
        icon: require('../assets/home/wallet-03.svg'),
        route: '/wallet',
        category: 'popular',
    },
    // Coming soon
    {
        id: 'pay',
        label: 'Pay',
        icon: require('../assets/home/more/payment-02.svg'),
        category: 'coming-soon',
        disabled: true,
    },
    {
        id: 'lend',
        label: 'Lend',
        icon: require('../assets/home/more/money-send-flow-02.svg'),
        category: 'coming-soon',
        disabled: true,
    },
    {
        id: 'vote',
        label: 'Vote',
        icon: require('../assets/home/more/user-dollar.svg'),
        category: 'coming-soon',
        disabled: true,
    },
];

// Convert to searchable items
const searchableItems: SearchableItem[] = allActions.map((action) => ({
    id: action.id,
    label: action.label,
    category: action.category,
    keywords: [action.label.toLowerCase(), action.category],
}));

/**
 * More Screen Component
 * Displays all available actions with search functionality
 * Matches Figma design exactly (node-id: 3331-39338)
 */
export default function MoreScreen() {
    const router = useRouter();
    const { top, bottom } = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredActions, setFilteredActions] = useState<MoreAction[]>(allActions);

    // Handle phone back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true; // Prevent default behavior
        });

        return () => backHandler.remove();
    }, []);

    // Search functionality
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredActions(allActions);
            return;
        }

        // Use 70% similarity threshold (between 60-80%)
        const searchResults = searchItems(searchQuery, searchableItems, 0.7);
        const resultIds = new Set(searchResults.map((item) => item.id));
        const filtered = allActions.filter((action) => resultIds.has(action.id));
        setFilteredActions(filtered);
    }, [searchQuery]);

    const handleBackPress = () => {
        // Navigate back to home screen
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/' as any);
        }
    };

    const handleActionPress = (action: MoreAction) => {
        if (action.disabled || !action.route) return;
        router.push(action.route as any);
    };

    // Group actions by category
    const recommendedActions = filteredActions.filter((a) => a.category === 'recommended');
    const popularActions = filteredActions.filter((a) => a.category === 'popular');
    const comingSoonActions = filteredActions.filter((a) => a.category === 'coming-soon');

    // Show sections only if they have items after filtering
    // When no search query, show all sections
    const showRecommended = searchQuery.trim() ? recommendedActions.length > 0 : true;
    const showPopular = searchQuery.trim() ? popularActions.length > 0 : true;
    const showComingSoon = searchQuery.trim() ? comingSoonActions.length > 0 : true;

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Header with Search */}
            <View
                style={[
                    styles.header,
                    {
                        paddingTop: top || 0,
                        backgroundColor: colors.bg,
                    }
                ]}
            >
                {/* Search Bar */}
                <View style={styles.searchBar}>
                    {/* Back Button */}
                    <TouchableOpacity
                        onPress={handleBackPress}
                        style={styles.backButton}
                    >
                        <Image
                            source={require('../assets/swap/arrow-left-02.svg')}
                            style={{ width: 24, height: 24 }}
                            contentFit="contain"
                        />
                    </TouchableOpacity>

                    {/* Search Input */}
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search"
                        placeholderTextColor={colors.mutedText}
                        style={styles.searchInput}
                    />
                </View>
            </View>

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={{
                    paddingTop: 24,
                    paddingBottom: (bottom || 16) + 76 + 24,
                    paddingHorizontal: 20,
                    gap: 24,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* Recommended Section */}
                {showRecommended && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>
                            Recommended
                        </Text>
                        <View style={styles.gridContainer}>
                            {Array.from({ length: 5 }).map((_, index) => {
                                const action = recommendedActions[index];
                                if (!action) {
                                    return <View key={`empty-${index}`} style={styles.emptyAction} />;
                                }
                                return (
                                    <TouchableOpacity
                                        key={action.id}
                                        onPress={() => handleActionPress(action)}
                                        disabled={action.disabled}
                                        style={[styles.actionItem, { opacity: action.disabled ? 0.5 : 1 }]}
                                    >
                                        <View style={styles.iconContainer}>
                                            <Image
                                                source={action.icon}
                                                style={styles.actionIcon}
                                                contentFit="contain"
                                            />
                                        </View>
                                        <Text
                                            style={[
                                                styles.actionLabel,
                                                { color: action.disabled ? colors.mutedText : colors.titleText }
                                            ]}
                                        >
                                            {action.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Popular Section */}
                {showPopular && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>
                            Popular
                        </Text>
                        <View style={styles.gridContainer}>
                            {Array.from({ length: 5 }).map((_, index) => {
                                const action = popularActions[index];
                                if (!action) {
                                    return <View key={`empty-${index}`} style={styles.emptyAction} />;
                                }
                                return (
                                    <TouchableOpacity
                                        key={action.id}
                                        onPress={() => handleActionPress(action)}
                                        disabled={action.disabled}
                                        style={[styles.actionItem, { opacity: action.disabled ? 0.5 : 1 }]}
                                    >
                                        <View style={styles.iconContainer}>
                                            <Image
                                                source={action.icon}
                                                style={styles.actionIcon}
                                                contentFit="contain"
                                            />
                                        </View>
                                        <Text
                                            style={[
                                                styles.actionLabel,
                                                { color: action.disabled ? colors.mutedText : colors.titleText }
                                            ]}
                                        >
                                            {action.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Coming Soon Section */}
                {showComingSoon && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>
                            Coming soon
                        </Text>
                        <View style={styles.gridContainer}>
                            {Array.from({ length: 5 }).map((_, index) => {
                                const action = comingSoonActions[index];
                                if (!action) {
                                    return <View key={`empty-${index}`} style={styles.emptyAction} />;
                                }
                                return (
                                    <TouchableOpacity
                                        key={action.id}
                                        onPress={() => handleActionPress(action)}
                                        disabled={action.disabled}
                                        style={[styles.actionItem, { opacity: action.disabled ? 0.5 : 1 }]}
                                    >
                                        <View style={styles.iconContainer}>
                                            <Image
                                                source={action.icon}
                                                style={styles.actionIcon}
                                                contentFit="contain"
                                            />
                                        </View>
                                        <Text
                                            style={[
                                                styles.actionLabel,
                                                { color: colors.mutedText } // Grayed out for coming soon
                                            ]}
                                        >
                                            {action.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* No Results Message */}
                {searchQuery.trim() && filteredActions.length === 0 && (
                    <View style={styles.noResultsContainer}>
                        <Text style={styles.noResultsText}>
                            No results found
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingBottom: 8,
        paddingHorizontal: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 20,
        padding: 8,
        gap: 8,
    },
    backButton: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchInput: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
        height: '100%',
        padding: 0,
    },
    scrollView: {
        flex: 1,
    },
    sectionContainer: {
        gap: 16,
    },
    sectionTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.mutedText, // #7C7C7C
    },
    gridContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    actionItem: {
        alignItems: 'center',
        gap: 8,
        width: 70,
    },
    emptyAction: {
        width: 64,
        height: 55,
    },
    iconContainer: {
        width: 40,
        height: 40,
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
    },
    actionIcon: {
        width: 24,
        height: 24,
    },
    actionLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        textAlign: 'center',
    },
    noResultsContainer: {
        alignItems: 'center',
        paddingTop: 40,
    },
    noResultsText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
});
