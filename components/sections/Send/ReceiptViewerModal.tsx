/**
 * ReceiptViewerModal
 *
 * Modal wrapper around <TransactionReceiptCard> so a past Sent activity can
 * re-open its receipt and reuse the existing Share-as-PNG / Share-as-PDF
 * flows. The card component is unchanged.
 */

import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionReceipt, TransactionReceiptCard } from './TransactionReceiptCard';

interface Props {
    visible: boolean;
    receipt: TransactionReceipt | null;
    onClose: () => void;
}

export const ReceiptViewerModal: React.FC<Props> = ({ visible, receipt, onClose }) => {
    const { top } = useSafeAreaInsets();

    return (
        <Modal
            visible={visible && !!receipt}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { paddingTop: top }]}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Transaction Receipt</Text>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="close" size={24} color={colors.titleText} />
                    </TouchableOpacity>
                </View>
                {receipt && (
                    <TransactionReceiptCard receipt={receipt} onDone={onClose} />
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 12,
    },
    headerTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    closeButton: {
        padding: 4,
    },
});
