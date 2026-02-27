/**
 * Onboarding Screen
 * 3-screen carousel for first-time users
 * Matches Figma designs exactly
 */

import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useLocalization';
import { useOnboardingStore } from '@/store/onboardingStore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View, ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ArrowRightIcon = require('../assets/onboarding/arrow-right-02.svg');

interface OnboardingSlide {
    id: string;
    title: string;
    description: string;
    image: any;
}


export default function OnboardingScreen() {
    const { bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { t } = useTranslation();
    const flatListRef = useRef<FlatList>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const { completeOnboarding, setSeenOnboardingInSession } = useOnboardingStore();

    const slides: OnboardingSlide[] = [
        {
            id: '1',
            title: t('onboarding.slide1_title'),
            description: t('onboarding.slide1_desc'),
            image: require('../assets/onboarding/trade-smarter.svg'),
        },
        {
            id: '2',
            title: t('onboarding.slide2_title'),
            description: t('onboarding.slide2_desc'),
            image: require('../assets/onboarding/pay-future.png'),
        },
        {
            id: '3',
            title: t('onboarding.slide3_title'),
            description: t('onboarding.slide3_desc'),
            image: require('../assets/onboarding/nft-unlocked.png'),
        },
    ];

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            handleComplete();
        }
    };

    const handleComplete = async () => {
        await completeOnboarding();
        setSeenOnboardingInSession(true);
        router.replace('/wallet' as any);
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    }).current;

    const renderSlide = ({ item }: { item: OnboardingSlide }) => (
        <View style={styles.slide}>
            {/* Image Container */}
            <View style={styles.imageContainer}>
                <Image
                    source={item.image}
                    style={styles.image}
                    contentFit="cover" // Changed to cover to fill width
                    transition={1000}
                />
            </View>

            {/* Text Content */}
            <View style={styles.textContainer}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Progress Indicator */}
            <View style={styles.progressContainer}>
                {slides.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.progressBar,
                            {
                                backgroundColor: index === currentIndex ? colors.primaryCTA : '#2A2A2A',
                                width: index === currentIndex ? 48 : 16,
                            },
                        ]}
                    />
                ))}
            </View>

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={slides}
                renderItem={renderSlide}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                keyExtractor={(item) => item.id}
                bounces={false}
            />

            {/* Next Button */}
            <View style={[styles.buttonContainer, { paddingBottom: bottom }]}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleNext}
                    style={styles.nextButton}
                >
                    <Image
                        source={ArrowRightIcon}
                        style={styles.arrowIcon}
                        contentFit="contain"
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingTop: 60,
        paddingBottom: 20,
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
    },
    slide: {
        width: SCREEN_WIDTH,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 0,
    },
    imageContainer: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        // Removed red background
    },
    image: {
        width: '100%',
        height: '100%', // Takes up all available space in container
    },
    textContainer: {
        width: '100%',
        alignItems: 'flex-start',
        paddingHorizontal: 24,
        paddingBottom: 120,
    },
    title: {
        fontFamily: 'Manrope-Bold',
        fontSize: 32,
        lineHeight: 40,
        color: colors.titleText,
        marginBottom: 12,
    },
    description: {
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        lineHeight: 24,
        color: colors.bodyText,
    },
    buttonContainer: {
        position: 'absolute',
        bottom: 0,
        right: 20,
        alignItems: 'flex-end',
    },
    nextButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowIcon: {
        width: 24,
        height: 24,
    },
});
