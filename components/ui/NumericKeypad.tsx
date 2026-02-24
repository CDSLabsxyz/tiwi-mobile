import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface NumericKeypadProps {
    onPress: (value: string) => void;
    onDelete: () => void;
    showDecimal?: boolean;
}

const KEYS = [
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '.', value: '.', isDecimal: true },
    { label: '0', value: '0' },
    { label: 'del', value: 'del', isAction: true },
];

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
    onPress,
    onDelete,
    showDecimal = true
}) => {
    const handlePress = (key: typeof KEYS[0]) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (key.value === 'del') {
            onDelete();
        } else {
            onPress(key.value);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.grid}>
                {KEYS.map((key) => {
                    if (key.value === '.' && !showDecimal) {
                        return <View key="empty" style={styles.keyContainer} />;
                    }

                    return (
                        <TouchableOpacity
                            key={key.value}
                            style={styles.keyContainer}
                            onPress={() => handlePress(key)}
                            activeOpacity={0.6}
                        >
                            <View style={styles.keyBackground}>
                                {key.value === 'del' ? (
                                    <Ionicons name="backspace-outline" size={24} color={colors.titleText} />
                                ) : (
                                    <Text style={styles.keyLabel}>{key.label}</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    keyContainer: {
        width: '31.5%', // Adjust for gap
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyBackground: {
        flex: 1,
        width: '100%',
        backgroundColor: '#1B1B1B', // Consistent with deposit modal and security keypad blocks
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 28,
        color: colors.titleText,
    },
});
