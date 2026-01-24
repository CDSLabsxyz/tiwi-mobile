import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SelectionBottomSheet } from './SelectionBottomSheet';

const EthereumIcon = require('@/assets/home/chains/ethereum.svg');
const ApexIcon = require('@/assets/home/chains/near.svg');
const VerdantIcon = require('@/assets/home/chains/polygon.svg');
const AegisIcon = require('@/assets/home/chains/solana.svg');
const CortexIcon = require('@/assets/home/chains/avalanche.svg');
const CheckmarkIcon = require('@/assets/swap/checkmark-circle-01.svg');

export type ChainId = 'ethereum' | 'apex' | 'verdant' | 'aegis' | 'cortex';

export interface ChainOption {
    id: ChainId;
    name: string;
    icon: any;
}

const CHAIN_OPTIONS: ChainOption[] = [
    { id: 'ethereum', name: 'Ethereum', icon: EthereumIcon },
    { id: 'apex', name: 'Apex Network', icon: ApexIcon },
    { id: 'verdant', name: 'Verdant Protocol', icon: VerdantIcon },
    { id: 'aegis', name: 'Aegis Core', icon: AegisIcon },
    { id: 'cortex', name: 'Cortex Chain', icon: CortexIcon },
];

interface ChainSelectSheetProps {
    visible: boolean;
    selectedChainId: ChainId | null;
    onSelect: (option: ChainOption) => void;
    onClose: () => void;
}

/**
 * Chain selection bottom sheet
 * Matches Figma chain dropdown menu
 */
export const ChainSelectSheet: React.FC<ChainSelectSheetProps> = ({
    visible,
    selectedChainId,
    onSelect,
    onClose,
}) => {
    return (
        <SelectionBottomSheet
            visible={visible}
            title="Chain Selection"
            onClose={onClose}
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {CHAIN_OPTIONS.map((option) => {
                    const isActive = selectedChainId !== null && option.id === selectedChainId;

                    return (
                        <TouchableOpacity
                            key={option.id}
                            activeOpacity={0.9}
                            onPress={() => onSelect(option)}
                            style={[
                                styles.optionItem,
                                isActive && styles.activeItem
                            ]}
                        >
                            <View style={styles.optionContent}>
                                <View style={styles.chainInfo}>
                                    <View style={styles.iconWrapper}>
                                        <Image source={option.icon} style={styles.fullSize} contentFit="contain" />
                                    </View>
                                    <Text style={styles.optionName}>{option.name}</Text>
                                </View>

                                {isActive && (
                                    <View style={styles.checkWrapper}>
                                        <Image source={CheckmarkIcon} style={styles.fullSize} contentFit="contain" />
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </SelectionBottomSheet>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 8,
        paddingBottom: 24,
        gap: 14,
    },
    optionItem: {
        height: 56,
        borderRadius: 16,
        backgroundColor: colors.bgSemi,
        overflow: 'hidden',
    },
    activeItem: {
        backgroundColor: colors.bgShade20,
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        height: '100%',
    },
    chainInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconWrapper: {
        width: 32,
        height: 32,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
    optionName: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    checkWrapper: {
        width: 24,
        height: 24,
    },
});
