import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useLocalization';
import { apiClient } from '@/services/apiClient';
import { useWalletStore } from '@/store/walletStore';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Assets from Figma
const imgFrameReferral = require('../assets/home/frame-referral.png');
const imgCopy01 = require('../assets/referral/copy-01.svg');
const imgArrowRight03 = require('../assets/referral/arrow-right-03.svg');

/**
 * Referral Screen
 * Exact implementation from Figma design (node-id: 3279-116990)
 */
export default function ReferralScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { bottom } = useSafeAreaInsets();
    const { walletGroups, activeGroupId } = useWalletStore();
    // Always use EVM address for referrals — ties all chains to one referral identity
    const activeGroup = walletGroups.find(g => g.id === activeGroupId);
    const address = activeGroup?.addresses?.EVM || useWalletStore.getState().address;

    const [referralCodeInput, setReferralCodeInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [generateMode, setGenerateMode] = useState<'auto' | 'custom'>('auto');
    const [customCodeInput, setCustomCodeInput] = useState('');
    const [alertModal, setAlertModal] = useState<{ visible: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        visible: false, title: '', message: '', type: 'info',
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setAlertModal({ visible: true, title, message, type });
    };

    // Fetch Stats (Includes personal referral code)
    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
        queryKey: ['referralStats', address],
        queryFn: () => address ? apiClient.getReferralStats(address) : null,
        enabled: !!address
    });

    // Fetch Recent Activity for the banner
    const { data: activity } = useQuery({
        queryKey: ['recentReferralActivity', address],
        queryFn: () => address ? apiClient.getRecentReferralActivity(3, address) : [],
        refetchInterval: 30000,
        enabled: !!address
    });

    const hasCode = !!stats?.referralCode;
    const displayActivity = activity && activity.length > 0 ? activity[0] : null;

    const handlePaste = async () => {
        const text = await Clipboard.getStringAsync();
        setReferralCodeInput(text);
    };

    const handleConfirm = async () => {
        if (!referralCodeInput.trim() || !address) {
            showAlert('Error', 'Please enter a referral code', 'error');
            return;
        }

        setIsProcessing(true);
        try {
            const res = await apiClient.applyReferralCode(address, referralCodeInput.trim());
            if (res.success) {
                showAlert('Success', 'Referral code applied successfully!', 'success');
                setReferralCodeInput('');
                refetchStats();
            } else {
                showAlert('Error', res.message || 'Failed to apply code', 'error');
            }
        } catch (error: any) {
            showAlert('Error', error.message || 'An unexpected error occurred', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleGeneratePress = async () => {
        if (!address) return;

        // If wallet already has a code, go straight to position page
        if (hasCode) {
            router.push('/referral/position' as any);
            return;
        }

        // Check with backend — maybe code was created on another device
        setIsProcessing(true);
        try {
            const freshStats = await apiClient.getReferralStats(address);
            if (freshStats?.referralCode) {
                refetchStats();
                router.push('/referral/position' as any);
                return;
            }
        } catch {}
        setIsProcessing(false);

        // No existing code — show the generate modal
        setShowGenerateModal(true);
    };

    const handleGenerateCode = async () => {
        if (!address) return;

        const customCode = generateMode === 'custom' ? customCodeInput.trim() : undefined;

        if (generateMode === 'custom') {
            if (!customCode || customCode.length < 3 || customCode.length > 30) {
                showAlert('Invalid Code', 'Custom code must be 3-30 characters.', 'error');
                return;
            }
            if (!/^[a-zA-Z0-9_]+$/.test(customCode)) {
                showAlert('Invalid Code', 'Only letters, numbers, and underscores are allowed.', 'error');
                return;
            }
        }

        setIsProcessing(true);
        try {
            const res = await apiClient.createReferralCode(address, customCode);
            if (res.success) {
                setShowGenerateModal(false);
                setCustomCodeInput('');
                refetchStats();
                router.push('/referral/position' as any);
            }
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to generate code', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCopy = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        showAlert('Copied', `${label} copied to clipboard!`, 'success');
    };

    return (
        <View style={styles.container}>
            <CustomStatusBar />
            <SettingsHeader
                title="Referrals"
                onBack={() => router.back()}
                showBack={true}
            />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.content, { paddingBottom: bottom + 40 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Card */}
                <View style={styles.heroCard}>
                    <Image
                        source={imgFrameReferral}
                        style={styles.heroImage}
                        contentFit="fill"
                    />
                </View>

                {/* Recent Earnings Banner */}
                <View style={styles.earningsBanner}>
                    <View style={styles.earningsLeft}>
                        <Text style={styles.earningsLabel}>
                            {displayActivity ? `${displayActivity.walletAddress.slice(0, 6)}...${displayActivity.walletAddress.slice(-4)}` : (statsLoading ? 'Loading activity...' : 'Latest protocol activity...')}
                        </Text>
                        <Text style={styles.earningsAmount}>
                            {displayActivity ? `${displayActivity.reward.toFixed(2)} USDT` : '0.00 USDT'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.positionButton}
                        onPress={() => router.push('/referral/position' as any)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.positionText}>Position</Text>
                        <Image source={imgArrowRight03} style={styles.arrowIcon} contentFit="contain" />
                    </TouchableOpacity>
                </View>

                {/* Main Logic: Toolkit or Registration */}
                {hasCode ? (
                    <View style={styles.toolkitSection}>
                        <Text style={styles.inputLabel}>My Referral Toolkit</Text>
                        <View style={styles.toolkitCard}>
                            <View style={styles.toolkitRow}>
                                <View style={styles.toolkitInfo}>
                                    <Text style={styles.toolkitLabel}>Your Code</Text>
                                    <Text style={styles.toolkitValue}>{stats.referralCode}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => handleCopy(stats.referralCode!, 'Code')}
                                    style={styles.toolkitCopy}
                                >
                                    <Image source={imgCopy01} style={styles.pasteIcon} contentFit="contain" />
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.toolkitRow, { borderTopWidth: 1, borderTopColor: colors.bgStroke, marginTop: 12, paddingTop: 12 }]}>
                                <View style={styles.toolkitInfo}>
                                    <Text style={styles.toolkitLabel}>Referral Link</Text>
                                    <Text style={styles.toolkitValue} numberOfLines={1}>{stats.referralLink}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => handleCopy(stats.referralLink!, 'Link')}
                                    style={styles.toolkitCopy}
                                >
                                    <Image source={imgCopy01} style={styles.pasteIcon} contentFit="contain" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[styles.generateButton, { marginTop: 16 }]}
                            onPress={() => router.push('/referral/position' as any)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.generateText}>View My Position</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Enter Referral Code Section */}
                        <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Enter Referral Code (Optional)</Text>
                            <View style={styles.inputRow}>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        value={referralCodeInput}
                                        onChangeText={setReferralCodeInput}
                                        placeholder="Enter Referral Code"
                                        placeholderTextColor={colors.mutedText}
                                        style={styles.input}
                                        editable={!isProcessing}
                                    />
                                    <TouchableOpacity onPress={handlePaste} style={styles.pasteButton} disabled={isProcessing}>
                                        <Image source={imgCopy01} style={styles.pasteIcon} contentFit="contain" />
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity
                                    style={[styles.confirmButton, isProcessing && { opacity: 0.5 }]}
                                    onPress={handleConfirm}
                                    activeOpacity={0.8}
                                    disabled={isProcessing}
                                >
                                    <Text style={styles.confirmText}>{isProcessing ? '...' : 'Confirm'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Generate Referral Code Button */}
                        <TouchableOpacity
                            style={[styles.generateButton, isProcessing && { opacity: 0.5 }]}
                            onPress={handleGeneratePress}
                            activeOpacity={0.8}
                            disabled={isProcessing}
                        >
                            <Text style={styles.generateText}>{isProcessing ? 'Checking...' : 'Generate Referral Code'}</Text>
                        </TouchableOpacity>
                    </>
                )}

                {/* Generate Referral Code Modal */}
                <Modal
                    visible={showGenerateModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowGenerateModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            {/* Close button */}
                            <TouchableOpacity
                                style={styles.modalClose}
                                onPress={() => { setShowGenerateModal(false); setCustomCodeInput(''); }}
                            >
                                <Text style={{ fontSize: 20, color: colors.titleText }}>✕</Text>
                            </TouchableOpacity>

                            <Text style={styles.modalTitle}>Generate Referral Code</Text>
                            <Text style={styles.modalSubtitle}>
                                Create a unique referral code to invite friends and earn rewards
                            </Text>

                            {/* Auto / Custom toggle */}
                            <View style={styles.modeToggle}>
                                <TouchableOpacity
                                    style={[styles.modeButton, generateMode === 'auto' && styles.modeButtonActive]}
                                    onPress={() => setGenerateMode('auto')}
                                >
                                    <Text style={[styles.modeButtonText, generateMode === 'auto' && styles.modeButtonTextActive]}>Auto Generate</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modeButton, generateMode === 'custom' && styles.modeButtonActive]}
                                    onPress={() => setGenerateMode('custom')}
                                >
                                    <Text style={[styles.modeButtonText, generateMode === 'custom' && styles.modeButtonTextActive]}>Custom Code</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Custom code input */}
                            {generateMode === 'custom' && (
                                <View style={styles.customInputSection}>
                                    <Text style={styles.customInputLabel}>Enter Custom Code</Text>
                                    <TextInput
                                        value={customCodeInput}
                                        onChangeText={setCustomCodeInput}
                                        placeholder="YourName, YourName123, or Your_Name"
                                        placeholderTextColor={colors.mutedText}
                                        style={styles.customInput}
                                        maxLength={30}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                    <Text style={styles.customInputHint}>
                                        Use your name, name with numbers, or name with symbols (3-30 characters).{'\n'}Auto-generated codes follow TIWI#### format.
                                    </Text>
                                </View>
                            )}

                            {/* Generate button */}
                            <TouchableOpacity
                                style={[styles.modalGenerateButton, isProcessing && { opacity: 0.5 }]}
                                onPress={handleGenerateCode}
                                activeOpacity={0.8}
                                disabled={isProcessing}
                            >
                                <Text style={styles.modalGenerateText}>
                                    {isProcessing ? 'Generating...' : 'Generate Referral Code'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Referral Rules */}
                <View style={styles.rulesSection}>
                    <Text style={styles.rulesTitle}>Referral Rules</Text>

                    <View style={styles.rulesList}>
                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleNumber}>1.</Text>
                            <Text style={styles.ruleText}>
                                When someone signs up using your referral link or code, they become your referee permanently.
                            </Text>
                        </View>

                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleNumber}>2.</Text>
                            <Text style={styles.ruleText}>
                                You earn a percentage of the TIWI Protocol fee (0.25%) from their spot trades only.
                            </Text>
                        </View>

                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleNumber}>3.</Text>
                            <Text style={styles.ruleText}>
                                Rebates are paid in USDT, not in TIWI tokens.
                            </Text>
                        </View>

                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleNumber}>4.</Text>
                            <Text style={styles.ruleText}>
                                Your earnings depend on your Referral Level, which is based on how much volume referees traded in the past 28 days.
                            </Text>
                        </View>

                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleNumber}>5.</Text>
                            <Text style={styles.ruleText}>
                                You only earn from spot trading volume made by people you referred.
                            </Text>
                        </View>

                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleNumber}>6.</Text>
                            <Text style={styles.ruleText}>
                                Fees are automatically converted to USDT and stored for monthly payout.
                            </Text>
                        </View>

                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleNumber}>7.</Text>
                            <Text style={styles.ruleText}>
                                Your rebate rate increases as your referees generate more trading volume.
                            </Text>
                        </View>

                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleNumber}>8.</Text>
                            <Text style={styles.ruleText}>
                                Rebate earnings update continuously throughout the month.
                            </Text>
                        </View>

                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleNumber}>9.</Text>
                            <Text style={styles.ruleText}>
                                The claim window opens every 28th of the month.
                            </Text>
                        </View>

                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleNumber}>10.</Text>
                            <Text style={styles.ruleText}>
                                You can claim your USDT directly to your wallet once claims are enabled.
                            </Text>
                        </View>
                    </View>
                </View>

            </ScrollView>

            {/* Themed Alert Modal */}
            <Modal
                visible={alertModal.visible}
                transparent
                animationType="fade"
                onRequestClose={() => setAlertModal(prev => ({ ...prev, visible: false }))}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.alertModalContent}>
                        <View style={[
                            styles.alertIconCircle,
                            alertModal.type === 'success' && { backgroundColor: 'rgba(177, 241, 40, 0.12)', borderColor: 'rgba(177, 241, 40, 0.3)' },
                            alertModal.type === 'error' && { backgroundColor: 'rgba(255, 59, 48, 0.12)', borderColor: 'rgba(255, 59, 48, 0.3)' },
                            alertModal.type === 'info' && { backgroundColor: 'rgba(177, 241, 40, 0.12)', borderColor: 'rgba(177, 241, 40, 0.3)' },
                        ]}>
                            <Text style={[
                                styles.alertIconText,
                                alertModal.type === 'success' && { color: colors.primaryCTA },
                                alertModal.type === 'error' && { color: '#FF3B30' },
                                alertModal.type === 'info' && { color: colors.primaryCTA },
                            ]}>
                                {alertModal.type === 'success' ? '✓' : alertModal.type === 'error' ? '!' : 'i'}
                            </Text>
                        </View>
                        <Text style={styles.alertTitle}>{alertModal.title}</Text>
                        <Text style={styles.alertMessage}>{alertModal.message}</Text>
                        <TouchableOpacity
                            style={[
                                styles.alertButton,
                                alertModal.type === 'error' && { backgroundColor: '#FF3B30' },
                            ]}
                            onPress={() => setAlertModal(prev => ({ ...prev, visible: false }))}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.alertButtonText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    heroCard: {
        width: '100%',
        aspectRatio: 375 / 120, // Match Figma banner ratio
        marginBottom: 16,
        overflow: 'hidden',
    },
    heroTextContainer: {
        flex: 1,
    },
    heroTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 24,
        lineHeight: 32,
        color: '#000000',
        letterSpacing: -0.5,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    earningsBanner: {
        width: '100%',
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    earningsLeft: {
        flex: 1,
    },
    earningsLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
        marginBottom: 4,
    },
    earningsAmount: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.primaryCTA,
    },
    positionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    positionText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    arrowIcon: {
        width: 16,
        height: 16,
    },
    inputSection: {
        width: '100%',
        marginBottom: 16,
    },
    inputLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        marginBottom: 12,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 56,
    },
    input: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        height: '100%',
    },
    pasteButton: {
        padding: 4,
    },
    pasteIcon: {
        width: 20,
        height: 20,
    },
    confirmButton: {
        backgroundColor: colors.primaryCTA,
        borderRadius: 12,
        paddingHorizontal: 24,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: '#000000',
    },
    generateButton: {
        width: '100%',
        height: 56,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.primaryCTA,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    generateText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.primaryCTA,
    },
    rulesSection: {
        width: '100%',
    },
    toolkitSection: {
        width: '100%',
        marginBottom: 24,
    },
    toolkitCard: {
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    toolkitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toolkitInfo: {
        flex: 1,
    },
    toolkitLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
        marginBottom: 4,
    },
    toolkitValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.titleText,
    },
    toolkitCopy: {
        padding: 8,
    },
    rulesTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: colors.titleText,
        marginBottom: 16,
    },
    rulesList: {
        gap: 12,
    },
    ruleItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    ruleNumber: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.titleText,
        width: 20,
    },
    ruleText: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        lineHeight: 21,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    modalContent: {
        width: '100%',
        backgroundColor: colors.bgCards,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    modalClose: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    modalTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
        color: colors.titleText,
        marginBottom: 8,
    },
    modalSubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.bodyText,
        marginBottom: 24,
        lineHeight: 20,
    },
    modeToggle: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    modeButton: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: colors.bgStroke,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modeButtonActive: {
        backgroundColor: colors.primaryCTA,
        borderColor: colors.primaryCTA,
    },
    modeButtonText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.bodyText,
    },
    modeButtonTextActive: {
        color: '#000000',
    },
    customInputSection: {
        marginBottom: 20,
    },
    customInputLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        marginBottom: 10,
    },
    customInput: {
        height: 52,
        backgroundColor: colors.bg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        paddingHorizontal: 16,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        marginBottom: 8,
    },
    customInputHint: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.mutedText,
        lineHeight: 18,
    },
    modalGenerateButton: {
        width: '100%',
        height: 52,
        borderRadius: 12,
        backgroundColor: colors.primaryCTA,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalGenerateText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#000000',
    },
    // Themed alert modal
    alertModalContent: {
        width: '100%',
        backgroundColor: colors.bgCards,
        borderRadius: 20,
        padding: 28,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        alignItems: 'center',
    },
    alertIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    alertIconText: {
        fontSize: 24,
        fontFamily: 'Manrope-Bold',
    },
    alertTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
        color: colors.titleText,
        marginBottom: 8,
        textAlign: 'center',
    },
    alertMessage: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.bodyText,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 24,
    },
    alertButton: {
        width: '100%',
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.primaryCTA,
        justifyContent: 'center',
        alignItems: 'center',
    },
    alertButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#000000',
    },
});
