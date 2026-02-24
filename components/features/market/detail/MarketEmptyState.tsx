import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const imgFolder = "http://localhost:3845/assets/0568c07c2a7e7d6928e3b089c9e8876c16d554a9.svg"; // wallet/folder-02.svg

interface MarketEmptyStateProps {
    symbol: string;
    type: 'order book' | 'trades';
}

/**
 * Standard Empty State for Market Details
 * Used when no data is returned from WebSockets after timeout.
 */
export const MarketEmptyState: React.FC<MarketEmptyStateProps> = ({ symbol, type }) => {
    return (
        <View style={styles.container}>
            <Image
                source={{ uri: imgFolder }}
                style={styles.icon}
                tintColor={colors.mutedText}
            />
            <Text style={styles.text}>No {type} for {symbol}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 250,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    icon: {
        width: 48,
        height: 48,
        marginBottom: 16,
        opacity: 0.5,
    },
    text: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
    },
});
