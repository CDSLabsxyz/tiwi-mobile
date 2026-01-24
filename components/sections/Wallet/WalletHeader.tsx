/**
 * Wallet Header Component
 * Displays wallet logo, truncated address, and action icons
 * Converted from Tailwind to StyleSheet
 */

import { colors } from '@/constants/colors';
import { truncateAddress } from '@/utils/wallet';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TiwicatIcon = require('../../../assets/home/tiwicat.svg');
const IrisScanIcon = require('../../../assets/home/iris-scan.svg');
const SettingsIcon = require('../../../assets/home/settings-03.svg');
const ChevronLeftIcon = require('../../../assets/swap/arrow-left-02.svg');
const TransactionHistoryIcon = require('../../../assets/home/transaction-history.svg');

interface WalletHeaderProps {
    walletAddress: string;
    onIrisScanPress?: () => void;
    onSettingsPress?: () => void;
    showBackButton?: boolean;
    onBackPress?: () => void;
    showTransactionHistory?: boolean;
    onTransactionHistoryPress?: () => void;
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
}) => {
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
                    <View style={styles.logoContainer}>
                        <Image
                            source={TiwicatIcon}
                            style={styles.iconFull}
                            contentFit="contain"
                        />
                    </View>
                )}

                {/* Address Pill */}
                <View style={styles.addressPill}>
                    <Text style={styles.addressText}>
                        {displayAddress}
                    </Text>
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

                {/* Settings Icon */}
                {!showBackButton && (
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
    logoContainer: {
        width: 32,
        height: 32,
    },
    addressPill: {
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 16,
        paddingVertical: 6.5,
        borderRadius: 100,
        overflow: 'hidden',
    },
    addressText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
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
