import { colors } from "@/constants/colors";
import React, { useEffect, useRef } from "react";
import { Animated, DimensionValue, View, ViewStyle } from "react-native";

interface SkeletonLoaderProps {
    width?: DimensionValue;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    width = "100%",
    height = 20,
    borderRadius = 8,
    style,
}) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [animatedValue]);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: colors.bgCards,
                    opacity,
                },
                style,
            ]}
        />
    );
};


/**
 * Token List Skeleton - for token selection loading
 */
export const TokenListSkeleton: React.FC = () => {
  return (
    <View style={{ gap: 12 }}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 82,
            paddingVertical: 12,
          }}
        >
          {/* Left: Token Info Skeleton */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 9,
            }}
          >
            <SkeletonLoader width={57} height={57} borderRadius={57 / 2} />
            <View style={{ gap: 4 }}>
              <SkeletonLoader width={60} height={16} borderRadius={4} />
              <SkeletonLoader width={100} height={12} borderRadius={4} />
            </View>
          </View>

          {/* Right: Balance Skeleton */}
          <View style={{ gap: 4, width: 75, alignItems: "flex-end" }}>
            <SkeletonLoader width={60} height={18} borderRadius={4} />
            <SkeletonLoader width={50} height={12} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
};

