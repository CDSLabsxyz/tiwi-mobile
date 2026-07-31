/**
 * AI credits / TWC billing sheet — mobile counterpart of the web modal's
 * billing popover. Shows the free allowance left, paid TWC credits left, the
 * wallet's on-chain payment-token balance, and the admin-configured packs.
 * Buying a pack transfers the pack price to the treasury; credits are granted
 * only once that transfer confirms.
 */

import { colors } from '@/constants/colors';
import type { AiCreditPack, CreditSummary } from '@/services/aiCreditsService';
import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AiCreditsSheetProps {
    visible: boolean;
    onClose: () => void;

    summary: CreditSummary;
    freeMonthlyCredits: number;
    packs: AiCreditPack[];
    paySymbol: string;
    payTokenBalanceLabel: string;

    buyingPackId: string | null;
    billingMessage: string | null;
    onBuy: (pack: AiCreditPack) => void;

    hasReceipt: boolean;
    onViewReceipt: () => void;
}

export function AiCreditsSheet({
    visible,
    onClose,
    summary,
    freeMonthlyCredits,
    packs,
    paySymbol,
    payTokenBalanceLabel,
    buyingPackId,
    billingMessage,
    onBuy,
    hasReceipt,
    onViewReceipt,
}: AiCreditsSheetProps) {
    const { bottom } = useSafeAreaInsets();

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={[styles.sheet, { paddingBottom: (bottom || 16) + 12 }]}>
                    <View style={styles.accent} />

                    <View style={styles.header}>
                        <View style={styles.headerText}>
                            <Text style={styles.title}>AI credits</Text>
                            <Text style={styles.subtitle}>
                                {freeMonthlyCredits} free monthly credits. Pro credits are paid with {paySymbol}.
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}>
                            <Feather name="x" size={16} color={colors.bodyText} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.tiles}>
                        <View style={styles.tile}>
                            <Text style={styles.tileLabel}>Free left</Text>
                            <Text style={styles.tileValue}>{summary.monthlyLeft}</Text>
                        </View>
                        <View style={styles.tile}>
                            <Text style={styles.tileLabel}>{paySymbol} credits</Text>
                            <Text style={[styles.tileValue, styles.tileValueAccent]}>{summary.paidLeft}</Text>
                        </View>
                        <View style={styles.tile}>
                            <Text style={styles.tileLabel}>{paySymbol} balance</Text>
                            {/* Already abbreviated (e.g. "7.95B TWC"); shrink
                                slightly rather than wrap if it still overflows. */}
                            <Text
                                style={styles.tileValue}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                            >
                                {payTokenBalanceLabel}
                            </Text>
                        </View>
                    </View>

                    <ScrollView style={styles.packList} contentContainerStyle={styles.packListContent}>
                        {packs.map((pack) => {
                            const busy = buyingPackId === pack.id;
                            return (
                                <TouchableOpacity
                                    key={pack.id}
                                    style={[styles.pack, buyingPackId !== null && styles.packDisabled]}
                                    disabled={buyingPackId !== null}
                                    onPress={() => onBuy(pack)}
                                >
                                    <View style={styles.packInfo}>
                                        <Text style={styles.packLabel}>{pack.label}</Text>
                                        <Text style={styles.packCredits}>{pack.credits} AI credits</Text>
                                    </View>
                                    {busy ? (
                                        <ActivityIndicator size="small" color={colors.primaryCTA} />
                                    ) : (
                                        // Grouped, not abbreviated — a price the
                                        // user is about to pay must be exact.
                                        <Text style={styles.packPrice} numberOfLines={1}>
                                            {pack.twcAmount.toLocaleString(undefined, {
                                                maximumFractionDigits: 4,
                                            })}{' '}
                                            {paySymbol}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}

                        {billingMessage && <Text style={styles.billingMessage}>{billingMessage}</Text>}

                        {hasReceipt && (
                            <TouchableOpacity onPress={onViewReceipt} style={styles.receiptLink}>
                                <Text style={styles.receiptLinkText}>🧾 View last receipt</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheet: {
        backgroundColor: colors.bgSemi,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#24351F',
        paddingHorizontal: 16,
        paddingTop: 18,
        maxHeight: '82%',
    },
    accent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: colors.primaryCTA,
        opacity: 0.6,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 16,
    },
    headerText: {
        flex: 1,
    },
    title: {
        color: colors.titleText,
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
    },
    subtitle: {
        color: '#9AA39A',
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        marginTop: 6,
    },
    close: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#10200D',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tiles: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    tile: {
        flex: 1,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        backgroundColor: colors.bg,
        padding: 10,
    },
    tileLabel: {
        color: '#8C978C',
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
    },
    tileValue: {
        color: colors.titleText,
        fontFamily: 'Manrope-Bold',
        fontSize: 13,
        marginTop: 4,
    },
    tileValueAccent: {
        color: colors.primaryCTA,
    },
    packList: {
        flexGrow: 0,
    },
    packListContent: {
        gap: 8,
        paddingBottom: 4,
    },
    pack: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        backgroundColor: colors.bg,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    packDisabled: {
        opacity: 0.6,
    },
    packInfo: {
        flex: 1,
    },
    packLabel: {
        color: colors.titleText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
    },
    packCredits: {
        color: '#8C978C',
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        marginTop: 2,
    },
    packPrice: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
    },
    billingMessage: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        backgroundColor: colors.bg,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: colors.bodyText,
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        lineHeight: 17,
    },
    receiptLink: {
        paddingVertical: 6,
    },
    receiptLinkText: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
    },
});
