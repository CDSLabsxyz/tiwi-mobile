import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';

export type ThemedButtonProps = TouchableOpacityProps & {
    title: string;
    lightColor?: string;
    darkColor?: string;
    variant?: 'primary' | 'secondary' | 'outline';
};

export function ThemedButton({
    title,
    style,
    lightColor,
    darkColor,
    variant = 'primary',
    ...otherProps
}: ThemedButtonProps) {
    const primaryColor = useThemeColor({ light: lightColor, dark: darkColor }, 'primary');
    const secondaryColor = useThemeColor({ light: lightColor, dark: darkColor }, 'secondary');
    const backgroundColor = variant === 'primary' ? primaryColor : variant === 'secondary' ? secondaryColor : 'transparent';
    const borderColor = variant === 'outline' ? primaryColor : 'transparent';
    const buttonTextColor = variant === 'outline' ? primaryColor : '#FFFFFF';

    return (
        <TouchableOpacity
            style={[
                styles.button,
                { backgroundColor, borderColor, borderWidth: variant === 'outline' ? 1 : 0 },
                style,
            ]}
            {...otherProps}
        >
            <Text style={[styles.text, { color: buttonTextColor }]}>{title}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 16,
        fontWeight: '600',
    },
});
