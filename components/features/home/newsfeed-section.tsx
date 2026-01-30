import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { NewsfeedItem } from '@/types';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';

interface NewsfeedSectionProps {
    items: NewsfeedItem[];
    isLoading?: boolean;
}

import { Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = 160; // Increased height significantly for better presence
const AUTO_SCROLL_INTERVAL = 5000;

/**
 * Newsfeed Section Component
 * Displays banner images in a carousel with dynamic indicators
 * Matches Figma design exactly
 */
export const NewsfeedSection: React.FC<NewsfeedSectionProps> = ({
    items,
    isLoading = false,
}) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isUserScrollingRef = useRef(false);

    useEffect(() => {
        if (items.length <= 1) return;

        const startAutoScroll = () => {
            // @ts-ignore
            autoScrollTimerRef.current = setInterval(() => {
                if (isUserScrollingRef.current) return;

                setActiveIndex((prevIndex) => {
                    const nextIndex = (prevIndex + 1) % items.length;
                    flatListRef.current?.scrollToIndex({
                        index: nextIndex,
                        animated: true,
                    });
                    return nextIndex;
                });
            }, AUTO_SCROLL_INTERVAL);
        };

        startAutoScroll();

        return () => {
            if (autoScrollTimerRef.current) {
                clearInterval(autoScrollTimerRef.current);
            }
        };
    }, [items.length]);

    if (isLoading) {
        return (
            <View style={styles.container}>
                <Skeleton width={SCREEN_WIDTH} height={BANNER_HEIGHT} borderRadius={16} style={{ paddingHorizontal: 16 }} />
                <View style={styles.indicatorContainer}>
                    <Skeleton width={8} height={4} borderRadius={100} />
                    <Skeleton width={24} height={4} borderRadius={100} />
                    <Skeleton width={24} height={4} borderRadius={100} />
                </View>
            </View>
        );
    }

    if (!items || items.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.bannerWrapper}>
                    <Image
                        source={require('../../../assets/home/banner.svg')}
                        style={styles.image}
                        contentFit="contain"
                    />
                </View>
                <View style={styles.indicatorContainer}>
                    <View style={[styles.indicator, { width: 8, backgroundColor: colors.primaryCTA }]} />
                </View>
            </View>
        );
    }

    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        isUserScrollingRef.current = true;
        const scrollPosition = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollPosition / SCREEN_WIDTH);
        if (index !== activeIndex && index >= 0 && index < items.length) {
            setActiveIndex(index);
        }

        setTimeout(() => {
            isUserScrollingRef.current = false;
        }, 1000);
    };

    const onScrollToIndexFailed = (info: { index: number }) => {
        setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
        }, 100);
    };

    const renderBanner = ({ item }: { item: NewsfeedItem }) => {
        const imageSource = typeof item.imageUrl === 'string'
            ? item.imageUrl
            : item.imageUrl || require('../../../assets/home/banner.svg');

        return (
            <View style={styles.bannerWrapper}>
                <Image
                    source={imageSource}
                    style={styles.image}
                    contentFit="contain"
                />
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={items}
                renderItem={renderBanner}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                snapToInterval={SCREEN_WIDTH}
                decelerationRate="fast"
                onScrollToIndexFailed={onScrollToIndexFailed}
                getItemLayout={(_, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                })}
            />

            {items.length > 1 && (
                <View style={styles.indicatorContainer}>
                    {items.map((_, index) => {
                        const isActive = index === activeIndex;
                        return (
                            <View
                                key={index}
                                style={[
                                    styles.indicator,
                                    {
                                        width: isActive ? 8 : 24,
                                        backgroundColor: isActive ? colors.primaryCTA : colors.bgStroke,
                                    },
                                ]}
                            />
                        );
                    })}
                </View>
            )}

            {items.length === 1 && (
                <View style={styles.indicatorContainer}>
                    <View style={[styles.indicator, { width: 8, backgroundColor: colors.primaryCTA }]} />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: "100%",
        gap: 8,
    },
    bannerWrapper: {
        width: SCREEN_WIDTH,
        height: BANNER_HEIGHT,
        overflow: 'hidden',
        backgroundColor: colors.bg, // Match background for contain
        paddingHorizontal: 16,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    indicatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    indicator: {
        height: 4,
        borderRadius: 999,
    },
});
