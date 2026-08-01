/**
 * Unwrap bottom sheet.
 *
 * One job, stated bluntly: turn a wrapped token back into the chain's native
 * coin. There is no destination picker — the output is always the native coin,
 * 1:1. Solana can only close the whole wSOL account, so the amount is locked to
 * the full balance there and the sheet says so.
 */

import { colors } from '@/constants/colors';
import type { WrappedNativeInfo } from '@/constants/wrappedNatives';
import { useUnwrap } from '@/hooks/useUnwrap';
import { getTokenLogo } from '@/services/tokenLogoService';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { formatUnits, parseUnits } from 'viem';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Linking,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface UnwrapSheetProps {
    visible: boolean;
    /** `null` renders nothing — lets callers mount the sheet unconditionally. */
    info: WrappedNativeInfo | null;
    /** Logo of the wrapped token, when the caller already has one. */
    logoURI?: string;
    onClose: () => void;
}

/** Explorer roots for the chains we can unwrap on. Absent → no link is shown. */
const EXPLORERS: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    56: 'https://bscscan.com/tx/',
    137: 'https://polygonscan.com/tx/',
    42161: 'https://arbiscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
    43114: 'https://snowtrace.io/tx/',
    59144: 'https://lineascan.build/tx/',
    534352: 'https://scrollscan.com/tx/',
    81457: 'https://blastscan.io/tx/',
    324: 'https://explorer.zksync.io/tx/',
    5000: 'https://explorer.mantle.xyz/tx/',
    100: 'https://gnosisscan.io/tx/',
    250: 'https://ftmscan.com/tx/',
    25: 'https://cronoscan.com/tx/',
    1284: 'https://moonscan.io/tx/',
    1329: 'https://seitrace.com/tx/',
    999: 'https://hyperevmscan.io/tx/',
    80094: 'https://berascan.com/tx/',
    146: 'https://sonicscan.org/tx/',
    130: 'https://uniscan.xyz/tx/',
    480: 'https://worldscan.org/tx/',
    1116: 'https://scan.coredao.org/tx/',
    2020: 'https://app.roninchain.com/tx/',
    7565164: 'https://solscan.io/tx/',
};

/** Middle-truncate a tx hash: 0xf72a41b8…9d786558 */
function shortenHash(hash: string): string {
    return hash.length > 24 ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : hash;
}

/** Cycled in the CTA while the tx is in flight, in place of a bare spinner. */
const PENDING_PHRASES = [
    'Unwrapping…',
    'Tiwiculating…',
    'Transforming…',
    'Almost there…',
];

const PERCENT_PRESETS = [
    { value: 25, label: '25%' },
    { value: 50, label: '50%' },
    { value: 75, label: '75%' },
    { value: 100, label: 'Max' },
] as const;

/** Trim a full-precision decimal string for display without lying about it. */
function trimAmount(value: string, maxDecimals = 8): string {
    if (!value.includes('.')) return value;
    const [whole, frac] = value.split('.');
    const cut = frac.slice(0, maxDecimals).replace(/0+$/, '');
    return cut ? `${whole}.${cut}` : whole;
}

export const UnwrapSheet: React.FC<UnwrapSheetProps> = ({ visible, info, logoURI, onClose }) => {
    const { bottom } = useSafeAreaInsets();
    const isSolana = info?.family === 'solana';

    const { balance, isLoadingBalance, unwrap, isPending, error, txHash, reset, owner } =
        useUnwrap(visible ? info : null);

    const [amount, setAmount] = useState('');
    const [activePercent, setActivePercent] = useState<number | null>(null);
    const [logoError, setLogoError] = useState(false);
    const [copied, setCopied] = useState(false);
    const [unwrappedAmount, setUnwrappedAmount] = useState<bigint | null>(null);
    const [phraseIndex, setPhraseIndex] = useState(0);
    const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const phraseOpacity = useRef(new Animated.Value(1)).current;

    // Rotate the pending copy so a slow chain still feels alive.
    useEffect(() => {
        if (!isPending) {
            setPhraseIndex(0);
            return;
        }
        const id = setInterval(
            () => setPhraseIndex((i) => (i + 1) % PENDING_PHRASES.length),
            1500,
        );
        return () => clearInterval(id);
    }, [isPending]);

    // Fade each new phrase in rather than snapping between words.
    useEffect(() => {
        if (!isPending) return;
        phraseOpacity.setValue(0.25);
        Animated.timing(phraseOpacity, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
        }).start();
    }, [phraseIndex, isPending, phraseOpacity]);

    useEffect(() => () => {
        if (copyTimer.current) clearTimeout(copyTimer.current);
    }, []);

    /**
     * Confirm inline rather than via the global toast — that renders outside the
     * Modal's native window and would be covered by this sheet.
     */
    const handleCopyHash = (hash: string) => {
        Clipboard.setStringAsync(hash);
        setCopied(true);
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 1600);
    };

    // Reset the form each time the sheet opens on a token.
    useEffect(() => {
        if (visible) {
            setAmount('');
            setActivePercent(null);
            setLogoError(false);
            setCopied(false);
            setUnwrappedAmount(null);
            reset();
        }
    }, [visible, info?.address, reset]);

    // Solana always unwraps everything — keep the field in sync with the balance.
    useEffect(() => {
        if (visible && isSolana) setAmount(balance.formatted);
    }, [visible, isSolana, balance.formatted]);

    const amountWei = useMemo(() => {
        if (!info) return 0n;
        if (isSolana) return balance.raw;
        const cleaned = amount.replace(/,/g, '').trim();
        if (!cleaned || Number.isNaN(Number(cleaned))) return 0n;
        try {
            return parseUnits(cleaned, info.decimals);
        } catch {
            return 0n;
        }
    }, [amount, info, isSolana, balance.raw]);

    const exceedsBalance = amountWei > balance.raw;
    const canSubmit = !!info && !!owner && amountWei > 0n && !exceedsBalance && !isPending;

    /**
     * Percentage of the balance. Computed on the raw bigint — going through a
     * float would round the last few wei off "Max" and leave dust behind.
     */
    const handlePercent = (percent: number) => {
        if (!info) return;
        if (percent >= 100) {
            // Max must be exact — trimming here would strand dust in the wrapper,
            // which is the whole thing you're trying to get rid of.
            setAmount(formatUnits(balance.raw, info.decimals));
        } else {
            // A fraction of 18 decimals is a 20-character number that overflows
            // the field. Round the display to 8 dp; the difference is dust, and
            // "Max" is right there when someone wants the exact remainder.
            setAmount(trimAmount(formatUnits((balance.raw * BigInt(percent)) / 100n, info.decimals)));
        }
        setActivePercent(percent);
    };

    const handleUnwrap = async () => {
        if (!canSubmit) return;
        try {
            // Capture what was actually unwrapped. The success view can't read it
            // back off `amountWei`: on Solana that tracks the live balance, which
            // the post-unwrap refresh drops to zero ("0 WSOL is now SOL").
            const result = await unwrap(amountWei);
            setUnwrappedAmount(result.amount);
        } catch {
            // `error` from the hook drives the message; nothing else to do here.
        }
    };

    if (!info) return null;

    const receiveAmount = amountWei > 0n ? trimAmount(formatUnits(amountWei, info.decimals)) : '0';
    const amountFieldValue = isSolana ? trimAmount(balance.formatted) : amount;
    const explorerRoot = EXPLORERS[info.chainId];
    const explorerUrl = explorerRoot && txHash ? `${explorerRoot}${txHash}` : undefined;
    // The caller's logo can be missing or dead; fall back to the shared resolver,
    // which maps a wrapped native onto its native coin's icon.
    const resolvedLogo = logoURI || getTokenLogo(info.wrappedSymbol, info.chainId, info.address);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={isPending ? undefined : onClose} />

            <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) + 8 }]}>
                <View style={styles.grabber} />

                {txHash ? (
                    /* ---------------- Success ---------------- */
                    <View style={styles.successWrap}>
                        <View style={styles.successBadge}>
                            <Ionicons name="checkmark" size={34} color="#010501" />
                        </View>
                        <Text style={styles.successTitle}>Unwrapped</Text>
                        <Text style={styles.successBody}>
                            {trimAmount(formatUnits(unwrappedAmount ?? amountWei, info.decimals))}{' '}
                            {info.wrappedSymbol} is now {info.nativeSymbol} in your wallet.
                        </Text>

                        {/* A bare 66-character hash reads as debug output. Show a
                            middle-truncated one that actually does something. */}
                        <TouchableOpacity
                            style={styles.hashChip}
                            activeOpacity={0.8}
                            onPress={() => handleCopyHash(txHash)}
                        >
                            <Text style={styles.hashText} numberOfLines={1}>
                                {copied ? 'Copied' : shortenHash(txHash)}
                            </Text>
                            <Ionicons
                                name={copied ? 'checkmark' : 'copy-outline'}
                                size={15}
                                color={copied ? colors.primaryCTA : colors.mutedText}
                            />
                        </TouchableOpacity>

                        {explorerUrl && (
                            <TouchableOpacity
                                style={styles.explorerLink}
                                activeOpacity={0.7}
                                onPress={() => Linking.openURL(explorerUrl)}
                            >
                                <Text style={styles.explorerText}>View transaction</Text>
                                <Ionicons name="open-outline" size={14} color={colors.primaryCTA} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={onClose}>
                            <Text style={styles.ctaText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* ---------------- Header ---------------- */}
                        <View style={styles.header}>
                            <View style={styles.tokenIcon}>
                                {resolvedLogo && !logoError ? (
                                    <Image
                                        source={{ uri: resolvedLogo }}
                                        style={styles.tokenIconImage}
                                        contentFit="cover"
                                        onError={() => setLogoError(true)}
                                    />
                                ) : (
                                    <Text style={styles.tokenIconText}>{info.wrappedSymbol.charAt(0)}</Text>
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>Unwrap {info.wrappedSymbol}</Text>
                                <Text style={styles.subtitle}>
                                    Get native {info.nativeSymbol} back, 1:1. No swap, no slippage.
                                </Text>
                            </View>
                            <TouchableOpacity onPress={isPending ? undefined : onClose} hitSlop={12}>
                                <Ionicons name="close" size={22} color={colors.mutedText} />
                            </TouchableOpacity>
                        </View>

                        {/* ---------------- Amount ---------------- */}
                        <View style={styles.card}>
                            <View style={styles.cardTopRow}>
                                <Text style={styles.cardLabel}>You unwrap</Text>
                                <Text style={styles.balanceText}>
                                    {isLoadingBalance ? 'Loading…' : `Balance ${trimAmount(balance.formatted)} ${info.wrappedSymbol}`}
                                </Text>
                            </View>

                            <View style={styles.inputRow}>
                                <TextInput
                                    // A full-precision "Max" on an 18-decimal token
                                    // is still long — step the size down so it fits
                                    // instead of running under the symbol.
                                    style={[styles.input, amountFieldValue.length > 13 && styles.inputCompact]}
                                    value={amountFieldValue}
                                    onChangeText={(t) => {
                                        setAmount(t.replace(/[^0-9.]/g, ''));
                                        setActivePercent(null);
                                    }}
                                    placeholder="0"
                                    placeholderTextColor={colors.mutedText}
                                    keyboardType="decimal-pad"
                                    editable={!isSolana && !isPending}
                                />
                                <Text style={styles.symbolText}>{info.wrappedSymbol}</Text>
                            </View>

                            {/* Solana can only close the whole account, so a
                                partial split would be a lie there. */}
                            {!isSolana && (
                                <View style={styles.percentRow}>
                                    {PERCENT_PRESETS.map((preset) => {
                                        const active = activePercent === preset.value;
                                        return (
                                            <TouchableOpacity
                                                key={preset.value}
                                                style={[styles.percentChip, active && styles.percentChipActive]}
                                                onPress={() => handlePercent(preset.value)}
                                                disabled={isPending}
                                                activeOpacity={0.85}
                                            >
                                                <Text style={[styles.percentText, active && styles.percentTextActive]}>
                                                    {preset.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>

                        <View style={styles.arrowWrap}>
                            <View style={styles.arrowCircle}>
                                <Ionicons name="arrow-down" size={18} color={colors.primaryCTA} />
                            </View>
                        </View>

                        {/* ---------------- Receive ---------------- */}
                        <View style={styles.card}>
                            <Text style={styles.cardLabel}>You receive</Text>
                            <View style={styles.inputRow}>
                                <Text style={styles.receiveAmount} numberOfLines={1}>
                                    {receiveAmount}
                                </Text>
                                <Text style={styles.symbolText}>{info.nativeSymbol}</Text>
                            </View>
                        </View>

                        <Text style={styles.note}>
                            {isSolana
                                ? `Solana unwraps the full balance — your entire ${info.wrappedSymbol} account is closed and returned as ${info.nativeSymbol}.`
                                : `1 ${info.wrappedSymbol} = 1 ${info.nativeSymbol}. Only a network fee applies.`}
                        </Text>

                        {(error || exceedsBalance) && (
                            <Text style={styles.error}>
                                {exceedsBalance ? `You only have ${trimAmount(balance.formatted)} ${info.wrappedSymbol}.` : error}
                            </Text>
                        )}

                        <TouchableOpacity
                            style={[styles.cta, !canSubmit && styles.ctaDisabled]}
                            activeOpacity={0.9}
                            onPress={handleUnwrap}
                            disabled={!canSubmit}
                        >
                            {isPending ? (
                                <Animated.Text style={[styles.ctaText, { opacity: phraseOpacity }]}>
                                    {PENDING_PHRASES[phraseIndex]}
                                </Animated.Text>
                            ) : (
                                <Text style={styles.ctaText}>
                                    Unwrap to {info.nativeSymbol}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.bgSemi,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        borderColor: colors.bgStroke,
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    grabber: {
        alignSelf: 'center',
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.bgStroke,
        marginBottom: 18,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 18,
    },
    tokenIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.bgCards,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    tokenIconImage: { width: '100%', height: '100%' },
    tokenIconText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.titleText,
    },
    title: {
        fontFamily: 'Manrope-ExtraBold',
        fontSize: 21,
        // Sentence case doesn't need the letter-spacing that made the old
        // all-caps version legible — it just looks loose.
        letterSpacing: -0.2,
        color: colors.titleText,
    },
    subtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.mutedText,
        marginTop: 2,
    },
    card: {
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 10,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    balanceText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.bodyText,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    input: {
        flex: 1,
        fontFamily: 'Manrope-Bold',
        fontSize: 26,
        color: colors.titleText,
        padding: 0,
    },
    inputCompact: {
        fontSize: 19,
    },
    receiveAmount: {
        flex: 1,
        fontFamily: 'Manrope-Bold',
        fontSize: 26,
        color: colors.titleText,
    },
    symbolText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 15,
        color: colors.bodyText,
    },
    percentRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 2,
    },
    percentChip: {
        flex: 1,
        height: 32,
        borderRadius: 999,
        backgroundColor: colors.bgShade20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    percentChipActive: {
        backgroundColor: colors.primaryCTA,
    },
    percentText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 13,
        color: colors.primaryCTA,
    },
    percentTextActive: {
        color: '#010501',
    },
    arrowWrap: {
        alignItems: 'center',
        marginVertical: -10,
        zIndex: 2,
    },
    arrowCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        alignItems: 'center',
        justifyContent: 'center',
    },
    note: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        lineHeight: 17,
        color: colors.mutedText,
        marginTop: 14,
    },
    error: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.error,
        marginTop: 10,
    },
    cta: {
        marginTop: 18,
        // Explicit width: the success view centres its children, which collapsed
        // this pill to the width of the word "Done" while it kept height 54.
        width: '100%',
        height: 54,
        borderRadius: 999,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaDisabled: { opacity: 0.4 },
    ctaText: {
        fontFamily: 'Manrope-ExtraBold',
        fontSize: 17,
        letterSpacing: -0.1,
        color: '#010501',
    },
    successWrap: {
        alignItems: 'center',
        paddingTop: 4,
        paddingBottom: 4,
    },
    successBadge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    successTitle: {
        fontFamily: 'Manrope-ExtraBold',
        fontSize: 22,
        letterSpacing: -0.2,
        color: colors.titleText,
    },
    successBody: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: colors.bodyText,
        textAlign: 'center',
        marginTop: 8,
    },
    hashChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 16,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    hashText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    explorerLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 12,
        paddingVertical: 4,
    },
    explorerText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: colors.primaryCTA,
    },
});
