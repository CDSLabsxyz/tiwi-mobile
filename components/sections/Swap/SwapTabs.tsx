import { colors } from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type SwapTabKey = 'swap' | 'limit';

interface SwapTabsProps {
    activeTab: SwapTabKey;
    onChange: (tab: SwapTabKey) => void;
}

/**
 * Swap / Limit segmented control
 * Responsive width to match other swap cards
 */
export const SwapTabs: React.FC<SwapTabsProps> = ({ activeTab, onChange }) => {
    const handlePress = (tab: SwapTabKey) => {
        if (tab === activeTab) return;
        onChange(tab);
    };

    return (
        <View style={styles.container}>
            <View style={styles.tabWrapper}>
                {/* Swap tab */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handlePress('swap')}
                    style={[
                        styles.tab,
                        activeTab === 'swap' && styles.activeTab
                    ]}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'swap' ? styles.activeText : styles.inactiveText
                        ]}
                    >
                        Swap
                    </Text>
                </TouchableOpacity>

                {/* Limit tab */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handlePress('limit')}
                    style={[
                        styles.tab,
                        activeTab === 'limit' && styles.activeTab
                    ]}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'limit' ? styles.activeText : styles.inactiveText
                        ]}
                    >
                        Limit
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
    },
    tabWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 100,
        width: '100%',
        padding: 4,
        backgroundColor: colors.bgSemi,
    },
    tab: {
        flex: 1,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 100,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    activeTab: {
        backgroundColor: '#141E00',
        borderColor: colors.primaryCTA,
    },
    tabText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
    },
    activeText: {
        color: colors.primaryCTA,
    },
    inactiveText: {
        color: colors.mutedHiddenText,
    },
});
