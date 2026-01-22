/**
 * Coming Soon Component
 * Displays coming soon message with rotated icon
 * Matches Figma design exactly
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ComingSoonIcon = require('@/assets/earn/coming-soon-02.svg');

interface ComingSoonProps {
  message?: string;
}

/**
 * Coming Soon - Centered message with icon
 */
export const ComingSoon: React.FC<ComingSoonProps> = ({
  message = "We're currently developing this feature and will make it available soon",
}) => {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 44,
      }}
    >
      {/* Rotated Icon */}
      <View
        style={{
          width: 255.154,
          height: 255.154,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          transform: [{ rotate: '335deg' }],
        }}
      >
        <View
          style={{
            width: 192,
            height: 192,
          }}
        >
          <Image
            source={ComingSoonIcon}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
          />
        </View>
      </View>

      {/* Text Content */}
      <View
        style={{
          alignItems: 'center',
          gap: 8,
          maxWidth: 306,
        }}
      >
        <Text
          style={{
            fontFamily: 'Manrope-Medium',
            fontSize: 16,
            color: colors.titleText,
            textAlign: 'center',
          }}
        >
          Coming Soon
        </Text>
        <Text
          style={{
            fontFamily: 'Manrope-Regular',
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
          }}
        >
          {message}
        </Text>
      </View>
    </View>
  );
};

