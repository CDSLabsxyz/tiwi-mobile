import { colors } from '@/constants/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BackupStepProps {
    mnemonic: string;
    onComplete: () => void;
}

export default function BackupStep({ mnemonic, onComplete }: BackupStepProps) {
    ScreenCapture.usePreventScreenCapture();
    const [isCopied, setIsCopied] = useState(false);
    const words = mnemonic.split(' ');

    const copyToClipboard = async () => {
        await Clipboard.setStringAsync(mnemonic);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerInfo}>
                <Text style={styles.title}>Backup Seed Phrase</Text>
                <Text style={styles.subtitle}>
                    Save these 12 words in a secure place. Never share them with anyone as they provide full access to your funds.
                </Text>
            </View>

            <View style={styles.warningBox}>
                <MaterialCommunityIcons name="alert-outline" size={20} color="#FF5C5C" />
                <Text style={styles.warningText}>
                    If you lose these words, TIWI Protocol cannot help you recover your account.
                </Text>
            </View>

            <View style={styles.wordsGrid}>
                {words.map((word, index) => (
                    <View key={index} style={styles.wordItem}>
                        <Text style={styles.wordIndex}>{index + 1}</Text>
                        <Text style={styles.wordText}>{word}</Text>
                    </View>
                ))}
            </View>

            <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
                <Ionicons
                    name={isCopied ? "checkmark-circle" : "copy-outline"}
                    size={18}
                    color={colors.primaryCTA}
                />
                <Text style={styles.copyButtonText}>
                    {isCopied ? "Copied!" : "Copy to Clipboard"}
                </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.continueButton} onPress={onComplete}>
                    <Text style={styles.continueButtonText}>I've backed it up</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
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
        marginBottom: 24,
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
    warningBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 92, 92, 0.1)',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 92, 92, 0.2)',
        marginBottom: 24,
        gap: 12,
    },
    warningText: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: '#FF5C5C',
    },
    wordsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 24,
    },
    wordItem: {
        width: '31%', // Roughly 3 columns
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderColor: '#1F261E',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 10,
    },
    wordIndex: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: '#6E7873',
        width: 18,
    },
    wordText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#FFFFFF',
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        marginBottom: 40,
    },
    copyButtonText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.primaryCTA,
    },
    footer: {
        marginTop: 'auto',
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
