/**
 * Fraud Alerts Screen
 * Fraud alerts page matching Figma design exactly (node-id: 3279-121761)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');

// Toggle Switch Component
interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ value, onValueChange }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={{
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 40,
          height: 24,
          borderRadius: 12,
          borderColor: value ? colors.primaryCTA : '#4e634b',
          borderWidth: 2,
          backgroundColor: colors.bg,
          padding: 2,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 10,
            backgroundColor: value ? colors.primaryCTA : '#4e634b',
            transform: [{ translateX: value ? 16 : 0 }],
          }}
        />
      </View>
    </TouchableOpacity>
  );
};

export default function FraudAlertsScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const [suspiciousActivityAlerts, setSuspiciousActivityAlerts] = useState(true);
  const [transactionRiskScores, setTransactionRiskScores] = useState(true);
  const [flaggedAddressWarnings, setFlaggedAddressWarnings] = useState(true);

  // Handle phone back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings/security' as any);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Header */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 15,
            paddingVertical: 10,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleBackPress}
            style={{
              width: 24,
              height: 24,
            }}
          >
            <Image
              source={ChevronLeftIcon}
              className="w-full h-full"
              contentFit="contain"
            />
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 20,
              lineHeight: 20,
              color: colors.titleText,
              flex: 1,
              textAlign: 'center',
            }}
          >
            Fraud Alerts
          </Text>
        </View>
      </View>

      {/* Content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 22,
          paddingTop: 106,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'column',
            gap: 8,
            width: '100%',
            maxWidth: 400,
          }}
        >
          {/* Suspicious Activity Alerts */}
          <View
            style={{
              height: 40,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.bodyText,
              }}
            >
              Suspicious Activity Alerts
            </Text>
            <ToggleSwitch
              value={suspiciousActivityAlerts}
              onValueChange={setSuspiciousActivityAlerts}
            />
          </View>

          {/* Transaction Risk Scores */}
          <View
            style={{
              height: 40,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.bodyText,
              }}
            >
              Transaction Risk Scores
            </Text>
            <ToggleSwitch
              value={transactionRiskScores}
              onValueChange={setTransactionRiskScores}
            />
          </View>

          {/* Flagged Address Warnings */}
          <View
            style={{
              height: 40,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.bodyText,
              }}
            >
              Flagged Address Warnings
            </Text>
            <ToggleSwitch
              value={flaggedAddressWarnings}
              onValueChange={setFlaggedAddressWarnings}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

