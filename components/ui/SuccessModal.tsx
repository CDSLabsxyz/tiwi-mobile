import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type SuccessType = 'created' | 'imported' | 'connected';

interface SuccessModalProps {
    isVisible: boolean;
    onDone: () => void;
    type: SuccessType;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({ isVisible, onDone, type }) => {
    const getMessage = () => {
        switch (type) {
            case 'created':
                return {
                    title: 'Wallet Created Successfully!',
                    subtitle: 'Your new wallet is ready. Secure it with a passcode now.'
                };
            case 'imported':
                return {
                    title: 'Wallet Imported Successfully!',
                    subtitle: 'Your wallet data is synchronized. View your activity.'
                };
            case 'connected':
                return {
                    title: 'Wallet Connected Successfully!',
                    subtitle: 'External wallet is linked. Start your journey.'
                };
        }
    };

    const { title, subtitle } = getMessage();

    return (
        <Modal visible={isVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <View style={styles.successCard}>
                    <View style={styles.successIconWrapper}>
                        <View style={styles.circleIcon}>
                            <Ionicons name="checkmark" size={40} color={colors.primaryCTA} />
                        </View>
                    </View>
                    <Text style={styles.successTitle}>{title}</Text>
                    <Text style={styles.successSubtitle}>{subtitle}</Text>
                    <TouchableOpacity style={styles.doneButton} onPress={onDone}>
                        <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    successCard: {
        width: '100%',
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderColor: '#1F261E',
        borderRadius: 32,
        padding: 20,
        alignItems: 'center',
    },
    successIconWrapper: {
        marginTop: 24,
        marginBottom: 32,
    },
    circleIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: 'rgba(177, 241, 40, 0.1)',
        backgroundColor: 'rgba(177, 241, 40, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    successSubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: '#B5B5B5',
        textAlign: 'center',
        marginBottom: 40,
        paddingHorizontal: 20,
    },
    doneButton: {
        width: '100%',
        backgroundColor: colors.primaryCTA,
        height: 54,
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    doneButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: '#010501',
    },
});
