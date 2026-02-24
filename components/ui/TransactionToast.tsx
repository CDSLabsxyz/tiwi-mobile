import { colors } from '@/constants/colors';
import { ToastStatus, useToastStore } from '@/store/useToastStore';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STAKE_OR_CLAIM_STATUS: Record<ToastStatus, { label: string; color: string; icon: string }> = {
    pending: { label: 'Signature Required', color: '#FFB800', icon: 'signature' },
    confirmed: { label: 'Transaction Processing', color: '#3B82F6', icon: 'gear' },
    success: { label: 'Success', color: colors.primaryCTA, icon: 'check-circle' },
    error: { label: 'Transaction Failed', color: colors.error, icon: 'triangle-exclamation' },
};

export const TransactionToast = () => {
    const { visible, message, status, txHash, hideToast } = useToastStore();
    const insets = useSafeAreaInsets();

    if (!visible) return null;

    const currentStatus = STAKE_OR_CLAIM_STATUS[status];

    const openExplorer = () => {
        if (txHash) {
            Linking.openURL(`https://bscscan.com/tx/${txHash}`);
        }
    };

    return (
        <Animated.View
            entering={FadeInUp.duration(400).springify()}
            exiting={FadeOutUp.duration(300)}
            style={[styles.container, { top: insets.top + 10 }]}
        >
            <BlurView intensity={80} tint="dark" style={styles.blur}>
                <View style={[styles.content, { borderLeftColor: currentStatus.color }]}>
                    <View style={styles.iconContainer}>
                        {status === 'pending' || status === 'confirmed' ? (
                            <Animated.View>
                                <FontAwesome6 name={currentStatus.icon as any} size={20} color={currentStatus.color} />
                            </Animated.View>
                        ) : (
                            <FontAwesome6 name={currentStatus.icon as any} size={20} color={currentStatus.color} />
                        )}
                    </View>

                    <View style={styles.textContainer}>
                        <Text style={[styles.statusLabel, { color: currentStatus.color }]}>
                            {currentStatus.label}
                        </Text>
                        <Text style={styles.messageText}>{message}</Text>
                    </View>

                    {txHash && (
                        <TouchableOpacity onPress={openExplorer} style={styles.explorerButton}>
                            <FontAwesome6 name="arrow-up-right-from-square" size={14} color={colors.mutedText} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
                        <FontAwesome6 name="xmark" size={18} color={colors.mutedText} />
                    </TouchableOpacity>
                </View>
            </BlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 10000,
        borderRadius: 12,
        overflow: 'hidden',
    },
    blur: {
        width: '100%',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderLeftWidth: 4,
        backgroundColor: 'rgba(18, 23, 18, 0.6)',
    },
    iconContainer: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
        gap: 2,
    },
    statusLabel: {
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    messageText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    explorerButton: {
        padding: 8,
    },
    closeButton: {
        padding: 8,
        marginLeft: 4,
    },
});
