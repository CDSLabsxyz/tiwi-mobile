/**
 * Assets/NFTs Tab Switcher Component
 * Segmented control for switching between Assets and NFTs views
 */

import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const FilterIcon = require('@/assets/wallet/filter-horizontal.svg');

export type WalletTabKey = 'assets' | 'nfts';

interface AssetsTabSwitcherProps {
    activeTab: WalletTabKey;
    onTabChange: (tab: WalletTabKey) => void;
    onFilterPress?: () => void;
    onAddTokenPress?: () => void;
}

/**
 * Assets/NFTs Tab Switcher - Segmented control with filter button
 */
export const AssetsTabSwitcher: React.FC<AssetsTabSwitcherProps> = ({
    activeTab,
    onTabChange,
    onFilterPress,
    onAddTokenPress,
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
                        styles.tabButton,
                        { width: 94 },
                        activeTab === 'assets' && styles.activeTab
                    ]}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'assets' ? colors.bg : colors.bodyText }
                        ]}
                    >
                        Assets
                    </Text>
                </TouchableOpacity>

                {/* NFTs Tab */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => onTabChange('nfts')}
                    style={[
                        styles.tabButton,
                        { width: 82 },
                        activeTab === 'nfts' && styles.activeTab
                    ]}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'nfts' ? colors.bg : colors.bodyText }
                        ]}
                    >
                        NFTs
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* Add Token Button */}
                {onAddTokenPress && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onAddTokenPress}
                        style={styles.filterButton}
                    >
                        <Text style={{ fontSize: 20, color: colors.primaryCTA, fontFamily: 'Manrope-Bold' }}>+</Text>
                    </TouchableOpacity>
                )}

                {/* Filter Button */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={onFilterPress}
                    style={styles.filterButton}
                >
                    <View style={styles.filterIconWrapper}>
                        <Image
                            source={FilterIcon}
                            style={styles.fullSize}
                            contentFit="contain"
                        />
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        // paddingHorizontal: 16,
    },
    segmentedControl: {
        backgroundColor: '#1B1B1B',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 50,
        padding: 4,
    },
    tabButton: {
        height: 35,
        borderRadius: 50,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
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
    filterIconWrapper: {
        width: 24,
        height: 24,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
