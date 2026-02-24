import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    FadeOut,
    FadeOutUp,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

const TiwiLogo = require('@/assets/logo/tiwi-logo.svg');
const { width, height } = Dimensions.get('window');

interface ProcessingOverlayProps {
    isVisible: boolean;
    title?: string;
    subtitles?: string[];
}

const DEFAULT_SUBTITLES = [
    "Seamless crypto payments across any chain.",
    "The fastest cross-chain swaps in the ecosystem.",
    "Your assets, your control. non-custodial and secure.",
    "Earn rewards by participating in the Tiwi Protocol.",
    "Experience alpha trading with institutional precision."
];

/**
 * Professional, modular processing overlay with dynamic value-driven subtitles.
 * Features a heartbeat animation and a smooth carousel of Tiwi possibilities.
 */
export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
    isVisible,
    title = "Processing...",
    subtitles = DEFAULT_SUBTITLES
}) => {
    const pulseScale = useSharedValue(1);
    const [subIndex, setSubIndex] = useState(0);

    // Heartbeat Pulse Animation
    useEffect(() => {
        if (isVisible) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.15, { duration: 800, easing: Easing.out(Easing.quad) }),
                    withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) })
                ),
                -1,
                false
            );
        } else {
            pulseScale.value = withTiming(1, { duration: 300 });
        }
    }, [isVisible]);

    // Subtitle Rotation Cycle
    useEffect(() => {
        if (isVisible && subtitles.length > 1) {
            const timer = setInterval(() => {
                setSubIndex((prev) => (prev + 1) % subtitles.length);
            }, 500);
            return () => clearInterval(timer);
        }
    }, [isVisible, subtitles]);

    if (!isVisible) return null;

    return (
        <Animated.View
            entering={FadeIn.duration(500)}
            exiting={FadeOut.duration(400)}
            style={styles.container}
        >
            <View style={styles.topSection}>
                <Animated.View
                    style={[
                        styles.logoWrapper,
                        { transform: [{ scale: pulseScale }] }
                    ]}
                >
                    <Image
                        source={TiwiLogo}
                        style={styles.logo}
                        tintColor={colors.primaryCTA}
                        contentFit="contain"
                    />
                </Animated.View>
            </View>

            <View style={styles.bottomSection}>
                <Text style={styles.title}>{title}</Text>

                <View style={styles.subtitleContainer}>
                    <Animated.Text
                        key={`sub-${subIndex}`}
                        entering={FadeInDown.duration(800).delay(200)}
                        exiting={FadeOutUp.duration(600)}
                        style={styles.subtitle}
                    >
                        {subtitles[subIndex]}
                    </Animated.Text>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
        zIndex: 99999,
        paddingHorizontal: 30,
    },
    topSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: height * 0.1,
    },
    bottomSection: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 40,
    },
    logoWrapper: {
        width: 160,
        height: 160,
        // backgroundColor: 'rgba(177, 241, 40, 0.05)',
        // borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        // borderWidth: 1,
        // borderColor: 'rgba(177, 241, 40, 0.15)',
    },
    logo: {
        width: "100%",
        height: "100%",
    },
    title: {
        fontFamily: typography.fontFamily.bold,
        fontSize: 28,
        color: colors.titleText,
        textAlign: 'center',
        marginBottom: 16,
    },
    subtitleContainer: {
        height: 60, // Fixed height to prevent layout jumps during transition
        width: '100%',
        alignItems: 'center',
    },
    subtitle: {
        fontFamily: typography.fontFamily.regular,
        fontSize: 12,
        lineHeight: 24,
        color: colors.bodyText,
        textAlign: 'center',
        maxWidth: width * 0.8,
    }
});
