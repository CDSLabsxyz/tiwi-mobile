import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';

const CheckIcon = require('@/assets/swap/checkmark-circle-01.svg');

interface SuccessModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    buttonText?: string;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
    visible,
    onClose,
    title = 'Wallet Imported Successfully',
    message = 'Your wallet is now connected and ready to use.',
    buttonText = 'Continue',
}) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            scale.value = withSpring(1, { damping: 15, stiffness: 100 });
            opacity.value = withTiming(1, { duration: 300 });
        } else {
            scale.value = withTiming(0, { duration: 200 });
            opacity.value = withTiming(0, { duration: 200 });
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            statusBarTranslucent
        >
            <View style={styles.container}>
                {/* Dark Backdrop */}
                <View style={styles.backdrop} />

                {/* Modal Card */}
                <Animated.View style={[styles.card, animatedStyle]}>
                    <View style={styles.iconContainer}>
                        <Image
                            source={CheckIcon}
                            style={styles.icon}
                            contentFit="contain"
                        />
                    </View>

                    <View style={styles.textContainer}>
                        <Text style={styles.title}>{title}</Text>
                        {/* <Text style={styles.message}>{message}</Text> */}
                    </View>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={onClose}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>{buttonText}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)', // Dark backdrop
    },
    card: {
        width: '100%',
        backgroundColor: '#0B0F0A', // Dark/bg semi from Figma
        borderRadius: 24,
        paddingVertical: 40,
        paddingHorizontal: 24,
        alignItems: 'center',
        gap: 32,
    },
    iconContainer: {
        width: 88,
        height: 88,
        backgroundColor: '#161B14', // Slightly lighter dark for contrast
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2A3029',
    },
    icon: {
        width: 40,
        height: 40,
        tintColor: colors.primaryCTA, // Neon Green
    },
    textContainer: {
        gap: 8,
        alignItems: 'center',
    },
    title: {
        fontFamily: 'Manrope-Bold',
        fontSize: 24,
        color: '#FFFFFF',
        textAlign: 'center',
        lineHeight: 32,
    },
    message: {
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        color: '#B5B5B5', // Dark/body text
        textAlign: 'center',
        lineHeight: 24,
    },
    button: {
        width: '100%',
        height: 56,
        backgroundColor: colors.primaryCTA,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#000000',
    }
});
