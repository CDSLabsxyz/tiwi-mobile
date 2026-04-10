/**
 * Price Alerts settings screen.
 *
 * Controls server-side price-alert pushes (the cron in Supabase that fires
 * even when the app is closed). Persists to the `price_alert_settings`
 * table keyed on the active wallet address.
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useWalletStore } from '@/store/walletStore';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const THRESHOLD_PRESETS = [1, 3, 5, 10] as const;
const COOLDOWN_PRESETS = [
    { label: '15 min', value: 15 },
    { label: '1 hour', value: 60 },
    { label: '6 hours', value: 360 },
    { label: '24 hours', value: 1440 },
] as const;

export default function PriceAlertsScreen() {
    const { bottom } = useSafeAreaInsets();
    const activeAddress = useWalletStore((s) => s.activeAddress);
    const wallet = activeAddress?.toLowerCase() || '';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enabled, setEnabled] = useState(true);
    const [threshold, setThreshold] = useState<number>(3);
    const [cooldown, setCooldown] = useState<number>(60);

    // Load existing settings on mount
    useEffect(() => {
        if (!wallet) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const { data, error } = await supabase
                    .from('price_alert_settings')
                    .select('enabled, threshold_percent, cooldown_minutes')
                    .eq('user_wallet', wallet)
                    .maybeSingle();
                if (cancelled) return;
                if (error) {
                    console.warn('[PriceAlerts] load error:', error.message);
                } else if (data) {
                    setEnabled(!!data.enabled);
                    setThreshold(Number(data.threshold_percent) || 3);
                    setCooldown(Number(data.cooldown_minutes) || 60);
                }
            } catch (e) {
                console.warn('[PriceAlerts] load exception:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [wallet]);

    const persist = async (patch: { enabled?: boolean; threshold_percent?: number; cooldown_minutes?: number }) => {
        if (!wallet) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('price_alert_settings')
                .upsert(
                    {
                        user_wallet: wallet,
                        enabled: patch.enabled ?? enabled,
                        threshold_percent: patch.threshold_percent ?? threshold,
                        cooldown_minutes: patch.cooldown_minutes ?? cooldown,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'user_wallet' },
                );
            if (error) console.warn('[PriceAlerts] save error:', error.message);
        } catch (e) {
            console.warn('[PriceAlerts] save exception:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = (value: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEnabled(value);
        persist({ enabled: value });
    };

    const handleThreshold = (value: number) => {
        Haptics.selectionAsync();
        setThreshold(value);
        persist({ threshold_percent: value });
    };

    const handleCooldown = (value: number) => {
        Haptics.selectionAsync();
        setCooldown(value);
        persist({ cooldown_minutes: value });
    };

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="Price Alerts" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: (bottom || 16) + 24 }]}
                showsVerticalScrollIndicator={false}
            >
                {!wallet && (
                    <Text style={styles.warning}>
                        Connect a wallet to configure price alerts.
                    </Text>
                )}

                {loading ? (
                    <View style={styles.loader}><ActivityIndicator color={colors.primaryCTA} /></View>
                ) : (
                    <>
                        {/* Master toggle */}
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <ThemedText style={styles.rowLabel}>Enable Price Alerts</ThemedText>
                                <ThemedText style={styles.rowSub}>
                                    Get a push when one of your tokens moves significantly — even when the app is closed.
                                </ThemedText>
                            </View>
                            <ToggleSwitch value={enabled} onValueChange={handleToggle} />
                        </View>

                        <View style={styles.divider} />

                        {/* Threshold */}
                        <ThemedText style={styles.sectionLabel}>Alert threshold</ThemedText>
                        <ThemedText style={styles.sectionSub}>
                            Notify me when a token's price changes by at least:
                        </ThemedText>
                        <View style={styles.chipRow}>
                            {THRESHOLD_PRESETS.map((p) => {
                                const active = threshold === p;
                                return (
                                    <TouchableOpacity
                                        key={p}
                                        activeOpacity={0.8}
                                        onPress={() => handleThreshold(p)}
                                        disabled={!enabled}
                                        style={[
                                            styles.chip,
                                            active && styles.chipActive,
                                            !enabled && styles.chipDisabled,
                                        ]}
                                    >
                                        <Text style={[
                                            styles.chipText,
                                            active && styles.chipTextActive,
                                        ]}>
                                            {p}%
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.divider} />

                        {/* Cooldown */}
                        <ThemedText style={styles.sectionLabel}>Cooldown</ThemedText>
                        <ThemedText style={styles.sectionSub}>
                            Minimum time between alerts for the same token.
                        </ThemedText>
                        <View style={styles.chipRow}>
                            {COOLDOWN_PRESETS.map((p) => {
                                const active = cooldown === p.value;
                                return (
                                    <TouchableOpacity
                                        key={p.value}
                                        activeOpacity={0.8}
                                        onPress={() => handleCooldown(p.value)}
                                        disabled={!enabled}
                                        style={[
                                            styles.chip,
                                            active && styles.chipActive,
                                            !enabled && styles.chipDisabled,
                                        ]}
                                    >
                                        <Text style={[
                                            styles.chipText,
                                            active && styles.chipTextActive,
                                        ]}>
                                            {p.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {saving && (
                            <Text style={styles.savingText}>Saving…</Text>
                        )}

                        <View style={styles.infoBox}>
                            <Text style={styles.infoText}>
                                Price alerts watch every token in your wallet. We compare against the last price you were notified about, so big swings will alert you before small wiggles.
                            </Text>
                        </View>
                    </>
                )}
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingTop: 24, paddingHorizontal: 20, gap: 20 },
    loader: { paddingTop: 60, alignItems: 'center' },
    warning: {
        color: '#FF9900',
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        textAlign: 'center',
        padding: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        padding: 16,
        gap: 12,
    },
    rowLabel: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: colors.titleText },
    rowSub: { fontFamily: 'Manrope-Regular', fontSize: 12, color: colors.bodyText, marginTop: 4, lineHeight: 18 },
    divider: { height: 1, backgroundColor: colors.bgStroke, marginVertical: 4 },
    sectionLabel: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: colors.titleText, marginTop: 4 },
    sectionSub: { fontFamily: 'Manrope-Regular', fontSize: 12, color: colors.bodyText, marginTop: 2, marginBottom: 12 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 100,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    chipActive: {
        backgroundColor: 'rgba(177, 241, 40, 0.12)',
        borderColor: colors.primaryCTA,
    },
    chipDisabled: { opacity: 0.5 },
    chipText: { fontFamily: 'Manrope-Medium', fontSize: 14, color: colors.titleText },
    chipTextActive: { color: colors.primaryCTA },
    savingText: { fontFamily: 'Manrope-Regular', fontSize: 12, color: colors.mutedText, textAlign: 'center', marginTop: 8 },
    infoBox: {
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        marginTop: 8,
    },
    infoText: { fontFamily: 'Manrope-Regular', fontSize: 12, color: colors.bodyText, lineHeight: 20 },
});
