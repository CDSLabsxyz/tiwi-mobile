import { colors } from '@/constants/colors';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Custom Tab Bar Component
 * Matches Figma design exactly (node-id: 286-685)
 * Dimensions: 393px × 76px
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
        <View
            style={[
                styles.container,
                {
                    paddingBottom: (bottom || 16),
                }
            ]}
        >
            <View
                style={styles.navContent}
            >
                {/* Left Side - Home and Market */}
                <View
                    style={styles.group}
                >
                    {navItems.slice(0, 2).map((item) => {
                        const isFocused = state.index === state.routes.findIndex(r => r.name === item.id);
                        const route = state.routes.find(r => r.name === item.id);

                        return (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => route && onTabPress(route, isFocused)}
                                style={styles.tabItem}
                                activeOpacity={0.7}

                            >
                                <View
                                    style={styles.iconWrapper}
                                >
                                    <Image
                                        source={item.icon}
                                        style={[
                                            styles.icon,
                                            {
                                                tintColor: isFocused
                                                    ? item.id === 'index' ? undefined : colors.primaryCTA
                                                    : colors.mutedText
                                            }
                                        ]}
                                        contentFit="contain"
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        {
                                            color: isFocused ? colors.primaryCTA : colors.mutedText,
                                        }
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Right Side - Earn and Wallet */}
                <View
                    style={styles.group}
                >
                    {navItems.slice(2).map((item) => {
                        const isFocused = state.index === state.routes.findIndex(r => r.name === item.id);
                        const route = state.routes.find(r => r.name === item.id);

                        return (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => route && onTabPress(route, isFocused)}
                                style={styles.tabItem}
                                activeOpacity={0.7}
                            >
                                <View
                                    style={styles.iconWrapper}
                                >
                                    <Image
                                        source={item.icon}
                                        style={[styles.icon, { tintColor: isFocused ? colors.primaryCTA : colors.mutedText }]}
                                        contentFit="contain"
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        {
                                            color: isFocused ? colors.primaryCTA : colors.mutedText,
                                        }
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Center Button - Swap (main comp.svg) */}
            <View
                style={styles.swapButtonWrapper}
            >
                <TouchableOpacity
                    onPress={onSwapPress}
                    activeOpacity={0.8}
                    style={styles.swapButtonTouch}
                >
                    <View
                        style={styles.swapIconContainer}
                    >
                        <Image
                            source={require('../../assets/home/main comp.svg')}
                            style={styles.icon}
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
        width: '100%',
        paddingHorizontal: 8,
        gap: 48, // Responsive gap for the center button
    },
    group: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapper: {
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
        textAlign: 'center',
        marginTop: 4,
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
    },
    swapButtonWrapper: {
        position: 'absolute',
        top: -19,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    swapButtonTouch: {
        width: 58,
        height: 58,
    },
    swapIconContainer: {
        position: 'absolute',
        left: -58 * 0.1381,
        top: -58 * 0.1726,
        right: -58 * 0.1381,
        bottom: -58 * 0.1036,
    },
});
