/**
 * Pool Card Component
 * A smaller card for grid layouts, matching web's recommended pools
 */

import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface PoolCardProps {
    tokenName: string;
    tokenIcon?: any;
    apy: string;
    onPress?: () => void;
}

export const PoolCard: React.FC<PoolCardProps> = ({
    tokenName,
    tokenIcon,
    apy,
    onPress,
}) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.container}
        >
            <View style={styles.header}>
                <View style={styles.tokenInfo}>
                    <View style={styles.iconContainer}>
                        {tokenIcon ? (
                            <Image
                                source={tokenIcon}
                                style={styles.fullImage}
                                contentFit="cover"
                            />
                        ) : (
                            <View style={styles.placeholderIcon} />
                        )}
                    </View>
                    <Text style={styles.tokenName} numberOfLines={1}>
                        {tokenName}
                    </Text>
                </View>
                <Feather name="chevron-right" size={20} color="white" />
            </View>
            <Text style={styles.apyText}>
                {apy}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#121712',
        borderRadius: 16,
        padding: 12,
        flex: 1,
        minHeight: 100,
        justifyContent: 'space-between',
        gap: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    tokenInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    iconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        overflow: 'hidden',
    },
    fullImage: {
        width: '100%',
        height: '100%',
    },
    placeholderIcon: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.bgStroke,
    },
    tokenName: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: 'white',
        flexShrink: 1,
    },
    apyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 18,
        color: 'white',
    },
});
