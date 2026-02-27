/**
 * Welcome Screen
 * Entry point after onboarding. Acts as the gatekeeper for the dApp.
 * Matches Figma design (node-id: 3279-113003)
 */

import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useLocalization';
import { useSecurityStore } from '@/store/securityStore';
import { useAppKit } from '@reown/appkit-react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccount } from 'wagmi';

function WelcomeScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { open } = useAppKit();
    const { isConnected } = useAccount();
    const { t } = useTranslation();
    const [isSuccess, setIsSuccess] = useState(false);
    const { setSetupPhase } = useSecurityStore();

    // Watch for connection from AppKit
    useEffect(() => {
        if (isConnected) {
            setIsSuccess(true);
            // Pre-emptively set phase
            setSetupPhase('WALLET_READY');
        }
    }, [isConnected, setSetupPhase]);

    const handleConnectWallet = async () => {
        await open();
    };

    const handleCreateWallet = () => {
        router.push('/wallet' as any);
    };

    const handleSuccessDone = () => {
        setIsSuccess(false);
        setSetupPhase('WALLET_READY');
        router.push('/security' as any);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            <View style={styles.imageContainer}>
                <Image
                    source={require('@/assets/onboarding/wallet-onboarding.png')}
                    style={styles.image}
                    contentFit="contain"
                    transition={1000}
                />
            </View>
            <View style={[styles.header, { paddingTop: top * 5 }]} />

            {/* Bottom Content */}
            <View style={[styles.bottomContent, { paddingBottom: bottom + 20 }]}>
                <View style={styles.buttonGroup}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleCreateWallet}
                        style={[styles.button, styles.primaryButton]}
                    >
                        <Text style={styles.primaryButtonText}>{t('welcome.connect_app_wallet')}</Text>
                    </TouchableOpacity>
                </View>

                {/* Legal & Terms */}
                <Text style={styles.termsText}>
                    {t('welcome.terms_prefix')} <Text style={styles.linkText}>{t('welcome.terms_service')}</Text> {t('welcome.terms_and')} <Text style={styles.linkText}>{t('welcome.privacy_policy')}</Text>
                </Text>
            </View>

            <SuccessModal
                isVisible={isSuccess}
                type="connected"
                onDone={handleSuccessDone}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
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
    imageContainer: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
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

export default WelcomeScreen;
