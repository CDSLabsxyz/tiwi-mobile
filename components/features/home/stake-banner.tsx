import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Stake Banner Component
 * 1:1 Implementation of Figma Design (node-id: 3331-39008)
 * Uses native components and high-quality SVG assets.
 */
export const StakeBanner: React.FC = () => {
    const router = useRouter();

    const handlePress = () => {
        router.push('/stake' as any);
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.8}
            style={styles.container}
        >
            {/* Background Layer with Bottom Glow */}
            <View style={styles.glowContainer}>
                <LinearGradient
                    colors={['rgba(31, 38, 30, 0)', 'rgba(177, 241, 40, 0.4)', 'rgba(31, 38, 30, 0)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.glowEffect}
                />
            </View>

            {/* Inner Content Section */}
            <View style={styles.content}>
                <View style={styles.leftGroup}>
                    {/* Stake Icon */}
                    <Image
                        source={require('@/assets/home/stake_icon.svg')}
                        style={styles.stakeIcon}
                        contentFit="contain"
                    />

                    {/* Text Label */}
                    <Text style={styles.label}>
                        <Text style={styles.labelMuted}>Stake to earn </Text>
                        <Text style={styles.labelHighlight}>$TWC</Text>
                    </Text>
                </View>

                {/* Right Arrow */}
                <Image
                    source={require('@/assets/home/arrow-right-01.svg')}
                    style={styles.arrowIcon}
                    contentFit="contain"
                    tintColor="#b5b5b5"
                />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 353,
        height: 40,
        borderRadius: 16,
        backgroundColor: '#0F110F',
        borderWidth: 1,
        borderColor: '#1f261e',
        overflow: 'hidden',
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    glowContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    glowEffect: {
        width: 146,
        height: 37,
        bottom: -18,
        position: 'absolute',
        borderRadius: 100,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1,
    },
    leftGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    stakeIcon: {
        width: 18,
        height: 18,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
    },
    labelMuted: {
        color: '#b5b5b5',
    },
    labelHighlight: {
        fontFamily: 'Manrope-SemiBold',
        color: '#FFFFFF',
    },
    arrowIcon: {
        width: 16,
        height: 16,
    },
});
