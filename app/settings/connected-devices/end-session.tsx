/**
 * End This Session Screen
 * 
 * Confirmation page for logging out of the current or a remote device.
 * Integrated with Supabase for cloud-synced security.
 */

import { StatusBar } from '@/components/ui/StatusBar';
import { colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { cloudSessionService } from '@/services/cloudSessionService';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');

export default function EndSessionScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{
        dbId?: string; // The UUID from Supabase sessions table
        deviceName?: string;
        ipAddress?: string;
        location?: string;
        lastActive?: string;
        isCurrentDevice?: string;
    }>();

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });
        return () => backHandler.remove();
    }, []);

    const handleBackPress = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/settings/connected-devices' as any);
        }
    };

    const handleYesTerminate = async () => {
        if (!params.dbId) return;

        try {
            const success = await cloudSessionService.terminateSession(supabase, params.dbId);
            if (success) {
                router.replace('/settings/connected-devices' as any);
            }
        } catch (error) {
            console.error('[EndSession] Terminate Error:', error);
        }
    };

    const deviceName = params.deviceName || 'This Device';
    const ipAddress = params.ipAddress || 'Unknown';
    const location = params.location || 'Unknown';
    const lastActiveAt = params.lastActive || new Date().toISOString();

    const formatTimeAgo = (timestamp: string) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        return 'Recently';
    };

    return (
        <View style={styles.container}>
            <StatusBar />

            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity activeOpacity={0.8} onPress={handleBackPress} style={styles.backButton}>
                        <Image source={ChevronLeftIcon} style={styles.fullImage} contentFit="contain" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>End This Session</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.infoWrapper}>
                    <Text style={styles.infoText}>
                        This device will be logged out immediately and will no longer have access to your wallet.
                    </Text>
                </View>

                <View style={styles.deviceInfoRow}>
                    <View style={styles.deviceNameCol}>
                        <Text style={styles.deviceName} numberOfLines={1}>{deviceName}</Text>
                        <Text style={styles.deviceIp}>{ipAddress}</Text>
                    </View>
                    <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
                    <Text style={styles.timeText} numberOfLines={1}>{formatTimeAgo(lastActiveAt)}</Text>
                </View>

                <View style={[styles.buttonsContainer, { paddingBottom: (bottom || 16) + 24 }]}>
                    <TouchableOpacity activeOpacity={0.8} onPress={handleYesTerminate} style={styles.yesBtn}>
                        <Text style={styles.yesBtnText}>Yes Terminate</Text>
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.8} onPress={handleBackPress} style={styles.cancelBtn}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { backgroundColor: colors.bg, paddingHorizontal: 21 },
    headerContent: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 10 },
    backButton: { width: 24, height: 24 },
    fullImage: { width: '100%', height: '100%' },
    headerTitle: { fontFamily: 'Manrope-Medium', fontSize: 20, color: colors.titleText, flex: 1, textAlign: 'center' },
    content: { flex: 1, paddingHorizontal: 21, alignItems: 'center' },
    infoWrapper: { width: '100%', maxWidth: 400, marginTop: 8, marginBottom: 67 },
    infoText: { fontFamily: 'Manrope-Medium', fontSize: 12, lineHeight: 18, color: colors.titleText },
    deviceInfoRow: { width: '100%', maxWidth: 400, flexDirection: 'row', alignItems: 'center', gap: 32, marginBottom: 135 },
    deviceNameCol: { flexDirection: 'column', gap: 4, width: 110 },
    deviceName: { fontFamily: 'Manrope-Medium', fontSize: 14, color: colors.titleText },
    deviceIp: { fontFamily: 'Manrope-Medium', fontSize: 12, color: colors.titleText },
    locationText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: colors.titleText, width: 62 },
    timeText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: colors.titleText, width: 55 },
    buttonsContainer: { width: '100%', maxWidth: 400, gap: 16 },
    yesBtn: { width: '100%', height: 54, backgroundColor: colors.primaryCTA, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
    yesBtnText: { fontFamily: 'Manrope-Medium', fontSize: 16, color: colors.bg },
    cancelBtn: { width: '100%', height: 54, backgroundColor: colors.bgCards, borderWidth: 1, borderColor: colors.primaryCTA, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
    cancelBtnText: { fontFamily: 'Manrope-Regular', fontSize: 16, color: colors.primaryCTA },
});
