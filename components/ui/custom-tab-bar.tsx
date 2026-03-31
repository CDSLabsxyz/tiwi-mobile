import { colors } from '@/constants/colors';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HomeIcon = require('@/assets/home/home-01.svg');
const MarketIcon = require('@/assets/home/market-analysis.svg');
const EarnIcon = require('@/assets/home/stake_icon.svg');
const WalletIcon = require('@/assets/home/wallet-03.svg');
const MenuSwapGif = require('@/assets/GIF/Menu_swap.gif');

/**
 * Custom Tab Bar - Exact implementation of Figma Design (node-id: 3331:39287)
 * Pinned to the absolute bottom of the screen.
 */
export const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const getIcon = (name: string, focused: boolean) => {
        const tint = focused ? colors.primaryCTA : '#B5B5B5';
        switch (name) {
            case 'index':
                return <Image source={HomeIcon} style={[styles.icon, { tintColor: focused ? "" : "#B5B5B5" }]} contentFit="contain" />;
            case 'market':
                return <Image source={MarketIcon} style={[styles.icon, { tintColor: tint }]} contentFit="contain" />;
            case 'earn':
                return <Image source={EarnIcon} style={[styles.icon, { tintColor: tint }]} contentFit="contain" />;
            case 'wallet':
                return <Image source={WalletIcon} style={[styles.icon, { tintColor: tint }]} contentFit="contain" />;
            default:
                return null;
        }
    };

    // Filter visible routes
    const visibleRoutes = state.routes.filter(route => {
        const options = descriptors[route.key].options as any;
        return options.href !== null;
    });

    const leftRoutes = visibleRoutes.slice(0, 2);
    const rightRoutes = visibleRoutes.slice(2, 4);

    const renderTab = (route: any) => {
        const index = state.routes.findIndex(r => r.key === route.key);
        const options = descriptors[route.key].options as any;
        const isFocused = state.index === index;

        const onPress = () => {
            const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
            }
        };

        return (
            <TouchableOpacity
                key={route.key}
                activeOpacity={0.7}
                onPress={onPress}
                style={styles.tabItem}
            >
                <View style={styles.iconWrapper}>
                    {getIcon(route.name, isFocused)}
                </View>
                <Text
                    style={[
                        styles.tabLabel,
                        { color: isFocused ? colors.primaryCTA : '#B5B5B5' }
                    ]}
                >
                    {options.title || route.name}
                </Text>
            </TouchableOpacity>
        );
    };

    // Check if tab bar should be hidden for the current screen
    const focusedRouteKey = state.routes[state.index].key;
    const focusedOptions = descriptors[focusedRouteKey].options as any;

    if (focusedOptions.tabBarStyle?.display === 'none') {
        return null;
    }

    return (
        <View style={[styles.wrapper, { height: 72 + insets.bottom }]}>
            {/* Background Layer with Radii and Border */}
            <View style={[styles.background, { paddingBottom: insets.bottom }]}>
                <View style={styles.menusContainer}>
                    <View style={styles.menuGroup}>
                        {leftRoutes.map(renderTab)}
                    </View>
                    <View style={styles.gap} />
                    <View style={styles.menuGroup}>
                        {rightRoutes.map(renderTab)}
                    </View>
                </View>
            </View>

            {/* Floating Central Button - Placed inside the wrapper, relative to bottom */}
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push('/swap')}
                style={[styles.floatingButton, { bottom: insets.bottom + 12 }]}
            >
                {Platform.OS === 'android' && (
                    <View style={styles.androidGlow} />
                )}
                <Image
                    source={MenuSwapGif}
                    style={styles.fullSize}
                    contentFit="contain"
                />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'transparent',
        zIndex: 1000,
    },
    background: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#010501',
        borderTopWidth: 0.5,
        borderColor: '#1F261E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        ...Platform.select({
            ios: {
                shadowColor: '#B1F128',
                shadowOffset: { width: 0, height: -1 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    menusContainer: {
        height: 72,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    menuGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    gap: {
        width: 90,
    },
    tabItem: {
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    iconWrapper: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        width: 24,
        height: 24,
    },
    tabLabel: {
        fontSize: 12,
        fontFamily: 'Manrope-Medium',
        textAlign: 'center',
    },
    floatingButton: {
        position: 'absolute',
        left: '50%',
        marginLeft: -45,
        width: 90,
        height: 90,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        overflow: 'visible',
        ...Platform.select({
            ios: {
                shadowColor: colors.primaryCTA,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.9,
                shadowRadius: 20,
            },
        }),
    },
    androidGlow: {
        position: 'absolute',
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(177, 241, 40, 0.25)',
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
