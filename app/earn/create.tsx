/**
 * Create Staking Pool Screen
 *
 * Thin screen wrapper around the shared <StakingPoolCreator/> (web-parity form).
 * The same component also renders inline under the Earn tab's "Create Pool"
 * sub-tab - this route is the full-screen entry point used by the
 * "Create Staking Pool" card.
 */

import { StakingPoolCreator } from '@/components/sections/Earn';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useWalletStore } from '@/store/walletStore';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CreatePoolScreen() {
    const { top } = useSafeAreaInsets();
    const router = useRouter();
    // Handed to the form so it can lift the edited field above the numpad.
    const scrollRef = useRef<ScrollView>(null);
    const { address, walletGroups, activeGroupId } = useWalletStore();

    // EVM-only flow - resolve the active group's EVM address.
    const evmAddress = useMemo(() => {
        const group = walletGroups.find(g => g.id === activeGroupId);
        return group?.addresses?.EVM || address || null;
    }, [walletGroups, activeGroupId, address]);

    return (
        <View style={[styles.container, { paddingTop: top }]}>
            <CustomStatusBar />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backTxt}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create Staking Pool</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView ref={scrollRef} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                    <StakingPoolCreator
                        activeWalletAddress={evmAddress}
                        onConnectEvmWallet={() => useWalletStore.getState().setWalletModalVisible(true)}
                        onViewPools={() => router.replace('/earn?tab=my-pools' as any)}
                        onCreationSuccessOk={() => router.replace('/earn' as any)}
                        scrollRef={scrollRef}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backTxt: { color: colors.titleText, fontSize: 30, lineHeight: 30 },
    headerTitle: { color: colors.titleText, fontSize: 17, fontWeight: '600' },
    body: { paddingHorizontal: 16, paddingBottom: 48 },
});
