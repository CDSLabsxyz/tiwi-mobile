import { colors } from '@/constants/colors';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Custom Tab Bar Component
 * Matches Figma design exactly (node-id: 286-685)
 * Dimensions: 393px x 76px
 */
export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const { bottom } = useSafeAreaInsets();

    const onTabPress = (route: any, isFocused: boolean) => {
        const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
        }
    };

    const onSwapPress = () => {
        navigation.navigate('swap');
    };

    const navItems = [
        { id: 'index', label: 'Home', icon: require('../../assets/home/home-01.svg') },
        { id: 'market', label: 'Market', icon: require('../../assets/home/market-analysis.svg') },
        { id: 'earn', label: 'Earn', icon: require('../../assets/home/coins-01.svg') },
        { id: 'wallet', label: 'Wallet', icon: require('../../assets/home/wallet-03.svg') },
    ];

    return (
        <View style={[styles.container, { paddingBottom: Math.max(bottom, 16) }]}>
            <View style={styles.navContent}>
                {/* Left Side Group */}
                <View style={styles.group}>
                    {navItems.slice(0, 2).map((item) => {
                        const route = state.routes.find((r) => r.name === item.id);
                        if (!route) return null;
                        const isFocused = state.index === state.routes.findIndex((r) => r.name === item.id);

                        return (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => onTabPress(route, isFocused)}
                                style={styles.tabItem}
                                activeOpacity={0.7}
                            >
                                <View style={styles.iconContainer}>
                                    <Image
                                        source={item.icon}
                                        style={[styles.icon, { tintColor: isFocused ? colors.primaryCTA : colors.mutedText }]}
                                        contentFit="contain"
                                    />
                                </View>
                                <Text style={[styles.tabLabel, { color: isFocused ? colors.primaryCTA : colors.mutedText }]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Right Side Group */}
                <View style={styles.group}>
                    {navItems.slice(2).map((item) => {
                        const route = state.routes.find((r) => r.name === item.id);
                        if (!route) return null;
                        const isFocused = state.index === state.routes.findIndex((r) => r.name === item.id);

                        return (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => onTabPress(route, isFocused)}
                                style={styles.tabItem}
                                activeOpacity={0.7}
                            >
                                <View style={styles.iconContainer}>
                                    <Image
                                        source={item.icon}
                                        style={[styles.icon, { tintColor: isFocused ? colors.primaryCTA : colors.mutedText }]}
                                        contentFit="contain"
                                    />
                                </View>
                                <Text style={[styles.tabLabel, { color: isFocused ? colors.primaryCTA : colors.mutedText }]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Center Button - Swap (Exactly positioned) */}
            <View style={styles.swapButtonWrapper}>
                <TouchableOpacity
                    onPress={onSwapPress}
                    activeOpacity={0.8}
                    style={styles.swapButtonContainer}
                >
                    <View style={styles.swapIconInset}>
                        <Image
                            source={require('../../assets/home/main comp.svg')}
                            style={styles.swapIcon}
                            contentFit="contain"
                        />
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.bg,
        borderTopWidth: 0.5,
        borderTopColor: colors.bgStroke,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 16,
        shadowColor: colors.primaryCTA,
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    navContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        gap: 64, // Gap between groups
    },
    group: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8, // Gap between items
    },
    tabItem: {
        alignItems: 'center',
        width: 70,
    },
    iconContainer: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        width: '100%',
        height: '100%',
    },
    tabLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    swapButtonWrapper: {
        position: 'absolute',
        left: 167.53, // Precise Figma value
        top: -18.97,  // Precise Figma value
        width: 57.941,
        height: 57.941,
        overflow: 'visible',
    },
    swapButtonContainer: {
        width: '100%',
        height: '100%',
    },
    swapIconInset: {
        position: 'absolute',
        left: -57.941 * 0.1381,
        top: -57.941 * 0.1726,
        right: -57.941 * 0.1381,
        bottom: -57.941 * 0.1036,
    },
    swapIcon: {
        width: '100%',
        height: '100%',
    },
});
