import { BlurView } from 'expo-blur';
import React, { useEffect } from 'react';
import { BackHandler, Modal, StyleSheet, View } from 'react-native';
import { TIWILoader } from './TIWILoader';

interface LoadingOverlayProps {
    visible: boolean;
    mode?: 'glass' | 'high-contrast';
    onCancel?: () => void;
}

/**
 * Global TIWI Loading Overlay
 * Uses the custom themed GIF animation
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    visible,
    mode = 'glass',
    onCancel
}) => {
    // Handle Back Button (Android)
    useEffect(() => {
        const backAction = () => {
            if (visible && onCancel) {
                onCancel();
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, [visible, onCancel]);

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onCancel}
        >
            <View style={styles.container}>
                {mode === 'glass' ? (
                    <BlurView
                        intensity={40}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                    />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(1, 5, 1, 0.95)' }]} />
                )}

                <TIWILoader size={180} />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
