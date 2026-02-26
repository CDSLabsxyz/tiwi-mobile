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
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
    const { address } = useWalletStore();

    const [referralCodeInput, setReferralCodeInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

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
            Alert.alert('Error', 'Please enter a referral code');
            return;
        }

        setIsProcessing(true);
        try {
            const res = await apiClient.applyReferralCode(address, referralCodeInput.trim());
            if (res.success) {
                Alert.alert('Success', 'Referral code applied successfully!');
                setReferralCodeInput('');
                refetchStats();
            } else {
                Alert.alert('Error', res.message || 'Failed to apply code');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'An unexpected error occurred');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleGenerateCode = async () => {
        if (!address) return;

        setIsProcessing(true);
        try {
            // By default we auto-generate, but we could allow a custom code later if requested
            const res = await apiClient.createReferralCode(address);
            if (res.success) {
                Alert.alert('Code Generated', `Your referral code: ${res.code}`);
                refetchStats();
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to generate code');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCopy = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        Alert.alert('Copied', `${label} copied to clipboard!`);
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
                            onPress={handleGenerateCode}
                            activeOpacity={0.8}
                            disabled={isProcessing}
                        >
                            <Text style={styles.generateText}>{isProcessing ? 'Generating...' : 'Generate Referral Code'}</Text>
                        </TouchableOpacity>
                    </>
                )}

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
});
