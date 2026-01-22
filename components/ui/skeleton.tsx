import { colors } from '@/constants/colors';
import React from 'react';
import { DimensionValue, View, ViewStyle } from 'react-native';

interface SkeletonProps {
    width?: DimensionValue;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = 20,
    borderRadius = 8,
    style,
}) => {
    return (
        <View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: colors.bgCards,
                },
                style,
            ]}
        />
    );
};
