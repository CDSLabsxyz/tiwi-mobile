import { colors } from '@/constants/colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import React, { useRef } from 'react';
import { Alert, Modal, Share as RNShare, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

interface ReferralQRCodeModalProps {
    visible: boolean;
    onClose: () => void;
    referralLink: string;
    referralCode: string;
}

export function ReferralQRCodeModal({ visible, onClose, referralLink, referralCode }: ReferralQRCodeModalProps) {
    const { bottom } = useSafeAreaInsets();
    const viewShotRef = useRef<any>(null);

    const handleShare = async () => {
        try {
            const uri = await viewShotRef.current.capture();
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                await RNShare.share({
                    message: `Join me on TIWI Protocol! Use my code ${referralCode}: ${referralLink}`,
                    url: referralLink,
                });
            }
        } catch (error) {
            console.error('Error sharing QR code:', error);
            Alert.alert('Error', 'Failed to share QR code');
        }
    };

    const handleSave = async () => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'We need permission to save the QR code to your gallery.');
                return;
            }

            const uri = await viewShotRef.current.capture();
            const asset = await MediaLibrary.createAssetAsync(uri);
            await MediaLibrary.createAlbumAsync('TIWI Referrals', asset, false);
            Alert.alert('Success', 'QR code saved to your gallery!');
        } catch (error) {
            console.error('Error saving QR code:', error);
            Alert.alert('Error', 'Failed to save QR code');
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={[styles.content, { paddingBottom: bottom > 0 ? bottom : 24 }]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Your Referral QR Code</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.titleText} />
                        </TouchableOpacity>
                    </View>

                    <ViewShot
                        ref={viewShotRef}
                        options={{ format: 'png', quality: 1.0 }}
                        style={styles.qrContainer}
                    >
                        <View style={styles.qrBackground}>
                            <QRCode
                                value={referralLink}
                                size={220}
                                color="#000"
                                backgroundColor="#fff"
                                logo={require('@/assets/images/tiwi-protocol-android-icon-foreground.png')} // Replace with your actual logo if available
                                logoSize={50}
                                logoBackgroundColor='black'
                                logoMargin={2}
                                logoBorderRadius={10}
                            />
                            <Text style={styles.qrCodeLabel}>{referralCode}</Text>
                        </View>
                    </ViewShot>

                    <Text style={styles.instructions}>
                        Let your friends scan this code to join TIWI Protocol under your referral.
                    </Text>

                    <View style={styles.actionContainer}>
                        <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
                            <Ionicons name="download-outline" size={24} color={colors.primaryCTA} />
                            <Text style={styles.actionText}>Save Image</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                            <Ionicons name="share-social-outline" size={24} color={colors.primaryCTA} />
                            <Text style={styles.actionText}>Share</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: colors.bgCards,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: colors.titleText,
    },
    closeButton: {
        padding: 4,
    },
    qrContainer: {
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    qrBackground: {
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    qrCodeLabel: {
        marginTop: 12,
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
        color: '#000',
        letterSpacing: 2,
    },
    instructions: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 20,
        paddingHorizontal: 20,
    },
    actionContainer: {
        flexDirection: 'row',
        gap: 16,
        width: '100%',
    },
    actionButton: {
        flex: 1,
        height: 56,
        borderRadius: 12,
        backgroundColor: 'rgba(177, 241, 40, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(177, 241, 40, 0.2)',
    },
    actionText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.primaryCTA,
    },
});
