/**
 * Quick Actions Component
 * Four action buttons: Send, Receive, Pay, Activities
 */

import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useLocalization';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const SendIcon = require("@/assets/wallet/navigation-03.svg");
const ReceiveIcon = require("@/assets/wallet/download-04.svg");
const PayIcon = require("@/assets/home/more/payment-02.svg");
const ActivitiesIcon = require("@/assets/home/transaction-history.svg");

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
    const { t } = useTranslation();

    const actions = [
        {
            icon: SendIcon,
            label: t('nav.send'),
            onPress: onSendPress,
        },
        {
            icon: ReceiveIcon,
            label: t('nav.receive'),
            onPress: onReceivePress,
        },
        {
            icon: PayIcon,
            label: t('nav.pay'),
            onPress: onPayPress,
        },
        {
            icon: ActivitiesIcon,
            label: t('nav.activities'),
            onPress: onActivitiesPress,
        },
    ];

    return (
        <View style={styles.container}>
            {actions.map((action, index) => (
                <TouchableOpacity
                    key={index}
                    activeOpacity={0.8}
                    onPress={action.onPress}
                    style={styles.actionItem}
                >
                    {/* <Image
                                source={action.icon}
                                style={styles.fullSize}
                                contentFit="contain"
                                tintColor={colors.titleText}
                            /> */}
                    {/* Icon Container */}
                    <View style={styles.iconContainer}>
                        <View style={styles.iconWrapper}>
                            <Image
                                source={action.icon}
                                style={styles.fullSize}
                                contentFit="contain"
                            // tintColor={colors.titleText}
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
        width: '100%',
        paddingHorizontal: 20,
    },
    actionItem: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    iconContainer: {
        backgroundColor: colors.bgCards,
        padding: 10,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 48,
    },
    iconWrapper: {
        width: 24,
        height: 24,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        textAlign: 'center',
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
