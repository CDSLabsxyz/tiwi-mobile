/**
 * NFT Empty State Component
 * Displays a themed empty state when no NFTs are found in the wallet
 */

import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const EmptyNFTIcon = require('../../../assets/wallet/folder-02.svg');

interface NFTEmptyStateProps {
    title?: string;
    description?: string;
}

export const NFTEmptyState: React.FC<NFTEmptyStateProps> = ({
    title = "No NFTs found",
    description = "You don't have any NFTs in this wallet yet. Deposit some NFTs to see them here."
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.iconWrapper}>
                <Image
                    source={EmptyNFTIcon}
                    style={styles.icon}
                    contentFit="contain"
                    tintColor={colors.mutedText}
                />
            </View>

            <View style={styles.textContainer}>
                <Text style={styles.titleText}>{title}</Text>
                <Text style={styles.descriptionText}>{description}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        minHeight: 260,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        marginTop: 20,
    },
    iconWrapper: {
        width: 192,
        height: 192,
        marginBottom: 16,
        opacity: 0.5,
    },
    icon: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        alignItems: 'center',
    },
    titleText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
        textAlign: 'center',
        marginBottom: 8,
    },
    descriptionText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
        lineHeight: 20,
    }
});
