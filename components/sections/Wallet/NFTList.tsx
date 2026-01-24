/**
 * NFT List Component
 * Displays grid of NFT items
 * Converted from Tailwind to StyleSheet - matches Figma exactly
 */

import type { NFTItem } from '@/services/walletService';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NFTListItem } from './NFTListItem';

interface NFTListProps {
    nfts: NFTItem[];
    onNFTPress?: (nft: NFTItem) => void;
}

/**
 * NFT List - Grid layout for NFT items
 * 2 columns, 6px gap between items
 */
export const NFTList: React.FC<NFTListProps> = ({ nfts, onNFTPress }) => {
    // Group NFTs into rows of 2
    const rows: NFTItem[][] = [];
    for (let i = 0; i < nfts.length; i += 2) {
        rows.push(nfts.slice(i, i + 2));
    }

    return (
        <View style={styles.container}>
            {rows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                    {row.map((nft) => (
                        <NFTListItem
                            key={nft.id}
                            nft={nft}
                            onPress={() => onNFTPress?.(nft)}
                        />
                    ))}
                    {/* Fill empty space if odd number of items */}
                    {row.length === 1 && <View style={styles.spacer} />}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        flexDirection: 'column',
        gap: 6,
    },
    row: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 6,
    },
    spacer: {
        width: 175,
    },
});
