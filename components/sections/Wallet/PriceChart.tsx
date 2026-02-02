/**
 * Price Chart Component
 * Displays price chart with time period tabs
 * Matches Figma design exactly (node-id: 3279-120268)
 */

import { colors } from "@/constants/colors";
import type { AssetDetail, ChartTimePeriod } from "@/services/walletService";
import React, { useMemo } from "react";
import { Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

interface PriceChartProps {
  asset: AssetDetail;
  timePeriod: ChartTimePeriod;
  onTimePeriodChange: (period: ChartTimePeriod) => void;
}

const CHART_HEIGHT = 232;
const CHART_PADDING = 10; // Smaller padding for "full width" feel

/**
 * Price Chart - Interactive chart with time period selection
 */
export const PriceChart: React.FC<PriceChartProps> = ({
  asset,
  timePeriod,
  onTimePeriodChange,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const CHART_WIDTH = screenWidth - 24; // Small margin on sides

  const chartData = asset.chartData[timePeriod];
  const isPositive = asset.change24h >= 0;
  const chartColor = isPositive ? colors.success : colors.error;

  // Calculate chart path and area
  const { path, areaPath } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { path: "", areaPath: "", minValue: 0, maxValue: 0 };
    }

    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1; // Avoid division by zero

    const width = CHART_WIDTH - CHART_PADDING * 2;
    const height = CHART_HEIGHT - CHART_PADDING * 2;

    let pathString = "";
    let areaString = `M ${CHART_PADDING} ${CHART_HEIGHT - CHART_PADDING}`;

    chartData.forEach((point, index) => {
      const x = CHART_PADDING + (index / (chartData.length - 1)) * width;
      const y =
        CHART_HEIGHT -
        CHART_PADDING -
        ((point.value - min) / range) * height;

      if (index === 0) {
        pathString = `M ${x} ${y}`;
        areaString += ` L ${x} ${y}`;
      } else {
        pathString += ` L ${x} ${y}`;
        areaString += ` L ${x} ${y}`;
      }
    });

    areaString += ` L ${CHART_PADDING + width} ${CHART_HEIGHT - CHART_PADDING} Z`;

    return {
      path: pathString,
      areaPath: areaString,
      minValue: min,
      maxValue: max,
    };
  }, [chartData, CHART_WIDTH]);

  const timePeriods: ChartTimePeriod[] = ["1D", "1W", "1M", "1Y", "5Y", "All"];

  return (
    <View
      style={{
        width: "100%",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
      }}
    >
      {/* Chart Container */}
      <View
        style={{
          width: CHART_WIDTH,
          height: CHART_HEIGHT,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop
                offset="0%"
                stopColor={chartColor}
                stopOpacity={0.3}
              />
              <Stop
                offset="100%"
                stopColor={chartColor}
                stopOpacity={0}
              />
            </LinearGradient>
          </Defs>

          {/* Gradient Area */}
          <Path
            d={areaPath}
            fill="url(#chartGradient)"
          />

          {/* Chart Line */}
          <Path
            d={path}
            fill="none"
            stroke={chartColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>

      {/* Time Period Tabs */}
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 0,
        }}
      >
        {timePeriods.map((period) => {
          const isActive = period === timePeriod;
          return (
            <TouchableOpacity
              key={period}
              activeOpacity={0.8}
              onPress={() => onTimePeriodChange(period)}
              style={{
                flex: 1,
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: isActive ? "#4E634B" : "transparent",
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope-Regular",
                  fontSize: 12,
                  lineHeight: 16,
                  color: isActive ? colors.primaryCTA : colors.titleText,
                }}
              >
                {period}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

