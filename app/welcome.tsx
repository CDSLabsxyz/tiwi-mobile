/**
 * Welcome Screen
 * Entry point after onboarding. Acts as the gatekeeper for the dApp.
 * Matches Figma design (node-id: 3279-113003)
 */

import { ConnectWalletSheet } from '@/components/sections/Auth/ConnectWalletSheet';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const [isConnectSheetVisible, setIsConnectSheetVisible] = useState(false);

    const handleConnectWallet = () => {
        setIsConnectSheetVisible(true);
    };

    const handleCreateWallet = () => {
        // TODO: Implement create in-app wallet flow (Smart Accounts/MPC)
        console.log('Create wallet pressed');
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Shapes (Absolute Positioned for Branded Look) */}
            <View style={styles.triangleContainer}>
                <View style={[styles.mockTriangle, { borderBottomColor: colors.primaryCTA }]} />
            </View>

            <View style={styles.starContainer}>
                <View style={[styles.mockStar, { backgroundColor: colors.primaryCTA }]} />
            </View>

            {/* Header Actions - Removed Skip as per protocol requirements (Wallet required for entry) */}
            <View style={[styles.header, { paddingTop: top + 10 }]} />

            {/* Bottom Content */}
            <View style={[styles.bottomContent, { paddingBottom: bottom + 20 }]}>
                {/* Brand Tagline or Main Hub UI could be here */}

                {/* Buttons Group */}
                <View style={styles.buttonGroup}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleConnectWallet}
                        style={[styles.button, styles.primaryButton]}
                    >
                        <Text style={styles.primaryButtonText}>Connect wallet</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleCreateWallet}
                        style={[styles.button, styles.secondaryButton]}
                    >
                        <Text style={styles.secondaryButtonText}>Create in-app wallet</Text>
                    </TouchableOpacity>
                </View>

                {/* Legal & Terms */}
                <Text style={styles.termsText}>
                    By continuing, you agree to TIWI's <Text style={styles.linkText}>Terms of Service</Text> and <Text style={styles.linkText}>Privacy Policy</Text>
                </Text>
            </View>

            {/* Wallet Selection Sheet */}
            <ConnectWalletSheet
                visible={isConnectSheetVisible}
                onClose={() => setIsConnectSheetVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    triangleContainer: {
        position: 'absolute',
        top: 100,
        left: 0,
        width: 100,
        height: 100,
    },
    starContainer: {
        position: 'absolute',
        top: '40%',
        right: -50,
        width: 200,
        height: 200,
        transform: [{ rotate: '15deg' }],
    },
    mockTriangle: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 50,
        borderRightWidth: 0,
        borderBottomWidth: 50,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        transform: [{ rotate: '180deg' }],
    },
    mockStar: {
        width: 150,
        height: 150,
        borderRadius: 30,
    },
    header: {
        paddingHorizontal: 24,
        alignItems: 'flex-end',
    },
    bottomContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        gap: 24,
    },
    buttonGroup: {
        gap: 12,
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
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: '#000000',
    },
    secondaryButtonText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.primaryCTA,
    },
    termsText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 18,
    },
    linkText: {
        color: colors.primaryCTA,
        textDecorationLine: 'underline',
    },
});
