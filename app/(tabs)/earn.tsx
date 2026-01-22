import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { colors } from '@/constants/colors';
import React from 'react';
import { StyleSheet } from 'react-native';

export default function EarnScreen() {
    return (
        <ThemedView style={styles.container}>
            <ThemedText type="title" style={styles.title}>Earn</ThemedText>
            <ThemedText style={styles.text}>Yield opportunities coming soon.</ThemedText>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: colors.titleText,
        fontFamily: 'Manrope-Bold',
    },
    text: {
        color: colors.bodyText,
        fontFamily: 'Manrope-Regular',
        marginTop: 8,
    },
});
