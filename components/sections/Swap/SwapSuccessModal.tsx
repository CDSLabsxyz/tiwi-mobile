import { colors } from '@/constants/colors';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SwapTabKey } from './SwapTabs';

const CheckmarkIcon = require('@/assets/swap/checkmark-circle-01.svg');

interface SwapSuccessModalProps {
    visible: boolean;
    onDone: () => void;
    activeTab?: SwapTabKey;
}

/**
 * Success modal after swap/limit completion
 * Matches Figma success state
 */
export const SwapSuccessModal: React.FC<SwapSuccessModalProps> = ({
    visible,
    onDone,
    activeTab = 'swap',
}) => {
    const isLimitOrder = activeTab === 'limit';

    const title = isLimitOrder ? 'Limit Set Successfully!' : 'Swap Successfully!';
    const description = isLimitOrder
        ? 'Your transaction limit has been updated and applied.'
        : 'The transaction was confirmed and the funds are now in your wallet.';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onDone}
            statusBarTranslucent
        >
            <View style={styles.container}>
                {/* Thick background blur and overlay */}
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, styles.overlay]} />

                <View style={styles.modalWrapper}>
                    <View style={styles.card}>
                        <View style={styles.iconCircle}>
                            <View style={styles.iconWrapper}>
                                <Image source={CheckmarkIcon} style={styles.fullSize} contentFit="contain" />
                            </View>
                        </View>

                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.description}>{description}</Text>

                        <TouchableOpacity activeOpacity={0.8} onPress={onDone} style={styles.doneButton}>
                            <Text style={styles.doneText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        backgroundColor: 'rgba(1, 5, 1, 0.85)',
    },
    modalWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    card: {
        width: 353,
        backgroundColor: colors.bgSemi,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        gap: 24,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: colors.primaryCTA,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    iconWrapper: {
        width: 40,
        height: 40,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
    title: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
        textAlign: 'center',
        width: 200,
        lineHeight: 20,
    },
    description: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
        textAlign: 'center',
        width: '100%',
        lineHeight: 18,
    },
    doneButton: {
        width: '100%',
        height: 56,
        borderRadius: 100,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.bg,
    },
});
