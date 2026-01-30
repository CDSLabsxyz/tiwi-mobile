import { colors } from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface OrderItemProps {
    symbol: string;
    side: 'long' | 'short';
    type: string;
    price: string;
    amount: string;
    filled: string;
    time: string;
    onCancel?: () => void;
}

export const OrderItem: React.FC<OrderItemProps> = (props) => {
    const sideColor = props.side === 'long' ? colors.success : colors.error;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.left}>
                    <View style={[styles.sideBadge, { backgroundColor: sideColor + '20' }]}>
                        <Text style={[styles.sideText, { color: sideColor }]}>{props.side.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.symbolText}>{props.symbol}</Text>
                    <Text style={styles.typeTag}>{props.type}</Text>
                </View>
                <TouchableOpacity onPress={props.onCancel} style={styles.cancelBtn}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.details}>
                <View style={styles.col}>
                    <Text style={styles.label}>Price</Text>
                    <Text style={styles.value}>{props.price}</Text>
                </View>
                <View style={styles.col}>
                    <Text style={styles.label}>Amount</Text>
                    <Text style={styles.value}>{props.amount}</Text>
                </View>
                <View style={[styles.col, { alignItems: 'flex-end' }]}>
                    <Text style={styles.label}>Filled</Text>
                    <Text style={styles.value}>{props.filled}</Text>
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.timeText}>{props.time}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sideBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    sideText: {
        fontFamily: 'Manrope-ExtraBold',
        fontSize: 10,
    },
    cancelBtn: {
        padding: 4,
    },
    symbolText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.titleText,
    },
    typeTag: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
        backgroundColor: colors.bgStroke,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    cancelText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
        color: colors.error,
    },
    details: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    col: {
        flex: 1,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        color: colors.mutedText,
        marginBottom: 2,
    },
    value: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: colors.titleText,
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
        paddingTop: 8,
        marginTop: 4,
    },
    timeText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
    },
});
