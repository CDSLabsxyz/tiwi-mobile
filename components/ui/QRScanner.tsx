import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface QRScannerProps {
    isVisible: boolean;
    onClose: () => void;
    onScan: (data: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ isVisible, onClose, onScan }) => {
    const { top, bottom } = useSafeAreaInsets();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    useEffect(() => {
        if (isVisible) {
            (async () => {
                const { status } = await Camera.requestCameraPermissionsAsync();
                setHasPermission(status === 'granted');
            })();
        }
    }, [isVisible]);

    const handleBarcodeScanned = (scanningResult: { data: string }) => {
        onScan(scanningResult.data);
        onClose();
    };

    if (hasPermission === null) {
        return null; // Or a loading state inside the modal
    }

    if (hasPermission === false) {
        return (
            <Modal visible={isVisible} animationType="slide" transparent>
                <View style={[styles.container, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 20 }}>
                        No access to camera
                    </Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButtonOverlay}>
                        <Text style={{ color: '#B1F128' }}>Close</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={isVisible} animationType="slide">
            <View style={styles.container}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    onBarcodeScanned={handleBarcodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                />

                {/* Overlay UI */}
                <View style={[styles.header, { paddingTop: top + 10 }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Scan QR Code</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.finderContainer}>
                    <View style={styles.finder}>
                        <View style={[styles.corner, styles.topLeft]} />
                        <View style={[styles.corner, styles.topRight]} />
                        <View style={[styles.corner, styles.bottomLeft]} />
                        <View style={[styles.corner, styles.bottomRight]} />
                    </View>
                    <Text style={styles.hint}>Align QR code within the frame</Text>
                </View>

                <View style={[styles.footer, { paddingBottom: bottom + 20 }]} />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonOverlay: {
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#B1F128',
    },
    title: {
        color: '#FFFFFF',
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
    },
    finderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    finder: {
        width: 250,
        height: 250,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: '#B1F128',
    },
    topLeft: {
        top: -2,
        left: -2,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 24,
    },
    topRight: {
        top: -2,
        right: -2,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 24,
    },
    bottomLeft: {
        bottom: -2,
        left: -2,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 24,
    },
    bottomRight: {
        bottom: -2,
        right: -2,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 24,
    },
    hint: {
        color: '#FFFFFF',
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        marginTop: 40,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 100,
    },
    footer: {
        alignItems: 'center',
    },
});
