import { colors } from '@/constants/colors';
import { WALLET_ADDRESS, truncateAddress } from '@/utils/wallet';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface HeaderProps {
    walletAddress?: string;
    onWalletPress?: () => void;
    onScanPress?: () => void;
    onSettingsPress?: () => void;
}

const TiwiCat = require('../../assets/home/tiwicat.svg');
const ArrowDown01 = require('../../assets/home/arrow-down-01.svg');
const Scan = require('../../assets/home/iris-scan.svg');
const Settings = require('../../assets/home/settings-03.svg');

import { useWalletStore } from '@/store/walletStore';

/**
 * Header Component
 * Matches Figma design exactly
 */
export const Header: React.FC<HeaderProps> = ({
    walletAddress,
    onWalletPress,
    onScanPress,
    onSettingsPress,
}) => {
    const { address, walletIcon } = useWalletStore();
    console.log("🚀 ~ Header ~ walletIcon:", walletIcon)
    const fullAddress = walletAddress || address || WALLET_ADDRESS;
    const displayAddress = truncateAddress(fullAddress);

    // Use provider icon if available, otherwise fallback to TiwiCat
    const displayIcon = walletIcon ? { uri: walletIcon } : TiwiCat;

    return (
        <View style={styles.container}>
            {/* Left Side - Logo and Wallet */}
            <View style={styles.leftSection}>
                <View style={styles.logoContainer}>
                    <Image
                        source={displayIcon}
                        style={styles.logo}
                        contentFit="cover"
                    />
                </View>

                <TouchableOpacity
                    onPress={onWalletPress}
                    style={styles.walletButton}
                    activeOpacity={0.7}
                >
                    <Text style={styles.walletText}>
                        {displayAddress}
                    </Text>
                    <Image
                        source={ArrowDown01}
                        style={styles.arrowIcon}
                        contentFit="contain"
                    />
                </TouchableOpacity>
            </View>

            {/* Right Side - Icons */}
            <View style={styles.rightSection}>
                <TouchableOpacity onPress={onScanPress} style={styles.iconButton} activeOpacity={0.7}>
                    <Image
                        source={Scan}
                        style={styles.icon}
                        contentFit="contain"
                    />
                </TouchableOpacity>
                <TouchableOpacity onPress={onSettingsPress} style={styles.iconButton} activeOpacity={0.7}>
                    <Image
                        source={Settings}
                        style={styles.icon}
                        contentFit="contain"
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20, // px-5
        paddingVertical: 10,   // py-[10px]
        backgroundColor: colors.bg,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8, // gap-2
    },
    logoContainer: {
        width: 32, // w-8
        height: 32,
    },
    logo: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
    },
    walletButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10, // gap-[10px]
        paddingHorizontal: 16, // px-4
        paddingVertical: 6.5,  // py-[6.5px]
        borderRadius: 999,
        backgroundColor: colors.bgSemi,
    },
    walletText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    arrowIcon: {
        width: 16, // w-4
        height: 16,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16, // gap-4
    },
    iconButton: {
        width: 24, // w-6
        height: 24,
    },
    icon: {
        width: '100%',
        height: '100%',
    },
});
