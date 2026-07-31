/**
 * Action row under an AI reply — the mobile counterpart of the web modal's
 * assistant message footer: the security-validation chip, the "1 credit used"
 * chip, then Share insight / Copy / Retry / thumbs up / thumbs down.
 */

import { colors } from '@/constants/colors';
import type { AiValidationResult, AiValidationStatus } from '@/lib/mobile/api-client';
import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AiMessageFooterProps {
    validation?: AiValidationResult;
    creditCharged?: boolean;
    feedback?: 'up' | 'down';
    copied: boolean;
    onShare: () => void;
    onCopy: () => void;
    onRetry: () => void;
    onFeedback: (value: 'up' | 'down') => void;
    retryDisabled?: boolean;
}

/** Same three states and palette as the web `validationChipClass`. */
function chipStyle(status?: AiValidationStatus) {
    if (status === 'blocked') return { backgroundColor: '#3A0B0B', borderColor: '#6F1717', color: '#FF6B6B' };
    if (status === 'review') return { backgroundColor: '#332807', borderColor: '#5F4A10', color: '#F7C948' };
    return { backgroundColor: '#1D3708', borderColor: '#315D12', color: colors.primaryCTA };
}

export function AiMessageFooter({
    validation,
    creditCharged,
    feedback,
    copied,
    onShare,
    onCopy,
    onRetry,
    onFeedback,
    retryDisabled,
}: AiMessageFooterProps) {
    const chip = chipStyle(validation?.status);

    return (
        <View style={styles.container}>
            {validation && (
                <View
                    style={[
                        styles.chip,
                        { backgroundColor: chip.backgroundColor, borderColor: chip.borderColor },
                    ]}
                >
                    <Text style={[styles.chipText, { color: chip.color }]}>{validation.label}</Text>
                </View>
            )}

            {creditCharged && (
                <View style={styles.neutralChip}>
                    <Text style={styles.neutralChipText}>1 credit used</Text>
                </View>
            )}

            <TouchableOpacity style={styles.accentChip} onPress={onShare} hitSlop={6}>
                <Text style={styles.accentChipText}>{copied ? 'Copied' : 'Share insight'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.neutralChip} onPress={onCopy} hitSlop={6}>
                <Feather name="copy" size={11} color={colors.bodyText} />
                <Text style={styles.neutralChipText}>Copy</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.neutralChip, retryDisabled && styles.disabled]}
                onPress={onRetry}
                disabled={retryDisabled}
                hitSlop={6}
            >
                <Feather name="refresh-cw" size={11} color={colors.bodyText} />
                <Text style={styles.neutralChipText}>Retry</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.iconChip, feedback === 'up' && styles.iconChipUp]}
                onPress={() => onFeedback('up')}
                hitSlop={6}
            >
                <Feather
                    name="thumbs-up"
                    size={11}
                    color={feedback === 'up' ? colors.primaryCTA : colors.bodyText}
                />
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.iconChip, feedback === 'down' && styles.iconChipDown]}
                onPress={() => onFeedback('down')}
                hitSlop={6}
            >
                <Feather
                    name="thumbs-down"
                    size={11}
                    color={feedback === 'down' ? '#FF6B6B' : colors.bodyText}
                />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.bgStroke,
    },
    chip: {
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    chipText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
    },
    neutralChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#24351F',
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    neutralChipText: {
        color: colors.bodyText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
    },
    accentChip: {
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#24351F',
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    accentChipText: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
    },
    iconChip: {
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#24351F',
        backgroundColor: colors.bgSemi,
        padding: 5,
    },
    iconChipUp: {
        borderColor: colors.primaryCTA,
        backgroundColor: '#18330B',
    },
    iconChipDown: {
        borderColor: '#6F1717',
        backgroundColor: '#3A0B0B',
    },
    disabled: {
        opacity: 0.5,
    },
});
