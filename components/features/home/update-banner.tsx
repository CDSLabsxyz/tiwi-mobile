import { colors } from '@/constants/colors';
import { updateService, UpdateStatus } from '@/services/updateService';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ArrowRightIcon = require('@/assets/home/arrow-down-01.svg');
const DownloadIcon = require('@/assets/settings/download-03.svg');

export const UpdateBanner: React.FC = () => {
    const router = useRouter();
    const [hasUpdate, setHasUpdate] = useState(false);
    const [newVersion, setNewVersion] = useState('');

    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const unsubscribe = updateService.subscribe((status, _progress, versionInfo) => {
            setHasUpdate(status === 'update-available' || status === 'ready-to-install');
            if (versionInfo?.version) setNewVersion(versionInfo.version);
        });

        // Check for update silently
        updateService.checkForUpdate();

        return unsubscribe;
    }, []);

    if (!hasUpdate) return null;

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/settings/app-updates-cache' as any)}
            style={styles.container}
        >
            <LinearGradient
                colors={['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0.6)', 'rgba(59, 130, 246, 0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.gradientLine}
                pointerEvents="none"
            />

            <View style={styles.leftSection}>
                <View style={styles.iconWrapper}>
                    <Image
                        source={DownloadIcon}
                        style={styles.icon}
                        contentFit="contain"
                        tintColor="#3B82F6"
                    />
                </View>
                <View style={styles.textWrapper}>
                    <Text style={styles.label}>
                        <Text style={styles.labelMuted}>New update </Text>
                        <Text style={styles.labelHighlight}>v{newVersion}</Text>
                        <Text style={styles.labelMuted}> available</Text>
                    </Text>
                </View>
            </View>

            <Image
                source={ArrowRightIcon}
                style={styles.arrow}
                contentFit="contain"
                tintColor={colors.mutedText}
            />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.15)',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 12,
        overflow: 'hidden',
    },
    gradientLine: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1.5,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    iconWrapper: {
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        width: 22,
        height: 22,
    },
    textWrapper: {
        flex: 1,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        includeFontPadding: false,
    },
    labelMuted: {
        color: '#b5b5b5',
    },
    labelHighlight: {
        fontFamily: 'Manrope-SemiBold',
        color: '#3B82F6',
    },
    arrow: {
        width: 20,
        height: 20,
        transform: [{ rotate: '-90deg' }],
    },
});
