/**
 * Market Screen
 * Displays Spot and Perp trading markets with filtering and search
 * Matches Figma designs exactly (node-id: 3279-113358, 3279-113736, 3279-113554)
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { StatusBar } from '@/components/ui/StatusBar';
import { BottomNav } from '@/components/ui/BottomNav';
import { MarketType, MarketSubTab, MarketToken } from '@/types/market';
import { fetchMarketData, filterTokensBySubTab, searchTokens } from '@/services/marketService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_CONTENT_WIDTH = 353; // From Figma design
const CONTENT_WIDTH = Math.min(SCREEN_WIDTH - 40, MAX_CONTENT_WIDTH); // 20px padding on each side

// Icons
const SearchIcon = require('@/assets/swap/search-01.svg');
const ArrowLeftIcon = require('@/assets/swap/arrow-left-02.svg');

// Line indicator for active tab
const imgLine327 = 'https://www.figma.com/api/mcp/asset/2040f48a-ef4a-465d-85f9-1bc8eb6c0987';
const imgLine340 = 'https://www.figma.com/api/mcp/asset/a1a2844d-92df-45f5-9b95-980536c19b61';

const subTabs: { id: MarketSubTab; label: string }[] = [
  { id: 'favorite', label: 'Favourite' },
  { id: 'top', label: 'Top' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'new', label: 'New' },
  { id: 'gainers', label: 'Gainers' },
  { id: 'losers', label: 'Losers' },
];

interface TokenListItemProps {
  token: MarketToken;
  onPress: () => void;
}

const TokenListItem: React.FC<TokenListItemProps> = ({ token, onPress }) => {
  const isPositive = token.priceChange >= 0;
  const priceChangeColor = isPositive ? colors.success : colors.error;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 0,
      }}
    >
      {/* Left Side - Token Info */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          {/* Token Pair */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-SemiBold',
                fontSize: 14,
                lineHeight: 20,
                color: colors.titleText,
              }}
            >
              {token.symbol}
            </Text>
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 14,
                lineHeight: 20,
                color: colors.bodyText,
              }}
            >
              /USDT
            </Text>
            {/* Leverage Badge */}
            <View
              style={{
                backgroundColor: colors.bgStroke,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 10,
                  lineHeight: 14,
                  color: colors.bodyText,
                }}
              >
                {token.leverage}X
              </Text>
            </View>
          </View>
          {/* Volume */}
          <Text
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 12,
              lineHeight: 16,
              color: colors.bodyText,
            }}
          >
            Vol {token.volume}
          </Text>
        </View>
      </View>

      {/* Right Side - Price and Change */}
      <View
        style={{
          alignItems: 'flex-end',
        }}
      >
        <Text
          style={{
            fontFamily: 'Manrope-SemiBold',
            fontSize: 14,
            lineHeight: 20,
            color: colors.titleText,
            marginBottom: 4,
          }}
        >
          {token.price}
        </Text>
        <Text
          style={{
            fontFamily: 'Manrope-Medium',
            fontSize: 12,
            lineHeight: 16,
            color: priceChangeColor,
          }}
        >
          {token.priceChangePercent}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default function MarketScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [marketType, setMarketType] = useState<MarketType>('spot');
  const [activeSubTab, setActiveSubTab] = useState<MarketSubTab>('top');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [marketData, setMarketData] = useState<{ spot: MarketToken[]; perp: MarketToken[] }>({
    spot: [],
    perp: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load market data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchMarketData();
        setMarketData(data);
      } catch (error) {
        console.error('Failed to load market data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Get current tokens based on market type
  const currentTokens = marketType === 'spot' ? marketData.spot : marketData.perp;

  // Filter tokens by sub-tab and search
  const filteredTokens = React.useMemo(() => {
    let tokens = filterTokensBySubTab(currentTokens, activeSubTab);
    if (searchQuery.trim()) {
      tokens = searchTokens(tokens, searchQuery);
    }
    return tokens;
  }, [currentTokens, activeSubTab, searchQuery]);

  const handleTokenPress = (token: MarketToken) => {
    const symbolParam = token.symbol.toLowerCase();
    router.push(`/market/${symbolParam}` as any);
  };

  const handleSearchPress = () => {
    setIsSearchVisible(true);
  };

  const handleSearchBack = () => {
    setIsSearchVisible(false);
    setSearchQuery('');
  };

  // Search Screen
  if (isSearchVisible) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg }}>
        <StatusBar />
        
        {/* Header with Search Bar */}
        <View
          style={{
            paddingTop: top || 0,
            backgroundColor: colors.bg,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.bgStroke,
          }}
        >
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 0,
            }}
          >
            {/* Search Bar */}
            <View
              style={{
                backgroundColor: colors.bgCards,
                borderWidth: 1,
                borderColor: colors.bgStroke,
                borderRadius: 20,
                padding: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <TouchableOpacity onPress={handleSearchBack}>
                <Image
                  source={ArrowLeftIcon}
                  style={{ width: 24, height: 24 }}
                  contentFit="contain"
                />
              </TouchableOpacity>
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <View style={{ width: 16, height: 1 }}>
                  <Image
                    source={{ uri: imgLine340 }}
                    style={{ width: '100%', height: 1, transform: [{ rotate: '90deg' }] }}
                    contentFit="contain"
                  />
                </View>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search Coin Pairs"
                  placeholderTextColor={colors.mutedText}
                  autoFocus
                  style={{
                    flex: 1,
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    color: colors.mutedText,
                    padding: 0,
                  }}
                />
              </View>
            </View>
          </View>
          
          {/* Top Tokens Label */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-SemiBold',
                fontSize: 14,
                lineHeight: 20,
                color: colors.mutedText,
                textAlign: 'center',
              }}
            >
              Top Tokens
            </Text>
          </View>
        </View>

        {/* Token List */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: Math.max(20, (SCREEN_WIDTH - CONTENT_WIDTH) / 2),
            paddingTop: 0,
            paddingBottom: (bottom || 16) + 76 + 24,
            alignItems: 'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: CONTENT_WIDTH, maxWidth: '100%' }}>
            {filteredTokens.map((token) => (
              <TokenListItem
                key={token.id}
                token={token}
                onPress={() => handleTokenPress(token)}
              />
            ))}
            {filteredTokens.length === 0 && (
              <View
                style={{
                  padding: 40,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 14,
                    color: colors.bodyText,
                  }}
                >
                  No tokens found
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <BottomNav />
      </View>
    );
  }

  // Main Market Screen
  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Header with Tabs */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.bgStroke,
        }}
      >
        {/* Spot/Perp Tabs */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 0,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              gap: 16,
            }}
          >
            {/* Spot Tab */}
            <TouchableOpacity
              onPress={() => setMarketType('spot')}
              style={{
                flexDirection: 'column',
                gap: 10,
                alignItems: 'center',
                paddingVertical: 0,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Manrope-SemiBold',
                  fontSize: 14,
                  lineHeight: 20,
                  color: marketType === 'spot' ? colors.primaryCTA : colors.mutedText,
                }}
              >
                Spot
              </Text>
              {marketType === 'spot' && (
                <View style={{ height: 1.5, width: '100%' }}>
                  <Image
                    source={{ uri: imgLine327 }}
                    style={{ width: '100%', height: 1.5 }}
                    contentFit="contain"
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Perp Tab */}
            <TouchableOpacity
              onPress={() => setMarketType('perp')}
              style={{
                flexDirection: 'column',
                gap: 10,
                alignItems: 'center',
                paddingVertical: 0,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Manrope-SemiBold',
                  fontSize: 14,
                  lineHeight: 20,
                  color: marketType === 'perp' ? colors.primaryCTA : colors.mutedText,
                }}
              >
                Perp
              </Text>
              {marketType === 'perp' && (
                <View style={{ height: 1.5, width: '100%' }}>
                  <Image
                    source={{ uri: imgLine327 }}
                    style={{ width: '100%', height: 1.5 }}
                    contentFit="contain"
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Search Icon */}
          <TouchableOpacity
            onPress={handleSearchPress}
            style={{
              width: 24,
              height: 24,
            }}
          >
            <Image
              source={SearchIcon}
              style={{ width: 24, height: 24 }}
              contentFit="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Sub-Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingVertical: 8,
            gap: 8,
          }}
        >
          {subTabs.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveSubTab(tab.id)}
                style={{
                  backgroundColor: isActive ? '#081f02' : colors.bgSemi,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 100,
                }}
              >
                <Text
                  style={{
                    fontFamily: isActive ? 'Manrope-SemiBold' : 'Manrope-Medium',
                    fontSize: 12,
                    lineHeight: 16,
                    color: isActive ? colors.primaryCTA : colors.bodyText,
                    letterSpacing: 0.012,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Token List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: Math.max(20, (SCREEN_WIDTH - CONTENT_WIDTH) / 2),
          paddingTop: 0,
          paddingBottom: (bottom || 16) + 76 + 24,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: CONTENT_WIDTH, maxWidth: '100%' }}>
        {isLoading ? (
          <View
            style={{
              padding: 40,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              Loading...
            </Text>
          </View>
        ) : (
          filteredTokens.map((token) => (
            <TokenListItem
              key={token.id}
              token={token}
              onPress={() => handleTokenPress(token)}
            />
          ))
        )}
        {!isLoading && filteredTokens.length === 0 && (
          <View
            style={{
              padding: 40,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              No tokens found
            </Text>
          </View>
        )}
        </View>
      </ScrollView>

      <BottomNav />
    </View>
  );
}
