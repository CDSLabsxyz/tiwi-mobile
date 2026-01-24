import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../themed-text';
import { CustomStatusBar } from './custom-status-bar';

const ChevronLeftIcon = require('../../assets/swap/arrow-left-02.svg');

interface SettingsHeaderProps {
    title: string;
    onBack?: () => void;
    showBack?: boolean;
}

export function SettingsHeader({ title, onBack, showBack = true }: SettingsHeaderProps) {
    const { top } = useSafeAreaInsets();
    const router = useRouter();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/settings' as any);
        }
    };

    return (
        <View style={[styles.header, { paddingTop: top || 0 }]}>
            <CustomStatusBar />
            <View style={styles.headerContent}>
                {showBack ? (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleBack}
                        style={styles.backButton}
                    >
                        <Image
                            source={ChevronLeftIcon}
                            style={styles.icon24}
                            contentFit="contain"
                        />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.icon24} />
                )}

                <ThemedText type="subtitle" style={styles.headerTitle}>
                    {title}
                </ThemedText>

                <View style={styles.icon24} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        backgroundColor: 'transparent',
        paddingHorizontal: 20,
    },
    headerContent: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    backButton: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        textAlign: 'center',
        flex: 1,
    },
    icon24: {
        width: 24,
        height: 24,
    },
});
