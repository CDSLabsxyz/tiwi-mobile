import { BannerCard } from '@/components/sections/Wallet/ClaimableRewardsCard';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

/**
 * Stake Banner Component
 * Reusable implementation using the modular BannerCard.
 */
export const StakeBanner: React.FC = () => {
    const router = useRouter();

    const handlePress = () => {
        router.push('/earn' as any);
    };

    return (
        <BannerCard
            icon={require('@/assets/home/stake_icon.svg')}
            renderTitle={() => (
                <Text style={styles.label}>
                    <Text style={styles.labelMuted}>Stake to earn </Text>
                    <Text style={styles.labelHighlight}>$TWC</Text>
                </Text>
            )}
            onPress={handlePress}
            style={{ marginBottom: 12 }}
        />
    );
};

const styles = StyleSheet.create({
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        includeFontPadding: false,
    },
    labelMuted: {
        color: '#b5b5b5',
    },
    labelHighlight: {
        fontFamily: 'Manrope-SemiBold',
        color: '#FFFFFF',
    },
});
