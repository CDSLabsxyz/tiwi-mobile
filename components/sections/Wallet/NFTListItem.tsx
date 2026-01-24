/**
 * NFT List Item Component
 * Displays individual NFT card in the grid view
 * Converted from Tailwind to StyleSheet - matches Figma exactly
 */

import { colors } from '@/constants/colors';
import type { NFTItem } from '@/services/walletService';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ArrowIcon = require('../../../assets/settings/arrow-right-01.svg');

interface NFTListItemProps {
    nft: NFTItem;
    onPress?: () => void;
}

/**
 * NFT List Item - Individual NFT card in the grid
 * Dimensions: 175px × 210px
 */
export const NFTListItem: React.FC<NFTListItemProps> = ({
    nft,
    onPress,
}) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.container}
        >
            {/* NFT Image */}
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: nft.mediaUrl }}
                    style={styles.image}
                    contentFit="cover"
                />
            </View>

            {/* Bottom Overlay with Name and Floor Price */}
            <View style={styles.overlay}>
                {/* Left: Name and Floor Price */}
                <View style={styles.infoContainer}>
                    {/* NFT Name */}
                    <Text style={styles.name} numberOfLines={1}>
                        {nft.name}
                    </Text>

                    {/* Floor Price */}
                    <Text style={styles.floorPrice}>
                        Floor: {nft.floorPrice}
                    </Text>
                </View>

                {/* Right: Arrow Icon */}
                <View style={styles.arrowContainer}>
                    <Image
                        source={ArrowIcon}
                        style={styles.arrowIcon}
                        contentFit="contain"
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 175,
        height: 210,
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    imageContainer: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 45,
        backgroundColor: 'rgba(27, 27, 27, 0.25)',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    infoContainer: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 0,
    },
    name: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        lineHeight: 18,
        color: colors.titleText,
    },
    floorPrice: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        lineHeight: 16,
        color: 'rgba(255, 255, 255, 0.75)',
    },
    arrowContainer: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowIcon: {
        width: 24,
        height: 24,
    },
});
