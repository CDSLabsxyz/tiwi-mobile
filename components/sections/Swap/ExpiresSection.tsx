import { colors } from '@/constants/colors';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export type ExpiresOption = 'never' | '24hours' | '7days' | 'custom';
export type ExpiresUnit = 'hours' | 'days' | 'months';

interface ExpiresSectionProps {
    selectedOption: ExpiresOption;
    onSelect: (option: ExpiresOption) => void;
    customValue?: string;
    customUnit?: ExpiresUnit;
    onCustomChange?: (value: string, unit: ExpiresUnit) => void;
}

export const ExpiresSection: React.FC<ExpiresSectionProps> = ({
    selectedOption,
    onSelect,
    customValue,
    customUnit = 'days',
    onCustomChange,
}) => {
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [tempValue, setTempValue] = useState(customValue || '');
    const [tempUnit, setTempUnit] = useState<ExpiresUnit>(customUnit);

    const options: { key: ExpiresOption; label: string }[] = [
        { key: 'never', label: 'Never' },
        { key: '24hours', label: '24 Hours' },
        { key: '7days', label: '7 Days' },
        { key: 'custom', label: 'Custom' },
    ];

    const units: { key: ExpiresUnit; label: string }[] = [
        { key: 'hours', label: 'Hours' },
        { key: 'days', label: 'Days' },
        { key: 'months', label: 'Months' },
    ];

    const handleOptionPress = (key: ExpiresOption) => {
        onSelect(key);
        if (key === 'custom') {
            setTempValue(customValue || '');
            setTempUnit(customUnit);
            setShowCustomModal(true);
        }
    };

    const handleConfirm = () => {
        if (tempValue.trim()) {
            onCustomChange?.(tempValue.trim(), tempUnit);
        }
        setShowCustomModal(false);
    };

    const getCustomLabel = () => {
        if (!customValue) return null;
        return `${customValue} ${customUnit}`;
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Expires</Text>

            <View style={styles.optionsRow}>
                {options.map((option) => {
                    const isSelected = selectedOption === option.key;
                    return (
                        <TouchableOpacity
                            key={option.key}
                            activeOpacity={0.8}
                            onPress={() => handleOptionPress(option.key)}
                            style={[
                                styles.optionButton,
                                isSelected ? styles.activeButton : styles.inactiveButton
                            ]}
                        >
                            <Text style={[styles.optionText, isSelected ? styles.activeText : styles.inactiveText]}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {selectedOption === 'custom' && customValue && (
                <TouchableOpacity style={styles.customBadge} onPress={() => setShowCustomModal(true)} activeOpacity={0.7}>
                    <Text style={styles.customBadgeText}>Expires in {getCustomLabel()}</Text>
                </TouchableOpacity>
            )}

            {/* Custom Duration Modal */}
            <Modal transparent animationType="fade" visible={showCustomModal} onRequestClose={() => setShowCustomModal(false)}>
                <Pressable style={styles.overlay} onPress={() => setShowCustomModal(false)}>
                    <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
                        <Text style={styles.modalTitle}>Set Custom Duration</Text>
                        <Text style={styles.modalSubtitle}>How long should this limit order last?</Text>

                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.numberInput}
                                value={tempValue}
                                onChangeText={setTempValue}
                                placeholder="0"
                                placeholderTextColor="#666"
                                keyboardType="number-pad"
                                autoFocus
                            />
                        </View>

                        <View style={styles.unitRow}>
                            {units.map((unit) => {
                                const isActive = tempUnit === unit.key;
                                return (
                                    <TouchableOpacity
                                        key={unit.key}
                                        style={[styles.unitButton, isActive && styles.unitButtonActive]}
                                        onPress={() => setTempUnit(unit.key)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.unitText, isActive && styles.unitTextActive]}>
                                            {unit.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCustomModal(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmButton, !tempValue.trim() && { opacity: 0.4 }]}
                                onPress={handleConfirm}
                                disabled={!tempValue.trim()}
                            >
                                <Text style={styles.confirmText}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderRadius: 10,
        backgroundColor: colors.bgSemi,
        padding: 12,
    },
    label: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
        color: colors.bodyText,
        marginBottom: 12,
    },
    optionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    optionButton: {
        flex: 1,
        height: 24,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    activeButton: {
        backgroundColor: '#081f02',
    },
    inactiveButton: {
        backgroundColor: colors.bgCards,
        borderWidth: 0.5,
        borderColor: colors.bgStroke,
    },
    optionText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
    },
    activeText: {
        color: colors.primaryCTA,
    },
    inactiveText: {
        color: colors.bodyText,
    },
    customBadge: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#1A2418',
    },
    customBadgeText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        color: colors.primaryCTA,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    modal: {
        width: '100%',
        backgroundColor: '#111810',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1F261E',
        padding: 24,
        alignItems: 'center',
    },
    modalTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: '#FFFFFF',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: '#888',
        marginBottom: 24,
    },
    inputRow: {
        width: '100%',
        marginBottom: 16,
    },
    numberInput: {
        width: '100%',
        height: 56,
        backgroundColor: '#0B0F0A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1F261E',
        paddingHorizontal: 20,
        fontFamily: 'Manrope-Bold',
        fontSize: 24,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    unitRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 24,
        width: '100%',
    },
    unitButton: {
        flex: 1,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderColor: '#1F261E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    unitButtonActive: {
        backgroundColor: '#081f02',
        borderColor: colors.primaryCTA,
    },
    unitText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: '#888',
    },
    unitTextActive: {
        color: colors.primaryCTA,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderColor: '#1F261E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: '#888',
    },
    confirmButton: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: '#010501',
    },
});
