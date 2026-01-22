import React from 'react';
import { View, ViewStyle, DimensionValue } from 'react-native';
import { colors } from '@/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  className = '',
}) => {
  const style: ViewStyle = {
    width,
    height,
    borderRadius,
    backgroundColor: colors.bgCards,
  };

  return (
    <View
      className={`bg-[${colors.bgCards}] ${className}`}
      style={style}
    />
  );
};

