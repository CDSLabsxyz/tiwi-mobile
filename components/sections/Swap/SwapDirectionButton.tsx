import { colors } from '@/constants/colors';
import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

const SwapVerticalIcon = require('@/assets/swap/swap-vertical.svg');

interface SwapDirectionButtonProps {
    onPress?: () => void;
    disabled?: boolean;
}

/**
 * Small direction toggle button between From/To cards
 * Centered horizontally between cards
 */
export const SwapDirectionButton: React.FC<SwapDirectionButtonProps> = ({
    onPress,
    disabled,
}) => {
    return (
        <View style={styles.container}>
            <TouchableOpacity
                disabled={disabled}
                activeOpacity={0.8}
                onPress={onPress}
                style={styles.touchArea}
            >
                <Image
                    source={SwapVerticalIcon}
                    style={styles.icon}
                    tintColor={colors.primaryCTA}
                    contentFit="contain"
                />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: "45%", // Adjusted to sit between the cards
        left: '50%',
        marginLeft: -16,
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: colors.bgStroke,
        borderWidth: 2,
        borderColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
    },
    touchArea: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        width: 20,
        height: 20
    },
});
