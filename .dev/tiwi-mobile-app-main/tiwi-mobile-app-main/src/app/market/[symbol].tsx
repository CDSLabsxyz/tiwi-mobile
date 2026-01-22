/**
 * Market Detail (Spot) Screen
 * Implements spot trading detail view for a selected pair
 * Matches Figma references (spot trade / detail states)
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { StatusBar } from '@/components/ui/StatusBar';
import { fetchMarketData } from '@/services/marketService';
import { MarketToken } from '@/types/market';

// Icons (using existing local assets)
const BackIcon = require('@/assets/swap/arrow-left-02.svg');
const StarIcon = require('@/assets/home/star-18.svg');
const ShareIcon = require('@/assets/wallet/share-08.svg');
const ChartLineIcon = require('@/assets/market/chart-line-data-02.svg');
const ChartCandleIcon = require('@/assets/market/chart-01.svg');

// Chart placeholder from Figma
const ChartImage = 'https://www.figma.com/api/mcp/asset/c40f42b6-3f01-47ad-a71f-43d9d27355d4';

// Info icons (reusing existing)
const CopyIcon = require('@/assets/wallet/copy-01.svg');
const LinkIcon = require('@/assets/market/link-03.svg');

const timeframes = ['15m', '1h', '4h', '6h', '1D', '3D', 'More'];

const aboutItems = [
  { label: 'Token Name', value: 'Zora' },
  { label: 'Network', value: 'Base' },
  { label: 'Contract', value: '0x1111...fc69', copyable: true },
  { label: 'Official X', value: '@zora', linkable: true },
  { label: 'Website', value: 'zora.co', linkable: true },
];

const statsTop = [
  { label: 'Market Cap', value: '$520.98M' },
  { label: 'Liquidity', value: '$2.08T' },
  { label: '24h Volume', value: '$9.55M' },
];

const supplies = [
  { label: 'Circulating Supply', value: '4,469,999,998' },
  { label: 'Total Supply', value: '10,000,000,000' },
  { label: 'Max. Supply', value: '10,000,000,000' },
];

export default function MarketDetailScreen() {
  const router = useRouter();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { top, bottom } = useSafeAreaInsets();

  // Load data (mocked for now)
  const [marketData, setMarketData] = React.useState<{ spot: MarketToken[]; perp: MarketToken[] }>({
    spot: [],
    perp: [],
  });

  React.useEffect(() => {
    const load = async () => {
      const data = await fetchMarketData();
      setMarketData(data);
    };
    load();
  }, []);

  const token = useMemo(() => {
    if (!symbol) return null;
    const lower = symbol.toLowerCase();
    return marketData.spot.find((t) => t.symbol.toLowerCase() === lower) || marketData.perp.find((t) => t.symbol.toLowerCase() === lower) || null;
  }, [symbol, marketData]);

  const price = token?.price ?? '$0.05189';
  const priceChange = token?.priceChange ?? 1.13;
  const priceChangeText = token?.priceChangePercent ?? '+$1.13%';
  const isPositive = priceChange >= 0;

  const handleCopy = (text: string) => {
    Alert.alert('Copied', text);
  };

  const handleBuy = () => {
    Alert.alert('Buy', 'Buy flow coming soon');
  };

  const handleSell = () => {
    Alert.alert('Sell', 'Sell flow coming soon');
  };

  if (!token) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar />
        <Text style={{ fontFamily: 'Manrope-Medium', fontSize: 16, color: colors.bodyText }}>Loading pair...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Header */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 8,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={{ width: 24, height: 24 }}>
            <Image source={BackIcon} style={{ width: 24, height: 24 }} contentFit="contain" />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Image source={StarIcon} style={{ width: 20, height: 20 }} contentFit="contain" />
            <Image source={ShareIcon} style={{ width: 20, height: 20 }} contentFit="contain" />
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: (bottom || 16) + 96,
        }}
      >
        {/* Pair + Price */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgCards }} />
              <Text
                style={{
                  fontFamily: 'Manrope-SemiBold',
                  fontSize: 14,
                  color: colors.titleText,
                }}
              >
                {token.symbol}
                <Text style={{ color: colors.bodyText }}>/USDT</Text>
              </Text>
            </View>

            <View
              style={{
                backgroundColor: colors.bgSemi,
                borderWidth: 1,
                borderColor: colors.bgStroke,
                borderRadius: 100,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 100,
                  backgroundColor: colors.bgStroke,
                }}
              >
                <Image source={ChartLineIcon} style={{ width: 16, height: 16 }} contentFit="contain" />
              </View>
              <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                <Image source={ChartCandleIcon} style={{ width: 16, height: 16 }} contentFit="contain" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            <Text
              style={{
                fontFamily: 'Manrope-SemiBold',
                fontSize: 24,
                color: colors.titleText,
              }}
            >
              {price}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 12,
                  color: isPositive ? colors.success : colors.error,
                }}
              >
                {priceChangeText}
              </Text>
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 12,
                  color: colors.bodyText,
                }}
              >
                1D
              </Text>
            </View>
          </View>
        </View>

        {/* Chart */}
        <View style={{ width: '100%', height: 300, marginTop: 4 }}>
          <Image source={{ uri: ChartImage }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </View>

        {/* Timeframes */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingVertical: 8,
            gap: 16,
          }}
        >
          {timeframes.map((tf) => (
            <TouchableOpacity key={tf} activeOpacity={0.8}>
              <Text
                style={{
                  fontFamily: tf === '1D' ? 'Manrope-SemiBold' : 'Manrope-Medium',
                  fontSize: 12,
                  color: tf === '1D' ? colors.titleText : colors.bodyText,
                }}
              >
                {tf}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Your Position */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text
            style={{
              fontFamily: 'Manrope-SemiBold',
              fontSize: 14,
              color: colors.titleText,
              marginBottom: 12,
            }}
          >
            Your Position
          </Text>
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.bgStroke,
              paddingTop: 12,
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 12,
                color: colors.bodyText,
              }}
            >
              No Available Data
            </Text>
          </View>
        </View>

        {/* About */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, gap: 10 }}>
          <Text
            style={{
              fontFamily: 'Manrope-SemiBold',
              fontSize: 14,
              color: colors.titleText,
            }}
          >
            About
          </Text>
          {aboutItems.map((item) => (
            <View
              key={item.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 14,
                  color: colors.bodyText,
                }}
              >
                {item.label}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 14,
                    color: colors.titleText,
                  }}
                >
                  {item.value}
                </Text>
                {item.copyable && (
                  <TouchableOpacity onPress={() => handleCopy(item.value)} style={{ width: 16, height: 16 }}>
                    <Image source={CopyIcon} style={{ width: 16, height: 16 }} contentFit="contain" />
                  </TouchableOpacity>
                )}
                {item.linkable && (
                  <Image source={LinkIcon} style={{ width: 16, height: 16 }} contentFit="contain" />
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Stats */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, gap: 10 }}>
          {statsTop.map((stat) => (
            <View
              key={stat.label}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
            >
              <Text style={{ fontFamily: 'Manrope-Medium', fontSize: 14, color: colors.bodyText }}>{stat.label}</Text>
              <Text style={{ fontFamily: 'Manrope-Medium', fontSize: 14, color: colors.titleText }}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: 20, paddingVertical: 12, gap: 10 }}>
          {supplies.map((stat) => (
            <View
              key={stat.label}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
            >
              <Text style={{ fontFamily: 'Manrope-Medium', fontSize: 14, color: colors.bodyText }}>{stat.label}</Text>
              <Text style={{ fontFamily: 'Manrope-Medium', fontSize: 14, color: colors.titleText }}>{stat.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Buy/Sell Bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          gap: 16,
          paddingHorizontal: 20,
          paddingVertical: 12,
          backgroundColor: colors.bg,
          borderTopWidth: 0.5,
          borderTopColor: colors.bgStroke,
        }}
      >
        <TouchableOpacity
          onPress={handleBuy}
          activeOpacity={0.9}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 100,
            backgroundColor: colors.primaryCTA,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Manrope-SemiBold', fontSize: 16, color: colors.bg }}>Buy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSell}
          activeOpacity={0.9}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 100,
            backgroundColor: colors.error,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Manrope-SemiBold', fontSize: 16, color: colors.titleText }}>Sell</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}





