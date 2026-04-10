import { colors } from '@/constants/colors';
import { useWalletStore } from '@/store/walletStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Backup gate hook.
 *
 * Returns the active wallet's backup status, a `requireBackup()` function that
 * the caller invokes when an action would be blocked, and a `BackupRequiredModal`
 * JSX element that the caller renders inside its tree. The modal uses project
 * colors (no native Alert).
 *
 * External wallets and wallets imported from an existing seed don't need backup
 * (the user already has the source of truth elsewhere).
 */
export function useRequireBackup() {
    const router = useRouter();
    const activeGroupId = useWalletStore(s => s.activeGroupId);
    const walletGroups = useWalletStore(s => s.walletGroups);
    const [visible, setVisible] = useState(false);

    const activeGroup = walletGroups.find(g => g.id === activeGroupId);

    const needsBackup =
        !!activeGroup &&
        activeGroup.source === 'internal' &&
        activeGroup.type === 'mnemonic' &&
        !activeGroup.isBackupComplete;

    const isBackedUp = !needsBackup;

    const requireBackup = (): boolean => {
        if (isBackedUp) return true;
        setVisible(true);
        return false;
    };

    const handleBackupNow = () => {
        setVisible(false);
        router.push('/settings/accounts/backup-wallet' as any);
    };

    const BackupRequiredModal = (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => setVisible(false)}
        >
            <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
                <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.iconWrap}>
                        <Ionicons name="shield-checkmark" size={32} color={colors.primaryCTA} />
                    </View>
                    <Text style={styles.title}>Backup Required</Text>
                    <Text style={styles.body}>
                        You must back up your seed phrase before you can perform this action. This protects your funds if you lose access to your device.
                    </Text>
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={() => setVisible(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.confirmButton]}
                            onPress={handleBackupNow}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.confirmText}>Backup Now</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );

    return { isBackedUp, needsBackup, requireBackup, BackupRequiredModal };
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(1, 5, 1, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    card: {
        width: '100%',
        maxWidth: 353,
        backgroundColor: colors.bgCards,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        padding: 32,
        alignItems: 'center',
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(177, 241, 40, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    title: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: colors.titleText,
        textAlign: 'center',
        marginBottom: 8,
    },
    body: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: colors.bodyText,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
    },
    buttonRow: { flexDirection: 'row', gap: 12, width: '100%' },
    button: {
        flex: 1,
        height: 52,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    cancelText: { fontFamily: 'Manrope-Medium', fontSize: 15, color: colors.titleText },
    confirmButton: { backgroundColor: colors.primaryCTA },
    confirmText: { fontFamily: 'Manrope-Bold', fontSize: 15, color: colors.bg },
});
