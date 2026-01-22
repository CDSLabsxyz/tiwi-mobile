import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { colors } from '@/theme';

/**
 * Status Bar Component
 * Uses native status bar + custom overlay for design accuracy
 * The actual status bar is handled by ExpoStatusBar
 */
export const StatusBar: React.FC = () => {
  const { top } = useSafeAreaInsets();

  return (
    <>
      <ExpoStatusBar style="light" backgroundColor={colors.bg} translucent />
      {/* This view ensures proper spacing but native status bar shows on top */}
      <View
        style={{
          height: top || 0,
          backgroundColor: 'transparent',
        }}
      />
    </>
  );
};

