import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SeedConfirmStepProps {
    mnemonic: string;
    onConfirm: () => void;
}

const COMMON_WORDS = ["apple", "river", "mountain", "ocean", "galaxy", "orbit", "quantum", "rocket", "solar", "token", "crypto", "wizard", "forest", "desert", "bridge"];

export default function SeedConfirmStep({ mnemonic, onConfirm }: SeedConfirmStepProps) {
    const words = mnemonic.split(' ');

    // Pick 3 random indices to hide
    const [hiddenIndices, availableChoices] = useMemo(() => {
        const indices: number[] = [];
        while (indices.length < 3) {
            const r = Math.floor(Math.random() * 12);
            if (!indices.includes(r)) indices.push(r);
        }
        indices.sort((a, b) => a - b); // Keep them ordered

        // Get the missing words
        const missingWords = indices.map(i => words[i]);

        // Get 3 fake words
        const fakes: string[] = [];
        while (fakes.length < 3) {
            const f = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
            if (!missingWords.includes(f) && !fakes.includes(f)) {
                fakes.push(f);
            }
        }

        // Shuffle all choices
        const choices = [...missingWords, ...fakes].sort(() => Math.random() - 0.5);

        return [indices, choices];
    }, [mnemonic]);

    const [selectedAnswers, setSelectedAnswers] = useState<(string | null)[]>([null, null, null]);
    const [error, setError] = useState('');

    const handleSelectChoice = (word: string) => {
        setError('');
        // Find first empty slot
        const emptyIndex = selectedAnswers.findIndex(a => a === null);
        if (emptyIndex !== -1) {
            const newAnswers = [...selectedAnswers];
            newAnswers[emptyIndex] = word;
            setSelectedAnswers(newAnswers);
        }
    };

    const handleRemoveAnswer = (indexToRemove: number) => {
        setError('');
        const newAnswers = [...selectedAnswers];
        newAnswers[indexToRemove] = null;
        setSelectedAnswers(newAnswers);
    };

    const handleConfirm = () => {
        if (selectedAnswers.includes(null)) {
            setError('Please fill all missing words');
            return;
        }

        // Verify
        let isValid = true;
        for (let i = 0; i < 3; i++) {
            if (selectedAnswers[i] !== words[hiddenIndices[i]]) {
                isValid = false;
                break;
            }
        }

        if (isValid) {
            onConfirm();
        } else {
            setError('Incorrect phrase. Please check the order and try again.');
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
        >
            {/* Stepper Indicator */}
            <View style={styles.stepperContainer}>
                <View style={styles.stepRow}>
                    <View style={styles.completedStepIcon}>
                        <Ionicons name="checkmark" size={14} color="#0B0F0A" />
                    </View>
                    <Text style={styles.completedStepText}>Select Creation Method</Text>
                </View>

                <View style={[styles.connectorLine, { backgroundColor: colors.primaryCTA }]} />

                <View style={styles.stepRow}>
                    <View style={styles.completedStepIcon}>
                        <Ionicons name="checkmark" size={14} color="#0B0F0A" />
                    </View>
                    <Text style={styles.completedStepText}>Save Seed Phrase</Text>
                </View>

                <View style={[styles.connectorLine, { backgroundColor: colors.primaryCTA }]} />

                <View style={styles.stepRow}>
                    <View style={styles.activeStepIcon}>
                        <View style={styles.activeInnerCircle} />
                    </View>
                    <Text style={styles.activeStepText}>Confirm Seed Phrase</Text>
                </View>

                <View style={[styles.connectorLine, { backgroundColor: '#1F261E' }]} />

                <View style={styles.stepRow}>
                    <View style={styles.inactiveStepIcon} />
                    <Text style={styles.inactiveStepText}>Get Wallet</Text>
                </View>
            </View>

            <View style={styles.instructionContainer}>
                <Text style={styles.instructionText}>
                    Select the missing words in the correct order to confirm your seed phrase.
                </Text>
            </View>

            <View style={styles.seedBox}>
                <View style={styles.wordGrid}>
                    {words.map((word, index) => {
                        const isHidden = hiddenIndices.includes(index);
                        const hiddenAnswerIndex = hiddenIndices.indexOf(index);
                        const currentAnswer = isHidden ? selectedAnswers[hiddenAnswerIndex] : null;

                        if (isHidden) {
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.wordItem, styles.hiddenWordItem, currentAnswer && styles.filledWordItem]}
                                    onPress={() => currentAnswer && handleRemoveAnswer(hiddenAnswerIndex)}
                                >
                                    <Text style={styles.wordIndex}>{index + 1}</Text>
                                    <Text style={[styles.wordText, !currentAnswer && { color: '#6E7873' }]}>
                                        {currentAnswer || 'Tap to fill'}
                                    </Text>
                                </TouchableOpacity>
                            );
                        }

                        return (
                            <View key={index} style={styles.wordItem}>
                                <Text style={styles.wordIndex}>{index + 1}</Text>
                                <Text style={styles.wordText}>{word}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.choicesContainer}>
                {availableChoices.map((choice, i) => {
                    const isUsed = selectedAnswers.includes(choice);
                    return (
                        <TouchableOpacity
                            key={i}
                            style={[styles.choicePill, isUsed && styles.choicePillDisabled]}
                            onPress={() => !isUsed && handleSelectChoice(choice)}
                            disabled={isUsed}
                        >
                            <Text style={[styles.choiceText, isUsed && styles.choiceTextDisabled]}>{choice}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <TouchableOpacity style={styles.continueButton} onPress={handleConfirm}>
                <Text style={styles.continueButtonText}>Confirm</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 40,
        flexGrow: 1,
    },
    stepperContainer: {
        marginBottom: 20,
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
    completedStepIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.primaryCTA,
        justifyContent: 'center',
        alignItems: 'center',
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
        height: 16,
        marginLeft: 9,
        marginVertical: 4,
    },
    activeStepText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#FFFFFF',
    },
    inactiveStepText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#6E7873',
    },
    completedStepText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#FFFFFF',
    },
    instructionContainer: {
        marginBottom: 16,
    },
    instructionText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: '#B5B5B5',
        lineHeight: 20,
    },
    seedBox: {
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderColor: '#1F261E',
        borderRadius: 24,
        padding: 16,
        marginBottom: 20,
    },
    wordGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 8,
    },
    wordItem: {
        width: '48%',
        flexDirection: 'row',
        backgroundColor: '#111810',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 8,
    },
    hiddenWordItem: {
        backgroundColor: 'rgba(177, 241, 40, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(177, 241, 40, 0.3)',
        borderStyle: 'dashed',
    },
    filledWordItem: {
        backgroundColor: 'rgba(177, 241, 40, 0.1)',
        borderStyle: 'solid',
        borderColor: colors.primaryCTA,
    },
    wordIndex: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: '#6E7873',
        width: 24,
    },
    wordText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: '#FFFFFF',
    },
    choicesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 20,
    },
    choicePill: {
        backgroundColor: '#1F261E',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 24,
    },
    choicePillDisabled: {
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderColor: '#1F261E',
    },
    choiceText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: '#FFFFFF',
    },
    choiceTextDisabled: {
        color: '#6E7873',
    },
    errorText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#FF4444',
        textAlign: 'center',
        marginBottom: 16,
    },
    continueButton: {
        backgroundColor: colors.primaryCTA,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40,
    },
    continueButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#010501',
    },
});
