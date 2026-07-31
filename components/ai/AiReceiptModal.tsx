/**
 * AI credit purchase receipt — mobile counterpart of the web modal's receipt.
 *
 * Same content and actions: a CONFIRMED header, the credits/amount summary,
 * pack / network / from / treasury / tx hash / reference / date rows, a QR to
 * the explorer link, and Download (PNG) / Share / Copy.
 *
 * The web app draws the PNG on a canvas; here the receipt card itself is
 * captured with react-native-view-shot, which is the same pattern the Send
 * receipt already uses.
 */

import { colors } from '@/constants/colors';
import {
    explorerTxUrl,
    payChainName,
    receiptText,
    shortAddr,
    type Receipt,
} from '@/services/aiCreditsService';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';

interface AiReceiptModalProps {
    visible: boolean;
    receipt: Receipt | null | undefined;
    onClose: () => void;
    onCopied?: (message: string) => void;
}

export function AiReceiptModal({ visible, receipt, onClose, onCopied }: AiReceiptModalProps) {
    const shotRef = useRef<ViewShot>(null);
    const [busy, setBusy] = useState(false);

    if (!receipt) return null;

    const explorer = explorerTxUrl(receipt.chainId, receipt.txHash);

    /**
     * Capture the card as a PNG. `download` isn't a thing on mobile, so both
     * Download and Share funnel into the OS share sheet — the user picks
     * "Save Image" or a target app from there.
     */
    const captureAndShare = async () => {
        setBusy(true);
        try {
            const uri = await captureRef(shotRef as any, {
                format: 'png',
                quality: 1,
                result: 'tmpfile',
            });
            const filename = `tiwi-ai-receipt-${receipt.reference}.png`;
            const dest = `${FileSystem.cacheDirectory}${filename}`;
            let target = uri;
            try {
                await FileSystem.copyAsync({ from: uri, to: dest });
                target = dest;
            } catch {
                /* fall back to the captured uri */
            }
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(target, {
                    mimeType: 'image/png',
                    dialogTitle: 'TIWI AI Receipt',
                    UTI: 'public.png',
                });
            } else {
                // No share sheet available → the text receipt is the fallback.
                await Clipboard.setStringAsync(receiptText(receipt));
                onCopied?.('Receipt copied.');
            }
        } catch (e: any) {
            console.warn('[AI receipt] capture failed:', e);
            Alert.alert('Could not export receipt', e?.message ?? 'Unknown error');
        } finally {
            setBusy(false);
        }
    };

    const copyText = async () => {
        try {
            await Clipboard.setStringAsync(receiptText(receipt));
            onCopied?.('Receipt copied.');
        } catch {
            /* ignore */
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.card}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={styles.capture}>
                            <View style={styles.header}>
                                <View>
                                    <Text style={styles.brand}>TIWI AI</Text>
                                    <Text style={styles.brandSub}>Payment Receipt</Text>
                                </View>
                                <View style={styles.confirmedPill}>
                                    <Text style={styles.confirmedText}>✓ CONFIRMED</Text>
                                </View>
                            </View>

                            <View style={styles.amountBlock}>
                                <Text style={styles.credits}>{receipt.credits}</Text>
                                <Text style={styles.creditsLabel}>AI credits</Text>
                                <Text style={styles.paid}>
                                    {receipt.twcAmount} {receipt.tokenSymbol}
                                </Text>
                            </View>

                            <View style={styles.rows}>
                                <Row label="Pack" value={receipt.packLabel} />
                                <Row label="Network" value={payChainName(receipt.chainId)} />
                                <Row label="From" value={shortAddr(receipt.from)} mono />
                                <Row label="To (treasury)" value={shortAddr(receipt.to)} mono />
                                {receipt.txHash && <Row label="Tx hash" value={shortAddr(receipt.txHash)} mono />}
                                <Row label="Reference" value={receipt.reference} mono />
                                <Row label="Date" value={new Date(receipt.timestamp).toLocaleString()} />
                            </View>

                            {explorer && (
                                <View style={styles.qrBlock}>
                                    <View style={styles.qrSurface}>
                                        <QRCode value={explorer} size={104} />
                                    </View>
                                </View>
                            )}

                            <Text style={styles.footer}>
                                app.tiwiprotocol.xyz · Thank you for using TIWI AI
                            </Text>
                        </ViewShot>

                        {explorer && (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(explorer).catch(() => { })}
                                style={styles.explorerLink}
                            >
                                <Text style={styles.explorerLinkText}>View transaction on explorer ↗</Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.actionPrimary, busy && styles.actionBusy]}
                                onPress={captureAndShare}
                                disabled={busy}
                            >
                                {busy ? (
                                    <ActivityIndicator size="small" color={colors.bg} />
                                ) : (
                                    <Text style={styles.actionPrimaryText}>Download</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionSecondary}
                                onPress={captureAndShare}
                                disabled={busy}
                            >
                                <Feather name="share-2" size={13} color={colors.primaryCTA} />
                                <Text style={styles.actionSecondaryText}>Share</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionGhost} onPress={copyText}>
                                <Feather name="copy" size={13} color={colors.bodyText} />
                                <Text style={styles.actionGhostText}>Copy</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={[styles.rowValue, mono && styles.rowValueMono]}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    card: {
        width: '100%',
        maxWidth: 380,
        maxHeight: '90%',
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        backgroundColor: colors.bgSemi,
        overflow: 'hidden',
    },
    capture: {
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.bgStroke,
    },
    brand: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
    },
    brandSub: {
        color: '#8A938A',
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        marginTop: 3,
    },
    confirmedPill: {
        backgroundColor: '#1D3708',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#315D12',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    confirmedText: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-Bold',
        fontSize: 10,
    },
    amountBlock: {
        alignItems: 'center',
        paddingVertical: 14,
    },
    credits: {
        color: colors.titleText,
        fontFamily: 'Manrope-Bold',
        fontSize: 30,
    },
    creditsLabel: {
        color: '#8A938A',
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        marginTop: 2,
    },
    paid: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        marginTop: 6,
    },
    rows: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.bgStroke,
        paddingTop: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 6,
    },
    rowLabel: {
        color: '#8A938A',
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
    },
    rowValue: {
        flex: 1,
        textAlign: 'right',
        color: colors.titleText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
    },
    rowValueMono: {
        fontFamily: 'Manrope-Medium',
    },
    qrBlock: {
        alignItems: 'center',
        marginTop: 14,
    },
    qrSurface: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 8,
    },
    footer: {
        textAlign: 'center',
        color: '#8A938A',
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        marginTop: 14,
    },
    explorerLink: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    explorerLinkText: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 18,
        paddingBottom: 10,
    },
    actionPrimary: {
        flex: 1,
        borderRadius: 10,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    actionBusy: {
        opacity: 0.7,
    },
    actionPrimaryText: {
        color: colors.bg,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
    },
    actionSecondary: {
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    actionSecondaryText: {
        color: colors.primaryCTA,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
    },
    actionGhost: {
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F3C19',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    actionGhostText: {
        color: colors.bodyText,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
    },
    closeButton: {
        marginHorizontal: 18,
        marginBottom: 16,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.bgStroke,
        alignItems: 'center',
        paddingVertical: 10,
    },
    closeButtonText: {
        color: '#8A938A',
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
    },
});
