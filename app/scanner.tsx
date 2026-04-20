import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useToastStore } from '@/store/useToastStore';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const URL_REGEX = /^(https?:\/\/|www\.)\S+$/i;

function looksLikeUrl(value: string): boolean {
    const v = value.trim();
    if (!v) return false;
    if (URL_REGEX.test(v)) return true;
    if (v.includes('.') && !v.includes(' ')) {
        const head = v.split('/')[0];
        return head.includes('.') && head.length > 3;
    }
    return false;
}

function normalizeUrl(value: string): string {
    const v = value.trim();
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v.replace(/^\/+/, '')}`;
}

export default function ScannerScreen() {
    const router = useRouter();
    const { top, bottom } = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const showToast = useToastStore(s => s.showToast);

    const [scanned, setScanned] = useState(false);
    const [manualVisible, setManualVisible] = useState(false);
    const [manualValue, setManualValue] = useState('');
    const lastScannedRef = useRef<string>('');

    const handleResult = useCallback(
        (raw: string) => {
            const value = raw.trim();
            if (!value) return;

            if (looksLikeUrl(value)) {
                const url = normalizeUrl(value);
                router.replace({ pathname: '/browser', params: { url } } as any);
                return;
            }

            showToast(
                `Scanned: ${value.length > 60 ? value.slice(0, 60) + '…' : value}`,
                'success'
            );
            router.back();
        },
        [router, showToast]
    );

    const onBarcodeScanned = useCallback(
        ({ data }: { data: string }) => {
            if (scanned) return;
            if (data === lastScannedRef.current) return;
            lastScannedRef.current = data;
            setScanned(true);
            handleResult(data);
        },
        [scanned, handleResult]
    );

    const submitManual = useCallback(() => {
        if (!manualValue.trim()) return;
        setManualVisible(false);
        const v = manualValue;
        setManualValue('');
        handleResult(v);
    }, [manualValue, handleResult]);

    const renderBody = () => {
        if (!permission) {
            return (
                <View style={styles.centerBox}>
                    <ActivityIndicator color={colors.primaryCTA} />
                </View>
            );
        }

        if (!permission.granted) {
            return (
                <View style={styles.centerBox}>
                    <Ionicons name="camera-outline" size={48} color={colors.bodyText} />
                    <Text style={styles.permissionTitle}>Camera access needed</Text>
                    <Text style={styles.permissionBody}>
                        Grant camera permission to scan QR codes and barcodes.
                    </Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                        <Text style={styles.primaryBtnText}>Grant permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.linkBtn}
                        onPress={() => Linking.openSettings()}
                    >
                        <Text style={styles.linkBtnText}>Open settings</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.cameraWrap}>
                <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'pdf417', 'aztec', 'datamatrix'],
                    }}
                    onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
                />
                <View style={styles.overlay} pointerEvents="none">
                    <View style={styles.frame}>
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />
                    </View>
                    <Text style={styles.hint}>Align QR code inside the frame</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <CustomStatusBar />

            <View style={[styles.header, { paddingTop: top + 8 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.titleText} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scan</Text>
                <TouchableOpacity
                    onPress={() => setManualVisible(true)}
                    style={styles.headerBtn}
                    accessibilityLabel="Enter value manually for testing"
                >
                    <Ionicons name="create-outline" size={22} color={colors.titleText} />
                </TouchableOpacity>
            </View>

            {renderBody()}

            <View style={[styles.footer, { paddingBottom: bottom + 16 }]}>
                <TouchableOpacity style={styles.testBtn} onPress={() => setManualVisible(true)}>
                    <Ionicons name="flask-outline" size={18} color={colors.primaryCTA} />
                    <Text style={styles.testBtnText}>Test without scanning</Text>
                </TouchableOpacity>
                {scanned && (
                    <TouchableOpacity
                        style={styles.rescanBtn}
                        onPress={() => {
                            setScanned(false);
                            lastScannedRef.current = '';
                        }}
                    >
                        <Text style={styles.rescanText}>Scan again</Text>
                    </TouchableOpacity>
                )}
            </View>

            <Modal
                visible={manualVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setManualVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Simulate a scan</Text>
                        <Text style={styles.modalBody}>
                            Paste a URL or any text to test the scan flow without a camera.
                        </Text>
                        <TextInput
                            value={manualValue}
                            onChangeText={setManualValue}
                            placeholder="https://example.com"
                            placeholderTextColor={colors.mutedText}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            style={styles.input}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalCancel]}
                                onPress={() => setManualVisible(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalConfirm]}
                                onPress={submitManual}
                            >
                                <Text style={styles.modalConfirmText}>Submit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: colors.bg,
        zIndex: 2,
    },
    headerBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: colors.titleText,
        fontSize: 17,
        fontWeight: '600',
    },
    cameraWrap: {
        flex: 1,
        backgroundColor: '#000',
        overflow: 'hidden',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    frame: {
        width: 260,
        height: 260,
    },
    corner: {
        position: 'absolute',
        width: 32,
        height: 32,
        borderColor: colors.primaryCTA,
    },
    cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
    cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
    hint: {
        marginTop: 16,
        color: colors.titleText,
        fontSize: 13,
    },
    centerBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    permissionTitle: {
        color: colors.titleText,
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },
    permissionBody: {
        color: colors.bodyText,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
    primaryBtn: {
        backgroundColor: colors.primaryCTA,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 999,
    },
    primaryBtnText: {
        color: colors.bg,
        fontWeight: '600',
    },
    linkBtn: {
        marginTop: 12,
        padding: 8,
    },
    linkBtnText: {
        color: colors.bodyText,
        fontSize: 13,
    },
    footer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: colors.bg,
        gap: 10,
    },
    testBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        backgroundColor: colors.bgCards,
    },
    testBtnText: {
        color: colors.primaryCTA,
        fontWeight: '600',
        fontSize: 14,
    },
    rescanBtn: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    rescanText: {
        color: colors.bodyText,
        fontSize: 13,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    modalCard: {
        width: '100%',
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    modalTitle: {
        color: colors.titleText,
        fontSize: 16,
        fontWeight: '600',
    },
    modalBody: {
        color: colors.bodyText,
        fontSize: 13,
        marginTop: 6,
        marginBottom: 16,
    },
    input: {
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
        color: colors.titleText,
        fontSize: 14,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    modalCancel: {
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    modalCancelText: {
        color: colors.bodyText,
        fontWeight: '600',
    },
    modalConfirm: {
        backgroundColor: colors.primaryCTA,
    },
    modalConfirmText: {
        color: colors.bg,
        fontWeight: '700',
    },
});
