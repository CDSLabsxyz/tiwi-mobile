/**
 * Recipient ("To") address sheet — port of the web app's to-address flow
 * (components/swap/to-address-modal.tsx).
 *
 * Lets the user send the OUTPUT of a swap to an address other than their own.
 * That is what makes true cross-chain swapping usable on mobile: the wallet may
 * have no address on the destination chain at all, and without a recipient the
 * engine's cross-VM guard refuses the swap outright (delivering to a source-VM
 * address on a different VM is unrecoverable).
 *
 * The address is validated against the DESTINATION chain's family before it can
 * be saved, so a Solana address can't be pasted for an EVM payout.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/constants/colors';
import { addressKeyForChain } from '@/services/swap/core/platform/wallet-context';
import { isAddressChainCompatible } from '@/services/swap/core/utils/wallet-display';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SelectionBottomSheet } from './SelectionBottomSheet';

const RECENT_KEY = 'tiwi_recent_recipient_addresses';
const MAX_RECENT = 5;

export interface RecipientAddressSheetProps {
    visible: boolean;
    onClose: () => void;
    /** Called with the address to use, or null to fall back to your own wallet. */
    onSave: (address: string | null) => void;
    /** Currently applied recipient, if the user set one. */
    currentAddress?: string | null;
    /** Destination chain — the address is validated against this. */
    toChainId?: number;
    /** Destination chain name, for copy. */
    toChainName?: string;
}

export function truncateAddress(addr: string, lead = 6, tail = 4): string {
    if (!addr) return '';
    if (addr.length <= lead + tail + 3) return addr;
    return `${addr.slice(0, lead)}...${addr.slice(-tail)}`;
}

export const RecipientAddressSheet: React.FC<RecipientAddressSheetProps> = ({
    visible,
    onClose,
    onSave,
    currentAddress,
    toChainId,
    toChainName,
}) => {
    const [value, setValue] = useState('');
    const [recent, setRecent] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const walletGroups = useWalletStore((s) => s.walletGroups);
    const activeGroupId = useWalletStore((s) => s.activeGroupId);
    const addressNicknames = useWalletStore((s) => s.addressNicknames);
    const whitelistedAddresses = useSecurityStore((s) => s.whitelistedAddresses);

    /**
     * Every wallet on this device that can actually receive on the destination
     * chain — same source the Send screen's address book uses (walletGroups ×
     * their per-chain addresses), narrowed to the one key this chain uses.
     *
     * Narrowed deliberately: listing a wallet's Solana address as an option for
     * a BNB payout is a trap, since it could never be a valid destination.
     */
    const deviceWallets = useMemo(() => {
        if (!toChainId) return [];
        const key = addressKeyForChain(toChainId);
        const seen = new Set<string>();
        const out: { name: string; address: string; isActive: boolean }[] = [];

        for (const g of walletGroups) {
            const addr = (g.addresses as Record<string, string | undefined>)?.[key];
            if (!addr) continue;
            const lower = addr.toLowerCase();
            if (seen.has(lower)) continue;
            seen.add(lower);
            out.push({
                name: addressNicknames[lower] ?? g.name,
                address: addr,
                isActive: g.id === activeGroupId,
            });
        }
        // Active wallet first — it's the default destination.
        return [...out.filter((w) => w.isActive), ...out.filter((w) => !w.isActive)];
    }, [walletGroups, activeGroupId, addressNicknames, toChainId]);

    /** Saved address-book contacts that are valid on the destination chain. */
    const savedContacts = useMemo(() => {
        const mine = new Set(deviceWallets.map((w) => w.address.toLowerCase()));
        return whitelistedAddresses.filter(
            (c) =>
                !mine.has(c.address.toLowerCase()) &&
                (!toChainId || isAddressChainCompatible(c.address, toChainId)),
        );
    }, [whitelistedAddresses, deviceWallets, toChainId]);

    /**
     * Recents minus anything already listed above, and minus anything invalid
     * for this chain — a recent EVM address is meaningless on a Solana payout.
     */
    const recentOnly = useMemo(() => {
        const shown = new Set([
            ...deviceWallets.map((w) => w.address.toLowerCase()),
            ...savedContacts.map((c) => c.address.toLowerCase()),
        ]);
        return recent.filter(
            (a) =>
                !shown.has(a.toLowerCase()) &&
                (!toChainId || isAddressChainCompatible(a, toChainId)),
        );
    }, [recent, deviceWallets, savedContacts, toChainId]);

    useEffect(() => {
        if (!visible) return;
        setValue(currentAddress || '');
        setError(null);
        AsyncStorage.getItem(RECENT_KEY)
            .then((raw) => {
                if (!raw) return;
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setRecent(parsed.slice(0, MAX_RECENT));
            })
            .catch(() => { /* recents are a convenience, never block on them */ });
    }, [visible, currentAddress]);

    const handlePaste = useCallback(async () => {
        try {
            const text = await Clipboard.getStringAsync();
            if (text) {
                setValue(text.trim());
                setError(null);
            }
        } catch {
            setError('Could not read the clipboard.');
        }
    }, []);

    const commit = useCallback(async (address: string) => {
        const trimmed = address.trim();
        if (!trimmed) return;

        // Validate against the DESTINATION chain, not just "looks like an
        // address" — sending to a well-formed address of the wrong family is
        // unrecoverable.
        if (toChainId && !isAddressChainCompatible(trimmed, toChainId)) {
            setError(`That is not a valid ${toChainName || 'destination chain'} address.`);
            return;
        }

        try {
            const next = [trimmed, ...recent.filter((a) => a !== trimmed)].slice(0, MAX_RECENT);
            setRecent(next);
            await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch { /* ignore storage errors */ }

        onSave(trimmed);
        setValue('');
        setError(null);
        onClose();
    }, [recent, toChainId, toChainName, onSave, onClose]);

    const useOwnWallet = useCallback(() => {
        onSave(null);
        setValue('');
        setError(null);
        onClose();
    }, [onSave, onClose]);

    return (
        <SelectionBottomSheet visible={visible} title="Switch To" onClose={onClose}>
            <View style={styles.container}>
                <Text style={styles.label}>
                    {toChainName
                        ? `Switch where the ${toChainName} tokens land.`
                        : 'Switch where the swapped tokens land.'}
                </Text>

                <View style={[styles.inputRow, !!error && styles.inputRowError]}>
                    <TextInput
                        style={styles.input}
                        value={value}
                        onChangeText={(t) => { setValue(t); setError(null); }}
                        placeholder={toChainName ? `${toChainName} address` : 'Recipient address'}
                        placeholderTextColor={colors.mutedText}
                        autoCapitalize="none"
                        autoCorrect={false}
                        multiline
                    />
                    <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
                        <Ionicons name="clipboard-outline" size={16} color={colors.primaryCTA} />
                        <Text style={styles.pasteText}>Paste</Text>
                    </TouchableOpacity>
                </View>

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <ScrollView
                    style={styles.list}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Every wallet on this device that can receive on the
                        destination chain — same source as the Send screen's
                        address book. */}
                    {deviceWallets.length > 0 && (
                        <>
                            <Text style={styles.sectionLabel}>MY WALLETS</Text>
                            {deviceWallets.map((w) => {
                                const isSelected = currentAddress
                                    ? currentAddress.toLowerCase() === w.address.toLowerCase()
                                    : w.isActive;
                                return (
                                    <Pressable
                                        key={w.address}
                                        style={styles.optionRow}
                                        onPress={() => (w.isActive ? useOwnWallet() : commit(w.address))}
                                    >
                                        <Ionicons name="wallet-outline" size={18} color={colors.primaryCTA} />
                                        <View style={styles.optionTextWrap}>
                                            <Text style={styles.optionTitle} numberOfLines={1}>
                                                {w.name}
                                                {w.isActive ? '  ·  Active' : ''}
                                            </Text>
                                            <Text style={styles.optionSub}>{truncateAddress(w.address, 10, 6)}</Text>
                                        </View>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={20} color={colors.primaryCTA} />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </>
                    )}

                    {savedContacts.length > 0 && (
                        <>
                            <Text style={styles.sectionLabel}>SAVED ADDRESSES</Text>
                            {savedContacts.map((c) => (
                                <Pressable key={c.address} style={styles.optionRow} onPress={() => commit(c.address)}>
                                    <Ionicons name="person-outline" size={18} color={colors.bodyText} />
                                    <View style={styles.optionTextWrap}>
                                        <Text style={styles.optionTitle} numberOfLines={1}>{c.name}</Text>
                                        <Text style={styles.optionSub}>{truncateAddress(c.address, 10, 6)}</Text>
                                    </View>
                                    {currentAddress?.toLowerCase() === c.address.toLowerCase() && (
                                        <Ionicons name="checkmark-circle" size={20} color={colors.primaryCTA} />
                                    )}
                                </Pressable>
                            ))}
                        </>
                    )}

                    {recentOnly.length > 0 && (
                        <>
                            <Text style={styles.sectionLabel}>RECENT</Text>
                            {recentOnly.map((addr) => (
                                <Pressable key={addr} style={styles.optionRow} onPress={() => commit(addr)}>
                                    <Ionicons name="time-outline" size={18} color={colors.mutedText} />
                                    <View style={styles.optionTextWrap}>
                                        <Text style={styles.optionSub}>{truncateAddress(addr, 12, 8)}</Text>
                                    </View>
                                    {currentAddress?.toLowerCase() === addr.toLowerCase() && (
                                        <Ionicons name="checkmark-circle" size={20} color={colors.primaryCTA} />
                                    )}
                                </Pressable>
                            ))}
                        </>
                    )}

                    {/* Nothing to pick from — the wallet has no key on this
                        chain and no saved address fits it. Pasting is the way. */}
                    {deviceWallets.length === 0 && savedContacts.length === 0 && recentOnly.length === 0 && (
                        <Text style={styles.emptyText}>
                            No wallet on this device can receive on {toChainName || 'this network'}.
                            Paste a destination address above.
                        </Text>
                    )}
                </ScrollView>

                <TouchableOpacity
                    style={[styles.saveButton, !value.trim() && styles.saveButtonDisabled]}
                    disabled={!value.trim()}
                    onPress={() => commit(value)}
                >
                    <Text style={styles.saveButtonText}>Switch to this address</Text>
                </TouchableOpacity>
            </View>
        </SelectionBottomSheet>
    );
};

const styles = StyleSheet.create({
    container: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
    label: { color: colors.bodyText, fontSize: 13 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    inputRowError: { borderColor: colors.error },
    input: { flex: 1, color: colors.titleText, fontSize: 13, minHeight: 40 },
    pasteButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 },
    pasteText: { color: colors.primaryCTA, fontSize: 12, fontWeight: '600' },
    errorText: { color: colors.error, fontSize: 12 },
    list: { maxHeight: 320 },
    sectionLabel: {
        color: colors.mutedText,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.6,
        marginTop: 12,
        marginBottom: 6,
    },
    emptyText: { color: colors.mutedText, fontSize: 12, lineHeight: 18, paddingVertical: 12 },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.bgSemi,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        marginBottom: 8,
    },
    optionTextWrap: { flex: 1 },
    optionTitle: { color: colors.titleText, fontSize: 13, fontWeight: '600' },
    optionSub: { color: colors.mutedText, fontSize: 12 },
    saveButton: {
        backgroundColor: colors.primaryCTA,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    saveButtonDisabled: { opacity: 0.4 },
    saveButtonText: { color: '#000', fontSize: 14, fontWeight: '700' },
});

export default RecipientAddressSheet;
