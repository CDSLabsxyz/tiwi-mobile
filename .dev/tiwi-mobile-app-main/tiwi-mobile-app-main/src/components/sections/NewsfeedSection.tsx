import React, { useState, useRef, useEffect } from 'react';
import { View, FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { NewsfeedItem } from '@/types';
import { Skeleton } from '../ui/Skeleton';

interface NewsfeedSectionProps {
  items: NewsfeedItem[];
  isLoading?: boolean;
}

const BANNER_WIDTH = 353;
const BANNER_HEIGHT = 114;
const AUTO_SCROLL_INTERVAL = 5000; // 5 seconds

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

  // Auto-scroll functionality (pauses when user is scrolling)
  useEffect(() => {
    if (items.length <= 1) return;

    const startAutoScroll = () => {
      autoScrollTimerRef.current = setInterval(() => {
        // Don't auto-scroll if user is currently scrolling
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
      <View className="flex-col gap-2 w-[353px]">
        <Skeleton width={353} height={114} borderRadius={16} />
        <View className="flex-row items-center justify-center gap-1">
          <Skeleton width={8} height={4} borderRadius={100} />
          <Skeleton width={24} height={4} borderRadius={100} />
          <Skeleton width={24} height={4} borderRadius={100} />
        </View>
      </View>
    );
  }

  // If no items, show placeholder with banner.svg
  if (!items || items.length === 0) {
    return (
      <View className="flex-col gap-2 w-[353px]">
        <View 
          className="relative w-full h-[114px] rounded-2xl overflow-hidden"
          style={{ backgroundColor: colors.bgCards }}
        >
          <Image
            source={require('../../assets/home/banner.svg')}
            className="w-full h-full"
            contentFit="contain"
          />
        </View>
        <View className="flex-row items-center justify-center gap-1">
          <View
            className="h-1 rounded-full"
            style={{
              width: 8,
              backgroundColor: colors.primaryCTA,
            }}
          />
        </View>
      </View>
    );
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    isUserScrollingRef.current = true;
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / BANNER_WIDTH);
    if (index !== activeIndex && index >= 0 && index < items.length) {
      setActiveIndex(index);
    }
    
    // Reset user scrolling flag after scroll ends
    setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 1000);
  };

  const onScrollToIndexFailed = (info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
    // Handle scroll to index failure gracefully
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
    }, 100);
  };

  const renderBanner = ({ item }: { item: NewsfeedItem }) => {
    // Handle both local assets (require) and remote URLs (string)
    const imageSource = typeof item.imageUrl === 'string' 
      ? item.imageUrl 
      : item.imageUrl || require('../../assets/home/banner.svg');

    return (
      <View
        className="w-[353px] h-[114px] rounded-2xl overflow-hidden"
        style={{ 
          width: BANNER_WIDTH, 
          height: BANNER_HEIGHT,
          backgroundColor: colors.bgCards,
        }}
      >
        <Image
          source={imageSource}
          className="w-full h-full"
          contentFit="contain"
        />
      </View>
    );
  };

  return (
    <View className="flex-col gap-2 w-[353px]">
      {/* Banner Carousel */}
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
        snapToInterval={BANNER_WIDTH}
        decelerationRate="fast"
        onScrollToIndexFailed={onScrollToIndexFailed}
        getItemLayout={(_, index) => ({
          length: BANNER_WIDTH,
          offset: BANNER_WIDTH * index,
          index,
        })}
        contentContainerStyle={{
          paddingHorizontal: 0,
        }}
      />

      {/* Indicators */}
      {items.length > 1 && (
        <View className="flex-row items-center justify-center gap-1">
          {items.map((_, index) => {
            const isActive = index === activeIndex;
            return (
              <View
                key={index}
                className="h-1 rounded-full"
                style={{
                  width: isActive ? 8 : 24,
                  backgroundColor: isActive ? colors.primaryCTA : colors.bgStroke,
                }}
              />
            );
          })}
        </View>
      )}
      
      {/* Single indicator when only one banner */}
      {items.length === 1 && (
        <View className="flex-row items-center justify-center gap-1">
          <View
            className="h-1 rounded-full"
            style={{
              width: 8,
              backgroundColor: colors.primaryCTA,
            }}
          />
        </View>
      )}
    </View>
  );
};
