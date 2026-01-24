import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import {
    formatTimeAgo,
    getDeviceSessions,
    registerCurrentDevice,
    terminateAllOtherSessions,
    terminateDeviceSession,
    type DeviceSession,
} from '@/utils/deviceManager';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ConnectedDevicesScreen() {
    const { bottom } = useSafeAreaInsets();
    const [devices, setDevices] = useState<DeviceSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadDevices();
    }, []);

    const loadDevices = async () => {
        setIsLoading(true);
        try {
            await registerCurrentDevice();
            const sessions = await getDeviceSessions();
            const sorted = sessions.sort((a, b) => {
                if (a.isActive) return -1;
                if (b.isActive) return 1;
                return b.lastActive - a.lastActive;
            });
            setDevices(sorted);
        } catch (error) {
            console.error('Failed to load devices:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTerminateDevice = async (deviceId: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        try {
            await terminateDeviceSession(deviceId);
            await loadDevices();
        } catch (error) {
            console.error('Failed to terminate device:', error);
        }
    };

    const handleTerminateAll = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        try {
            await terminateAllOtherSessions();
            await loadDevices();
        } catch (error) {
            console.error('Failed to terminate all sessions:', error);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="Connected Devices" />

            <View style={styles.mainWrapper}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    alwaysBounceVertical={true}
                >
                    <View style={styles.infoWrapper}>
                        <ThemedText style={styles.infoText}>
                            These are the devices currently logged into your TIWI Protocol Wallet.{' '}
                            If you notice any unfamiliar activity, terminate the session immediately.
                        </ThemedText>
                    </View>

                    <View style={styles.listWrapper}>
                        {devices.map((device) => (
                            <View key={device.id} style={styles.deviceRow}>
                                <View style={styles.deviceMainInfo}>
                                    <ThemedText type="defaultSemiBold" style={styles.deviceNameText}>
                                        {device.deviceName}
                                    </ThemedText>
                                    <ThemedText style={styles.deviceIpText}>
                                        {device.ipAddress}
                                    </ThemedText>
                                </View>

                                <View style={styles.deviceMetaInfo}>
                                    <ThemedText style={styles.deviceLocationText}>
                                        {device.location}
                                    </ThemedText>
                                    <ThemedText
                                        style={[
                                            styles.deviceStatusText,
                                            { color: device.isActive ? colors.primaryCTA : colors.titleText }
                                        ]}
                                    >
                                        {device.isActive ? 'Active' : formatTimeAgo(device.lastActive)}
                                    </ThemedText>
                                </View>

                                {!device.isActive && (
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => handleTerminateDevice(device.id)}
                                        style={styles.terminateBtn}
                                    >
                                        <ThemedText style={styles.terminateBtnText}>Terminate</ThemedText>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                    </View>
                </ScrollView>

                <View style={[styles.bottomSection, { paddingBottom: (bottom || 16) + 24 }]}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleTerminateAll}
                        style={styles.terminateAllBtn}
                    >
                        <ThemedText style={styles.terminateAllBtnText}>
                            Terminate All Sessions
                        </ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={styles.bottomInfoText}>
                        Signs out every device except the one you're using now.
                    </ThemedText>
                </View>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    mainWrapper: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingTop: 24,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    infoWrapper: {
        marginBottom: 24,
    },
    infoText: {
        fontSize: 13,
        lineHeight: 20,
        opacity: 0.7,
    },
    listWrapper: {
        gap: 32,
    },
    deviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    deviceMainInfo: {
        flex: 2,
        gap: 4,
    },
    deviceNameText: {
        fontSize: 15,
    },
    deviceIpText: {
        fontSize: 12,
        opacity: 0.6,
    },
    deviceMetaInfo: {
        flex: 1.5,
        gap: 4,
    },
    deviceLocationText: {
        fontSize: 12,
        opacity: 0.8,
    },
    deviceStatusText: {
        fontSize: 12,
    },
    terminateBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    terminateBtnText: {
        fontSize: 13,
    },
    bottomSection: {
        paddingHorizontal: 20,
        paddingTop: 20,
        gap: 12,
    },
    terminateAllBtn: {
        width: '100%',
        height: 56,
        backgroundColor: colors.primaryCTA,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    terminateAllBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#050201',
    },
    bottomInfoText: {
        fontSize: 12,
        textAlign: 'center',
        opacity: 0.6,
    },
});
