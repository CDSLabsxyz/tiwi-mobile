/**
 * TransactionReceiptCard
 *
 * Shown on the send-success step. Displays Amount / Network / Sender /
 * Receiver / Date / Tx ID, and lets the user share or save the receipt
 * as a PNG via react-native-view-shot + expo-sharing.
 */

import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as Sharing from 'expo-sharing';

const TiwiLogo = require('@/assets/logo/tiwi-logo.svg');

// Lazy-loaded so the app doesn't crash on JS-only builds where the
// native ExpoPrint module isn't compiled in. Becomes available after the
// next EAS build.
let Print: typeof import('expo-print') | null = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Print = require('expo-print');
} catch {
    Print = null;
}
const isPdfAvailable = !!Print;
import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';

export interface TransactionReceipt {
    txHash: string;
    amount: string;
    symbol: string;
    network: string;
    sender: string;
    recipient: string;
    recipientCount: number;
    completedAt: string; // ISO
    isMulti: boolean;
}

interface Props {
    receipt: TransactionReceipt;
    onDone: () => void;
}

const truncate = (s: string, head = 6, tail = 6) =>
    !s ? '' : s.length <= head + tail + 3 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

// TIWI logo (assets/logo/tiwi-logo.svg) inlined as a base64 data URI so the
// generated PDF is fully self-contained — no external assets, no font/CORS
// issues from the WebView print pipeline.
const TIWI_LOGO_DATA_URI =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAzNiA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgY2xpcC1wYXRoPSJ1cmwoI2NsaXAwXzQ3MzRfMTY2NTEpIj4KPHBhdGggZD0iTTE3LjE0MTQgNy4xNDk5MkwxNy41MzMgMy41MTM1NUMxNy41MzMgMy41MTM1NSAyNS45OTE3IDEyLjUyMDYgMjYuNzMwMiAxOS44OTRDMjcuNDY4NiAyNy4yNjc0IDI2LjYwNzEgMzAuNjM1MyAxNy45ODA1IDQwLjA1NjNDMTcuOTgwNSA0MC4wNTYzIDMzLjE1MjYgMjEuNzg0OSAxNy4xNTI1IDcuMTQ5OTJIMTcuMTQxNFoiIGZpbGw9IiM3OEE2MjciLz4KPHBhdGggZD0iTTE4LjIzNzkgMzIuOTI4N0wxNy44NDYzIDM2LjU2NTFDMTcuODQ2MyAzNi41NjUxIDkuMzQyNzYgMjcuNTU4MSA4LjYwNDMgMjAuMTg0N0M3Ljg2NTg0IDEyLjgxMTIgOC43MjczOCA5LjQ1NDU3IDE3LjM5ODcgMC4wMzM1NjkzQzE3LjM5ODcgMC4wMzM1NjkzIDIuMTQ4MzQgMTguMzA0OSAxOC4yMzc5IDMyLjkyODdaIiBmaWxsPSIjNzhBNjI3Ii8+CjxwYXRoIGQ9Ik0xNy44MjM4IDM2LjU0MjdIOS4zNTM4NkwyLjczMDA3IDI2LjgwODRDMS4wMDY5OSAyNC4yOTEgMC4xMDA2OTIgMjEuMzgxOSAtNy40NjAyNGUtMDYgMTguNDYxNkMtNy40NjAyNGUtMDYgMTguMzYwOSAtNy40NjAyNGUtMDYgMTguMjQ5IC03LjQ2MDI0ZS0wNiAxOC4xNDgzQy0wLjA0NDc2MjggMTQuOTgxOCAwLjg2MTUzMyAxMS44MTU0IDIuNzMwMDcgOS4wODUzM0w4LjkwNjMgMEgxNy4zNzYyTDExLjIgOS4wODUzM0M5LjM0MjY3IDExLjgxNTQgOC40MzYzNyAxNC45ODE4IDguNDY5OTQgMTguMTQ4M0M4LjQ2OTk0IDE4LjI0OSA4LjQ2OTk0IDE4LjM2MDkgOC40Njk5NCAxOC40NjE2QzguNTU5NDUgMjEuMzgxOSA5LjQ2NTc0IDI0LjI5MSAxMS4xODg4IDI2LjgwODRMMTcuODEyNiAzNi41NDI3SDE3LjgyMzhaIiBmaWxsPSIjQjFGMTI4Ii8+CjxwYXRoIGQ9Ik0zNS4zNTY1IDIxLjkwOEMzNS40MDEzIDI1LjA3NDQgMzQuNDk1IDI4LjI0MDkgMzIuNjI2NCAzMC45NzA5TDI2LjQ1MDIgNDAuMDU2M0gxNy45ODAzTDI0LjE1NjUgMzAuOTcwOUMyNi4wMTM4IDI4LjI0MDkgMjYuOTMxMyAyNS4wNzQ0IDI2Ljg4NjYgMjEuOTA4QzI2Ljg4NjYgMjEuODA3MyAyNi44ODY2IDIxLjY5NTQgMjYuODg2NiAyMS41OTQ3QzI2Ljc5NzEgMTguNjc0NCAyNS44OTA4IDE1Ljc2NTMgMjQuMTY3NyAxMy4yNDc4TDE3LjUzMjcgMy41MTM1NUgyNi4wMDI3TDMyLjYyNjQgMTMuMjQ3OEMzNC4zNDk1IDE1Ljc3NjUgMzUuMjU1OCAxOC42NzQ0IDM1LjM0NTMgMjEuNTk0N0MzNS4zNDUzIDIxLjY5NTQgMzUuMzQ1MyAyMS44MDczIDM1LjM0NTMgMjEuOTA4SDM1LjM1NjVaIiBmaWxsPSIjQjFGMTI4Ii8+CjwvZz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcDBfNDczNF8xNjY1MSI+CjxyZWN0IHdpZHRoPSIzNS4zNTY3IiBoZWlnaHQ9IjQwLjA1NiIgZmlsbD0id2hpdGUiLz4KPC9jbGlwUGF0aD4KPC9kZWZzPgo8L3N2Zz4K';

const escapeHtml = (s: string) =>
    String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const buildReceiptHtml = (r: TransactionReceipt) => {
    const dateStr = (() => {
        try {
            return new Date(r.completedAt).toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false,
            });
        } catch { return r.completedAt; }
    })();

    const recipientLine = r.isMulti
        ? `${r.recipientCount} addresses`
        : escapeHtml(r.recipient);

    const recipientList = r.isMulti
        ? `<div class="multi-list">${r.recipient
            .split(/[,\n]+/)
            .map(a => a.trim())
            .filter(Boolean)
            .map(a => `<div class="multi-item">${escapeHtml(a)}</div>`)
            .join('')}</div>`
        : '';

    return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #010501;
    color: #FFFFFF;
    margin: 0;
    padding: 32px;
  }
  .card {
    background: #121712;
    border: 1px solid #1F261E;
    border-radius: 28px;
    padding: 32px;
    max-width: 540px;
    margin: 0 auto;
  }
  .header { text-align: center; margin-bottom: 16px; }
  .logo {
    width: 56px; height: 56px;
    display: inline-flex; align-items: center; justify-content: center;
    margin-bottom: 8px;
  }
  .logo img { width: 56px; height: 56px; display: block; }
  .brand { font-size: 18px; font-weight: 700; }
  .brand-sub { font-size: 12px; color: #B5B5B5; margin-top: 2px; }
  .check {
    width: 64px; height: 64px;
    border-radius: 32px;
    background: rgba(177,241,40,0.10);
    border: 2px solid #B1F128;
    display: flex; align-items: center; justify-content: center;
    margin: 12px auto 8px;
    color: #B1F128;
    font-size: 32px;
    font-weight: bold;
  }
  .success-title { text-align: center; font-size: 17px; font-weight: 600; }
  .success-sub { text-align: center; font-size: 12px; color: #B5B5B5; margin-top: 2px; }
  .amount {
    text-align: center;
    margin: 18px 0 12px;
  }
  .amount-value {
    font-size: 32px;
    font-weight: 700;
    color: #B1F128;
  }
  .amount-symbol {
    font-size: 16px;
    font-weight: 600;
    color: #FFFFFF;
    margin-left: 6px;
  }
  .divider { height: 1px; background: #1F261E; margin: 12px 0; }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 9px 0;
    gap: 12px;
  }
  .row-label { font-size: 12px; color: #B5B5B5; flex-shrink: 0; }
  .row-value {
    font-size: 13px;
    font-weight: 500;
    text-align: right;
    word-break: break-all;
    max-width: 60%;
  }
  .multi-list {
    margin-top: 8px;
    padding: 12px;
    background: #0B0F0A;
    border: 1px solid #1F261E;
    border-radius: 12px;
  }
  .multi-item {
    font-size: 11px;
    color: #B5B5B5;
    word-break: break-all;
    padding: 3px 0;
    border-bottom: 1px solid #1F261E;
  }
  .multi-item:last-child { border-bottom: none; }
  .footer {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid #1F261E;
    text-align: center;
    font-size: 11px;
    color: #B5B5B5;
  }
</style></head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo"><img src="${TIWI_LOGO_DATA_URI}" alt="TIWI Protocol" /></div>
      <div class="brand">TIWI Protocol</div>
      <div class="brand-sub">Transaction Receipt</div>
    </div>

    <div class="check">✓</div>
    <div class="success-title">${r.isMulti ? 'Multi-Send Successful' : 'Transfer Successful'}</div>
    <div class="success-sub">Confirmed on-chain</div>

    <div class="amount">
      <span class="amount-value">${escapeHtml(r.amount)}</span><span class="amount-symbol">${escapeHtml(r.symbol)}</span>
    </div>

    <div class="divider"></div>

    <div class="row"><span class="row-label">Network</span><span class="row-value">${escapeHtml(r.network)}</span></div>
    <div class="row"><span class="row-label">From</span><span class="row-value">${escapeHtml(r.sender)}</span></div>
    <div class="row"><span class="row-label">${r.isMulti ? `To (${r.recipientCount} recipients)` : 'To'}</span><span class="row-value">${recipientLine}</span></div>
    ${recipientList}
    <div class="row"><span class="row-label">Date</span><span class="row-value">${escapeHtml(dateStr)}</span></div>
    <div class="row"><span class="row-label">Transaction ID</span><span class="row-value">${escapeHtml(r.txHash)}</span></div>

    <div class="footer">tiwiprotocol.xyz</div>
  </div>
</body></html>`;
};

const formatDate = (iso: string) => {
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    } catch {
        return iso;
    }
};

export const TransactionReceiptCard: React.FC<Props> = ({ receipt, onDone }) => {
    const shotRef = useRef<ViewShot>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const copy = async (label: string, value: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await Clipboard.setStringAsync(value);
        setCopiedField(label);
        setTimeout(() => setCopiedField(null), 1500);
    };

    const handleSharePNG = async () => {
        if (busy) return;
        setBusy(true);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const uri = await captureRef(shotRef as any, {
                format: 'png',
                quality: 1,
                result: 'tmpfile',
            });

            const filename = `tiwi-receipt-${receipt.txHash.slice(0, 10)}.png`;
            const dest = `${FileSystem.cacheDirectory}${filename}`;
            try {
                await FileSystem.copyAsync({ from: uri, to: dest });
            } catch {
                // Fall back to the captured uri if copy fails
            }

            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(dest, {
                    mimeType: 'image/png',
                    dialogTitle: 'TIWI Transaction Receipt',
                    UTI: 'public.png',
                });
            }
        } catch (e) {
            console.warn('[Receipt] share PNG failed:', e);
        } finally {
            setBusy(false);
        }
    };

    const handleSharePDF = async () => {
        if (busy) return;
        if (!Print) {
            console.warn('[Receipt] expo-print not available in this build');
            return;
        }
        setBusy(true);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Build a self-contained HTML doc styled with TIWI brand colors.
            // We don't reuse the React tree — expo-print needs raw HTML/CSS.
            const html = buildReceiptHtml(receipt);

            const { uri } = await Print.printToFileAsync({
                html,
                base64: false,
                width: 612,   // 8.5" * 72dpi (US Letter)
                height: 792,
            });

            const filename = `tiwi-receipt-${receipt.txHash.slice(0, 10)}.pdf`;
            const dest = `${FileSystem.cacheDirectory}${filename}`;
            try {
                await FileSystem.copyAsync({ from: uri, to: dest });
            } catch {
                // Fall back to the original uri if copy fails
            }

            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(dest, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'TIWI Transaction Receipt',
                    UTI: 'com.adobe.pdf',
                });
            }
        } catch (e) {
            console.warn('[Receipt] share PDF failed:', e);
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={styles.wrapper}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                <ViewShot
                    ref={shotRef}
                    options={{ format: 'png', quality: 1 }}
                    style={styles.captureWrap}
                >
                    <View style={styles.card}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.logoWrap}>
                                <ExpoImage
                                    source={TiwiLogo}
                                    style={styles.logoImg}
                                    contentFit="contain"
                                />
                            </View>
                            <Text style={styles.brand}>TIWI Protocol</Text>
                            <Text style={styles.brandSub}>Transaction Receipt</Text>
                        </View>

                        <View style={styles.checkRow}>
                            <View style={styles.checkRing}>
                                <Ionicons name="checkmark" size={28} color={colors.primaryCTA} />
                            </View>
                            <Text style={styles.successTitle}>
                                {receipt.isMulti ? 'Multi-Send Successful' : 'Transfer Successful'}
                            </Text>
                            <Text style={styles.successSub}>
                                Confirmed on-chain
                            </Text>
                        </View>

                        {/* Big amount */}
                        <View style={styles.amountWrap}>
                            <Text style={styles.amountValue}>
                                {receipt.amount}
                            </Text>
                            <Text style={styles.amountSymbol}>{receipt.symbol}</Text>
                        </View>

                        <View style={styles.divider} />

                        {/* Detail rows */}
                        <Row label="Network" value={receipt.network} />

                        <Row
                            label="From"
                            value={truncate(receipt.sender, 8, 8)}
                            full={receipt.sender}
                            copyable
                            copied={copiedField === 'sender'}
                            onCopy={() => copy('sender', receipt.sender)}
                        />

                        <Row
                            label={receipt.isMulti ? `To (${receipt.recipientCount} recipients)` : 'To'}
                            value={
                                receipt.isMulti
                                    ? `${receipt.recipientCount} addresses`
                                    : truncate(receipt.recipient, 8, 8)
                            }
                            full={receipt.recipient}
                            copyable
                            copied={copiedField === 'recipient'}
                            onCopy={() => copy('recipient', receipt.recipient)}
                        />

                        {receipt.isMulti && (
                            <View style={styles.multiList}>
                                {receipt.recipient
                                    .split(/[,\n]+/)
                                    .map(a => a.trim())
                                    .filter(Boolean)
                                    .map((addr, i) => (
                                        <View key={`${addr}-${i}`} style={styles.multiItem}>
                                            <Text style={styles.multiIndex}>{i + 1}.</Text>
                                            <Text style={styles.multiAddr} numberOfLines={1} ellipsizeMode="middle">
                                                {addr}
                                            </Text>
                                        </View>
                                    ))}
                            </View>
                        )}

                        <Row label="Date" value={formatDate(receipt.completedAt)} />

                        <Row
                            label="Transaction ID"
                            value={truncate(receipt.txHash, 8, 8)}
                            full={receipt.txHash}
                            copyable
                            copied={copiedField === 'txHash'}
                            onCopy={() => copy('txHash', receipt.txHash)}
                        />

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>tiwiprotocol.xyz</Text>
                        </View>
                    </View>
                </ViewShot>

                {/* Action buttons (NOT inside view-shot — we don't capture them) */}
                <View style={styles.actions}>
                    <View style={styles.shareRow}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.shareButtonHalf, busy && { opacity: 0.6 }]}
                            onPress={handleSharePNG}
                            disabled={busy}
                        >
                            <Ionicons name="share-outline" size={18} color={colors.bg} />
                            <Text style={styles.shareButtonText}>
                                {busy ? 'Saving…' : (isPdfAvailable ? 'Share as PNG' : 'Share / Save Receipt')}
                            </Text>
                        </TouchableOpacity>
                        {isPdfAvailable && (
                            <TouchableOpacity
                                activeOpacity={0.8}
                                style={[styles.shareButtonHalf, busy && { opacity: 0.6 }]}
                                onPress={handleSharePDF}
                                disabled={busy}
                            >
                                <Ionicons name="document-outline" size={18} color={colors.bg} />
                                <Text style={styles.shareButtonText}>
                                    {busy ? '…' : 'Share as PDF'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.doneButton}
                        onPress={onDone}
                    >
                        <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
};

interface RowProps {
    label: string;
    value: string;
    full?: string;
    copyable?: boolean;
    copied?: boolean;
    onCopy?: () => void;
}

const Row: React.FC<RowProps> = ({ label, value, copyable, copied, onCopy }) => (
    <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{value}</Text>
            {copyable && (
                <TouchableOpacity
                    onPress={onCopy}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.copyIcon}
                >
                    <Ionicons
                        name={copied ? 'checkmark' : 'copy-outline'}
                        size={14}
                        color={copied ? colors.primaryCTA : colors.bodyText}
                    />
                </TouchableOpacity>
            )}
        </View>
    </View>
);

const styles = StyleSheet.create({
    wrapper: { flex: 1, width: '100%' },
    scroll: { padding: 18, paddingBottom: 40, alignItems: 'center' },
    captureWrap: { width: '100%' },
    card: {
        width: '100%',
        backgroundColor: colors.bgCards,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        padding: 22,
        gap: 14,
    },
    header: { alignItems: 'center', gap: 4 },
    logoWrap: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    logoImg: { width: 48, height: 48 },
    brand: { fontFamily: 'Manrope-Bold', fontSize: 16, color: colors.titleText },
    brandSub: { fontFamily: 'Manrope-Regular', fontSize: 11, color: colors.bodyText, marginTop: -2 },
    checkRow: { alignItems: 'center', gap: 4, marginTop: 4 },
    checkRing: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(177, 241, 40, 0.10)',
        borderWidth: 2,
        borderColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    successTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: colors.titleText },
    successSub: { fontFamily: 'Manrope-Regular', fontSize: 11, color: colors.bodyText },
    amountWrap: {
        alignItems: 'center',
        marginVertical: 8,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    amountValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 28,
        color: colors.primaryCTA,
        textAlign: 'center',
    },
    amountSymbol: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
        marginTop: 8,
    },
    divider: { height: 1, backgroundColor: colors.bgStroke, marginVertical: 4 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        gap: 12,
    },
    rowLabel: { fontFamily: 'Manrope-Regular', fontSize: 12, color: colors.bodyText, flexShrink: 0 },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    rowValue: { fontFamily: 'Manrope-Medium', fontSize: 13, color: colors.titleText, textAlign: 'right' },
    copyIcon: { padding: 2 },
    multiList: {
        marginTop: 4,
        padding: 12,
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 12,
        gap: 4,
    },
    multiItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 3,
    },
    multiIndex: {
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        color: colors.bodyText,
        width: 22,
    },
    multiAddr: {
        flex: 1,
        fontFamily: 'Manrope-Regular',
        fontSize: 11,
        color: colors.titleText,
    },
    footer: {
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
    },
    footerText: { fontFamily: 'Manrope-Medium', fontSize: 10, color: colors.bodyText },
    actions: { width: '100%', gap: 10, marginTop: 18 },
    shareRow: { flexDirection: 'row', gap: 10 },
    shareButtonHalf: {
        flex: 1,
        height: 54,
        borderRadius: 100,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    shareButtonText: { fontFamily: 'Manrope-Bold', fontSize: 15, color: colors.bg },
    doneButton: {
        height: 54,
        borderRadius: 100,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneButtonText: { fontFamily: 'Manrope-Medium', fontSize: 15, color: colors.titleText },
});
