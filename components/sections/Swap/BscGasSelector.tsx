/**
 * BSC gas-token selector - React Native port of the web's bsc-gas-selector.
 *
 * On BSC the user chooses which token the protocol fee (and, on the relayer
 * paths, the gas) is denominated in. The choice is not cosmetic:
 *
 *   TWC   → 0.20% - cheapest tier
 *   BNB   → 0.25% - standard; the user pays their own BNB gas
 *   Other → 0.30% - any BEP-20, gas deducted by the relayer
 *
 * The tier is sent with the quote request (the routing engine prices the fee
 * server-side) AND read back by the executors at execution time, so quoting and
 * settling always agree. Only rendered when the source chain is BSC.
 */

import { colors } from '@/constants/colors';
import { BASIS_POINTS, GasTokenType, TAX_RATES } from '@/services/swap/core/config/tax-config';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

export interface GasTokenOption {
    type: GasTokenType;
    symbol: string;
    name: string;
    taxBps: number;
    /** Short label shown on the right of the row. */
    tier: string;
    icon?: string;
    recommended?: boolean;
}

const TWC_ICON =
    'https://cdn.dexscreener.com/cms/images/c135d9cc87d8db4c1e74788c546ed3c7c4498a5da693cbefdc30e749cbea4843?width=800&height=800&quality=90';
const BNB_ICON =
    'https://assets.coingecko.com/coins/images/825/small/binance-coin-logo.png?1547034615';

export const GAS_TOKEN_OPTIONS: GasTokenOption[] = [
    {
        type: GasTokenType.TWC,
        symbol: 'TWC',
        name: 'TIWICAT',
        taxBps: TAX_RATES.BSC_TWC,
        tier: 'Recommended',
        icon: TWC_ICON,
        recommended: true,
    },
    {
        type: GasTokenType.BNB,
        symbol: 'BNB',
        name: 'BNB (Native)',
        taxBps: TAX_RATES.BSC_BNB,
        tier: 'Standard',
        icon: BNB_ICON,
    },
    {
        type: GasTokenType.OTHER_BSC,
        symbol: 'Other',
        name: 'Other Token',
        taxBps: TAX_RATES.BSC_OTHER,
        tier: 'Flexible',
    },
];

function formatBps(bps: number): string {
    return `${((bps / BASIS_POINTS) * 100).toFixed(2)}%`;
}

export interface BscGasSelectorProps {
    selectedType: GasTokenType;
    onSelectType: (type: GasTokenType) => void;
    /** Set when the OTHER_BSC tier has a specific BEP-20 chosen. */
    selectedToken?: { symbol: string; name?: string; icon?: string } | null;
    /** Opens the token picker for the "Other" tier. */
    onPickOtherToken?: () => void;
}

export function BscGasSelector({
    selectedType,
    onSelectType,
    selectedToken,
    onPickOtherToken,
}: BscGasSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const base =
        GAS_TOKEN_OPTIONS.find((o) => o.type === selectedType) ?? GAS_TOKEN_OPTIONS[1];

    // The OTHER tier shows the actual token the user picked, not "Other".
    const selected =
        selectedType === GasTokenType.OTHER_BSC && selectedToken
            ? { ...base, symbol: selectedToken.symbol, name: selectedToken.name ?? base.name, icon: selectedToken.icon }
            : base;

    const handleSelect = (option: GasTokenOption) => {
        setIsOpen(false);
        if (option.type === GasTokenType.OTHER_BSC) {
            // Needs a concrete token before the tier means anything.
            onPickOtherToken?.();
            return;
        }
        onSelectType(option.type);
    };

    return (
        <View style={styles.container}>
            <View style={styles.labelRow}>
                <Ionicons name="flame-outline" size={14} color={colors.primaryCTA} />
                <Text style={styles.label}>Choose How You Pay</Text>
                <Text style={styles.byline}>BY TIWI PROTOCOL</Text>
            </View>

            <Pressable style={styles.trigger} onPress={() => setIsOpen((v) => !v)}>
                <View style={styles.triggerLeft}>
                    {selected.icon ? (
                        <Image source={{ uri: selected.icon }} style={styles.icon} />
                    ) : (
                        <View style={[styles.icon, styles.iconFallback]}>
                            <Ionicons name="ellipse-outline" size={16} color={colors.mutedText} />
                        </View>
                    )}
                    <View>
                        <View style={styles.symbolRow}>
                            <Text style={styles.symbol}>{selected.symbol}</Text>
                            {selected.recommended && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>RECOMMENDED</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.feeText}>{formatBps(selected.taxBps)} protocol fee</Text>
                    </View>
                </View>

                <View style={styles.triggerRight}>
                    <Text style={styles.tier}>{selected.tier}</Text>
                    <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.bodyText}
                    />
                </View>
            </Pressable>

            {isOpen && (
                <View style={styles.dropdown}>
                    {GAS_TOKEN_OPTIONS.map((option) => {
                        const isSelected = option.type === selectedType;
                        const display =
                            option.type === GasTokenType.OTHER_BSC && selectedToken && isSelected
                                ? { ...option, symbol: selectedToken.symbol, icon: selectedToken.icon }
                                : option;

                        return (
                            <Pressable
                                key={option.type}
                                style={[styles.option, isSelected && styles.optionSelected]}
                                onPress={() => handleSelect(option)}
                            >
                                <View style={styles.triggerLeft}>
                                    {display.icon ? (
                                        <Image source={{ uri: display.icon }} style={styles.icon} />
                                    ) : (
                                        <View style={[styles.icon, styles.iconFallback]}>
                                            <Ionicons name="ellipse-outline" size={16} color={colors.mutedText} />
                                        </View>
                                    )}
                                    <View>
                                        <View style={styles.symbolRow}>
                                            <Text style={styles.symbol}>
                                                {option.type === GasTokenType.OTHER_BSC && !isSelected
                                                    ? 'Other Token →'
                                                    : display.symbol}
                                            </Text>
                                            {option.recommended && (
                                                <View style={styles.badge}>
                                                    <Text style={styles.badgeText}>RECOMMENDED</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.feeText}>
                                            {formatBps(option.taxBps)} protocol fee
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.tier, !isSelected && styles.tierMuted]}>
                                    {option.tier}
                                </Text>
                            </Pressable>
                        );
                    })}

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            TIWI handles the network complexity so you can focus on your trade.
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { width: '100%' },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 },
    label: { color: colors.bodyText, fontSize: 13, fontWeight: '500' },
    byline: { color: colors.mutedText, fontSize: 9, marginLeft: 'auto', letterSpacing: 0.6, fontWeight: '700' },
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 12,
        padding: 12,
    },
    triggerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
    triggerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    icon: { width: 32, height: 32, borderRadius: 16 },
    iconFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgStroke },
    symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    symbol: { color: colors.titleText, fontSize: 14, fontWeight: '600' },
    feeText: { color: colors.mutedText, fontSize: 11, marginTop: 2 },
    badge: { backgroundColor: 'rgba(177,241,40,0.16)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
    badgeText: { color: colors.primaryCTA, fontSize: 8, fontWeight: '800' },
    tier: { color: colors.primaryCTA, fontSize: 12, fontWeight: '600' },
    tierMuted: { color: colors.mutedText },
    dropdown: {
        marginTop: 8,
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 12,
        overflow: 'hidden',
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.bgStroke,
    },
    optionSelected: {
        backgroundColor: 'rgba(177,241,40,0.08)',
        borderLeftWidth: 3,
        borderLeftColor: colors.primaryCTA,
    },
    footer: { padding: 12, borderTopWidth: 1, borderTopColor: colors.bgStroke, backgroundColor: colors.bg },
    footerText: { color: colors.mutedText, fontSize: 11, lineHeight: 16 },
});

export default BscGasSelector;
