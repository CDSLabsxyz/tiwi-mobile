import { colors } from '@/constants/colors';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface VerifyStepProps {
    mnemonic: string;
    onComplete: () => void;
    onCancel: () => void;
}

export default function VerifyStep({ mnemonic, onComplete, onCancel }: VerifyStepProps) {
    const words = mnemonic.split(' ');
    const [indicesToVerify, setIndicesToVerify] = useState<number[]>([]);
    const [userInputs, setUserInputs] = useState<{ [key: number]: string }>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Pick 3 random indices to verify
        const indices = [] as number[];
        while (indices.length < 3) {
            const r = Math.floor(Math.random() * 12);
            if (!indices.includes(r)) indices.push(r);
        }
        setIndicesToVerify(indices.sort((a, b) => a - b));
    }, []);

    const handleInputChange = (index: number, text: string) => {
        setUserInputs(prev => ({ ...prev, [index]: text.trim().toLowerCase() }));
        if (error) setError(null);
    };

    const handleVerify = () => {
        console.log("verify and wor on it")
        const allCorrect = indicesToVerify.every(index => {
            return userInputs[index] === words[index];
        });

        if (allCorrect) {
            onComplete();
            console.log("all correct")
        } else {
            setError('One or more words are incorrect. Please check your seed phrase.');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                <View style={styles.headerInfo}>
                    <Text style={styles.title}>Confirm Seed Phrase</Text>
                    <Text style={styles.subtitle}>
                        Please verify your seed phrase by entering the requested words.
                    </Text>
                </View>

                {error && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                <View style={styles.inputsSection}>
                    {indicesToVerify.map((index) => (
                        <View key={index} style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Word #{index + 1}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Type word here"
                                placeholderTextColor="#6E7873"
                                autoComplete="off"
                                autoCorrect={false}
                                autoCapitalize="none"
                                value={userInputs[index] || ''}
                                onChangeText={(text) => handleInputChange(index, text)}
                            />
                        </View>
                    ))}
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[
                            styles.verifyButton,
                            { opacity: indicesToVerify.every(idx => userInputs[idx]) ? 1 : 0.5 }
                        ]}
                        onPress={handleVerify}
                        disabled={!indicesToVerify.every(idx => userInputs[idx])}
                    >
                        <Text style={styles.verifyButtonText}>Verify & Continue</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                        <Text style={styles.cancelButtonText}>Go back to Bakcup</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },
    headerInfo: {
        marginBottom: 32,
    },
    title: {
        fontFamily: 'Manrope-Bold',
        fontSize: 24,
        color: '#FFFFFF',
        marginBottom: 12,
    },
    subtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: '#B5B5B5',
        lineHeight: 20,
    },
    errorBox: {
        backgroundColor: 'rgba(255, 92, 92, 0.1)',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
    },
    errorText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: '#FF5C5C',
        textAlign: 'center',
    },
    inputsSection: {
        gap: 20,
        marginBottom: 40,
    },
    inputGroup: {
        gap: 8,
    },
    inputLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#FFFFFF',
    },
    input: {
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderColor: '#1F261E',
        borderRadius: 12,
        height: 56,
        paddingHorizontal: 16,
        color: '#FFFFFF',
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
    },
    footer: {
        gap: 16,
    },
    verifyButton: {
        backgroundColor: colors.primaryCTA,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    verifyButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#010501',
    },
    cancelButton: {
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#6E7873',
    },
});
