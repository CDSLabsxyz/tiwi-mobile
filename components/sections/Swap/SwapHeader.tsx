import { colors } from '@/constants/colors';
import { truncateAddress } from '@/utils/wallet';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TiwiLogo = require('@/assets/logo/tiwi-logo.svg');
const ArrowDown01 = require('@/assets/home/arrow-down-01.svg');
const ArrowLeft02 = require('@/assets/swap/arrow-left-02.svg');
const SettingsIcon = require('@/assets/home/settings-03.svg');

interface SwapHeaderProps {
    walletAddress?: string;
    onWalletPress?: () => void;
    onSettingsPress?: () => void;
}

import { useWalletStore } from '@/store/walletStore';

/**
 * Swap Header
 * Aligned with Figma design (centered title and back button)
 */
export const SwapHeader: React.FC<SwapHeaderProps> = ({
    walletAddress,
    onWalletPress,
    onSettingsPress,
}) => {
    const router = useRouter();
    const { address } = useWalletStore();

    const fullAddress = walletAddress || address || '';
    const displayAddress = truncateAddress(fullAddress);

    const handleBack = () => {
        router.back();
    };

    return (
        <View style={styles.container}>
            {/* Top row: back arrow + centered title */}
            <View style={styles.topRow}>
                <TouchableOpacity
                    onPress={handleBack}
                    activeOpacity={0.7}
                    style={styles.backButton}
                >
                    <Image
                        source={ArrowLeft02}
                        style={styles.backIcon}
                        contentFit="contain"
                    />
                </TouchableOpacity>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Swap</Text>
                </View>
                <TouchableOpacity
                    onPress={onSettingsPress}
                    activeOpacity={0.7}
                    style={styles.settingsButton}
                >
                    <Image source={SettingsIcon} style={styles.backIcon} tintColor={colors.titleText} contentFit="contain" />
                </TouchableOpacity>
            </View>

            {/* Wallet identity row centered below */}
            <View style={styles.walletRow}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={onWalletPress}
                    style={styles.walletPill}
                >
                    <View style={styles.logoContainer}>
                        <Image
                            source={TiwiLogo}
                            style={styles.fullSize}
                            contentFit="contain"
                        />
                    </View>
                    <Text style={styles.walletAddress}>
                        {displayAddress}
                    </Text>
                    <Image
                        source={ArrowDown01}
                        style={styles.arrowDown}
                        contentFit="contain"
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 20,
        marginTop: 12,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 40,
        width: '100%',
    },
    backButton: {
        position: 'absolute',
        left: 0,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingsButton: {
        position: 'absolute',
        right: 0,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backIcon: {
        width: 24,
        height: 24,
    },
    titleContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    walletRow: {
        width: '100%',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 20,
    },
    walletContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoContainer: {
        width: 24,
        height: 24,
        marginRight: 8,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
    walletPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 100,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: colors.bgSemi,
    },
    walletAddress: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: colors.bodyText,
    },
    arrowDown: {
        width: 16,
        height: 16,
        marginLeft: 8,
    },
});
