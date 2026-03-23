import { api } from '@/lib/mobile/api-client';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { SettingsHeader } from '@/components/ui/settings-header';
import { useWalletStore } from '@/store/walletStore';
import * as Device from 'expo-device';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/*
 * Request shape for the bug reporting logic
 */
export interface CreateBugReportRequest {
    userWallet: string;
    description: string;
    title?: string;
    screenshot?: string;
    logFile?: string;
    deviceInfo?: any;
}

const CloudAddIcon = require('@/assets/settings/cloud-add.svg');

/**
 * Custom Toggle Component
 * Matches Tiwi aesthetic (pill shape, green when active)
 */
function TiwiToggle({ value, onValueChange }: { value: boolean; onValueChange: (val: boolean) => void }) {
    const trackStyle = useAnimatedStyle(() => ({
        backgroundColor: value ? '#B1F128' : '#3E3E3E',
    }));

    const thumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: withSpring(value ? 20 : 0) }],
    }));

    return (
        <Pressable onPress={() => onValueChange(!value)} style={styles.toggleTrackWrapper}>
            <Animated.View style={[styles.toggleTrack, trackStyle]}>
                <Animated.View style={[styles.toggleThumb, thumbStyle]} />
            </Animated.View>
        </Pressable>
    );
}

/**
 * Report Bug Screen
 * Matches Figma design 1:1 (node-id: 3279:121427)
 */
export default function ReportBugScreen() {
    const router = useRouter();
    const { bottom } = useSafeAreaInsets();
    const { activeAddress: userWallet } = useWalletStore();

    const [description, setDescription] = useState('');
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [screenshotName, setScreenshotName] = useState<string | null>(null);
    const [screenshotMime, setScreenshotMime] = useState<string | null>(null);
    const [logFile, setLogFile] = useState<string | null>(null);
    const [logFileName, setLogFileName] = useState<string | null>(null);
    const [logFileMime, setLogFileMime] = useState<string | null>(null);
    const [sendDeviceInfo, setSendDeviceInfo] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Media library access is required to upload screenshots.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setScreenshot(result.assets[0].uri);
            const name = result.assets[0].fileName || result.assets[0].uri.split('/').pop() || 'image.jpg';
            setScreenshotName(name);
            setScreenshotMime(result.assets[0].mimeType || 'image/jpeg');
        }
    };

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/plain', 'application/pdf', 'application/json', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setLogFile(result.assets[0].uri);
                setLogFileName(result.assets[0].name);
                setLogFileMime(result.assets[0].mimeType || 'text/plain');
            }
        } catch (err) {
            console.error('Document picking error:', err);
        }
    };

    const handleSubmit = async () => {
        if (!description.trim()) {
            Alert.alert('Error', 'Please describe the issue before submitting.');
            return;
        }

        if (!userWallet) {
            Alert.alert('Error', 'Wallet not connected.');
            return;
        }

        setIsSubmitting(true);

        try {
            let screenshotUrl: string | undefined;
            let logFileUrl: string | undefined;

            // Upload Screenshot if exists - use SDK uploadFile
            if (screenshot && screenshotName && screenshotMime) {
                const uploadRes = await api.uploadFile(screenshot, screenshotName, screenshotMime, 'bug-reports/screenshots');
                if (uploadRes) {
                    screenshotUrl = uploadRes.url;
                }
            }

            // Upload Log File if exists - use SDK uploadFile
            if (logFile && logFileName && logFileMime) {
                const uploadRes = await api.uploadFile(logFile, logFileName, logFileMime, 'bug-reports/logs');
                if (uploadRes) {
                    logFileUrl = uploadRes.url;
                }
            }

            let deviceInfo: any = null;
            if (sendDeviceInfo) {
                deviceInfo = {
                    brand: Device.brand,
                    modelName: Device.modelName,
                    osName: Device.osName,
                    osVersion: Device.osVersion,
                    deviceName: Device.deviceName,
                    platform: Platform.OS,
                };
            }

            const payload: CreateBugReportRequest = {
                userWallet,
                description,
                screenshot: screenshotUrl,
                logFile: logFileUrl,
                deviceInfo,
            };

            const response = await api.bugReports.submit(payload);
            console.log("🚀 ~ handleSubmit ~ response:", response)

            if (response) { // SDK returns parsed json
                Alert.alert('Success', 'Your bug report has been submitted.', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                throw new Error('Failed to submit report');
            }
        } catch (error) {
            console.log("🚀 ~ handleSubmit ~ error:", error)
            Alert.alert('Error', 'Failed to submit bug report. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
            <CustomStatusBar />
            <SettingsHeader
                title="Report a Bug"
                showBack={true}
                onBack={() => router.back()}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom + 40 }]}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.introText}>
                        Help us improve TIWI Protocol by reporting any issues you encounter. Our team will review your report promptly.
                    </Text>

                    {/* Screenshot Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Attach Screenshot (Recommended)</Text>
                        <TouchableOpacity
                            onPress={handlePickImage}
                            activeOpacity={0.8}
                            style={styles.uploadBox}
                        >
                            <View style={styles.uploadInner}>
                                <Image source={CloudAddIcon} style={styles.cloudIcon} contentFit="contain" />
                                <View style={styles.uploadTextContainer}>
                                    <Text style={styles.uploadTitle} numberOfLines={1}>
                                        {screenshotName || 'Choose a file or drag & drop it here'}
                                    </Text>
                                    <Text style={styles.uploadSubtite}>JPEG, PNG formats, up to 50MB</Text>
                                </View>
                                <View style={styles.browseButton}>
                                    <Text style={styles.browseText}>Browse File</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Log File Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Add Log File (Optional)</Text>
                        <TouchableOpacity
                            onPress={handlePickDocument}
                            activeOpacity={0.8}
                            style={styles.uploadBox}
                        >
                            <View style={styles.uploadInner}>
                                <Image source={CloudAddIcon} style={styles.cloudIcon} contentFit="contain" />
                                <View style={styles.uploadTextContainer}>
                                    <Text style={styles.uploadTitle} numberOfLines={1}>
                                        {logFileName || 'Choose a file or drag & drop it here'}
                                    </Text>
                                    <Text style={styles.uploadSubtite}>TXT, PDF, DOCX formats, up to 50MB</Text>
                                </View>
                                <View style={styles.browseButton}>
                                    <Text style={styles.browseText}>Browse File</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Description Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Describe the Issue</Text>
                        <View style={styles.descriptionBox}>
                            <TextInput
                                style={styles.descriptionInput}
                                placeholder="Tell us what happened…"
                                placeholderTextColor="#7C7C7C"
                                multiline
                                numberOfLines={5}
                                textAlignVertical="top"
                                value={description}
                                onChangeText={setDescription}
                            />
                        </View>
                    </View>

                    {/* Device Info Toggle */}
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleText}>Send Device Info Automatically</Text>
                        <TiwiToggle value={sendDeviceInfo} onValueChange={setSendDeviceInfo} />
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                        activeOpacity={0.9}
                    >
                        {isSubmitting ? (
                            <TIWILoader size={40} />
                        ) : (
                            <Text style={styles.submitButtonText}>Submit Bug Report</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#010501',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        gap: 18,
    },
    introText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: '#B5B5B5',
        lineHeight: 18,
    },
    section: {
        gap: 4,
    },
    sectionLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#FFFFFF',
        lineHeight: 24,
    },
    uploadBox: {
        height: 202,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#1F261E',
        borderStyle: 'dashed',
        padding: 10,
    },
    uploadInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    cloudIcon: {
        width: 72,
        height: 72,
    },
    uploadTextContainer: {
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 20,
    },
    uploadTitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: '#B5B5B5',
        textAlign: 'center',
    },
    uploadSubtite: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: '#A9ACB4',
        textAlign: 'center',
    },
    browseButton: {
        height: 46,
        width: '100%',
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#1F261E',
        justifyContent: 'center',
        alignItems: 'center',
    },
    browseText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#FFFFFF',
    },
    descriptionBox: {
        height: 127,
        backgroundColor: '#0B0F0A',
        borderRadius: 16,
        paddingHorizontal: 17,
        paddingVertical: 10,
    },
    descriptionInput: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#FFFFFF',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 44,
    },
    toggleText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#B5B5B5',
    },
    toggleTrackWrapper: {
        padding: 4,
    },
    toggleTrack: {
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#3E3E3E',
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    toggleThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
    },
    submitButton: {
        height: 54,
        backgroundColor: '#B1F128',
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    submitButtonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#010501',
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
});
