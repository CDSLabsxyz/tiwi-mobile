/**
 * Pool Card Component
 * A smaller card for grid layouts, matching web's recommended pools
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PoolTokenIcon } from './PoolTokenIcon';

interface PoolCardProps {
    tokenName: string;
    tokenSymbol?: string;
    tokenIcon?: any;
    rewardTokenSymbol?: string;
    rewardTokenIcon?: any;
    apy: string;
    onPress?: () => void;
}

export const PoolCard: React.FC<PoolCardProps> = ({
    tokenName,
    tokenSymbol,
    tokenIcon,
    rewardTokenSymbol,
    rewardTokenIcon,
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
                    <PoolTokenIcon
                        tokenIcon={tokenIcon}
                        tokenSymbol={tokenSymbol || tokenName}
                        rewardTokenIcon={rewardTokenIcon}
                        rewardTokenSymbol={rewardTokenSymbol}
                        size={28}
                    />
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
