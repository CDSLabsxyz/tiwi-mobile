import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from '@/tw';

/**
 * Stake Banner Component
 * Uses exported SVG from Figma design (node-id: 286-406)
 * Exact dimensions: 353px × 40px
 * Clickable - navigates to stake screen
 */
export const StakeBanner: React.FC = () => {
  const router = useRouter();

  const handlePress = () => {
    router.push('/stake' as any);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={{
        width: 353,
        height: 40,
      }}
    >
      <Image
        source={require('../../assets/home/stake.svg')}
        className="w-full h-full"
        contentFit="contain"
      />
    </TouchableOpacity>
  );
};
