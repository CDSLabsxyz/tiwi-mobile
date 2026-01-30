import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenHeaderProps {
    symbol: string;
    isFavorite?: boolean;
    onToggleFavorite?: () => void;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
    symbol,
    isFavorite,
    onToggleFavorite
}) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out ${symbol} on Tiwi!`,
                url: `https://app.tiwiprotocol.xyz/market/${symbol.toLowerCase()}`
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
            >
                <Image
                    source={require('@/assets/settings/arrow-left-02.svg')}
                    style={styles.icon}
                />
            </TouchableOpacity>

            <View style={styles.rightActions}>
                <TouchableOpacity onPress={onToggleFavorite} style={styles.actionButton}>
                    <Image
                        source={isFavorite
                            ? require('@/assets/market/star-18.svg')
                            : require('@/assets/market/star.svg')
                        }
                        style={[styles.icon, isFavorite && { tintColor: '#F7931A' }]}
                    />
                </TouchableOpacity>

                <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
                    <Image
                        source={require('@/assets/market/share-04.svg')}
                        style={styles.icon}
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
        paddingHorizontal: 20,
        paddingBottom: 12,
        backgroundColor: colors.bg,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.bgCards,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.bgCards,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        width: 20,
        height: 20,
        tintColor: colors.titleText,
    },
});
