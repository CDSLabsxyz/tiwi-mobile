/**
 * Percentage Action Modal
 * Bottom sheet for Claim / Unstake with 25/50/75/Max quick selectors.
 * Mirrors the super-app's claim/unstake modals in [stake-details-card.tsx].
 */

import { colors } from '@/constants/colors';
import { formatCompactNumber } from '@/utils/formatting';
import React, { useState, useEffect } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export type PercentageActionKind = 'claim' | 'unstake';

interface Props {
    visible: boolean;
    onClose: () => void;
    kind: PercentageActionKind;
    /** Full amount available (pending for claim, staked for unstake). */
    maxAmount: number;
    tokenSymbol: string;
    isProcessing?: boolean;
    /** Called with the selected percentage (25/50/75/100). */
    onConfirm: (percentage: number) => void;
    /**
     * Optional secondary action for Max unstake with harvest.
     * Only shown when kind === 'unstake' and percentage === 100.
     */
    onConfirmMaxWithHarvest?: () => void;
}

const PERCENTAGES = [25, 50, 75, 100] as const;

export const PercentageActionModal: React.FC<Props> = ({
    visible,
    onClose,
    kind,
    maxAmount,
    tokenSymbol,
    isProcessing = false,
    onConfirm,
    onConfirmMaxWithHarvest,
}) => {
    const [percentage, setPercentage] = useState<number>(100);
    useEffect(() => { if (visible) setPercentage(100); }, [visible]);

    const title = kind === 'claim' ? 'Claim Rewards' : 'Unstake Selection';
    const amountLabel = kind === 'claim' ? 'Amount to Claim' : 'Amount to Unstake';
    const confirmLabel = kind === 'claim' ? 'Claim Yield' : 'Initiate Unstake';
    const resolvedAmount = maxAmount * (percentage / 100);
    const isMaxUnstake = kind === 'unstake' && percentage === 100;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose} />
            <View style={styles.sheet}>
                <View style={styles.grabber} />
                <Text style={styles.title}>{title}</Text>

                <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>{amountLabel}</Text>
                    <Text style={styles.amountValue}>
                        {formatCompactNumber(resolvedAmount, { decimals: 4 } as any)} {tokenSymbol}{' '}
                        <Text style={styles.percentText}>({percentage}%)</Text>
                    </Text>
                </View>

                <View style={styles.pctRow}>
                    {PERCENTAGES.map((pct) => {
                        const active = percentage === pct;
                        return (
                            <TouchableOpacity
                                key={pct}
                                activeOpacity={0.8}
                                onPress={() => setPercentage(pct)}
                                style={[
                                    styles.pctButton,
                                    active && styles.pctButtonActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.pctButtonText,
                                        active && styles.pctButtonTextActive,
                                    ]}
                                >
                                    {pct === 100 ? 'Max' : `${pct}%`}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {isMaxUnstake && onConfirmMaxWithHarvest && (
                    <TouchableOpacity
                        activeOpacity={0.9}
                        disabled={isProcessing}
                        onPress={onConfirmMaxWithHarvest}
                        style={[styles.secondaryButton, isProcessing && styles.buttonDisabled]}
                    >
                        <Text style={styles.secondaryButtonText}>
                            Unstake + Harvest Rewards
                        </Text>
                        <Text style={styles.secondaryButtonSubtext}>
                            Claims pending rewards, then withdraws principal
                        </Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={isProcessing || maxAmount <= 0}
                    onPress={() => onConfirm(percentage)}
                    style={[
                        styles.primaryButton,
                        (isProcessing || maxAmount <= 0) && styles.buttonDisabled,
                    ]}
                >
                    <Text style={styles.primaryButtonText}>{confirmLabel}</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheet: {
        backgroundColor: '#0b0f0a',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderColor: '#273024',
    },
    grabber: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#273024',
        marginBottom: 20,
    },
    title: {
        color: '#FFF',
        fontSize: 18,
        fontFamily: 'Manrope-Bold',
        marginBottom: 16,
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    amountLabel: { color: colors.mutedText, fontSize: 13 },
    amountValue: { color: '#FFF', fontSize: 13, fontFamily: 'Manrope-SemiBold' },
    percentText: { color: colors.mutedText, fontSize: 12 },
    pctRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    pctButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#273024',
        backgroundColor: '#0f140e',
        alignItems: 'center',
    },
    pctButtonActive: {
        backgroundColor: '#141e00',
        borderColor: '#b1f128',
    },
    pctButtonText: {
        color: colors.mutedText,
        fontSize: 14,
        fontFamily: 'Manrope-SemiBold',
    },
    pctButtonTextActive: { color: '#b1f128' },
    primaryButton: {
        backgroundColor: '#b1f128',
        paddingVertical: 16,
        borderRadius: 999,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#010501',
        fontSize: 16,
        fontFamily: 'Manrope-Bold',
    },
    secondaryButton: {
        borderWidth: 1,
        borderColor: '#b1f128',
        paddingVertical: 14,
        borderRadius: 999,
        alignItems: 'center',
        marginBottom: 10,
    },
    secondaryButtonText: {
        color: '#b1f128',
        fontSize: 15,
        fontFamily: 'Manrope-Bold',
    },
    secondaryButtonSubtext: {
        color: colors.mutedText,
        fontSize: 10,
        marginTop: 2,
    },
    buttonDisabled: { opacity: 0.5 },
});
