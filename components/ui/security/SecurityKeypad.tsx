import { colors } from '@/constants/colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Fallback logic for icons
const BackspaceIcon = require('@/assets/security/delete-left.svg');
// FaceID logic handled by prop/text usually, but can use image if provided

interface SecurityKeypadProps {
    onPress: (digit: string) => void;
    onDelete: () => void;
    onBiometric?: () => void;
    showBiometric?: boolean;
    biometricIcon?: boolean;
    biometricLabel?: string;
}

export const SecurityKeypad: React.FC<SecurityKeypadProps> = ({
    onPress,
    onDelete,
    onBiometric,
    showBiometric = false,
    biometricIcon,
    biometricLabel = 'ID'
}) => {

    const handlePress = (digit: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(digit);
    };

    const handleDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onDelete();
    };

    // Modern styling: Large Text, Rectangular Touch Area
    const renderKey = (digit: string) => (
        <TouchableOpacity
            key={digit}
            style={styles.key}
            onPress={() => handlePress(digit)}
            activeOpacity={0.6}
        >
            <Text style={styles.keyText}>{digit}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.grid}>
                <View style={styles.row}>{[renderKey('1'), renderKey('2'), renderKey('3')]}</View>
                <View style={styles.row}>{[renderKey('4'), renderKey('5'), renderKey('6')]}</View>
                <View style={styles.row}>{[renderKey('7'), renderKey('8'), renderKey('9')]}</View>
                <View style={styles.row}>
                    {/* Biometric */}
                    <View style={styles.sideKey}>
                        {showBiometric && onBiometric && (
                            <TouchableOpacity style={[styles.utilityButton]} onPress={onBiometric}>
                                {biometricIcon ? (
                                    <MaterialIcons name="fingerprint" size={32} color="white" />
                                ) : (
                                    <Text style={styles.utilityText}>{biometricLabel}</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>

                    {renderKey('0')}

                    {/* Delete */}
                    <View style={styles.sideKey}>
                        <TouchableOpacity style={styles.utilityButton} onPress={handleDelete}>
                            <Text style={styles.deleteText}>⌫</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 12,
        paddingBottom: 24,
    },
    grid: {
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    key: {
        flex: 1,
        // Rectangular blocks as per "box" input alignment
        height: 64,
        backgroundColor: '#1F1F1F', // Slightly lighter than black bg
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        // Optional: Add shadow or border if design demands
    },
    keyText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 28,
        color: '#FFFFFF',
    },
    sideKey: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    utilityButton: {
        flex: 1,
        width: '100%',
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
        // Transparent for utility? Or consistent bg?
        // Usually delete is transparent or same style. Let's make it consistent but transparent for now to differentiate
    },
    utilityText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.primaryCTA,
    },
    deleteText: {
        fontSize: 24,
        color: '#FFF',
    },
    biometricIcon: {
        width: 32,
        height: 32,
        tintColor: colors.primaryCTA,
    }
});
