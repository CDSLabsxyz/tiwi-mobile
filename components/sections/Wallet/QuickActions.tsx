/**
 * Quick Actions Component
 * Four action buttons: Send, Receive, Pay, Activities
 * Converted from Tailwind to StyleSheet
 */

import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const SendIcon = require('../../../assets/wallet/navigation-03.svg');
const ReceiveIcon = require('../../../assets/wallet/download-04.svg');
const PayIcon = require('../../../assets/wallet/payment-02.svg');
const ActivitiesIcon = require('../../../assets/wallet/transaction-history.svg');

interface QuickActionsProps {
    onSendPress?: () => void;
    onReceivePress?: () => void;
    onPayPress?: () => void;
    onActivitiesPress?: () => void;
}

/**
 * Quick Actions - Four action buttons in a row
 */
export const QuickActions: React.FC<QuickActionsProps> = ({
    onSendPress,
    onReceivePress,
    onPayPress,
    onActivitiesPress,
}) => {
    const actions = [
        {
            icon: SendIcon,
            label: 'Send',
            onPress: onSendPress,
            width: 50,
        },
        {
            icon: ReceiveIcon,
            label: 'Receive',
            onPress: onReceivePress,
            width: 56,
        },
        {
            icon: PayIcon,
            label: 'Pay',
            onPress: onPayPress,
            width: 50,
        },
        {
            icon: ActivitiesIcon,
            label: 'Activities',
            onPress: onActivitiesPress,
            width: 60.5,
        },
    ];

    return (
        <View style={styles.container}>
            {actions.map((action, index) => (
                <TouchableOpacity
                    key={index}
                    activeOpacity={0.8}
                    onPress={action.onPress}
                    style={[styles.actionButton]}
                >
                    {/* Icon Container */}
                    <View style={styles.iconContainer}>
                        <View style={styles.iconWrapper}>
                            <Image
                                source={action.icon}
                                style={styles.iconFull}
                                contentFit="contain"
                            />
                        </View>
                    </View>

                    {/* Label */}
                    <Text style={styles.label}>
                        {action.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        width: '100%',
        paddingVertical: 0,
    },
    actionButton: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    iconContainer: {
        backgroundColor: colors.bgCards,
        padding: 8,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapper: {
        width: 24,
        height: 24,
    },
    iconFull: {
        width: '100%',
        height: '100%',
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        textAlign: 'center',
    },
});
