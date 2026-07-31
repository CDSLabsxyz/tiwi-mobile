import { colors } from '@/constants/colors';
import { browserRoute, ECOSYSTEM_LINKS } from '@/constants/ecosystem-links';
import { useTranslation } from '@/hooks/useLocalization';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TextStyle, TouchableOpacity, View } from 'react-native';

const TiwiFlixIcon = require('../../../assets/dapp-icons/tiwiflix.svg');

interface QuickAction {
    id: string;
    label: string;
    icon: any;
    route: string;
    ioniconName?: keyof typeof Ionicons.glyphMap;
}

/**
 * Quick Actions Section
 * Two rows: primary actions, then the secondary tools row.
 */
export const QuickActionsSection: React.FC = () => {
    const router = useRouter();
    const { t } = useTranslation();

    const primaryActions: QuickAction[] = [
        { id: 'swap', label: t('nav.swap'), icon: require('../../../assets/home/exchange-01.svg'), route: '/swap' },
        { id: 'stake', label: t('home.stake'), icon: require('../../../assets/home/stake-1.svg'), route: '/earn' },
        // { id: 'pool', label: 'Pool', icon: require('../../../assets/home/coins-02-1.svg'), route: '/pool' },
        { id: 'referrals', label: 'Referrals', icon: null, ioniconName: 'gift-outline' as const, route: '/referral' },
        {
            id: 'tiwilock',
            label: 'TiwiLock',
            icon: null,
            ioniconName: 'lock-closed-outline' as const,
            route: browserRoute(ECOSYSTEM_LINKS.tiwilock),
        },
        { id: 'multisend', label: 'Multisend', icon: null, ioniconName: 'people-outline' as const, route: '/send' },
    ];

    const secondaryActions: QuickAction[] = [
        { id: 'settings', label: 'Settings', icon: null, ioniconName: 'settings-outline' as const, route: '/settings' },
        { id: 'pool', label: 'Liq. Pool', icon: null, ioniconName: 'water-outline' as const, route: '/pool' },
        {
            id: 'campaign',
            label: 'Campaigns',
            icon: null,
            ioniconName: 'megaphone-outline' as const,
            route: browserRoute(ECOSYSTEM_LINKS.campaigns),
        },
        {
            id: 'tiwiflix',
            label: 'TiwiFlix',
            icon: TiwiFlixIcon,
            route: browserRoute(ECOSYSTEM_LINKS.tiwiflix),
        },
        { id: 'more', label: 'More', icon: require('../../../assets/home/dashboard-square-edit.svg'), route: '/more' },
    ];

    const renderAction = (action: QuickAction, labelStyle?: TextStyle) => (
        <TouchableOpacity
            key={action.id}
            onPress={() => router.push(action.route as any)}
            style={styles.actionButton}
            activeOpacity={0.7}
        >
            <View style={styles.iconWrapper}>
                {action.ioniconName ? (
                    <Ionicons name={action.ioniconName} size={24} color={colors.titleText} />
                ) : (
                    <Image
                        source={action.icon}
                        style={styles.icon}
                        contentFit="contain"
                    />
                )}
            </View>
            <Text style={[styles.label, labelStyle]} numberOfLines={2}>
                {action.label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.wrapper}>
            <View style={styles.container}>
                {primaryActions.map((action) => renderAction(action))}
            </View>
            <View style={styles.container}>
                {secondaryActions.map((action) => renderAction(action, styles.labelCompact))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
        gap: 16,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        width: "100%",
    },
    actionButton: {
        flex: 1,
        alignItems: 'center',
        gap: 8,
    },
    iconWrapper: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: colors.bgCards,
    },
    icon: {
        width: 24,
        height: 24,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        textAlign: 'center',
    },
    labelCompact: {
        fontSize: 12,
        lineHeight: 15,
    },
});
