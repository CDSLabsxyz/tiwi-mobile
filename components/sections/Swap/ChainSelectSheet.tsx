import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SelectionBottomSheet } from './SelectionBottomSheet';
import { TIWILoader } from '@/components/ui/TIWILoader';

const CheckmarkIcon = require('@/assets/swap/checkmark-circle-01.svg');

export type ChainId = number | string;

export interface ChainOption {
    id: ChainId;
    name: string;
    icon: any;
}

interface ChainSelectSheetProps {
    visible: boolean;
    selectedChainId: ChainId | null;
    onSelect: (option: ChainOption) => void;
    onClose: () => void;
}

export const ChainSelectSheet: React.FC<ChainSelectSheetProps> = ({
    visible,
    selectedChainId,
    onSelect,
    onClose,
}) => {
    const { data: chains, isLoading } = useChains();

    const options: ChainOption[] = React.useMemo(() => {
        if (!chains) return [];
        return chains.map(c => ({
            id: c.id,
            name: c.name,
            icon: c.logoURI || c.logo || require('@/assets/home/chains/ethereum.svg'), // Priority to logoURI
        }));
    }, [chains]);

    return (
        <SelectionBottomSheet
            visible={visible}
            title="Chain Selection"
            onClose={onClose}
        >
            {isLoading ? (
                <View style={styles.loaderContainer}>
                    <TIWILoader size={60} />
                </View>
            ) : (
                <ScrollView
                    style={styles.container}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {options.map((option) => {
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
            )}
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
        borderRadius: 100
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
    loaderContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
