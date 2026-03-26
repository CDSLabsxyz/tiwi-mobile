/**
 * Wallet Header Component
 * Displays wallet logo, truncated address, and action icons
 * Converted from Tailwind to StyleSheet
 */

import { colors } from '@/constants/colors';
import { useWalletStore } from '@/store/walletStore';
import { truncateAddress } from '@/utils/wallet';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TiwicatIcon = require('../../../assets/home/tiwicat.svg');
const IrisScanIcon = require('../../../assets/home/iris-scan.svg');
const SettingsIcon = require('../../../assets/home/settings-03.svg');
const ChevronLeftIcon = require('../../../assets/swap/arrow-left-02.svg');
const TransactionHistoryIcon = require('../../../assets/home/transaction-history.svg');
const TiwiLogo = require('../../../assets/images/tiwi-logo.svg');

const ChainIcons = {
    EVM: require('../../../assets/home/chains/ethereum.svg'),
    SOLANA: require('../../../assets/home/chains/solana.svg'),
    TRON: require('../../../assets/home/chains/tron.png'),
    TON: require('../../../assets/home/chains/ton.jpg'),
    COSMOS: require('../../../assets/home/chains/bsc.svg'), // placeholder
    OSMOSIS: require('../../../assets/home/chains/polygon.svg'), // placeholder
};

interface WalletHeaderProps {
    walletAddress: string;
    onIrisScanPress?: () => void;
    onSettingsPress?: () => void;
    showBackButton?: boolean;
    onBackPress?: () => void;
    showTransactionHistory?: boolean;
    onTransactionHistoryPress?: () => void;
    showIrisScan?: boolean;
    showSettings?: boolean;
    onCopyPress?: () => void;
    showHome?: boolean;
    onHomePress?: () => void;
}

/**
 * Wallet Header - Sticky header with logo, address, and action icons
 */
export const WalletHeader: React.FC<WalletHeaderProps> = ({
    walletAddress,
    onIrisScanPress,
    onSettingsPress,
    showBackButton = false,
    onBackPress,
    showTransactionHistory = false,
    onTransactionHistoryPress,
    showIrisScan = false,
    showSettings = true,
    onCopyPress,
    showHome = false,
    onHomePress,
}) => {
    const { activeChain } = useWalletStore();
    const displayAddress = truncateAddress(walletAddress);

    return (
        <View style={styles.container}>
            {/* Left: Back Button (if shown) + Logo + Address */}
            <View style={styles.leftSection}>
                {/* Back Button */}
                {showBackButton && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onBackPress}
                        style={styles.backButton}
                    >
                        <Image
                            source={ChevronLeftIcon}
                            style={styles.iconFull}
                            contentFit="contain"
                        />
                    </TouchableOpacity>
                )}

                {/* Tiwicat Logo */}
                {!showBackButton && (
                    <View style={styles.logoWrapper}>
                        <View style={styles.logoContainer}>
                            <Image
                                source={TiwicatIcon}
                                style={styles.iconFull}
                                contentFit="contain"
                            />
                        </View>
                        {activeChain && (
                            <View style={styles.logoChainBadge}>
                                <Image source={(ChainIcons as any)[activeChain]} style={styles.iconFull} contentFit="contain" />
                            </View>
                        )}
                    </View>
                )}

                {/* Address Pill */}
                <View style={styles.addressPill}>
                    <Text style={styles.addressText}>
                        {displayAddress}
                    </Text>
                    <View style={styles.chainBadge}>
                        <Text style={styles.chainBadgeText}>{activeChain === 'SOLANA' ? 'SOL' : activeChain}</Text>
                    </View>
                </View>
            </View>

            {/* Right: Action Icons */}
            <View style={styles.rightSection}>
                {/* Transaction History Icon (if shown) */}
                {showTransactionHistory && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onTransactionHistoryPress}
                        style={styles.iconButton}
                    >
                        <Image
                            source={TransactionHistoryIcon}
                            style={styles.iconFull}
                            contentFit="contain"
                        />
                    </TouchableOpacity>
                )}

                {/* Iris Scan Icon */}
                {showIrisScan && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onIrisScanPress}
                        style={styles.iconButton}
                    >
                        <Image
                            source={IrisScanIcon}
                            style={styles.iconFull}
                            contentFit="contain"
                        />
                    </TouchableOpacity>
                )}

                {/* Settings Icon */}
                {showSettings && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onSettingsPress}
                        style={styles.iconButton}
                    >
                        <Image
                            source={SettingsIcon}
                            style={styles.iconFull}
                            contentFit="contain"
                        />
                    </TouchableOpacity>
                )}
                
                {/* Home Icon */}
                {showHome && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onHomePress}
                        style={styles.iconButton}
                    >
                        <Image
                            source={TiwiLogo}
                            style={styles.iconFull}
                            contentFit="contain"
                        />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    backButton: {
        width: 24,
        height: 24,
        marginRight: 0,
    },
    logoWrapper: {
        position: 'relative',
        width: 32,
        height: 32,
    },
    logoContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoChainBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.bgSemi,
        padding: 2,
        zIndex: 5,
    },
    addressPill: {
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 12, // slightly smaller padding to house the badge
        paddingVertical: 6.5,
        borderRadius: 100,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    addressText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    chainBadge: {
        backgroundColor: colors.bgStroke,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    chainBadgeText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 10,
        color: colors.primaryCTA,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    iconButton: {
        width: 24,
        height: 24,
    },
    iconFull: {
        width: '100%',
        height: '100%',
    },
});
