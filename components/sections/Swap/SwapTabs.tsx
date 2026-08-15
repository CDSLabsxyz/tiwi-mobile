import { colors } from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type SwapTabKey = 'swap' | 'limit';

export const SwapTabs: React.FC = () => {
    return (
        <View style={styles.container}>
            <View style={styles.tabWrapper}>
                <View style={[styles.tab, styles.activeTab]}>
                    <Text style={[styles.tabText, styles.activeText]}>
                        Swap
                    </Text>
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
    tabText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
    },
    activeText: {
        color: colors.primaryCTA,
    },
});
