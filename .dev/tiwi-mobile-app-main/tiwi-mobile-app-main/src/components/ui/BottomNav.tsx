import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from '@/tw';
import { colors } from '@/theme';

interface NavItem {
  id: string;
  label: string;
  route: string;
  icon: any; // Local SVG require
  activeIcon?: any; // Optional active state icon
}

const navItems: NavItem[] = [
  { 
    id: 'home', 
    label: 'Home', 
    route: '/', 
    icon: require('../../assets/home/home-01.svg'),
  },
  { 
    id: 'market', 
    label: 'Market', 
    route: '/market', 
    icon: require('../../assets/home/market-analysis.svg'),
  },
  { 
    id: 'earn', 
    label: 'Earn', 
    route: '/earn', 
    icon: require('../../assets/home/coins-01.svg'),
  },
  { 
    id: 'wallet', 
    label: 'Wallet', 
    route: '/wallet', 
    icon: require('../../assets/home/wallet-03.svg'),
  },
];

/**
 * Bottom Navigation Component
 * Matches Figma design exactly (node-id: 286-685)
 * Dimensions: 393px × 76px
 */
export const BottomNav: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { bottom } = useSafeAreaInsets();

  const isActive = (route: string) => {
    if (route === '/') return pathname === '/' || pathname === '';
    return pathname?.startsWith(route);
  };

  return (
    <View
      className="absolute bottom-0 left-0 right-0"
      style={{
        backgroundColor: colors.bg,
        borderTopWidth: 0.5,
        borderTopColor: colors.bgStroke,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 16,
        paddingBottom: (bottom || 16),
        shadowColor: colors.primaryCTA,
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <View 
        className="flex-row items-center justify-center w-full"
        style={{
          gap: 64, // Gap between left and right groups
        }}
      >
        {/* Left Side - Home and Market */}
        <View 
          className="flex-row items-center"
          style={{
            gap: 8, // Gap between items in left group
          }}
        >
          {navItems.slice(0, 2).map((item) => {
            const active = isActive(item.route);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(item.route as any)}
                className="items-center"
                style={{
                  width: 70,
                }}
              >
                <View
                  className="items-center justify-center"
                  style={{
                    width: 24,
                    height: 24,
                  }}
                >
                  <Image
                    source={item.icon}
                    className="w-full h-full"
                    contentFit="contain"
                  />
                </View>
                <Text
                  className="text-center mt-1"
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    color: active ? colors.primaryCTA : colors.mutedText,
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Right Side - Earn and Wallet */}
        <View 
          className="flex-row items-center"
          style={{
            gap: 8, // Gap between items in right group
          }}
        >
          {navItems.slice(2).map((item) => {
            const active = isActive(item.route);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(item.route as any)}
                className="items-center"
                style={{
                  width: 70,
                }}
              >
                <View
                  className="items-center justify-center"
                  style={{
                    width: 24,
                    height: 24,
                  }}
                >
                  <Image
                    source={item.icon}
                    className="w-full h-full"
                    contentFit="contain"
                  />
                </View>
                <Text
                  className="text-center mt-1"
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    color: active ? colors.primaryCTA : colors.mutedText,
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Center Button - Swap (main comp.svg) */}
      {/* Positioned absolutely at left: 167.53px, top: -18.97px */}
      {/* Container: 57.941px, SVG: 74px with inset to make it appear larger */}
      <View
        className="absolute"
        style={{
          left: 167.53,
          top: -18.97,
          width: 57.941,
          height: 57.941,
          overflow: 'visible',
        }}
      >
        <TouchableOpacity
          onPress={() => router.push('/swap' as any)}
          activeOpacity={0.8}
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          {/* SVG with inset: top: -17.26%, right: -13.81%, bottom: -10.36%, left: -13.81% */}
          {/* Inset percentages are relative to container (57.941px) */}
          <View
            style={{
              position: 'absolute',
              left: -57.941 * 0.1381, // -13.81% of container
              top: -57.941 * 0.1726, // -17.26% of container
              right: -57.941 * 0.1381, // -13.81% of container
              bottom: -57.941 * 0.1036, // -10.36% of container
            }}
          >
            <Image
              source={require('../../assets/home/main comp.svg')}
              className="w-full h-full"
              contentFit="contain"
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};
