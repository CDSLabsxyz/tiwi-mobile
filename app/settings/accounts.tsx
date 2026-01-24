import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { WALLET_ADDRESS, truncateAddress } from '@/utils/wallet';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Assets
const ChevronLeftIcon = require('../../assets/swap/arrow-left-02.svg');
const PencilEditIcon = require('../../assets/settings/pencil-edit-01.svg');
const CloudUploadIcon = require('../../assets/settings/cloud-upload.svg');
const LogoutIcon = require('../../assets/wallet/logout-01.svg');
const CopyIcon = require('../../assets/wallet/copy-01.svg');
const IrisScanIcon = require('../../assets/home/iris-scan.svg');
const ChainIcon = require('../../assets/home/chains/bsc.svg');

const DEFAULT_WALLET_NAME = 'Wallet 1';

export default function AccountSettingsScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ returnTo?: string }>();
    const [walletName] = useState(DEFAULT_WALLET_NAME);
    const [copied, setCopied] = useState(false);

    // Handle phone back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });

        return () => backHandler.remove();
    }, [params.returnTo]);

    const handleBackPress = () => {
        router.replace('/settings' as any);
    };

    const handleCopyAddress = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await Clipboard.setStringAsync(WALLET_ADDRESS);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy address:', error);
        }
    };

    const handleIrisScan = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        console.log('Iris scan pressed');
    };

    const actions = [
        { label: 'Edit Wallet Name', icon: PencilEditIcon, route: '/settings/accounts/edit-wallet-name' },
        { label: 'Export Private Key', icon: CloudUploadIcon, route: '/settings/accounts/export-private-key' },
        { label: 'Export Recovery Phrase', icon: CloudUploadIcon, route: '/settings/accounts/export-recovery-phrase' },
        { label: 'Disconnect Wallet', icon: LogoutIcon, route: '/settings/accounts/disconnect-wallet', destructive: true },
    ];

    const connectedNetworks = Array(8).fill(null);

    return (
        <ThemedView style={styles.container}>
            <CustomStatusBar />

            {/* Header - Matching Figma: 68px gap */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        activeOpacity={0.7}
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
                        Account Settings
                    </ThemedText>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: (bottom || 16) + 24 }
                ]}
                showsVerticalScrollIndicator={false}
                alwaysBounceVertical={true}
            >
                {/* Wallet Info Section - Matching Figma: 20px gap between items */}
                <View style={styles.infoSection}>
                    {/* Wallet Name */}
                    <View style={styles.infoGroup}>
                        <ThemedText style={styles.infoLabel}>Wallet Name:</ThemedText>
                        <ThemedText style={styles.infoValue}>{walletName}</ThemedText>
                    </View>

                    {/* Wallet Address */}
                    <View style={styles.infoGroup}>
                        <ThemedText style={styles.infoLabel}>Wallet Address:</ThemedText>
                        <View style={styles.addressContainer}>
                            <ThemedText style={styles.infoValue}>
                                {truncateAddress(WALLET_ADDRESS)}
                            </ThemedText>
                            <View style={styles.addressActions}>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={handleCopyAddress}
                                    style={styles.smallActionIcon}
                                >
                                    <Image
                                        source={CopyIcon}
                                        style={styles.fullSize}
                                        contentFit="contain"
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={handleIrisScan}
                                    style={styles.smallActionIcon}
                                >
                                    <Image
                                        source={IrisScanIcon}
                                        style={styles.fullSize}
                                        contentFit="contain"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                        {copied && <ThemedText style={styles.copiedText}>Copied!</ThemedText>}
                    </View>

                    {/* Account Type */}
                    <View style={styles.infoGroup}>
                        <ThemedText style={styles.infoLabel}>Account Type:</ThemedText>
                        <ThemedText style={styles.infoValue}>Non-custodial</ThemedText>
                    </View>

                    {/* Network(s) connected */}
                    <View style={styles.infoGroup}>
                        <ThemedText style={styles.infoLabel}>Network(s) connected:</ThemedText>
                        <View style={styles.networksList}>
                            {connectedNetworks.map((_, index) => (
                                <View key={index} style={styles.networkIconWrapper}>
                                    <Image source={ChainIcon} style={styles.fullSize} contentFit="cover" />
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Action Buttons - Matching Figma: 8px gap, 54px height, rounded-full */}
                <View style={styles.actionsSection}>
                    {actions.map((action, index) => (
                        <TouchableOpacity
                            key={index}
                            activeOpacity={0.7}
                            onPress={() => {
                                router.push(action.route as any);
                            }}
                            style={styles.actionButton}
                        >
                            <View style={styles.actionIconWrapper}>
                                <Image
                                    source={action.icon}
                                    style={styles.fullSize}
                                    contentFit="contain"
                                />
                            </View>
                            <ThemedText style={styles.actionButtonText}>
                                {action.label}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
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
        gap: 68,
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingTop: 24,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    infoSection: {
        width: '100%',
        // maxWidth: 400,
        gap: 20,
        marginBottom: 24,
    },
    infoGroup: {
        gap: 8,
    },
    infoLabel: {
        fontSize: 14,
        color: colors.bodyText,
        fontFamily: 'Manrope-Medium',
    },
    infoValue: {
        fontSize: 16,
        color: colors.titleText,
        fontFamily: 'Manrope-Medium',
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    addressActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    smallActionIcon: {
        width: 20,
        height: 20,
    },
    copiedText: {
        fontSize: 12,
        color: colors.success,
        marginTop: 4,
    },
    networksList: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    networkIconWrapper: {
        width: 20.25,
        height: 20.25,
        borderRadius: 10.125,
        overflow: 'hidden',
    },
    actionsSection: {
        width: '100%',
        // maxWidth: 400,
        gap: 8,
    },
    actionButton: {
        width: '100%',
        height: 54,
        backgroundColor: colors.bgCards,
        borderRadius: 100,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 10,
    },
    actionIconWrapper: {
        width: 24,
        height: 24,
    },
    actionButtonText: {
        fontSize: 16,
        color: colors.titleText,
        fontFamily: 'Manrope-Regular',
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
