import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChevronLeftIcon = require('../../../../assets/swap/arrow-left-02.svg');
const CopyIcon = require('../../../../assets/wallet/copy-01.svg');
const DownloadIcon = require('../../../../assets/settings/download-03.svg');

// Mock private key - in production, this should be retrieved securely after passcode validation
const MOCK_PRIVATE_KEY = '0xdeadbeef1234567890abcdefdeadbeef1234567890abcdefdeadbeef1234567890ab';

export default function ExportPrivateKeyDisplayScreen() {
    const { top } = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ returnTo?: string }>();
    const [copied, setCopied] = useState(false);

    // Handle phone back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });

        return () => backHandler.remove();
    }, [params.returnTo]);

    const handleBackPress = () => {
        router.replace('/settings/accounts' as any);
    };

    const handleCopy = async () => {
        try {
            await Clipboard.setStringAsync(MOCK_PRIVATE_KEY);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy private key:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleDownload = async () => {
        try {
            // No vibration on start, only on success/share trigger
            const fileContent = JSON.stringify({
                version: 1,
                id: Math.random().toString(36).substring(7),
                address: '0x1234567890abcdef1234567890abcdef12345678',
                crypto: {
                    ciphertext: MOCK_PRIVATE_KEY,
                    cipher: 'plaintext-export', // In production, this would be encrypted
                    kdf: 'none',
                    mac: 'none'
                },
                metadata: {
                    name: 'Tiwi Wallet Export',
                    description: 'Keep this file in a secure place. Never share it.',
                    exported_at: new Date().toISOString()
                }
            }, null, 2);

            if (Platform.OS === 'web') {
                const blob = new Blob([fileContent], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `private-key-${Date.now()}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                return;
            }

            // Modern Expo FileSystem API usage
            const fileName = `private-key-${Date.now()}.json`;
            const file = new File(Paths.cache, fileName);

            // Create and write content to the file
            file.create();
            file.write(fileContent);

            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                // Haptic on success
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await Sharing.shareAsync(file.uri, {
                    mimeType: 'application/json',
                    dialogTitle: 'Securely Save Private Key',
                    UTI: 'public.json'
                });
            } else {
                Alert.alert('Sharing Unavailable', 'Your device does not support file sharing.');
            }
        } catch (error) {
            console.error('Failed to download private key:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Failed to export private key');
        }
    };

    return (
        <ThemedView style={styles.container}>
            <CustomStatusBar />

            {/* Header */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleBackPress}
                        style={styles.backButton}
                    >
                        <Image
                            source={ChevronLeftIcon}
                            style={styles.fullSize}
                            contentFit="contain"
                        />
                    </TouchableOpacity>

                    <ThemedText style={styles.headerTitle}>
                        Export Private Key
                    </ThemedText>
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {/* Private Key Display Box */}
                <View style={styles.keyBox}>
                    <ThemedText style={styles.keyText} selectable>
                        {MOCK_PRIVATE_KEY}
                    </ThemedText>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                    {/* Copy Button */}
                    <View style={styles.actionItem}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={handleCopy}
                            style={styles.actionButton}
                        >
                            <View style={styles.iconWrapper}>
                                <Image
                                    source={CopyIcon}
                                    style={styles.fullSize}
                                    contentFit="contain"
                                />
                            </View>
                        </TouchableOpacity>
                        <ThemedText style={styles.actionLabel}>
                            {copied ? 'Copied!' : 'Copy'}
                        </ThemedText>
                    </View>

                    {/* Download Button */}
                    <View style={styles.actionItem}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={handleDownload}
                            style={styles.actionButton}
                        >
                            <View style={styles.iconWrapper}>
                                <Image
                                    source={DownloadIcon}
                                    style={styles.fullSize}
                                    contentFit="contain"
                                />
                            </View>
                        </TouchableOpacity>
                        <ThemedText style={styles.actionLabel}>
                            Download
                        </ThemedText>
                    </View>
                </View>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 68,
        paddingVertical: 10,
    },
    backButton: {
        width: 24,
        height: 24,
    },
    headerTitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 20,
        lineHeight: 20,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
        alignItems: 'center',
    },
    keyBox: {
        width: '100%',
        maxWidth: 353,
        minHeight: 99,
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        paddingHorizontal: 17,
        paddingVertical: 10,
        marginBottom: 24,
        justifyContent: 'center',
    },
    keyText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'left',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionItem: {
        width: 100,
        gap: 8,
        alignItems: 'center',
    },
    actionButton: {
        width: '100%',
        height: 56,
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapper: {
        width: 24,
        height: 24,
    },
    actionLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        textAlign: 'center',
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
