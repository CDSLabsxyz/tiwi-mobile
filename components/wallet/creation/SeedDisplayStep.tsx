import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SeedDisplayStepProps {
    mnemonic: string;
    onContinue: () => void;
    onSkip?: () => void;
}

export default function SeedDisplayStep({ mnemonic, onContinue, onSkip }: SeedDisplayStepProps) {
    const words = mnemonic.split(' ');
    const [showSkipModal, setShowSkipModal] = useState(false);

    const handleSkip = () => {
        if (!onSkip) return;
        setShowSkipModal(true);
    };

    const handleConfirmSkip = () => {
        setShowSkipModal(false);
        onSkip?.();
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
        >
            {/* Stepper Indicator */}
            <View style={styles.stepperContainer}>
                <View style={styles.stepRow}>
                    <View style={styles.completedStepIcon}>
                        <Ionicons name="checkmark" size={14} color="#0B0F0A" />
                    </View>
                    <Text style={styles.completedStepText}>Select Creation Method</Text>
                </View>

                <View style={[styles.connectorLine, { backgroundColor: colors.primaryCTA }]} />

                <View style={styles.stepRow}>
                    <View style={styles.activeStepIcon}>
                        <View style={styles.activeInnerCircle} />
                    </View>
                    <Text style={styles.activeStepText}>Save Seed Phrase</Text>
                </View>

                <View style={[styles.connectorLine, { backgroundColor: '#1F261E' }]} />

                <View style={styles.stepRow}>
                    <View style={styles.inactiveStepIcon} />
                    <Text style={styles.inactiveStepText}>Confirm Seed Phrase</Text>
                </View>

                <View style={[styles.connectorLine, { backgroundColor: '#1F261E' }]} />

                <View style={styles.stepRow}>
                    <View style={styles.inactiveStepIcon} />
                    <Text style={styles.inactiveStepText}>Get Wallet</Text>
                </View>
            </View>

            <View style={styles.warningContainer}>
                <Ionicons name="warning" size={20} color="#FF9900" />
                <Text style={styles.warningText}>
                    Write down these 12 words in order. Do not share them. Anyone with your seed phrase can access your assets.
                </Text>
            </View>

            <View style={styles.seedBox}>
                <View style={styles.wordGrid}>
                    {words.map((word, index) => (
                        <View key={index} style={styles.wordItem}>
                            <Text style={styles.wordIndex}>{index + 1}</Text>
                            <Text style={styles.wordText}>{word}</Text>
                        </View>
                    ))}
                </View>

            </View>

            <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
                <Text style={styles.continueButtonText}>Backup Manually</Text>
            </TouchableOpacity>

            {onSkip && (
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={styles.skipButtonText}>Bypass Manual Backup</Text>
                </TouchableOpacity>
            )}

            <Modal
                visible={showSkipModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSkipModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowSkipModal(false)}>
                    <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalIconWrap}>
                            <Ionicons name="warning" size={32} color="#FF9900" />
                        </View>
                        <Text style={styles.modalTitle}>Skip backup?</Text>
                        <Text style={styles.modalBody}>
                            You can back up your seed phrase later from Settings → Account Details. Until you do, you will not be able to send, swap, stake, or export your keys.
                        </Text>

                        <View style={styles.modalButtonRow}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalCancelButton]}
                                onPress={() => setShowSkipModal(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalConfirmButton]}
                                onPress={handleConfirmSkip}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.modalConfirmText}>Skip for now</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 40,
        flexGrow: 1,
    },
    stepperContainer: {
        marginBottom: 30,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    activeStepIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.primaryCTA,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeInnerCircle: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primaryCTA,
    },
    completedStepIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.primaryCTA,
        justifyContent: 'center',
        alignItems: 'center',
    },
    inactiveStepIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#1F261E',
    },
    connectorLine: {
        width: 2,
        height: 16,
        marginLeft: 9,
        marginVertical: 4,
    },
    activeStepText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#FFFFFF',
    },
    inactiveStepText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#6E7873',
    },
    completedStepText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#FFFFFF',
    },
    warningContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 153, 0, 0.1)',
        padding: 16,
        borderRadius: 16,
        gap: 12,
        marginBottom: 24,
    },
    warningText: {
        flex: 1,
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: '#FF9900',
        lineHeight: 20,
    },
    seedBox: {
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderColor: '#1F261E',
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
    },
    wordGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 8,
    },
    wordItem: {
        width: '48%',
        flexDirection: 'row',
        backgroundColor: '#111810',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 8,
    },
    wordIndex: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: '#6E7873',
        width: 24,
    },
    wordText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: '#FFFFFF',
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 20,
    },
    copyButtonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.primaryCTA,
    },
    continueButton: {
        backgroundColor: colors.primaryCTA,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40,
    },
    continueButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#010501',
    },
    skipButton: {
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#1F261E',
    },
    skipButtonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(1, 5, 1, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 353,
        backgroundColor: colors.bgCards,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        padding: 32,
        alignItems: 'center',
    },
    modalIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 153, 0, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: colors.titleText,
        textAlign: 'center',
        marginBottom: 8,
    },
    modalBody: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: colors.bodyText,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
    },
    modalButtonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalButton: {
        flex: 1,
        height: 52,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelButton: {
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    modalCancelText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 15,
        color: colors.titleText,
    },
    modalConfirmButton: {
        backgroundColor: colors.primaryCTA,
    },
    modalConfirmText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 15,
        color: colors.bg,
    },
});
