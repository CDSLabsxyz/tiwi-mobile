import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChevronLeftIcon = require('../../../assets/swap/arrow-left-02.svg');
const AlertIcon = require("../../../assets/wallet/alert-square.svg");

export default function ExportRecoveryPhraseScreen() {
    const { top } = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ returnTo?: string }>();

    // Handle phone back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });

        return () => backHandler.remove();
    }, [params.returnTo]);

    const handleBackPress = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/settings/accounts' as any);
        }
    };

    const handleShowRecoveryPhrase = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/settings/accounts/export-recovery-phrase/passcode' as any);
    };

    const handleCancel = () => {
        handleBackPress();
    };

    return (
        <ThemedView style={styles.container}>
            <CustomStatusBar />

            {/* Header */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleBackPress}
                        style={styles.backButton}
                    >
                        <Image
                            source={ChevronLeftIcon}
                            style={styles.fullSize}
                            contentFit="contain"
                        />
                    </TouchableOpacity>

                    <ThemedText style={styles.headerTitle}>
                        Export Recovery Phrase
                    </ThemedText>
                </View>
            </View>

            {/* Background Overlay */}
            <View style={styles.overlay} />

            {/* Modal Card */}
            <View style={styles.modalContainer}>
                <ThemedView style={styles.modalCard}>
                    <View style={styles.modalContent}>
                        {/* Icon and Message */}
                        <View style={styles.messageSection}>
                            <View style={styles.alertIconWrapper}>
                                <Image
                                    source={AlertIcon}
                                    style={styles.fullSize}
                                    contentFit="contain"
                                />
                            </View>

                            <View style={styles.textSection}>
                                <ThemedText style={styles.alertTitle}>
                                    Never Share Your Recovery Phrase
                                </ThemedText>
                                <ThemedText style={styles.alertDescription}>
                                    Your recovery phrase grants total access to your assets. Guard it carefully.
                                </ThemedText>
                            </View>
                        </View>

                        {/* Buttons */}
                        <View style={styles.buttonSection}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleShowRecoveryPhrase}
                                style={styles.primaryButton}
                            >
                                <ThemedText style={styles.primaryButtonText}>
                                    Show Recovery Phrase
                                </ThemedText>
                            </TouchableOpacity>

                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleCancel}
                                style={styles.secondaryButton}
                            >
                                <ThemedText style={styles.secondaryButtonText}>
                                    Cancel
                                </ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ThemedView>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 42,
        paddingVertical: 10,
    },
    backButton: {
        width: 24,
        height: 24,
    },
    headerTitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 20,
        lineHeight: 20,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(1, 5, 1, 0.7)',
    },
    modalContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 353,
        backgroundColor: colors.bgCards,
        borderRadius: 32,
        padding: 40,
        alignItems: 'center',
    },
    modalContent: {
        width: '100%',
        gap: 32,
        alignItems: 'center',
    },
    messageSection: {
        width: '100%',
        gap: 16,
        alignItems: 'center',
    },
    alertIconWrapper: {
        width: 48,
        height: 48,
    },
    textSection: {
        width: '100%',
        gap: 4,
        alignItems: 'center',
    },
    alertTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        textAlign: 'center',
    },
    alertDescription: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.bodyText,
        textAlign: 'center',
        lineHeight: 18,
    },
    buttonSection: {
        width: '100%',
        gap: 8,
    },
    primaryButton: {
        width: '100%',
        height: 54,
        backgroundColor: colors.primaryCTA,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.bg,
    },
    secondaryButton: {
        width: '100%',
        height: 54,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.primaryCTA,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        color: colors.primaryCTA,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
