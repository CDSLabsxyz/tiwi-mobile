import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import { apiClient, Tutorial } from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    Linking,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SearchIcon = require('@/assets/swap/search-01.svg');

/**
 * Fallback Tutorials matching Figma design (node-id: 3279:121361)
 */
const FALLBACK_TUTORIALS: Tutorial[] = [
    {
        id: '1',
        title: "How to swap",
        description: "Learn the basics of swapping assets on Tiwi Protocol.",
        category: 'Trading',
        link: 'https://youtube.com/watch?v=dQw4w9WgXcQ', // Placeholder link
        thumbnailUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=600&auto=format&fit=crop', // Crypto/DeFi theme
        createdAt: '',
        updatedAt: ''
    },
    {
        id: '2',
        title: "Add liquidity",
        description: "Step-by-step guide to providing liquidity and earning fees.",
        category: 'Liquidity',
        link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1605792657660-596af9009e82?q=80&w=600&auto=format&fit=crop',
        createdAt: '',
        updatedAt: ''
    },
    {
        id: '3',
        title: "Create a pool",
        description: "How to initialize a new liquidity pool for your favorite tokens.",
        category: 'Liquidity',
        link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb5200c729?q=80&w=600&auto=format&fit=crop',
        createdAt: '',
        updatedAt: ''
    },
    {
        id: '4',
        title: "Stake tokens",
        description: "Maximize your earnings by staking TIWI and other assets.",
        category: 'Staking',
        link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?q=80&w=600&auto=format&fit=crop',
        createdAt: '',
        updatedAt: ''
    },
    {
        id: '5',
        title: "Security guide",
        description: "Learn how to keep your wallet and assets safe from scams.",
        category: 'Security',
        link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=600&auto=format&fit=crop',
        createdAt: '',
        updatedAt: ''
    },
    {
        id: '6',
        title: "Advanced Trading",
        description: "Deep dive into cross-chain swaps and limit orders.",
        category: 'Advanced',
        link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1611974764457-36611586ca55?q=80&w=600&auto=format&fit=crop',
        createdAt: '',
        updatedAt: ''
    }
];

/**
 * Tutorial Card Component
 * 2-column grid item
 */
function TutorialCard({ item, cardWidth }: { item: Tutorial; cardWidth: number }) {
    const handlePress = async () => {
        const supported = await Linking.canOpenURL(item.link);
        if (supported) {
            await Linking.openURL(item.link);
        }
    };

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePress}
            style={[styles.card, { width: cardWidth }]}
        >
            <View style={styles.thumbnailContainer}>
                <Image
                    source={item.thumbnailUrl}
                    style={styles.thumbnail}
                    contentFit="cover"
                    transition={300}
                />
            </View>
            <View style={styles.cardInfo}>
                <Text style={styles.tutorialTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.tutorialDesc} numberOfLines={2}>{item.description}</Text>
            </View>
        </TouchableOpacity>
    );
}

/**
 * Tutorials Screen
 * Matches Figma design exactly (node-id: 3279:121361)
 */
export default function TutorialsScreen() {
    const router = useRouter();
    const { bottom } = useSafeAreaInsets();
    const { width: windowWidth } = useWindowDimensions();
    const [searchQuery, setSearchQuery] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['tutorials'],
        queryFn: () => apiClient.getTutorials(),
    });

    // Calculate grid layout
    const numColumns = 2;
    const horizontalPadding = 20;
    const gridGap = 8;
    const cardWidth = (windowWidth - (horizontalPadding * 2) - gridGap) / numColumns;

    const tutorialList = useMemo(() => {
        const sourceList = data?.tutorials?.length ? data.tutorials : FALLBACK_TUTORIALS;
        if (!searchQuery.trim()) return sourceList;

        const query = searchQuery.toLowerCase();
        return sourceList.filter(t =>
            t.title.toLowerCase().includes(query) ||
            t.description.toLowerCase().includes(query) ||
            t.category.toLowerCase().includes(query)
        );
    }, [data, searchQuery]);

    return (
        <View style={styles.container}>
            <CustomStatusBar />
            <SettingsHeader
                title="Tutorials"
                showBack={true}
                onBack={() => router.back()}
            />

            <View style={styles.content}>
                {/* Search Bar - Matching Figma: h[48px], bg-[#1B1B1B], rounded-[20px] */}
                <View style={styles.searchBarContainer}>
                    <Image source={SearchIcon} style={styles.searchIcon} contentFit="contain" />
                    <TextInput
                        placeholder="Search"
                        placeholderTextColor="rgba(255, 255, 255, 0.7)"
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {isLoading && !data ? (
                    <View style={styles.loaderContainer}>
                        <TIWILoader size={100} />
                    </View>
                ) : (
                    <FlatList
                        data={tutorialList}
                        keyExtractor={item => item.id}
                        numColumns={numColumns}
                        columnWrapperStyle={{ gap: gridGap }}
                        renderItem={({ item }) => (
                            <TutorialCard item={item} cardWidth={cardWidth} />
                        )}
                        contentContainerStyle={[
                            styles.listContent,
                            { paddingBottom: bottom + 20 }
                        ]}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No tutorials matching your search</Text>
                            </View>
                        )}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#010501', // Figma: Dark/bg
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    searchBarContainer: {
        height: 48,
        backgroundColor: '#1B1B1B',
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    searchIcon: {
        width: 16,
        height: 16,
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: '#FFFFFF',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        gap: 12, // Spacing between rows
    },
    card: {
        backgroundColor: '#0B0F0A', // Figma: Dark/bg semi
        borderRadius: 16,
        overflow: 'hidden',
        padding: 5, // Figma px-[5px]
        paddingBottom: 7, // Figma py-[7px]
    },
    thumbnailContainer: {
        width: '100%',
    },
    thumbnail: {
        height: 125, // Figma design height
        width: '100%',
        borderRadius: 16,
        backgroundColor: '#121712',
    },
    cardInfo: {
        paddingHorizontal: 5,
        paddingTop: 8,
    },
    tutorialTitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#B5B5B5', // Figma text color
        marginBottom: 2,
    },
    tutorialDesc: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: '#B5B5B5',
        lineHeight: 16,
        opacity: 0.7,
    },
    emptyContainer: {
        marginTop: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.mutedText,
    },
});
