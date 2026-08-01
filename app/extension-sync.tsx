/**
 * Extension Sync Screen
 *
 * Links this device to TIWI Wallet Core (the browser extension) by scanning the
 * QR code from the extension's "Mobile sync" screen.
 */

import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import {
    ExtensionLink,
    getExtensionLinks,
    isSyncPayloadExpired,
    linkExtension,
    parseExtensionSyncPayload,
    unlinkExtension,
} from '@/services/extensionLinkService';
import { useToastStore } from '@/store/useToastStore';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STEPS = [
    'Open the TIWI Wallet Core extension in your desktop browser.',
    'Go to Settings → Mobile sync to show the pairing QR code.',
    'Tap Scan QR code below and point your camera at it.',
];

export default function ExtensionSyncScreen() {
    const router = useRouter();
    const { top, bottom } = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const showToast = useToastStore((s) => s.showToast);

    const [links, setLinks] = useState<ExtensionLink[]>([]);
    const [scanning, setScanning] = useState(false);
    const [manualVisible, setManualVisible] = useState(false);
    const [manualValue, setManualValue] = useState('');
    const busyRef = useRef(false);

    const loadLinks = useCallback(async () => {
        setLinks(await getExtensionLinks());
    }, []);

    useEffect(() => {
        loadLinks();
    }, [loadLinks]);

    const handleBackPress = useCallback(() => {
        if (scanning) {
            setScanning(false);
            return;
        }
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/' as any);
        }
    }, [router, scanning]);

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });
        return () => sub.remove();
    }, [handleBackPress]);

    const handlePayload = useCallback(
        async (raw: string) => {
            if (busyRef.current) return;
            busyRef.current = true;

            try {
                const payload = parseExtensionSyncPayload(raw);
                if (!payload) {
                    showToast('That QR code is not a TIWI extension sync code.', 'error');
                    return;
                }
                if (isSyncPayloadExpired(payload)) {
                    showToast('Sync code expired. Generate a new one in the extension.', 'error');
                    return;
                }

                await linkExtension(payload);
                await loadLinks();
                setScanning(false);
                showToast('Extension linked to this device.', 'success');
            } catch (error: any) {
                console.error('[ExtensionSync] Link failed:', error);
                showToast(error?.message || 'Could not link the extension.', 'error');
            } finally {
                // Short guard so a QR held in frame doesn't re-fire immediately.
                setTimeout(() => {
                    busyRef.current = false;
                }, 1200);
            }
        },
        [loadLinks, showToast]
    );

    const handleStartScan = useCallback(async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result?.granted) return;
        }
        setScanning(true);
    }, [permission, requestPermission]);

    const handleUnlink = useCallback(
        (link: ExtensionLink) => {
            Alert.alert(
                'Unlink extension?',
                'This device will stop being paired with that browser extension.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Unlink',
                        style: 'destructive',
                        onPress: async () => {
                            await unlinkExtension(link.code);
                            await loadLinks();
                            showToast('Extension unlinked.', 'success');
                        },
                    },
                ]
            );
        },
        [loadLinks, showToast]
    );

    const submitManual = useCallback(() => {
        const value = manualValue;
        setManualVisible(false);
        setManualValue('');
        if (value.trim()) handlePayload(value);
    }, [manualValue, handlePayload]);

    const renderScanner = () => {
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
                        Grant camera permission to scan the extension&apos;s pairing QR code.
                    </Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                        <Text style={styles.primaryBtnText}>Grant permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openSettings()}>
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
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={({ data }) => handlePayload(data)}
                />
                <View style={styles.overlay} pointerEvents="none">
                    <View style={styles.frame}>
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />
                    </View>
                    <Text style={styles.hint}>Align the extension QR code inside the frame</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <CustomStatusBar />

            <View style={[styles.header, { paddingTop: (top || 0) + 8 }]}>
                <TouchableOpacity onPress={handleBackPress} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.titleText} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Extension Sync</Text>
                <View style={styles.headerBtn} />
            </View>

            {scanning ? (
                <>
                    {renderScanner()}
                    <View style={[styles.footer, { paddingBottom: (bottom || 16) + 16 }]}>
                        <TouchableOpacity
                            style={styles.secondaryBtn}
                            onPress={() => setManualVisible(true)}
                        >
                            <Ionicons name="create-outline" size={18} color={colors.primaryCTA} />
                            <Text style={styles.secondaryBtnText}>Enter code manually</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanning(false)}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </>
            ) : (
                <ScrollView
                    style={styles.flex1}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: (bottom || 16) + 32 },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.heroCard}>
                        <View style={styles.heroIcon}>
                            <Ionicons name="extension-puzzle-outline" size={26} color={colors.primaryCTA} />
                        </View>
                        <Text style={styles.heroTitle}>Link your extension wallet</Text>
                        <Text style={styles.heroBody}>
                            Pair this device with TIWI Wallet Core so your desktop browser and phone
                            work off the same wallet.
                        </Text>
                    </View>

                    <View style={styles.stepsCard}>
                        {STEPS.map((step, index) => (
                            <View key={step} style={styles.stepRow}>
                                <View style={styles.stepBadge}>
                                    <Text style={styles.stepBadgeText}>{index + 1}</Text>
                                </View>
                                <Text style={styles.stepText}>{step}</Text>
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity style={styles.primaryWideBtn} onPress={handleStartScan}>
                        <Ionicons name="qr-code-outline" size={20} color={colors.bg} />
                        <Text style={styles.primaryWideBtnText}>Scan QR code</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => setManualVisible(true)}
                    >
                        <Ionicons name="create-outline" size={18} color={colors.primaryCTA} />
                        <Text style={styles.secondaryBtnText}>Enter code manually</Text>
                    </TouchableOpacity>

                    <View style={styles.listSection}>
                        <Text style={styles.listTitle}>Linked extensions</Text>
                        {links.length === 0 ? (
                            <Text style={styles.emptyText}>No extension linked to this device yet.</Text>
                        ) : (
                            links.map((link) => (
                                <View key={link.code} style={styles.linkRow}>
                                    <View style={styles.linkInfo}>
                                        <Text style={styles.linkLabel}>{link.label}</Text>
                                        <Text style={styles.linkMeta}>
                                            Linked {new Date(link.linkedAt).toLocaleString()}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.unlinkBtn}
                                        onPress={() => handleUnlink(link)}
                                    >
                                        <Text style={styles.unlinkBtnText}>Unlink</Text>
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>
            )}

            <Modal
                visible={manualVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setManualVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Enter sync code</Text>
                        <Text style={styles.modalBody}>
                            Paste the tiwi://mobile-sync link shown under the extension&apos;s QR code.
                        </Text>
                        <TextInput
                            value={manualValue}
                            onChangeText={setManualValue}
                            placeholder="tiwi://mobile-sync?code=…"
                            placeholderTextColor={colors.mutedText}
                            autoCapitalize="none"
                            autoCorrect={false}
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
                                <Text style={styles.modalConfirmText}>Link</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    flex1: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: colors.bg,
    },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontFamily: 'Manrope-Medium', fontSize: 18, color: colors.titleText },
    scrollContent: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
    heroCard: {
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 16,
        padding: 16,
        gap: 8,
    },
    heroIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.bgSemi,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: colors.titleText },
    heroBody: { fontFamily: 'Manrope-Medium', fontSize: 13, lineHeight: 19, color: colors.bodyText },
    stepsCard: {
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 16,
        padding: 16,
        gap: 14,
    },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    stepBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.bgCards,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepBadgeText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: colors.primaryCTA },
    stepText: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        lineHeight: 19,
        color: colors.bodyText,
    },
    primaryWideBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 54,
        borderRadius: 100,
        backgroundColor: colors.primaryCTA,
    },
    primaryWideBtnText: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: colors.bg },
    secondaryBtn: {
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
    secondaryBtnText: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: colors.primaryCTA },
    listSection: { gap: 12, marginTop: 8 },
    listTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: colors.mutedText },
    emptyText: { fontFamily: 'Manrope-Medium', fontSize: 13, color: colors.bodyText },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 16,
        padding: 14,
    },
    linkInfo: { flex: 1, gap: 4 },
    linkLabel: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: colors.titleText },
    linkMeta: { fontFamily: 'Manrope-Medium', fontSize: 12, color: colors.mutedText },
    unlinkBtn: {
        backgroundColor: colors.bgSemi,
        borderRadius: 100,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    unlinkBtnText: { fontFamily: 'Manrope-Medium', fontSize: 13, color: colors.titleText },
    cameraWrap: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
    overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    frame: { width: 260, height: 260 },
    corner: { position: 'absolute', width: 32, height: 32, borderColor: colors.primaryCTA },
    cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
    cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
    hint: { marginTop: 16, color: colors.titleText, fontSize: 13 },
    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    permissionTitle: {
        color: colors.titleText,
        fontSize: 18,
        fontFamily: 'Manrope-SemiBold',
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
    primaryBtnText: { color: colors.bg, fontFamily: 'Manrope-SemiBold' },
    linkBtn: { marginTop: 12, padding: 8 },
    linkBtnText: { color: colors.bodyText, fontSize: 13 },
    footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg, gap: 10 },
    cancelBtn: { paddingVertical: 12, alignItems: 'center' },
    cancelBtnText: { color: colors.bodyText, fontSize: 13 },
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
    modalTitle: { color: colors.titleText, fontSize: 16, fontFamily: 'Manrope-SemiBold' },
    modalBody: { color: colors.bodyText, fontSize: 13, marginTop: 6, marginBottom: 16 },
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
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    modalCancel: { backgroundColor: colors.bgSemi, borderWidth: 1, borderColor: colors.bgStroke },
    modalCancelText: { color: colors.bodyText, fontFamily: 'Manrope-SemiBold' },
    modalConfirm: { backgroundColor: colors.primaryCTA },
    modalConfirmText: { color: colors.bg, fontFamily: 'Manrope-SemiBold' },
});
