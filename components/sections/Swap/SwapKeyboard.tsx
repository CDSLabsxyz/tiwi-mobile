import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface SwapKeyboardProps {
    visible: boolean;
    onKeyPress: (key: string) => void;
    onPercentagePress: (percentage: number) => void;
    onMaxPress: () => void;
    onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SwapKeyboard: React.FC<SwapKeyboardProps> = ({
    visible,
    onKeyPress,
    onPercentagePress,
    onMaxPress,
    onClose,
}) => {
    const translateY = useSharedValue(SCREEN_HEIGHT);

    React.useEffect(() => {
        if (visible) {
            translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
        } else {
            translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250, easing: Easing.in(Easing.quad) });
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    if (!visible && translateY.value === SCREEN_HEIGHT) return null;

    const renderKey = (val: string, label?: string) => (
        <TouchableOpacity
            style={styles.key}
            activeOpacity={0.7}
            onPress={() => onKeyPress(val)}
        >
            <Text style={styles.keyText}>{label || val}</Text>
        </TouchableOpacity>
    );

    return (
        <>
            {/* Invisible overlay to close when tapping outside */}
            {visible && (
                <View style={styles.overlayWrapper} pointerEvents="auto">
                    <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
                </View>
            )}

            <Animated.View style={[styles.container, animatedStyle]}>
                {/* Header Actions Row */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionPill} onPress={() => onPercentagePress(25)}>
                        <Text style={styles.actionText}>25%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionPill} onPress={() => onPercentagePress(50)}>
                        <Text style={styles.actionText}>50%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionPill} onPress={() => onPercentagePress(75)}>
                        <Text style={styles.actionText}>75%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionPill, styles.maxPill]} onPress={onMaxPress}>
                        <Text style={styles.maxText}>Max</Text>
                    </TouchableOpacity>
                </View>

                {/* Numpad Grid */}
                <View style={styles.grid}>
                    <View style={styles.row}>
                        {renderKey('1')}
                        {renderKey('2')}
                        {renderKey('3')}
                    </View>
                    <View style={styles.row}>
                        {renderKey('4')}
                        {renderKey('5')}
                        {renderKey('6')}
                    </View>
                    <View style={styles.row}>
                        {renderKey('7')}
                        {renderKey('8')}
                        {renderKey('9')}
                    </View>
                    <View style={styles.row}>
                        {renderKey('.')}
                        {renderKey('0')}
                        <TouchableOpacity
                            style={styles.key}
                            activeOpacity={0.7}
                            onPress={() => onKeyPress('DELETE')}
                        >
                            <Ionicons name="backspace-outline" size={24} color={colors.titleText} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Close Button at bottom */}
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Text style={styles.closeButtonText}>Done</Text>
                </TouchableOpacity>
            </Animated.View>
        </>
    );
};

const styles = StyleSheet.create({
    overlayWrapper: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 99,
    },
    overlay: {
        flex: 1,
    },
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.bgCards,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 16,
        paddingBottom: 32,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 20,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 8,
    },
    actionPill: {
        flex: 1,
        backgroundColor: colors.bgSemi,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    maxPill: {
        backgroundColor: colors.bgStroke, // Assuming this is the slightly green dark bg
    },
    actionText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    maxText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.primaryCTA,
    },
    grid: {
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    key: {
        flex: 1,
        backgroundColor: colors.bgSemi,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    keyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 24,
        color: colors.titleText,
    },
    closeButton: {
        marginTop: 24,
        backgroundColor: colors.primaryCTA,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    closeButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.bg,
    },
});
