/**
 * Assets/NFTs Tab Switcher Component
 * Segmented control for switching between Assets and NFTs views
 * Converted from Tailwind to StyleSheet
 */

import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const FilterIcon = require('../../../assets/home/filter-horizontal.svg');

export type WalletTabKey = 'assets' | 'nfts';

interface AssetsTabSwitcherProps {
    activeTab: WalletTabKey;
    onTabChange: (tab: WalletTabKey) => void;
    onFilterPress?: () => void;
}

/**
 * Assets/NFTs Tab Switcher - Segmented control with filter button
 */
export const AssetsTabSwitcher: React.FC<AssetsTabSwitcherProps> = ({
    activeTab,
    onTabChange,
    onFilterPress,
}) => {
    return (
        <View style={styles.container}>
            {/* Segmented Control */}
            <View style={styles.segmentedControl}>
                {/* Assets Tab */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => onTabChange('assets')}
                    style={[
                        styles.tab,
                        styles.assetsTab,
                        activeTab === 'assets' && styles.activeTab
                    ]}
                >
                    <Text style={[
                        styles.tabText,
                        { color: activeTab === 'assets' ? colors.bg : colors.bodyText }
                    ]}>
                        Assets
                    </Text>
                </TouchableOpacity>

                {/* NFTs Tab */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => onTabChange('nfts')}
                    style={[
                        styles.tab,
                        styles.nftsTab,
                        activeTab === 'nfts' && styles.activeTab
                    ]}
                >
                    <Text style={[
                        styles.tabText,
                        { color: activeTab === 'nfts' ? colors.bg : colors.bodyText }
                    ]}>
                        NFTs
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Filter Button */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onFilterPress}
                style={styles.filterButton}
            >
                <View style={styles.filterIconContainer}>
                    <Image
                        source={FilterIcon}
                        style={styles.iconFull}
                        contentFit="contain"
                    />
                </View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    segmentedControl: {
        backgroundColor: '#1B1B1B',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 50,
        padding: 0,
    },
    tab: {
        height: 35,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    assetsTab: {
        width: 94,
    },
    nftsTab: {
        width: 82,
    },
    activeTab: {
        backgroundColor: colors.primaryCTA,
    },
    tabText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        textAlign: 'center',
        letterSpacing: -0.32,
    },
    filterButton: {
        width: 35,
        height: 35,
        borderRadius: 20,
        backgroundColor: '#1B1B1B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterIconContainer: {
        width: 24,
        height: 24,
    },
    iconFull: {
        width: '100%',
        height: '100%',
    },
});
