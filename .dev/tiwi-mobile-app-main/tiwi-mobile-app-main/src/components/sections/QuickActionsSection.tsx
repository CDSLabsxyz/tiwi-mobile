import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { Skeleton } from '../ui/Skeleton';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  route: string;
}

const actions: QuickAction[] = [
  {
    id: 'swap',
    label: 'Swap',
    icon: require('../../assets/home/exchange-01.svg'),
    route: '/swap',
  },
  {
    id: 'stake',
    label: 'Stake',
    icon: require('../../assets/home/stake-1.svg'),
    route: '/stake',
  },
  {
    id: 'pool',
    label: 'Pool',
    icon: require('../../assets/home/coins-02-1.svg'),
    route: '/pool',
  },
  {
    id: 'history',
    label: 'History',
    icon: require('../../assets/home/transaction-history.svg'),
    route: '/history',
  },
  {
    id: 'more',
    label: 'More',
    icon: require('../../assets/home/dashboard-square-edit.svg'),
    route: '/more',
  },
];

/**
 * Quick Actions Section
 * Shows 5 action buttons in a row
 * Matches Figma design exactly
 */
export const QuickActionsSection: React.FC = () => {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between w-[353px]">
      {actions.map((action) => (
        <TouchableOpacity
          key={action.id}
          onPress={() => router.push(action.route as any)}
          className="flex-col items-center gap-2"
        >
          <View
            className="w-10 h-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: colors.bgCards }}
          >
            <Image
              source={action.icon}
              className="w-6 h-6"
              contentFit="contain"
            />
          </View>
          <Text
            className="text-sm text-center"
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 14,
              color: colors.titleText,
            }}
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};


