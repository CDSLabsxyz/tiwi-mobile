import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface SparklineProps {
    data: number[];
    color: string;
    width?: number;
    height?: number;
    strokeWidth?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
    data,
    color,
    width = 64,
    height = 32,
    strokeWidth = 2,
}) => {
    const pathData = useMemo(() => {
        if (!data || data.length < 2) return '';

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;

        // Add some padding to the range so the line doesn't hit the very top/bottom
        const padding = range * 0.1;
        const adjustedMin = min - padding;
        const adjustedMax = max + padding;
        const adjustedRange = adjustedMax - adjustedMin;

        const points = data.map((val, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((val - adjustedMin) / adjustedRange) * height;
            return `${x},${y}`;
        });

        return `M ${points.join(' L ')}`;
    }, [data, width, height]);

    if (!pathData) return <View style={{ width, height }} />;

    return (
        <View style={{ width, height }}>
            <Svg width={width} height={height}>
                <Path
                    d={pathData}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </Svg>
        </View>
    );
};
