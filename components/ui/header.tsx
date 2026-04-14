import { colors } from '@/constants/colors';
import { truncateAddress } from '@/utils/wallet';
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

const TiwiCat = require('../../assets/images/tiwi-logo.svg');
const ArrowDown01 = require('../../assets/home/arrow-down-01.svg');
const Scan = require('../../assets/home/iris-scan.svg');
const Settings = require('../../assets/home/settings-03.svg');
const ChevronLeftIcon = require('../../assets/swap/arrow-left-02.svg');
const NotificationIconLocal = require('../../assets/settings/notification-02.svg');
const ReferralIconLocal = require('../../assets/settings/user-group-02.svg');

const ChainIcons = {
    EVM: require('../../assets/home/chains/ethereum.svg'),
    SOLANA: require('../../assets/home/chains/solana.svg'),
    TRON: require('../../assets/home/chains/tron.png'),
    TON: require('../../assets/home/chains/ton.jpg'),
    COSMOS: require('../../assets/home/chains/bsc.svg'), // placeholder
    OSMOSIS: require('../../assets/home/chains/polygon.svg'), // placeholder
};

import { useNotifications } from '@/hooks/useNotifications';
import { useWalletStore } from '@/store/walletStore';
import { useRouter } from 'expo-router';

const NETWORK_LABELS: Record<string, string> = {
    ETH: 'ETH',
    BSC: 'BNB',
    POLYGON: 'MATIC',
    BASE: 'BASE',
    OPTIMISM: 'OP',
    AVALANCHE: 'AVAX',
    SOLANA: 'SOL',
    TRON: 'TRX',
    TON: 'TON',
    COSMOS: 'ATOM',
    OSMOSIS: 'OSMO',
};

function getNetworkLabel(chain: string, networkId: string | null): string {
    if (networkId && NETWORK_LABELS[networkId]) return NETWORK_LABELS[networkId];
    if (chain === 'SOLANA') return 'SOL';
    if (chain === 'TRON') return 'TRX';
    if (chain === 'TON') return 'TON';
    if (chain === 'COSMOS') return 'ATOM';
    return chain;
}

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
    const { address, activeChain, activeNetworkId } = useWalletStore();
    const { unreadCount } = useNotifications();
    const fullAddress = walletAddress || address || '';
    const displayAddress = truncateAddress(fullAddress);

    // Use provider icon if available, otherwise fallback to TiwiCat 0xa61c5bdf3cddb4cfcec2daa090ff0ad3563ad6q1
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
                    <View style={styles.logoWrapper}>
                        <View style={styles.logoContainer}>
                            <Image
                                source={displayIcon}
                                style={styles.logo}
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

                <TouchableOpacity
                    onPress={disableWalletModal ? undefined : onWalletPress}
                    style={styles.walletButton}
                    activeOpacity={disableWalletModal ? 1 : 0.7}
                >
                    <Text style={styles.walletText}>
                        {fullAddress ? displayAddress : 'Connect Wallet'}
                    </Text>
                    {fullAddress && (
                        <View style={styles.chainBadge}>
                            <Text style={styles.chainBadgeText}>{getNetworkLabel(activeChain, activeNetworkId)}</Text>
                        </View>
                    )}
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
                    <Image
                        source={NotificationIconLocal}
                        style={styles.icon}
                        contentFit="contain"
                    />
                    {unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/referral' as any)} style={styles.iconButton} activeOpacity={0.7}>
                    <Image
                        source={ReferralIconLocal}
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
                {/* <TouchableOpacity onPress={onScanPress} style={styles.iconButton} activeOpacity={0.7}>
                    <Image source={Scan} style={styles.icon} contentFit="contain" />
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
    logoWrapper: {
        position: 'relative',
        width: 32,
        height: 32,
    },
    logoContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000000', // Black background for the logo
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: colors.primaryCTA, // Neon green border
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
        // Glow effect
        shadowColor: colors.primaryCTA,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 10,
        elevation: 10,
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
    iconFull: {
        width: '100%',
        height: '100%',
    },
    backButton: {
        width: 24,
        height: 24,
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
    chainBadge: {
        backgroundColor: colors.bgStroke,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 0,
    },
    chainBadgeText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 10,
        color: colors.primaryCTA,
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
