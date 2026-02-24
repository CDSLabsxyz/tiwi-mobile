/**
 * Wallet Filter Sheet Component
 * Displays filtering and sorting options for the wallet assets/NFTs
 * Matches Figma design exactly (node-id: 3279-120616)
 */

import { colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

const CloseIcon = require('../../../assets/home/bot/cancel-01.svg');

interface CheckboxProps {
    label: string;
    checked: boolean;
    onToggle: () => void;
}

const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onToggle }) => (
    <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggle}
        style={styles.checkboxWrapper}
    >
        <View style={[
            styles.checkbox,
            { borderColor: checked ? colors.primaryCTA : '#7C7C7C' },
            checked && styles.checkboxActive
        ]}>
            {checked && <MaterialIcons name="check" size={14} color={colors.bg} />}
        </View>
        <Text style={[styles.checkboxLabel, checked && styles.labelActive]}>
            {label}
        </Text>
    </TouchableOpacity>
);

interface FilterSectionProps {
    title: string;
    children: React.ReactNode;
    columns?: 1 | 2;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, children, columns = 1 }) => (
    <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={[
            styles.optionsGrid,
            columns === 2 && styles.gridTwoColumns
        ]}>
            {children}
        </View>
    </View>
);

import { useWalletBalances } from '@/hooks/useWalletBalances';
import { useFilterStore } from '@/store/filterStore';

interface WalletFilterSheetProps {
    visible: boolean;
    onClose: () => void;
    nfts?: any[]; // For chain discovery
}

export const WalletFilterSheet: React.FC<WalletFilterSheetProps> = ({
    visible,
    onClose,
    nfts = [],
}) => {
    const translateY = useSharedValue(500);
    const backdropOpacity = useSharedValue(0);

    // Filter Store State
    const {
        sortBy,
        setSortBy,
        tokenCategories,
        toggleTokenCategory,
        chains: selectedChains,
        toggleChain,
        resetFilters
    } = useFilterStore();

    // Portfolio Data for Chain Discovery
    const { data: balanceData } = useWalletBalances();
    const tokens = balanceData?.tokens || [];

    // Discover unique chains from tokens and NFTs
    const availableChains = React.useMemo(() => {
        const chainIds = new Set<number>();
        tokens.forEach(t => chainIds.add(t.chainId));
        nfts.forEach(n => chainIds.add(n.chainId));

        const chainMap: { [key: number]: string } = {
            1: 'Ethereum',
            10: 'Optimism',
            56: 'BSC',
            137: 'Polygon',
            42161: 'Arbitrum',
            43114: 'Avalanche',
            8453: 'Base',
            1399811149: 'Solana'
        };

        return Array.from(chainIds).map(id => ({
            id,
            name: chainMap[id] || `Chain ${id}`
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [tokens, nfts]);

    useEffect(() => {
        if (visible) {
            translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
            backdropOpacity.value = withTiming(1, { duration: 300 });
        } else {
            translateY.value = withTiming(500, { duration: 300 });
            backdropOpacity.value = withTiming(0, { duration: 300 });
        }
    }, [visible]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const handleReset = () => {
        resetFilters();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={styles.fullContainer}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <Animated.View style={[styles.backdrop, backdropStyle]} />
                </Pressable>

                <Animated.View style={[styles.sheet, sheetStyle]}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onClose}
                        style={styles.closeButton}
                    >
                        <Image
                            source={CloseIcon}
                            style={styles.closeIcon}
                            contentFit="contain"
                        />
                    </TouchableOpacity>

                    <View style={styles.content}>
                        <FilterSection title="Sort By">
                            <Checkbox
                                label="Highest Value -> Lowest"
                                checked={sortBy === 'value-high'}
                                onToggle={() => setSortBy('value-high')}
                            />
                            <Checkbox
                                label="Recent Activity"
                                checked={sortBy === 'recent-activity'}
                                onToggle={() => setSortBy('recent-activity')}
                            />
                        </FilterSection>

                        <FilterSection title="Token Category" columns={2}>
                            {['DeFi Tokens', 'Gaming', 'Meme Coins', 'New Listings'].map(cat => (
                                <Checkbox
                                    key={cat}
                                    label={cat}
                                    checked={tokenCategories.has(cat)}
                                    onToggle={() => toggleTokenCategory(cat)}
                                />
                            ))}
                        </FilterSection>

                        <FilterSection title="Chain" columns={2}>
                            {availableChains.map(chain => (
                                <Checkbox
                                    key={chain.id}
                                    label={chain.name}
                                    checked={selectedChains.has(chain.id.toString())}
                                    onToggle={() => toggleChain(chain.id.toString())}
                                />
                            ))}
                        </FilterSection>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleReset}
                            style={styles.resetButton}
                        >
                            <Text style={styles.resetText}>Reset filters</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    fullContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    sheet: {
        backgroundColor: '#1B1B1B',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingTop: 32,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    closeButton: {
        position: 'absolute',
        top: -55,
        right: 20,
        width: 35,
        height: 35,
        backgroundColor: '#1B1B1B',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeIcon: {
        width: 24,
        height: 24,
    },
    content: {
        gap: 26,
    },
    sectionContainer: {
        gap: 12,
    },
    sectionTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    optionsGrid: {
        gap: 16,
    },
    gridTwoColumns: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    checkboxWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        minWidth: '45%',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 0.5,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxActive: {
        backgroundColor: colors.primaryCTA,
        borderColor: colors.primaryCTA,
    },
    checkboxLabel: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: '#7C7C7C',
    },
    labelActive: {
        color: colors.titleText,
    },
    resetButton: {
        backgroundColor: colors.primaryCTA,
        width: '100%',
        height: 52,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    resetText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#050201',
    },
});
