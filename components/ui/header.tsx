import { colors } from '@/constants/colors';
import { truncateAddress } from '@/utils/wallet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface HeaderProps {
    walletAddress?: string;
    onWalletPress?: () => void;
    onScanPress?: () => void;
    onSettingsPress?: () => void;
    disableWalletModal?: boolean;
    showBackButton?: boolean;
    onBackPress?: () => void;
}

const TiwiCat = require('../../assets/home/tiwicat.svg');
const ArrowDown01 = require('../../assets/home/arrow-down-01.svg');
const Scan = require('../../assets/home/iris-scan.svg');
const Settings = require('../../assets/home/settings-03.svg');
const ChevronLeftIcon = require('../../assets/swap/arrow-left-02.svg');

import { useNotifications } from '@/hooks/useNotifications';
import { useWalletStore } from '@/store/walletStore';
import { useRouter } from 'expo-router';

/**
 * Header Component
 * Matches Figma design exactly
 */
export const Header: React.FC<HeaderProps> = ({
    walletAddress,
    onWalletPress,
    onScanPress,
    onSettingsPress,
    disableWalletModal = false,
    showBackButton = false,
    onBackPress,
}) => {
    const router = useRouter();
    const { address } = useWalletStore();
    const { unreadCount } = useNotifications();
    const fullAddress = walletAddress || address || '';
    const displayAddress = truncateAddress(fullAddress);

    // Use provider icon if available, otherwise fallback to TiwiCat
    const displayIcon = TiwiCat;

    return (
        <View style={styles.container}>
            {/* Left Side - Logo/Back and Wallet */}
            <View style={styles.leftSection}>
                {showBackButton ? (
                    <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
                        <Image source={ChevronLeftIcon} style={styles.icon} contentFit="contain" />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.logoContainer}>
                        <Image
                            source={displayIcon}
                            style={styles.logo}
                            contentFit="cover"
                        />
                    </View>
                )}

                <TouchableOpacity
                    onPress={disableWalletModal ? undefined : onWalletPress}
                    style={styles.walletButton}
                    activeOpacity={disableWalletModal ? 1 : 0.7}
                >
                    <Text style={styles.walletText}>
                        {fullAddress ? displayAddress : 'Connect Wallet'}
                    </Text>
                    {!disableWalletModal && (
                        <Image
                            source={ArrowDown01}
                            style={styles.arrowIcon}
                            contentFit="contain"
                        />
                    )}
                </TouchableOpacity>
            </View>

            {/* Right Side - Icons */}
            <View style={styles.rightSection}>
                <TouchableOpacity onPress={() => router.push('/notifications' as any)} style={styles.iconButton} activeOpacity={0.7}>
                    <Ionicons name="notifications-outline" size={24} color={colors.titleText} />
                    {unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/referral' as any)} style={styles.iconButton} activeOpacity={0.7}>
                    <Ionicons name="gift-outline" size={24} color={colors.titleText} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onSettingsPress} style={styles.iconButton} activeOpacity={0.7}>
                    <Image
                        source={Settings}
                        style={styles.icon}
                        contentFit="contain"
                    />
                </TouchableOpacity>
                {/* <TouchableOpacity onPress={onScanPress} style={styles.iconButton} activeOpacity={0.7}>
                    <Ionicons name="scan-outline" size={24} color={colors.bodyText} />
                </TouchableOpacity> */}
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
    backButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
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
        position: 'relative',
    },
    unreadBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.error || '#FF4D4D',
        borderWidth: 1.5,
        borderColor: colors.bg,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 2,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontFamily: 'Manrope-Bold',
        textAlign: 'center',
    },
    icon: {
        width: '100%',
        height: '100%',
    },
});
