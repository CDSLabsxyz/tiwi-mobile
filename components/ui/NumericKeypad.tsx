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
    { label: '2', value: '2', sub: 'ABC' },
    { label: '3', value: '3', sub: 'DEF' },
    { label: '4', value: '4', sub: 'GHI' },
    { label: '5', value: '5', sub: 'JKL' },
    { label: '6', value: '6', sub: 'MNO' },
    { label: '7', value: '7', sub: 'PQRS' },
    { label: '8', value: '8', sub: 'TUV' },
    { label: '9', value: '9', sub: 'WXYZ' },
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
                            activeOpacity={0.7}
                        >
                            {key.value === 'del' ? (
                                <View style={styles.keyBackground}>
                                    <Ionicons name="backspace-outline" size={24} color={colors.titleText} />
                                </View>
                            ) : key.value === '.' ? (
                                <View style={styles.keyBackground}>
                                    <Text style={styles.keyLabel}>.</Text>
                                </View>
                            ) : (
                                <View style={styles.keyBackground}>
                                    <Text style={styles.keyLabel}>{key.label}</Text>
                                    {key.sub && <Text style={styles.keySubLabel}>{key.sub}</Text>}
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 6,
        paddingBottom: 20,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    keyContainer: {
        width: '33.33%',
        height: 64,
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyBackground: {
        flex: 1,
        width: '100%',
        backgroundColor: colors.bgSemi, // Slight contrast key bg
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 24,
        color: colors.titleText,
    },
    keySubLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
        marginTop: -2,
    },
});
