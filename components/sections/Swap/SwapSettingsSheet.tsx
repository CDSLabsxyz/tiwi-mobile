import { colors } from '@/constants/colors';
import { useSwapStore } from '@/store/swapStore';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SelectionBottomSheet } from './SelectionBottomSheet';

interface SwapSettingsSheetProps {
    visible: boolean;
    onClose: () => void;
}

export const SwapSettingsSheet: React.FC<SwapSettingsSheetProps> = ({
    visible,
    onClose,
}) => {
    const {
        slippage,
        setSlippage,
        isAutoSlippage,
        setAutoSlippage,
        useRelayer,
        setUseRelayer
    } = useSwapStore();

    const slippageOptions = [0.1, 0.5, 1.0, 3.0];

    return (
        <SelectionBottomSheet
            visible={visible}
            title="Swap Settings"
            onClose={onClose}
        >
            <View style={styles.container}>
                {/* Slippage Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Slippage Tolerance</Text>
                        <TouchableOpacity style={styles.infoIcon}>
                            <Ionicons name="information-circle-outline" size={18} color={colors.mutedText} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.optionsRow}>
                        <TouchableOpacity
                            style={[
                                styles.optionButton,
                                isAutoSlippage && styles.activeOption,
                            ]}
                            onPress={setAutoSlippage}
                        >
                            <Text style={[
                                styles.optionText,
                                isAutoSlippage && styles.activeOptionText,
                            ]}>
                                Auto
                            </Text>
                        </TouchableOpacity>
                        {slippageOptions.map((option) => (
                            <TouchableOpacity
                                key={option}
                                style={[
                                    styles.optionButton,
                                    !isAutoSlippage && slippage === option && styles.activeOption
                                ]}
                                onPress={() => setSlippage(option)}
                            >
                                <Text style={[
                                    styles.optionText,
                                    !isAutoSlippage && slippage === option && styles.activeOptionText
                                ]}>
                                    {option}%
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <View style={styles.customInputContainer}>
                            <TextInput
                                style={styles.customInput}
                                placeholder="Custom"
                                placeholderTextColor={colors.mutedText}
                                keyboardType="numeric"
                                value={!isAutoSlippage && !slippageOptions.includes(slippage) ? slippage.toString() : ''}
                                onChangeText={(text) => {
                                    const val = parseFloat(text);
                                    if (!isNaN(val)) setSlippage(val);
                                }}
                            />
                            <Text style={styles.percentSymbol}>%</Text>
                        </View>
                    </View>
                </View>

                {/* Relayer / Managed Swap Section */}
                <View style={[styles.section, styles.borderTop]}>
                    <View style={styles.switchRow}>
                        <View style={styles.switchInfo}>
                            <View style={styles.titleRow}>
                                <Text style={styles.sectionTitle}>Managed Swap (Relayer)</Text>
                                <View style={styles.soonBadge}>
                                    <Text style={styles.soonBadgeText}>SOON</Text>
                                </View>
                            </View>
                            <Text style={styles.sectionSubtitle}>
                                Pay gas fees in Tiwi Cat or the token you're swapping. Cheaper and faster.
                            </Text>
                        </View>
                        <Switch
                            trackColor={{ false: colors.bgCards, true: colors.primaryCTA + '80' }}
                            thumbColor={useRelayer ? colors.primaryCTA : '#f4f3f4'}
                            ios_backgroundColor={colors.bgCards}
                            onValueChange={setUseRelayer}
                            value={useRelayer}
                            disabled
                        />
                    </View>
                </View>

                {/* Future: Gas Payment Token selection could go here */}

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={onClose}
                >
                    <Text style={styles.saveButtonText}>Save Settings</Text>
                </TouchableOpacity>
            </View>
        </SelectionBottomSheet>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    sectionSubtitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
        marginTop: 4,
        paddingRight: 40,
    },
    infoIcon: {
        marginLeft: 8,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    optionButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    activeOption: {
        backgroundColor: colors.primaryCTA + '20',
        borderColor: colors.primaryCTA,
    },
    optionText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.bodyText,
    },
    activeOptionText: {
        color: colors.primaryCTA,
    },
    customInputContainer: {
        flex: 1,
        minWidth: 80,
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgSemi,
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    customInput: {
        flex: 1,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    percentSymbol: {
        color: colors.mutedText,
        fontFamily: 'Manrope-SemiBold',
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    switchInfo: {
        flex: 1,
        marginRight: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    soonBadge: {
        backgroundColor: colors.primaryCTA + '20',
        borderColor: colors.primaryCTA,
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    soonBadgeText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 9,
        color: colors.primaryCTA,
        letterSpacing: 0.5,
    },
    borderTop: {
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
    },
    saveButton: {
        backgroundColor: colors.primaryCTA,
        borderRadius: 16,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    saveButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#FFFFFF',
    },
});
