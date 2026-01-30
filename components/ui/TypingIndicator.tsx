import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

interface TypingIndicatorProps {
  size?: number;
  color?: string;
  spacing?: number;
}

/**
 * Typing Indicator Component
 * Shows 3 animated dots like WhatsApp
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  size = 8,
  color = '#B5B5B5',
  spacing = 4,
}) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    // Animate dots with staggered timing (like WhatsApp)
    dot1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    dot2.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 200 }),
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 200 })
      ),
      -1,
      false
    );

    dot3.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 400 }),
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 400 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle1 = useAnimatedStyle(() => {
    return {
      opacity: 0.3 + dot1.value * 0.7,
      transform: [{ scale: 0.8 + dot1.value * 0.2 }],
    };
  });

  const animatedStyle2 = useAnimatedStyle(() => {
    return {
      opacity: 0.3 + dot2.value * 0.7,
      transform: [{ scale: 0.8 + dot2.value * 0.2 }],
    };
  });

  const animatedStyle3 = useAnimatedStyle(() => {
    return {
      opacity: 0.3 + dot3.value * 0.7,
      transform: [{ scale: 0.8 + dot3.value * 0.2 }],
    };
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing,
        paddingHorizontal: 4,
      }}
    >
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          animatedStyle1,
        ]}
      />
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          animatedStyle2,
        ]}
      />
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          animatedStyle3,
        ]}
      />
    </View>
  );
};

