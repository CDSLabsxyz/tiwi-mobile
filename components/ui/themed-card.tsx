import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

export type ThemedCardProps = ViewProps & {
    lightColor?: string;
    darkColor?: string;
};

export function ThemedCard({ style, lightColor, darkColor, ...otherProps }: ThemedCardProps) {
    const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'card');
    const borderColor = useThemeColor({ light: lightColor, dark: darkColor }, 'border');

    return (
        <View
            style={[
                styles.card,
                { backgroundColor, borderColor },
                style,
            ]}
            {...otherProps}
        />
    );
}

const styles = StyleSheet.create({
    card: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
});
