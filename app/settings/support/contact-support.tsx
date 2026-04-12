import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Assets
const MailIcon = require('@/assets/settings/mail-01.svg');
const TelegramIcon = require('@/assets/settings/telegram.svg');
const XIcon = require('@/assets/settings/new-twitter-rectangle.svg');
const ArrowRightIcon = require('@/assets/settings/arrow-right-01.svg');

/**
 * Contact Support Screen
 * Logic: Simple redirection to Email, Telegram, and X.
 * Handles derived from "tiwicat" and "tiwiecosystem".
 * Matches Figma design exactly (node-id: 3279:121496)
 */
export default function ContactSupportScreen() {
    const router = useRouter();

    const handleContact = (type: 'email' | 'telegram' | 'X') => {
        // Haptic feedback for interaction
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        let url = '';
        switch (type) {
            case 'email':
                url = 'mailto:info@tiwiprotocol.xyz';
                break;
            case 'telegram':
                url = 'https://t.me/TIWIEcosystemSupport';
                break;
            case 'X':
                url = 'https://x.com/tiwiprotocol';
                break;
        }

        Linking.openURL(url).catch(() => {
            Alert.alert(
                'Action Required',
                `Could not open the ${type === 'email' ? 'Email client' : type} app. Please ensure it is installed on your device.`
            );
        });
    };

    const contactOptions = [
        {
            id: 'email',
            label: 'Email',
            icon: MailIcon,
            onPress: () => handleContact('email'),
        },
        {
            id: 'telegram',
            label: 'Telegram',
            icon: TelegramIcon,
            onPress: () => handleContact('telegram'),
        },
        {
            id: 'x',
            label: 'X (formerly Twitter)',
            icon: XIcon,
            onPress: () => handleContact('X'),
        },
    ];

    return (
        <View style={styles.container}>
            <CustomStatusBar />
            <SettingsHeader
                title="Contact Support"
                showBack={true}
                onBack={() => router.back()}
            />

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.optionsList}>
                    {contactOptions.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={styles.optionItem}
                            onPress={option.onPress}
                            activeOpacity={0.6}
                        >
                            <View style={styles.optionLeft}>
                                <View style={styles.iconWrapper}>
                                    <Image
                                        source={option.icon}
                                        style={styles.icon}
                                        contentFit="contain"
                                        tintColor={colors.bodyText} // Consistent with design style
                                    />
                                </View>
                                <Text style={styles.optionLabel}>{option.label}</Text>
                            </View>
                            <Image
                                source={ArrowRightIcon}
                                style={styles.arrowIcon}
                                contentFit="contain"
                                tintColor={colors.mutedText}
                            />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg, // #010501
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 32,
        paddingHorizontal: 20,
    },
    optionsList: {
        gap: 32, // More generous spacing for premium feel
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingVertical: 4,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconWrapper: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        width: 24,
        height: 24,
    },
    optionLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 18,
        color: colors.bodyText, // #B5B5B5
        lineHeight: 24,
    },
    arrowIcon: {
        width: 24,
        height: 24,
    },
});
