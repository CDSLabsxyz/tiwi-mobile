import { colors } from '@/constants/colors';
import { getWalletIconUrl, WalletConnectWallet } from '@/services/walletConnectService';
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

interface WalletConnectionContentProps {
    wallet: WalletConnectWallet | null;
    onCancel: () => void;
    onRetry: () => void;
    isConnecting: boolean;
}

export const WalletConnectionContent: React.FC<WalletConnectionContentProps> = ({
    wallet,
    onCancel,
    onRetry,
    isConnecting
}) => {
    // Rotation animation for loader
    const rotation = useSharedValue(0);

    useEffect(() => {
        if (isConnecting) {
            rotation.value = withRepeat(
                withTiming(360, { duration: 1500, easing: Easing.linear }),
                -1,
                false
            );
        } else {
            rotation.value = 0;
        }
    }, [isConnecting]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    if (!wallet) return null;

    const iconUrl = wallet.id === 'walletconnect'
        ? 'https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/master/Logo/Blue%20(Default)/Logo.png'
        : getWalletIconUrl(wallet.image_id);

    const handleGetWallet = () => {
        const url = wallet.mobile?.universal || wallet.homepage;
        if (url) {
            Linking.openURL(url);
        }
    };

    return (
        <View style={styles.container}>
            {/* Logo Section */}
            <View style={styles.logoContainer}>
                {/* Static Logo */}
                <Image
                    source={{ uri: iconUrl }}
                    style={styles.logo}
                    contentFit="contain"
                />

                {/* Animated Loading Ring */}
                {isConnecting && (
                    <Animated.View style={[styles.loaderRing, animatedStyle]}>
                        <View style={styles.loaderArc} />
                    </Animated.View>
                )}
            </View>

            {/* Status Text */}
            <Text style={styles.statusTitle}>
                Continue in {wallet.name}
            </Text>
            <Text style={styles.statusSubtitle}>
                Accept connection request in the wallet
            </Text>

            {/* Action Buttons */}
            <TouchableOpacity
                style={styles.retryButton}
                onPress={onRetry}
                activeOpacity={0.7}
            >
                <Feather name="refresh-cw" size={16} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>

            {/* Footer / Helper - Slightly different layout for bottom sheet to fill space */}
            <View style={styles.spacer} />

            <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have {wallet.name}?</Text>
                <TouchableOpacity
                    style={styles.getButton}
                    onPress={handleGetWallet}
                >
                    <Text style={styles.getText}>Get</Text>
                    <Feather name="chevron-right" size={16} color="#666" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 40,
        paddingHorizontal: 24,
    },
    logoContainer: {
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    logo: {
        width: 72,
        height: 72,
        borderRadius: 18,
    },
    loaderRing: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderArc: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: colors.primaryCTA,
        borderLeftColor: 'transparent',
        borderBottomColor: 'transparent',
        borderRightColor: 'transparent',
        transform: [{ rotate: '-45deg' }]
    },
    statusTitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 18,
        color: '#FFF',
        marginBottom: 12,
        textAlign: 'center',
    },
    statusSubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 15,
        color: '#BBB',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 22,
        maxWidth: '80%',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2A2A2A',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 100,
        borderWidth: 1,
        borderColor: '#444',
    },
    retryText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 15,
        color: '#FFF',
    },
    spacer: {
        flex: 1,
        minHeight: 40,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 40,
        gap: 12,
    },
    footerText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: '#BBB',
    },
    getButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#333',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 100,
        gap: 4
    },
    getText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#FFF',
    }
});
