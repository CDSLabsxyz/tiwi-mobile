import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TiwiLogo = require('@/assets/logo/tiwi-logo.svg');

interface FinalizeStepProps {
    address: string;
    onComplete: () => void;
}

export default function FinalizeStep({ address, onComplete }: FinalizeStepProps) {
    // Format address to show 0x...T43232 style as in Figma
    const formattedAddress = `${address.slice(0, 8)}..${address.slice(-6)}`;

    return (
        <View style={styles.container}>
            {/* Stepper Indicator - Fully Completed State */}
            <View style={styles.stepperContainer}>
                <View style={styles.stepRow}>
                    <View style={styles.completedStepIcon}>
                        <View style={styles.activeInnerCircle} />
                    </View>
                    <Text style={styles.completedStepText}>Select Creation Method</Text>
                </View>

                <View style={[styles.connectorLine, { backgroundColor: colors.primaryCTA }]} />

                <View style={styles.stepRow}>
                    <View style={styles.completedStepIcon}>
                        <View style={styles.activeInnerCircle} />
                    </View>
                    <Text style={styles.activeStepText}>Get Wallet</Text>
                </View>
            </View>

            <View style={styles.centerContent}>
                <Text style={styles.description}>
                    Use it to send and receive crypto on blockchain
                </Text>

                <View style={styles.graphicPlaceholder}>
                    <Image
                        source={TiwiLogo}
                        style={styles.logo}
                        contentFit="contain"
                    />
                </View>

                <Text style={styles.addressText}>{formattedAddress}</Text>
            </View>

            <TouchableOpacity style={styles.continueButton} onPress={onComplete}>
                <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 40,
    },
    stepperContainer: {
        marginBottom: 80,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    completedStepIcon: {
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
    connectorLine: {
        width: 2,
        height: 24,
        marginLeft: 9,
        marginVertical: 4,
    },
    completedStepText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#FFFFFF',
    },
    activeStepText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#FFFFFF',
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
    },
    description: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: '#B5B5B5',
        textAlign: 'center',
        marginBottom: 40,
    },
    graphicPlaceholder: {
        width: 100,
        height: 100,
        backgroundColor: '#111810',
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    logo: {
        width: 60,
        height: 60,
    },
    addressText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 32,
        color: '#FFFFFF', // In screenshot it's white but large
        textAlign: 'center',
    },
    continueButton: {
        backgroundColor: colors.primaryCTA,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#010501',
    },
});
