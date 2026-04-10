import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type SwapTabKey = 'swap' | 'limit';

interface SwapTabsProps {
    activeTab: SwapTabKey;
    onChange: (tab: SwapTabKey) => void;
}

export const SwapTabs: React.FC<SwapTabsProps> = ({ activeTab, onChange }) => {
    return (
        <View style={styles.container}>
            <View style={styles.tabWrapper}>
                {/* Swap tab */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => onChange('swap')}
                    style={[styles.tab, activeTab === 'swap' && styles.activeTab]}
                >
                    <Text style={[styles.tabText, activeTab === 'swap' ? styles.activeText : styles.inactiveText]}>
                        Swap
                    </Text>
                </TouchableOpacity>

                {/* Limit tab — locked */}
                <View style={[styles.tab, styles.lockedTab]}>
                    <Ionicons name="lock-closed" size={12} color="#555" style={{ marginRight: 4 }} />
                    <Text style={styles.lockedText}>Limit</Text>
                    <View style={styles.soonBadge}>
                        <Text style={styles.soonText}>Soon</Text>
                    </View>
                </View>
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
        flexDirection: 'row',
    },
    activeTab: {
        backgroundColor: '#141E00',
        borderColor: colors.primaryCTA,
    },
    lockedTab: {
        opacity: 0.5,
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
    lockedText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#555',
    },
    soonBadge: {
        marginLeft: 6,
        backgroundColor: 'rgba(177, 241, 40, 0.1)',
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    soonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 9,
        color: colors.primaryCTA,
        letterSpacing: 0.5,
    },
});
