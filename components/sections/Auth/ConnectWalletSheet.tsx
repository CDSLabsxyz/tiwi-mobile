/**
 * Connect Wallet Sheet
 * Displays list of available wallets to connect
 * Integrated with TIWI Headless Handshake for a seamless "One-Tap" experience
 * Matches Figma design (node-id: 3279-118496)
 */

import { WalletConnectionContent } from '@/components/ui/WalletConnectionContent';
import { SuccessModal } from '@/components/ui/success-modal';
import { colors } from '@/constants/colors';
import { useTiwiConnect } from '@/hooks/useTiwiConnect';
import { isRelayerConnected, subscribeToRelayerStatus } from '@/services/walletConnectClient';
import {
    fetchWalletListings,
    getWalletIconUrl,
    POPULAR_WALLETS,
    type WalletConnectWallet
} from '@/services/walletConnectService';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSecurityStore } from '@/store/securityStore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { SelectionBottomSheet } from '../Swap';

// Extract WalletItem to a memoized component for better performance with large lists
const WalletItem = React.memo(({
    item,
    onPress,
    isConnecting
}: {
    item: WalletConnectWallet;
    onPress: (item: WalletConnectWallet) => void;
    isConnecting: boolean;
}) => {
    const iconUrl = item.id === 'walletconnect'
        ? 'https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/master/Logo/Blue%20(Default)/Logo.png'
        : getWalletIconUrl(item.image_id);

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onPress(item)}
            style={[styles.walletItem, isConnecting && { opacity: 0.5 }]}
            disabled={isConnecting}
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
                {isConnecting ? (
                    <TIWILoader size={24} />
                ) : (
                    <Image
                        source={ChevronRightIcon}
                        style={styles.chevron}
                        contentFit="contain"
                    />
                )}
            </View>
        </TouchableOpacity>
    );
});

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
    const { connect, isConnecting, connectionUri, cancelConnection } = useTiwiConnect();
    const [wallets, setWallets] = useState<WalletConnectWallet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { completeOnboarding } = useOnboardingStore();
    const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
    const [selectedWallet, setSelectedWallet] = useState<WalletConnectWallet | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [isNetworkStable, setIsNetworkStable] = useState(isRelayerConnected());

    // Monitor Relayer Connection
    useEffect(() => {
        const unsubscribe = subscribeToRelayerStatus((connected: boolean) => {
            setIsNetworkStable(connected);
        });
        return unsubscribe;
    }, []);

    // Debounce search query to reduce re-filtering overhead
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 150);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        if (visible && wallets.length === 0) {
            loadWallets();
        }
    }, [visible]);

    const filteredWallets = wallets.filter(wallet =>
        wallet.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    );

    // ... (Imports and props)

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
        setSelectedWallet(wallet); // Show modal immediately logic

        try {
            await connect(wallet, {
                onSuccess: () => {
                    setIsSuccessModalVisible(true);
                    setSelectedWallet(null);
                }
            });
        } catch (error) {
            console.error('Handshake failed:', error);
        }
    };

    const handleCancelConnection = () => {
        cancelConnection();
        setSelectedWallet(null);
        setSearchQuery(''); // Clear search on cancel as requested
    };

    const handleSheetClose = () => {
        if (selectedWallet) {
            handleCancelConnection();
        }
        onClose();
    };

    const handleRetry = () => {
        if (selectedWallet) {
            handleSelectWallet(selectedWallet);
        }
    };

    const handleSuccessContinue = () => {
        const hasPasscode = useSecurityStore.getState().hasPasscode;

        setIsSuccessModalVisible(false);
        onClose();

        if (!hasPasscode) {
            router.replace('/security' as any);
        } else {
            router.replace('/(tabs)');
        }
    };

    const renderWalletItem = ({ item }: { item: WalletConnectWallet }) => (
        <WalletItem
            item={item}
            onPress={handleSelectWallet}
            isConnecting={isConnecting}
        />
    );

    // Fixed item height (64) + gap (8) = 72
    const getItemLayout = (_: any, index: number) => ({
        length: 72,
        offset: 72 * index,
        index,
    });

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

    const renderContent = (data: WalletConnectWallet[]) => {
        if (selectedWallet) {
            return (
                <WalletConnectionContent
                    wallet={selectedWallet}
                    isConnecting={isConnecting}
                    onCancel={handleCancelConnection}
                    onRetry={handleRetry}
                />
            );
        }

        if (isLoading) {
            return renderSkeleton();
        }

        return (
            <View style={{ flex: 1 }}>
                {!isNetworkStable && (
                    <View style={styles.networkWarning}>
                        <Text style={styles.networkWarningText}>
                            Connection to WalletConnect relay is unstable. Handshake may take longer or fail.
                        </Text>
                    </View>
                )}
                <FlatList
                    data={data}
                    renderItem={renderWalletItem}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={styles.scrollContent}
                    style={{ flex: 1 }}
                    initialNumToRender={12}
                    maxToRenderPerBatch={10}
                    windowSize={7}
                    getItemLayout={getItemLayout}
                    removeClippedSubviews={true}
                    keyboardShouldPersistTaps="handled"
                />
            </View>
        );
    };

    return (
        <>
            <SelectionBottomSheet
                visible={visible}
                title={selectedWallet ? selectedWallet.name : "Connect wallet"}
                onClose={handleSheetClose}
                showSearchIcon={!selectedWallet}
                height={700}
                onBack={selectedWallet ? handleCancelConnection : undefined}
                onSearch={!selectedWallet ? setSearchQuery : undefined}
            >
                <View style={[styles.container, selectedWallet && { paddingHorizontal: 0 }]}>
                    {renderContent(filteredWallets)}
                </View>
            </SelectionBottomSheet>

            <SuccessModal
                visible={isSuccessModalVisible}
                onClose={handleSuccessContinue}
            />
        </>
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
    connectingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        zIndex: 10,
    },
    connectingText: {
        color: '#fff',
        fontFamily: 'Manrope-Medium',
        marginTop: 12,
    },
    networkWarning: {
        backgroundColor: 'rgba(255, 107, 107, 0.15)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 107, 0.3)',
    },
    networkWarningText: {
        color: '#FF6B6B',
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        textAlign: 'center',
    }
});
