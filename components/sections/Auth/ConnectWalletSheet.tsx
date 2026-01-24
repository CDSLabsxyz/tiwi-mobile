/**
 * Connect Wallet Sheet
 * Displays list of available wallets to connect
 * Integrated with Reown AppKit for industry-standard reliable handshakes
 * Matches Figma design (node-id: 3279-118496)
 */

import { SelectionBottomSheet } from '@/components/sections/Swap/SelectionBottomSheet';
import { colors } from '@/constants/colors';
import {
    fetchWalletListings,
    getWalletIconUrl,
    POPULAR_WALLETS,
    type WalletConnectWallet
} from '@/services/walletConnectService';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAppKit } from '@reown/appkit-react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ConnectWalletSheetProps {
    visible: boolean;
    onClose: () => void;
}

const ChevronRightIcon = require('@/assets/onboarding/arrow-right-02.svg');

export const ConnectWalletSheet: React.FC<ConnectWalletSheetProps> = ({
    visible,
    onClose,
}) => {
    const router = useRouter();
    const { open } = useAppKit();
    const [wallets, setWallets] = useState<WalletConnectWallet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { completeOnboarding } = useOnboardingStore();

    useEffect(() => {
        if (visible && wallets.length === 0) {
            loadWallets();
        }
    }, [visible]);

    const loadWallets = async () => {
        setIsLoading(true);
        try {
            const allWallets = await fetchWalletListings();

            // Prioritize popular wallets
            const popular = allWallets.filter(w => POPULAR_WALLETS.includes(w.id));
            const others = allWallets.filter(w => !POPULAR_WALLETS.includes(w.id));

            // Sort popular by defined order
            popular.sort((a, b) => {
                return POPULAR_WALLETS.indexOf(a.id) - POPULAR_WALLETS.indexOf(b.id);
            });

            // Add generic WalletConnect option
            const wcOption: WalletConnectWallet = {
                id: 'walletconnect',
                name: 'WalletConnect',
                homepage: 'https://walletconnect.com',
                image_id: 'walletconnect-logo',
                app: {},
                mobile: { native: '', universal: '' }
            };

            setWallets([...popular, wcOption, ...others]);
        } catch (error) {
            console.error('Failed to load wallets:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectWallet = async (wallet: WalletConnectWallet) => {
        // Standard Reown AppKit open method
        onClose();

        // Mark onboarding complete so the layout guard allows entry once connected
        await completeOnboarding();

        // Open the official Reown connection UI
        open();
    };

    const renderWalletItem = ({ item }: { item: WalletConnectWallet }) => {
        const iconUrl = item.id === 'walletconnect'
            ? 'https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/master/Logo/Blue%20(Default)/Logo.png'
            : getWalletIconUrl(item.image_id);

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleSelectWallet(item)}
                style={styles.walletItem}
            >
                <View style={styles.walletInfo}>
                    <Image
                        source={{ uri: iconUrl }}
                        style={styles.walletIcon}
                        contentFit="cover"
                        transition={200}
                    />
                    <Text style={styles.walletName}>{item.name}</Text>
                </View>

                <View style={styles.iconContainer}>
                    <Image
                        source={ChevronRightIcon}
                        style={styles.chevron}
                        contentFit="contain"
                    />
                </View>
            </TouchableOpacity>
        );
    };

    const renderSkeleton = () => (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
        >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <View key={i} style={styles.walletItem}>
                    <View style={styles.walletInfo}>
                        <View style={[styles.walletIcon, { backgroundColor: '#2A2A2A' }]} />
                        <View style={{ width: 120, height: 16, backgroundColor: '#2A2A2A', borderRadius: 4 }} />
                    </View>
                </View>
            ))}
        </ScrollView>
    );

    return (
        <SelectionBottomSheet
            visible={visible}
            title="Connect wallet"
            onClose={onClose}
            showSearchIcon={false}
            height={700}
        >
            <View style={styles.container}>
                {isLoading ? (
                    renderSkeleton()
                ) : (
                    <View style={{ flex: 1 }}>
                        <FlatList
                            data={wallets}
                            renderItem={renderWalletItem}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={true}
                            contentContainerStyle={styles.scrollContent}
                            style={{ flex: 1 }}
                            initialNumToRender={10}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                        />
                    </View>
                )}
            </View>
        </SelectionBottomSheet>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 10,
    },
    scrollContent: {
        paddingBottom: 40,
        gap: 8,
    },
    walletItem: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        height: 64,
    },
    walletInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    walletIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
    },
    walletName: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.titleText,
    },
    iconContainer: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chevron: {
        width: 16,
        height: 16,
        tintColor: '#666',
    },
});
