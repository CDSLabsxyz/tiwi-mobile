/**
 * Earn Tab Switcher Component
 * Horizontal tab switcher for Earn categories
 * Matches Figma design exactly
 */

import { colors } from '@/constants/colors';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type EarnTabKey = 'staking' | 'farming' | 'lend-borrow' | 'nft-staking';

interface EarnTabSwitcherProps {
    activeTab: EarnTabKey;
    onTabChange: (tab: EarnTabKey) => void;
}

const TABS: { key: EarnTabKey; label: string }[] = [
    { key: 'staking', label: 'Staking' },
    { key: 'farming', label: 'Farming' },
    { key: 'lend-borrow', label: 'Lend & Borrow' },
    { key: 'nft-staking', label: 'NFT Staking' },
];

/**
 * Earn Tab Switcher - Horizontal tab navigation
 */
export const EarnTabSwitcher: React.FC<EarnTabSwitcherProps> = ({
    activeTab,
    onTabChange,
}) => {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        activeOpacity={0.8}
                        onPress={() => onTabChange(tab.key)}
                        style={[
                            styles.tabItem,
                            {
                                backgroundColor: isActive ? '#121712' : 'transparent',
                                borderColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent'
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                { color: isActive ? colors.titleText : colors.mutedText }
                            ]}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 0,
        paddingBottom: 4,
    },
    tabItem: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 40,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
    },
});
