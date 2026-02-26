/**
 * Activities Filter Sheet Component
 * Displays filtering options for user activities
 */

import { colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CloseIcon = require('@/assets/home/bot/cancel-01.svg');

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

interface ActivitiesFilterSheetProps {
    visible: boolean;
    onClose: () => void;
    activeFilter: string;
    onFilterChange: (filter: string) => void;
}

export const ActivitiesFilterSheet: React.FC<ActivitiesFilterSheetProps> = ({
    visible,
    onClose,
    activeFilter,
    onFilterChange,
}) => {
    const { bottom } = useSafeAreaInsets();
    const translateY = useSharedValue(600);
    const backdropOpacity = useSharedValue(0);

    const filterOptions = [
        { label: 'All', value: 'All' },
        { label: 'Swap', value: 'Swap' },
        { label: 'Stake & Unstake', value: 'Staking' },
        { label: 'Sent & Received', value: 'Transfers' },
        { label: 'Approve', value: 'Approve' },
        { label: 'Contract Call', value: 'Contract' },
        { label: 'DeFi', value: 'DeFi' },
    ];

    const nftOptions = [
        { label: 'Mint', value: 'Mint' },
        { label: 'NFT Transfer', value: 'NFT_Transfer' },
        { label: 'Sale & Purchase', value: 'Market' },
        { label: 'Listing', value: 'Listing' },
    ];

    useEffect(() => {
        if (visible) {
            // Use withTiming to prevent "jumping" (overshoot) from withSpring
            translateY.value = withTiming(0, { duration: 350 });
            backdropOpacity.value = withTiming(1, { duration: 300 });
        } else {
            translateY.value = withTiming(600, { duration: 300 });
            backdropOpacity.value = withTiming(0, { duration: 300 });
        }
    }, [visible]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

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

                <Animated.View style={[
                    styles.sheet,
                    { paddingBottom: Math.max(bottom, 20) + 20 },
                    sheetStyle
                ]}>
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
                        <FilterSection title="General Activity" columns={2}>
                            {filterOptions.map(option => (
                                <Checkbox
                                    key={option.value}
                                    label={option.label}
                                    checked={activeFilter === option.value}
                                    onToggle={() => {
                                        onFilterChange(option.value);
                                        onClose();
                                    }}
                                />
                            ))}
                        </FilterSection>

                        <FilterSection title="NFT Activities" columns={2}>
                            {nftOptions.map(option => (
                                <Checkbox
                                    key={option.value}
                                    label={option.label}
                                    checked={activeFilter === option.value}
                                    onToggle={() => {
                                        onFilterChange(option.value);
                                        onClose();
                                    }}
                                />
                            ))}
                        </FilterSection>
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
        justifyContent: 'space-between',
    },
    checkboxWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 10,
        width: '48%',
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
        fontSize: 14,
        color: '#7C7C7C',
    },
    labelActive: {
        color: colors.titleText,
    },
});
