/**
 * NFT List Item Component
 * Displays individual NFT card in the grid view
 */

import { colors } from '@/constants/colors';
import type { NFTItem } from '@/services/walletService';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ArrowRightIcon = require('@/assets/home/arrow-right-01.svg');

interface NFTListItemProps {
    nft: NFTItem;
    onPress?: () => void;
}

/**
 * NFT List Item - Individual NFT card in the grid
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
                    style={styles.fullSize}
                    contentFit="cover"
                />
            </View>

            {/* Bottom Overlay with Name and Floor Price */}
            <View style={styles.overlay}>
                {/* Left: Name and Floor Price */}
                <View style={styles.infoContainer}>
                    <Text style={styles.nftName} numberOfLines={1}>
                        {nft.name}
                    </Text>
                    <Text style={styles.floorPrice}>
                        Floor: {nft.floorPrice}
                    </Text>
                </View>

                {/* Right: Arrow Icon */}
                <View style={styles.arrowIconWrapper}>
                    <Image
                        source={ArrowRightIcon}
                        style={styles.fullSize}
                        contentFit="contain"
                        tintColor="#FFFFFF"
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
    fullSize: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 52,
        backgroundColor: 'rgba(18, 23, 18, 0.6)',
        backdropFilter: 'blur(10px)',
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
    },
    nftName: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    floorPrice: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.75)',
    },
    arrowIconWrapper: {
        width: 16,
        height: 16,
    },
});
