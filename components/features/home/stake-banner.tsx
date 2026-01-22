import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

/**
 * Stake Banner Component
 * Matches Figma design exactly
 */
export const StakeBanner: React.FC = () => {
    const router = useRouter();

    return (
        <TouchableOpacity
            onPress={() => router.push('/stake' as any)}
            activeOpacity={0.9}
            style={styles.container}
        >
            <Image
                source={require('../../../assets/home/stake.svg')}
                style={styles.image}
                contentFit="contain"
            />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 353,
        height: 78,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: colors.bgCards,
    },
    image: {
        width: '100%',
        height: '100%',
    },
});
