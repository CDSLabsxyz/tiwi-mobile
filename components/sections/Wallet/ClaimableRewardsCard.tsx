/**
 * Modular Banner Card Component
 * Reusable for Claimable Rewards, Stake to Earn, etc.
 * Matches Figma design (node-id: 3279:120018)
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

const ArrowRightIcon = require('@/assets/home/arrow-down-01.svg'); // Reusing and rotating

interface BannerCardProps {
    /** Left icon can be an image source or a React Node */
    icon: any;
    /** Main text label or a render function for complex tags */
    title?: string;
    renderTitle?: () => React.ReactNode;
    /** Optional amount/value to display prominently */
    amount?: string;
    /** Click handler */
    onPress?: () => void;
    /** Optional extra styling for container */
    style?: ViewStyle;
    /** Optional secondary text for subtitle/description */
    subtitle?: string;
}

/**
 * A premium, reusable banner card with the signature Tiwi glow effect.
 */
export const BannerCard: React.FC<BannerCardProps> = ({
    icon,
    title,
    renderTitle,
    amount,
    onPress,
    style,
    subtitle,
}) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={[styles.container, style]}
        >
            {/* High-Fidelity Bottom Gradient Line (Figma node-id: 3279:120024) */}
            <LinearGradient
                colors={['rgba(177, 241, 40, 0)', 'rgba(177, 241, 40, 0.95)', 'rgba(177, 241, 40, 0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.gradientLine}
                pointerEvents="none"
            />

            {/* Left Content */}
            <View style={styles.leftSection}>
                <View style={styles.iconWrapper}>
                    {typeof icon === 'number' || (typeof icon === 'object' && icon.uri) ? (
                        <Image source={icon} style={styles.fullSize} contentFit="contain" />
                    ) : (
                        icon
                    )}
                </View>

                <View style={styles.textWrapper}>
                    {renderTitle ? (
                        renderTitle()
                    ) : (
                        <Text style={styles.titleText}>
                            {title}
                            {amount && (
                                <Text style={styles.amountText}>: {amount}</Text>
                            )}
                        </Text>
                    )}
                    {subtitle && <Text style={styles.subtitleText}>{subtitle}</Text>}
                </View>
            </View>

            {/* Right Arrow */}
            <View style={styles.arrowWrapper}>
                <Image
                    source={ArrowRightIcon}
                    style={styles.arrowIcon}
                    contentFit="contain"
                />
            </View>
        </TouchableOpacity>
    );
};

/**
 * Specific implementation for Claimable Rewards
 */
const StarIcon = require('@/assets/home/star-18.svg');

export const ClaimableRewardsCard: React.FC<{ amount: string; onPress?: () => void }> = ({
    amount,
    onPress
}) => {
    return (
        <BannerCard
            icon={StarIcon}
            renderTitle={() => (
                <Text style={styles.titleText}>
                    Claimable Rewards: <Text style={styles.amountText}>{amount}</Text>
                </Text>
            )}
            onPress={onPress}
            style={{ marginTop: 12 }}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        minHeight: 48,
        backgroundColor: '#010501',
        borderWidth: 1,
        borderColor: '#1f261e',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
        position: 'relative',
        marginVertical: 20,
    },
    gradientLine: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
    },
    leftSection: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    iconWrapper: {
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
    },
    titleText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#B5B5B5',
        includeFontPadding: false,
    },
    amountText: {
        fontFamily: 'Manrope-SemiBold',
        color: '#FFFFFF',
    },
    subtitleText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: '#B5B5B5',
    },
    arrowWrapper: {
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '270deg' }], // Pointing right
    },
    arrowIcon: {
        width: '100%',
        height: '100%',
        tintColor: '#b5b5b5',
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
