import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedButton } from '@/components/ui/themed-button';
import { ThemedCard } from '@/components/ui/themed-card';
import { colors } from '@/constants/colors';
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

export function SwapWidget() {
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('');

    return (
        <View style={styles.container}>
            <ThemedCard style={styles.card}>
                <ThemedText type="subtitle" style={styles.title}>Swap</ThemedText>

                <View style={styles.inputContainer}>
                    <ThemedText style={styles.label}>From</ThemedText>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="0.0"
                            placeholderTextColor={colors.mutedText}
                            value={fromAmount}
                            onChangeText={setFromAmount}
                            keyboardType="numeric"
                        />
                        <ThemedButton title="ETH" variant="outline" style={styles.tokenButton} />
                    </View>
                </View>

                <View style={styles.divider}>
                    <IconSymbol name="arrow.down.circle.fill" size={32} color={colors.primaryCTA} />
                </View>

                <View style={styles.inputContainer}>
                    <ThemedText style={styles.label}>To</ThemedText>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="0.0"
                            placeholderTextColor={colors.mutedText}
                            value={toAmount}
                            onChangeText={setToAmount}
                            keyboardType="numeric"
                        />
                        <ThemedButton title="USDC" variant="outline" style={styles.tokenButton} />
                    </View>
                </View>

                <ThemedButton
                    title="Connect Wallet"
                    style={styles.swapButton}
                    onPress={() => alert('Connect Wallet functionality coming soon!')}
                />
            </ThemedCard>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    card: {
        gap: 16,
        backgroundColor: colors.bgCards,
        borderColor: colors.bgStroke,
        borderRadius: 24,
    },
    title: {
        color: colors.titleText,
        marginBottom: 8,
    },
    inputContainer: {
        gap: 8,
    },
    label: {
        color: colors.mutedText,
        fontSize: 14,
        fontWeight: '500',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 64,
        backgroundColor: colors.bgSemi,
    },
    input: {
        flex: 1,
        fontSize: 24,
        fontWeight: '600',
        color: colors.titleText,
    },
    tokenButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: colors.bgStroke,
        borderColor: colors.primaryCTA,
    },
    divider: {
        alignItems: 'center',
        marginVertical: -8,
        zIndex: 1,
    },
    swapButton: {
        marginTop: 16,
        height: 60,
        backgroundColor: colors.primaryCTA,
        borderRadius: 16,
    },
});
