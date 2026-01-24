import { colors } from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ExpiresOption = 'never' | '24hours' | '7days' | 'custom';

interface ExpiresSectionProps {
    selectedOption: ExpiresOption;
    onSelect: (option: ExpiresOption) => void;
}

/**
 * Expires section for Limit tab
 * Exact 1:1 match with Figma design
 */
export const ExpiresSection: React.FC<ExpiresSectionProps> = ({
    selectedOption,
    onSelect,
}) => {
    const options: { key: ExpiresOption; label: string }[] = [
        { key: 'never', label: 'Never' },
        { key: '24hours', label: '24 Hours' },
        { key: '7days', label: '7 Days' },
        { key: 'custom', label: 'Custom' },
    ];

    return (
        <View style={styles.container}>
            {/* Label */}
            <Text style={styles.label}>Expires</Text>

            {/* Options row */}
            <View style={styles.optionsRow}>
                {options.map((option) => {
                    const isSelected = selectedOption === option.key;

                    return (
                        <TouchableOpacity
                            key={option.key}
                            activeOpacity={0.8}
                            onPress={() => onSelect(option.key)}
                            style={[
                                styles.optionButton,
                                isSelected ? styles.activeButton : styles.inactiveButton
                            ]}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    isSelected ? styles.activeText : styles.inactiveText
                                ]}
                            >
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 353,
        height: 72,
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
        width: 78,
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
});
