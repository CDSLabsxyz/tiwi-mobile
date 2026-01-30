import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WalletChoiceScreen() {
    const router = useRouter();
    const { top, bottom } = useSafeAreaInsets();

    const handleCreateNew = () => {
        router.push('/wallet/create');
    };

    const handleImport = () => {
        router.push('/wallet/import' as any);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Background Decorations matching Figma 3279:123146 */}
            {/* <View style={styles.triangleContainer}>
                <View style={[styles.mockTriangle, { borderBottomColor: colors.primaryCTA }]} />
            </View>

            <View style={styles.starContainer}>
                <View style={[styles.mockStar, { backgroundColor: colors.primaryCTA }]} />
            </View> */}
            <View style={styles.imageContainer}>
                            <Image
                                source={require('@/assets/onboarding/wallet-onboarding.png')}
                                style={styles.image}
                                contentFit="contain" // Changed to cover to fill width
                                transition={1000}
                            />
                        </View>
                        <View style={[styles.header, { paddingTop: top * 5 }]} />

            {/* Content Container (Bottom Aligned) */}
            <View style={[styles.bottomContent, { paddingBottom: bottom + 40 }]}>
                <View style={styles.buttonGroup}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleCreateNew}
                        style={[styles.button, styles.primaryButton]}
                    >
                        <Text style={styles.primaryButtonText}>Create new wallet</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleImport}
                        style={[styles.button, styles.secondaryButton]}
                    >
                        <Text style={styles.secondaryButtonText}>Import Wallet</Text>
                    </TouchableOpacity>
                </View>

                {/* Legal & Terms */}
                <Text style={styles.termsText}>
                    By continuing, you agree to TIWI's <Text style={styles.linkText}>Terms of Service</Text> and <Text style={styles.linkText}>Privacy Policy</Text>
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    imageContainer: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: '100%',
        height: '100%', // Takes up all available space in container
    },
    triangleContainer: {
        position: 'absolute',
        top: 80,
        left: -40,
        width: 250,
        height: 250,
    },
    starContainer: {
        position: 'absolute',
        top: '40%',
        right: -80,
        width: 350,
        height: 350,
        transform: [{ rotate: '15deg' }],
    },
    mockTriangle: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 125,
        borderRightWidth: 0,
        borderBottomWidth: 125,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        transform: [{ rotate: '140deg' }],
    },
    mockStar: {
        width: 250,
        height: 250,
        borderRadius: 50,
    },
    bottomContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        gap: 32,
    },
    buttonGroup: {
        gap: 16,
    },
    button: {
        width: '100%',
        height: 56,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButton: {
        backgroundColor: colors.primaryCTA,
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#333333',
    },
    primaryButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: '#000000',
    },
    secondaryButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: colors.primaryCTA,
    },
    termsText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 20,
    },
    linkText: {
        color: colors.primaryCTA,
        textDecorationLine: 'underline',
    },
    header: {
        paddingHorizontal: 24,
        alignItems: 'flex-end',
    },
});
