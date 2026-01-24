import { colors } from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '../themed-text';

const ChevronRightIcon = require('../../assets/home/arrow-right-01.svg');

interface SettingsItemProps {
    label: string;
    icon?: any;
    onPress: () => void;
    rightElement?: React.ReactNode;
    showChevron?: boolean;
    destructive?: boolean;
}

export function SettingsItem({
    label,
    icon,
    onPress,
    rightElement,
    showChevron = true,
    destructive = false,
}: SettingsItemProps) {
    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={handlePress}
            style={styles.container}
        >
            <View style={styles.leftContent}>
                {icon && (
                    <View style={styles.iconWrapper}>
                        <Image source={icon} style={styles.icon} contentFit="contain" />
                    </View>
                )}
                <ThemedText
                    style={[
                        styles.label,
                        destructive && { color: colors.error }
                    ]}
                >
                    {label}
                </ThemedText>
            </View>

            <View style={styles.rightContent}>
                {rightElement}
                {showChevron && (
                    <Image
                        source={ChevronRightIcon}
                        style={styles.chevron}
                        contentFit="contain"
                    />
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    leftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconWrapper: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        width: '100%',
        height: '100%',
    },
    label: {
        fontSize: 18,
    },
    rightContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    chevron: {
        width: 24,
        height: 24,
    },
});
