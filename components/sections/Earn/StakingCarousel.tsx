/**
 * Staking Carousel Component
 * Banner carousel for staking promotions
 * Matches Figma design exactly
 */

import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

const MegaphoneIcon = require('../../../assets/earn/megaphone-02.svg');
const ArrowRightIcon = require('../../../assets/earn/arrow-right-02.svg');

interface StakingCarouselProps {
    onPress?: () => void;
}

/**
 * Staking Carousel - Promotional banner with carousel indicators
 */
export const StakingCarousel: React.FC<StakingCarouselProps> = ({ onPress }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const slides = ['Maximize Your Yields', 'Diverse', 'Simple'];

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.container}
        >
            {/* Megaphone Icon */}
            <View style={styles.iconContainer}>
                <Image
                    source={MegaphoneIcon}
                    style={styles.fullImage}
                    contentFit="contain"
                />
            </View>

            {/* Text Content */}
            <View style={styles.textContainer}>
                <Text style={styles.label}>
                    Stake
                </Text>
                <View style={[styles.title, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                    <Text style={styles.title}>
                        {slides[currentSlide]}
                    </Text>
                    <FontAwesome5 name="arrow-right" color="white" />
                </View>
            </View>

            {/* Carousel Indicators - Positioned absolutely at bottom */}
            <View style={styles.indicators}>
                {slides.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.indicator,
                            {
                                width: index === currentSlide ? 16 : 8,
                                backgroundColor: index === currentSlide ? colors.primaryCTA : '#273024',
                            }
                        ]}
                    />
                ))}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bgCards,
        height: 48,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 8,
        width: '100%',
    },
    iconContainer: {
        width: 24,
        height: 24,
    },
    fullImage: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        flex: 1,
        flexDirection: 'column',
    },
    label: {
        fontFamily: 'Manrope-Regular',
        fontSize: 10,
        color: colors.mutedText,
    },
    title: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        gap: 8,
    },
    arrowContainer: {
        width: 16,
        height: 16,
    },
    indicators: {
        position: 'absolute',
        bottom: 8,
        right: 16,
        flexDirection: 'row',
        gap: 2,
        alignItems: 'center',
    },
    indicator: {
        height: 1,
        borderRadius: 8,
    },
});
