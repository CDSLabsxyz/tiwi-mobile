import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ArrowDown01 = require('@/assets/home/arrow-down-01.svg');

interface ChainSelectorCardProps {
    chainName: string;
    chainIcon: any;
    onPress?: () => void;
}

/**
 * Chain Selection card
 * Matches Figma block
 */
export const ChainSelectorCard: React.FC<ChainSelectorCardProps> = ({
    chainName,
    chainIcon,
    onPress,
}) => {
    return (
        <View style={styles.container}>
            <Text style={styles.label}>Chain Selection</Text>

            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPress}
                style={styles.selector}
            >
                <View style={styles.chainInfo}>
                    <View style={styles.iconContainer}>
                        <Image
                            source={chainIcon}
                            style={styles.fullSize}
                            contentFit="contain"
                        />
                    </View>
                    <Text style={styles.chainName}>{chainName}</Text>
                </View>

                <Image
                    source={ArrowDown01}
                    style={styles.arrowIcon}
                    contentFit="contain"
                />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 99,
        borderRadius: 16,
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        textAlign: 'left',
    },
    selector: {
        marginTop: 11,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#273024',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        justifyContent: 'space-between',
    },
    chainInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 20,
        height: 20,
        marginRight: 8,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
    chainName: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    arrowIcon: {
        width: 24,
        height: 24,
    },
});
