import { colors } from '@/constants/colors';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function CustomStatusBar() {
    const { top } = useSafeAreaInsets();

    return (
        <>
            <ExpoStatusBar style="light" backgroundColor={colors.bg} translucent />
            <View style={[styles.statusBarOverlay, { height: top }]} />
        </>
    );
}

const styles = StyleSheet.create({
    statusBarOverlay: {
        backgroundColor: 'transparent',
    },
});
