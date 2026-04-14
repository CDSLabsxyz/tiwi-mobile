import { TutorialItem as SDKTutorial } from '@/lib/mobile/api-client';
import { supabase } from '@/lib/supabase';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* 
 * Tutorial type that supports both SDK and local fallback
 */
export interface Tutorial extends Partial<SDKTutorial> {
    id: string;
    title: string;
    description: string;
    category?: string;
    link: string; // Used for UI
    thumbnailUrl: string;
}

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
        link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=600&auto=format&fit=crop',
    },
    {
        id: '2',
        title: "Add liquidity",
        description: "Step-by-step guide to providing liquidity and earning fees.",
        category: 'Liquidity',
        link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1605792657660-596af9009e82?q=80&w=600&auto=format&fit=crop',
    },
    {
        id: '3',
        title: "Create a pool",
        description: "How to initialize a new liquidity pool for your favorite tokens.",
        category: 'Liquidity',
        link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb5200c729?q=80&w=600&auto=format&fit=crop',
    },
    {
        id: '4',
        title: "Stake tokens",
        description: "Maximize your earnings by staking TIWI and other assets.",
        category: 'Staking',
        link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?q=80&w=600&auto=format&fit=crop',
    },
    {
        id: '5',
        title: "Security guide",
        description: "Learn how to keep your wallet and assets safe from scams.",
        category: 'Security',
        link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=600&auto=format&fit=crop',
    },
    {
        id: '6',
        title: "Advanced Trading",
        description: "Deep dive into cross-chain swaps and limit orders.",
        category: 'Advanced',
        link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1611974764457-36611586ca55?q=80&w=600&auto=format&fit=crop',
    }
];

/**
 * Tutorial Card Component — single column, full width
 */
function TutorialCard({ item, onPress }: { item: Tutorial; onPress: () => void }) {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.card}
        >
            <View style={styles.thumbnailContainer}>
                <Image
                    source={item.thumbnailUrl}
                    style={styles.thumbnail}
                    contentFit="cover"
                    transition={300}
                />
                <View style={styles.playOverlay}>
                    <View style={styles.playCircle}>
                        <Text style={styles.playIcon}>▶</Text>
                    </View>
                </View>
            </View>
            <View style={styles.cardInfo}>
                <Text style={styles.tutorialTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.tutorialDesc} numberOfLines={2}>{item.description}</Text>
                {item.category && (
                    <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{item.category}</Text>
                    </View>
                )}
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
    const [searchQuery, setSearchQuery] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['tutorials'],
        queryFn: async () => {
            // Fetch tutorials directly from Supabase tutorials table
            const { data: rows, error } = await supabase
                .from('tutorials')
                .select('id, title, description, link, thumbnail_url, category')
                .order('category', { ascending: true });

            if (error) {
                console.warn('[Tutorials] Supabase fetch failed:', error.message);
                return { tutorials: [] as Tutorial[] };
            }

            const mapped: Tutorial[] = (rows || []).map((t: any) => ({
                id: String(t.id),
                title: t.title || 'Tutorial',
                description: t.description || '',
                link: t.link || '',
                thumbnailUrl: t.thumbnail_url || 'https://via.placeholder.com/300?text=Tiwi+Tutorial',
                category: t.category || 'General',
            }));

            return { tutorials: mapped };
        },
        staleTime: 5 * 60 * 1000, // 5 min — tutorials don't change often
    });

    const tutorialList = useMemo(() => {
        const sourceList = data?.tutorials?.length ? data.tutorials : FALLBACK_TUTORIALS;
        if (!searchQuery.trim()) return sourceList;

        const query = searchQuery.toLowerCase();
        return sourceList.filter(t =>
            t.title.toLowerCase().includes(query) ||
            t.description.toLowerCase().includes(query) ||
            (t.category || '').toLowerCase().includes(query)
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
                        renderItem={({ item }) => (
                            <TutorialCard
                                item={item}
                                onPress={() => router.push({
                                    pathname: '/settings/support/tutorial-player' as any,
                                    params: {
                                        id: item.id,
                                        title: item.title,
                                        description: item.description,
                                        videoUrl: encodeURIComponent(item.link),
                                        thumbnailUrl: encodeURIComponent(item.thumbnailUrl || ''),
                                        category: item.category || '',
                                    },
                                })}
                            />
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
        gap: 14,
    },
    card: {
        width: '100%',
        backgroundColor: '#0B0F0A',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1F261E',
    },
    thumbnailContainer: {
        width: '100%',
        position: 'relative',
    },
    thumbnail: {
        height: 180,
        width: '100%',
        backgroundColor: '#121712',
    },
    playOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderWidth: 2,
        borderColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playIcon: {
        fontSize: 20,
        color: colors.primaryCTA,
        marginLeft: 4,
    },
    cardInfo: {
        padding: 14,
    },
    tutorialTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.titleText,
        marginBottom: 6,
    },
    tutorialDesc: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: colors.bodyText,
        lineHeight: 18,
        opacity: 0.8,
        marginBottom: 8,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(177, 241, 40, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    categoryText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 11,
        color: colors.primaryCTA,
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
