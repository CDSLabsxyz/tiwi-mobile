import { colors } from '@/constants/colors';
import { DAppRequest, useDAppRequestStore } from '@/store/dappRequestStore';
import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * STUB: a minimal bottom-sheet approval UI. Replace the body sections with
 * proper designs (favicon, decoded message, tx simulation, gas selector, etc.)
 * once the plumbing is verified end-to-end.
 */
export const DAppApprovalSheet: React.FC = () => {
    const { current, approve, reject } = useDAppRequestStore();
    const visible = !!current;

    const title = useMemo(() => {
        if (!current) return '';
        switch (current.kind) {
            case 'connect': return 'Connect TIWI Protocol Wallet';
            case 'personal_sign':
            case 'eth_sign': return 'Sign Message';
            case 'signTypedData': return 'Sign Typed Data';
            case 'sendTransaction': return 'Confirm Transaction';
            case 'switchChain': return 'Switch Network';
            case 'addChain': return 'Add Network';
            case 'watchAsset': return 'Add Asset';
            default: return 'Approval Required';
        }
    }, [current?.kind]);

    const onApprove = () => {
        // Resolution handled by the bridge AFTER this — the bridge awaited
        // enqueue() which resolves here, then it runs the signer. Passing
        // `true` is just a signal; bridge ignores the value.
        approve(true);
    };

    const onReject = () => reject({ code: 4001, message: 'User rejected the request' });

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onReject}
        >
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    <Text style={styles.title}>{title}</Text>
                    {current && (
                        <Text style={styles.origin} numberOfLines={1}>
                            {current.origin}
                        </Text>
                    )}

                    <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 16 }}>
                        {current && <RequestBody req={current} />}
                    </ScrollView>

                    <View style={styles.actions}>
                        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onReject}>
                            <Text style={styles.btnGhostText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onApprove}>
                            <Text style={styles.btnPrimaryText}>Approve</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const RequestBody: React.FC<{ req: DAppRequest }> = ({ req }) => {
    switch (req.kind) {
        case 'connect':
            return (
                <Text style={styles.bodyText}>
                    This site wants to view your wallet address and propose transactions.
                </Text>
            );

        case 'personal_sign':
        case 'eth_sign': {
            const raw = req.method === 'personal_sign' ? req.params[0] : req.params[1];
            const decoded = tryDecodeUtf8(raw);
            return (
                <View>
                    <Text style={styles.label}>Message</Text>
                    <Text style={styles.code}>{decoded}</Text>
                </View>
            );
        }

        case 'signTypedData':
            return (
                <View>
                    <Text style={styles.label}>Typed data</Text>
                    <Text style={styles.code} numberOfLines={20}>
                        {safeStringify(req.params[1])}
                    </Text>
                </View>
            );

        case 'sendTransaction': {
            const tx = req.params[0] || {};
            return (
                <View style={{ gap: 8 }}>
                    <Row k="To" v={tx.to} />
                    <Row k="Value" v={tx.value ? weiToEth(tx.value) + ' ETH' : '0'} />
                    {tx.data && tx.data !== '0x' && (
                        <Row k="Data" v={String(tx.data).slice(0, 66) + '…'} />
                    )}
                </View>
            );
        }

        case 'switchChain':
            return <Row k="Target chain" v={req.params[0]?.chainId} />;

        default:
            return <Text style={styles.code}>{safeStringify(req.params)}</Text>;
    }
};

const Row: React.FC<{ k: string; v?: string }> = ({ k, v }) => (
    <View style={styles.row}>
        <Text style={styles.label}>{k}</Text>
        <Text style={styles.value} selectable>{v || '—'}</Text>
    </View>
);

function tryDecodeUtf8(input: string): string {
    if (typeof input !== 'string') return safeStringify(input);
    if (!input.startsWith('0x')) return input;
    try {
        const hex = input.slice(2);
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch {
        return input;
    }
}

function weiToEth(wei: string | number): string {
    try {
        const n = BigInt(wei);
        const whole = n / 10n ** 18n;
        const frac = n % 10n ** 18n;
        const fracStr = frac.toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
        return fracStr ? `${whole}.${fracStr}` : whole.toString();
    } catch {
        return String(wei);
    }
}

function safeStringify(v: unknown): string {
    try {
        return JSON.stringify(v, null, 2);
    } catch {
        return String(v);
    }
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.bgSemi,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 24,
        maxHeight: '80%',
        borderTopWidth: 1,
        borderColor: colors.bgStroke,
    },
    handle: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.bgStroke,
        marginBottom: 16,
    },
    title: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: colors.titleText,
        textAlign: 'center',
    },
    origin: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 16,
    },
    body: {
        maxHeight: 320,
    },
    bodyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
        marginBottom: 4,
    },
    value: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: colors.titleText,
    },
    row: {
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderColor: colors.bgStroke,
    },
    code: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
        backgroundColor: colors.bgCards,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    btn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnGhost: {
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    btnPrimary: {
        backgroundColor: colors.primaryCTA,
    },
    btnGhostText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    btnPrimaryText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.bg,
    },
});
