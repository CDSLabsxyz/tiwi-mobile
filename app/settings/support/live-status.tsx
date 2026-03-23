import { api } from '@/lib/mobile/api-client';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import { useQuery } from '@tanstack/react-query';

// Interface matching the legacy type but used locally
export interface LiveStatus {
    id: string;
    service: string;
    status: 'operational' | 'degraded' | 'maintenance' | 'down';
    description?: string;
    lastUpdated?: string;
}

import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Live Status Screen
 * Displays real-time status of protocol services (Swap, Bridge, Staking, etc.)
 * Mirroring TIWI Super App's design from Figma (node-id: 3279-121284)
 */
export default function LiveStatusScreen() {
    const router = useRouter();
    const { bottom } = useSafeAreaInsets();

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['liveStatus'],
        queryFn: () => api.liveStatus.get(),
    });
    console.log("🚀 ~ LiveStatusScreen ~ data:", data)

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'operational':
                return {
                    bg: '#00822B', // Figma line 101
                    text: '#BDF4CF', // Figma line 102 & 119
                };
            case 'degraded':
                return {
                    bg: '#CE9A2D', // Figma line 118
                    text: '#BDF4CF',
                };
            case 'down':
                return {
                    bg: '#D21010', // Figma line 169
                    text: '#FFC5C5', // Figma line 170
                };
            case 'maintenance':
            default:
                return {
                    bg: '#1C1C1E', // Default neutral dark
                    text: '#7C7C7C',
                };
        }
    };

    const renderItem = ({ item }: { item: LiveStatus }) => {
        const statusStyle = getStatusStyles(item.status);

        // Dynamic descriptions based on TIWI Super App logic or Figma fallbacks
        const getDescription = (service: string, status: string) => {
            if (item.description) return item.description;

            if (status === 'operational') return `${service} executing normally`;
            if (status === 'maintenance') return `${service} offline for maintenance`;
            if (status === 'down') return `${service} service interrupted`;
            if (status === 'degraded') return `${service} performance issues detected`;
            return `Checking ${service.toLowerCase()} state...`;
        };

        return (
            <View style={styles.statusCard}>
                <View style={styles.cardLeft}>
                    <Text style={styles.serviceName}>{item.service}</Text>
                    <Text style={styles.serviceDescription}>
                        {getDescription(item.service, item.status)}
                    </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusLabel, { color: statusStyle.text }]}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <CustomStatusBar />
            <SettingsHeader
                title="Live Status"
                onBack={() => router.back()}
                showBack={true}
            />

            {isLoading ? (
                <View style={styles.centerContainer}>
                    <TIWILoader size={100} />
                </View>
            ) : isError ? (
                <View style={styles.centerContainer}>
                    <Text style={styles.errorText}>Failed to load system status</Text>
                </View>
            ) : (
                <FlatList
                    data={data?.statuses || []}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={[
                        styles.listContent,
                        { paddingBottom: bottom + 20 }
                    ]}
                    refreshControl={
                        <RefreshControl
                            refreshing={isLoading}
                            onRefresh={refetch}
                            tintColor={colors.primaryCTA}
                        />
                    }
                    ListHeaderComponent={() => (
                        <View style={styles.headerSpacer} />
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#010501', // Figma: Dark/bg #010501
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
    },
    headerSpacer: {
        height: 20,
    },
    statusCard: {
        backgroundColor: '#0B0F0A', // Figma: Dark/bg semi #0B0F0A
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        height: 80, // Figma: h-[80px]
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    cardLeft: {
        flex: 1,
        justifyContent: 'center',
    },
    serviceName: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: '#FFFFFF',
        marginBottom: 4,
    },
    serviceDescription: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
        minWidth: 87,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        textAlign: 'center',
    },
    errorText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#D21010',
    },
});
