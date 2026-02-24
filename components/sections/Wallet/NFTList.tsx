/**
 * NFT List Component
 * Displays grid of NFT items
 */

import type { NFTItem } from '@/services/walletService';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NFTListItem } from './NFTListItem';

import { NFTEmptyState } from './NFTEmptyState';

interface NFTListProps {
    nfts: NFTItem[];
    onNFTPress?: (nft: NFTItem) => void;
    isLoading?: boolean;
}

/**
 * NFT List - Grid layout for NFT items
 * 2 columns with spacing
 */
export const NFTList: React.FC<NFTListProps> = ({ nfts, onNFTPress, isLoading }) => {
    if (isLoading && nfts.length === 0) {
        return null;
    }

    if (!isLoading && nfts.length === 0) {
        return <NFTEmptyState />;
    }

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
                    {/* Placeholder for empty slot in odd-numbered rows */}
                    {row.length === 1 && <View style={styles.placeholder} />}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        flexDirection: 'column',
        gap: 12,
        paddingHorizontal: 8,
    },
    row: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    placeholder: {
        width: 175,
    },
});
