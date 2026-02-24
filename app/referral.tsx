import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useLocalization';
import { useWalletStore } from '@/store/walletStore';
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

    const [referralCode, setReferralCode] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');

    // Mock data - replace with actual API calls
    const recentEarnings = '20.61 USDT';
    const recentReferrer = '0x09...879';

    const handlePaste = async () => {
        const text = await Clipboard.getStringAsync();
        setReferralCode(text);
    };

    const handleConfirm = () => {
        if (!referralCode.trim()) {
            Alert.alert('Error', 'Please enter a referral code');
            return;
        }
        // TODO: Submit referral code to backend
        Alert.alert('Success', 'Referral code confirmed!');
    };

    const handleGenerateCode = () => {
        // Generate code based on wallet address
        const code = address ? `TIWI${address.slice(-6).toUpperCase()}` : `TIWI${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        setGeneratedCode(code);
        Alert.alert('Code Generated', `Your referral code: ${code}`);
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
                    {/* <View style={styles.heroTextContainer}>
                        <Text style={styles.heroTitle}>
                            Invite Friends,{'\n'}Unlock{'\n'}Rewards.
                        </Text>
                    </View> */}
                    <Image
                        source={imgFrameReferral}
                        style={styles.heroImage}
                        contentFit="contain"
                    />
                </View>

                {/* Recent Earnings Banner */}
                <View style={styles.earningsBanner}>
                    <View style={styles.earningsLeft}>
                        <Text style={styles.earningsLabel}>
                            {recentReferrer} recently invited ...
                        </Text>
                        <Text style={styles.earningsAmount}>{recentEarnings}</Text>
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

                {/* Enter Referral Code Section */}
                <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Enter Referral Code (Optional)</Text>
                    <View style={styles.inputRow}>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                value={referralCode}
                                onChangeText={setReferralCode}
                                placeholder="Enter Referral Code"
                                placeholderTextColor={colors.mutedText}
                                style={styles.input}
                            />
                            <TouchableOpacity onPress={handlePaste} style={styles.pasteButton}>
                                <Image source={imgCopy01} style={styles.pasteIcon} contentFit="contain" />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={handleConfirm}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.confirmText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Generate Referral Code Button */}
                <TouchableOpacity
                    style={styles.generateButton}
                    onPress={handleGenerateCode}
                    activeOpacity={0.8}
                >
                    <Text style={styles.generateText}>Generate Referral Code</Text>
                </TouchableOpacity>

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
        height: 120,
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 24,
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
        // width: 160,
        width: '100%',
        height: 120,
        position: 'absolute',
        right: 0,
        top: 0,
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
