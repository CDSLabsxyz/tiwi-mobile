import { colors } from '@/constants/colors';
import { registerForPushNotificationsAsync, sendTestNotification } from '@/services/notificationService';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSecurityStore } from '@/store/securityStore';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NotificationIcon = require('@/assets/security/notification.svg');

export default function NotificationsScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const enableNotifications = useSecurityStore((state) => state.enableNotifications);
    const setSetupComplete = useSecurityStore((state) => state.setSetupComplete);
    const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);

    const [loading, setLoading] = useState(false);

    const handleEnable = async () => {
        setLoading(true);
        try {
            const token = await registerForPushNotificationsAsync();
            if (token) {
                enableNotifications(true);
                await sendTestNotification();
            }

            setSetupComplete(true);
            await completeOnboarding();
            router.replace('/(tabs)');
        } catch (error) {
            console.error('Notification setup failed', error);
            // Even if it fails, we move on but set false
            setSetupComplete(true);
            router.replace('/(tabs)');
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = async () => {
        enableNotifications(false);
        setSetupComplete(true);
        // Finally, mark onboarding as complete to avoid loops
        await completeOnboarding();
        router.replace('/(tabs)');
    };

    return (
        <View style={[styles.container, { paddingTop: top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Image
                        source={NotificationIcon}
                        style={styles.icon}
                        contentFit="contain"
                    />
                </View>

                <Text style={styles.title}>Stay Up-to-Date</Text>
                <Text style={styles.subtitle}>
                    Enable notifications to receive timely alerts, important updates
                </Text>
            </View>

            <View style={[styles.footer, { paddingBottom: bottom || 24 }]}>
                <TouchableOpacity
                    style={styles.primaryButton}
                    activeOpacity={0.8}
                    onPress={handleEnable}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#000000" />
                    ) : (
                        <Text style={styles.primaryButtonText}>Enable Notifications</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryButton}
                    activeOpacity={0.6}
                    onPress={handleSkip}
                >
                    <Text style={styles.secondaryButtonText}>Skip for Now</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        marginTop: -40,
    },
    iconContainer: {
        marginBottom: 40,
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        width: 80,
        height: 80,
        // Icon has its own color in SVG
    },
    title: {
        fontFamily: 'Manrope-Bold',
        fontSize: 24,
        color: '#FFFFFF',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        color: '#B5B5B5',
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 280,
    },
    footer: {
        paddingHorizontal: 24,
        gap: 16,
        width: '100%',
    },
    primaryButton: {
        height: 56,
        backgroundColor: colors.primaryCTA,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#000000',
    },
    secondaryButton: {
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.primaryCTA,
    },
});
