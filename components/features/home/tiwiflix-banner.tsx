import { BannerCard } from '@/components/sections/Wallet/ClaimableRewardsCard';
import { browserRoute, ECOSYSTEM_LINKS } from '@/constants/ecosystem-links';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

/**
 * TiwiFlix Banner Component
 * Sits under the Stake banner on home. TiwiFlix has no native screen yet, so
 * this opens it in the in-app browser.
 */
export const TiwiFlixBanner: React.FC = () => {
    const router = useRouter();

    const handlePress = () => {
        router.push(browserRoute(ECOSYSTEM_LINKS.tiwiflix) as any);
    };

    return (
        <BannerCard
            icon={require('@/assets/dapp-icons/tiwiflix.svg')}
            renderTitle={() => (
                <Text style={styles.label}>
                    <Text style={styles.labelMuted}>Explore videos on </Text>
                    <Text style={styles.labelHighlight}>TiwiFlix</Text>
                </Text>
            )}
            onPress={handlePress}
            // Spacing is owned by the banner stack in app/(tabs)/index.tsx
            style={{ marginVertical: 0 }}
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
