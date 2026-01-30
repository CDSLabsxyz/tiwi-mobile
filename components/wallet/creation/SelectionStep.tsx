import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SelectionStepProps {
    onSelect: () => void;
}

export default function SelectionStep({ onSelect }: SelectionStepProps) {
    return (
        <View style={styles.container}>
            {/* Stepper Indicator */}
            <View style={styles.stepperContainer}>
                <View style={styles.stepRow}>
                    <View style={styles.activeStepIcon}>
                        <View style={styles.activeInnerCircle} />
                    </View>
                    <Text style={styles.activeStepText}>Select Creation Method</Text>
                </View>

                <View style={[styles.connectorLine, { backgroundColor: colors.primaryCTA }]} />

                <View style={styles.stepRow}>
                    <View style={styles.inactiveStepIcon} />
                    <Text style={styles.inactiveStepText}>Get Wallet</Text>
                </View>
            </View>

            {/* Methods List */}
            <View style={styles.methodsContainer}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.methodCard}
                    onPress={onSelect}
                >
                    <View style={styles.cardContent}>
                        <View>
                            <Text style={styles.cardTitle}>Create New Seed Phrase</Text>
                            <Text style={styles.cardSubtitle}>Generate a new seed phrase for new wallets</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 30,
    },
    stepperContainer: {
        marginBottom: 40,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    activeStepIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.primaryCTA,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeInnerCircle: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primaryCTA,
    },
    inactiveStepIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#1F261E',
    },
    connectorLine: {
        width: 2,
        height: 24,
        marginLeft: 9,
        marginVertical: 4,
    },
    activeStepText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#FFFFFF',
    },
    inactiveStepText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#282828',
    },
    methodsContainer: {
        marginTop: 20,
    },
    methodCard: {
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderColor: '#1F261E',
        borderRadius: 24,
        padding: 24,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: '#FFFFFF',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: '#6E7873',
    },
});
