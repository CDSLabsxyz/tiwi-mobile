/**
 * Connected Devices Screen
 * 
 * Displays and manages all devices logged into the Tiwi Protocol wallet.
 * Synchronized with Supabase for global security control.
 */

import { StatusBar } from '@/components/ui/StatusBar';
import { colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { cloudSessionService } from '@/services/cloudSessionService';
import { deviceService } from '@/services/deviceService';
import { mobileSessionManager } from '@/services/mobileSessionManager';
import { useWalletStore } from '@/store/walletStore';
import { CloudSession } from '@/types/session';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    BackHandler,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');

export default function ConnectedDevicesScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ returnTo?: string }>();
    const { address } = useWalletStore();

    const [sessions, setSessions] = useState<CloudSession[]>([]);
    const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });
        return () => backHandler.remove();
    }, []);

    useEffect(() => {
        loadData();
    }, [address]);

    const loadData = async () => {
        if (!address) return;
        setIsLoading(true);
        try {
            const devId = await deviceService.getOrCreateDeviceId();
            setCurrentDeviceId(devId);

            // Sync current session first
            await mobileSessionManager.syncCurrentSession(address);

            // Fetch all sessions from cloud
            const data = await cloudSessionService.getSessions(supabase, address);
            setSessions(data);
        } catch (error: any) {
            if (error?.message?.includes('Network request failed')) {
                console.warn('[ConnectedDevices] Offline or network error while loading sessions.');
            } else {
                console.error('[ConnectedDevices] Load Error:', error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackPress = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/settings' as any);
        }
    };

    const handleTerminate = async (sessionId: string, deviceName: string) => {
        Alert.alert(
            'Terminate Session?',
            `Are you sure you want to log out ${deviceName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Terminate',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await cloudSessionService.terminateSession(supabase, sessionId);
                        if (success) loadData();
                    }
                }
            ]
        );
    };

    const handleTerminateAll = async () => {
        if (!address || !currentDeviceId) return;

        Alert.alert(
            'Terminate All Others?',
            'This will log out every device except your current one.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Terminate All',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await cloudSessionService.terminateAllOtherSessions(supabase, address, currentDeviceId);
                        if (success) loadData();
                    }
                }
            ]
        );
    };

    const formatTimeAgo = (timestamp: string) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    return (
        <View style={styles.container}>
            <StatusBar />

            {/* Header */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleBackPress}
                        style={styles.backButton}
                    >
                        <Image source={ChevronLeftIcon} style={styles.fullImage} contentFit="contain" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Connected Devices</Text>
                </View>
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
                <ScrollView
                    style={styles.flex1}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={isLoading} onRefresh={loadData} tintColor={colors.primaryCTA} />
                    }
                >
                    {/* Info Text */}
                    <View style={styles.infoWrapper}>
                        <Text style={styles.infoText}>
                            These are the devices currently logged into your TIWI Protocol Wallet.{' '}
                            If you notice any unfamiliar activity, terminate the session immediately.
                        </Text>
                    </View>

                    {/* Devices List */}
                    <View style={styles.listWrapper}>
                        {sessions.map((device) => {
                            const isCurrent = device.device_id === currentDeviceId;
                            const isActive = device.is_active;

                            return (
                                <View key={device.id} style={[styles.deviceRow, !isActive && styles.inactiveRow]}>
                                    <View style={styles.deviceInfoCol}>
                                        <Text style={styles.deviceName} numberOfLines={1}>{device.device_name}</Text>
                                        <Text style={styles.deviceIp}>{device.ip_address}</Text>
                                    </View>

                                    <Text style={styles.locationText} numberOfLines={1}>{device.location}</Text>

                                    <Text style={[
                                        styles.statusText,
                                        { color: (isCurrent && isActive) ? colors.primaryCTA : (isActive ? colors.titleText : colors.mutedText) }
                                    ]}>
                                        {(isCurrent && isActive) ? 'Active' : (isActive ? formatTimeAgo(device.last_active_at) : 'Terminated')}
                                    </Text>

                                    {isActive && (
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => {
                                                if (isCurrent) {
                                                    router.push({
                                                        pathname: '/settings/connected-devices/end-session',
                                                        params: {
                                                            dbId: device.id,
                                                            deviceName: device.device_name,
                                                            ipAddress: device.ip_address,
                                                            location: device.location,
                                                            lastActive: device.last_active_at,
                                                            isCurrentDevice: 'true'
                                                        }
                                                    } as any);
                                                } else {
                                                    handleTerminate(device.id, device.device_name);
                                                }
                                            }}
                                            style={styles.terminateBtn}
                                        >
                                            <Text style={styles.terminateBtnText}>Terminate</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>

                {/* Bottom Section */}
                <View style={[styles.bottomSection, { paddingBottom: (bottom || 16) + 24 }]}>
                    <View style={styles.bottomContent}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleTerminateAll}
                            style={styles.terminateAllBtn}
                        >
                            <Text style={styles.terminateAllBtnText}>Terminate All Sessions</Text>
                        </TouchableOpacity>
                        <Text style={styles.bottomDisclaimer}>
                            Signs out every device except the one you're using now.
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    flex1: { flex: 1 },
    header: { backgroundColor: colors.bg, paddingHorizontal: 21 },
    headerContent: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 10 },
    backButton: { width: 24, height: 24 },
    fullImage: { width: '100%', height: '100%' },
    headerTitle: { fontFamily: 'Manrope-Medium', fontSize: 20, color: colors.titleText, flex: 1, textAlign: 'center' },
    contentContainer: { flex: 1 },
    scrollContent: { paddingTop: 8, paddingHorizontal: 20, alignItems: 'center' },
    infoWrapper: { width: '100%', maxWidth: 400, marginBottom: 13 },
    infoText: { fontFamily: 'Manrope-Medium', fontSize: 12, lineHeight: 18, color: colors.titleText },
    listWrapper: { width: '100%', maxWidth: 400, gap: 30 },
    deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 15, width: '100%' },
    inactiveRow: { opacity: 0.5 },
    deviceInfoCol: { flexDirection: 'column', gap: 4, width: 101 },
    deviceName: { fontFamily: 'Manrope-Medium', fontSize: 14, color: colors.titleText },
    deviceIp: { fontFamily: 'Manrope-Medium', fontSize: 12, color: colors.titleText },
    locationText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: colors.titleText, width: 62 },
    statusText: { fontFamily: 'Manrope-Medium', fontSize: 12, width: 55 },
    terminateBtn: { backgroundColor: colors.bgCards, borderRadius: 100, padding: 10, width: 90, alignItems: 'center' },
    terminateBtnText: { fontFamily: 'Manrope-Medium', fontSize: 14, color: colors.titleText },
    thisDevicePlaceholder: { width: 90 },
    bottomSection: { paddingHorizontal: 20, paddingTop: 24, alignItems: 'center', backgroundColor: colors.bg },
    bottomContent: { width: '100%', maxWidth: 400, gap: 8, alignItems: 'center' },
    terminateAllBtn: { width: '100%', height: 54, backgroundColor: colors.primaryCTA, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
    terminateAllBtnText: { fontFamily: 'Manrope-Medium', fontSize: 16, color: colors.bg },
    bottomDisclaimer: { fontFamily: 'Manrope-Medium', fontSize: 12, color: colors.titleText, textAlign: 'center' },
});
