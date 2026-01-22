/**
 * FAQs Screen
 * FAQs page with search and expandable dropdowns matching Figma design exactly (node-id: 3279-121333)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const ArrowDownIcon = require('@/assets/home/arrow-down-01.svg');
const SearchIcon = require('@/assets/swap/search-01.svg');

// FAQ Item Component with Animation
interface FAQItemProps {
  faq: FAQ;
  isExpanded: boolean;
  onPress: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ faq, isExpanded, onPress }) => {
  const rotation = useSharedValue(isExpanded ? 180 : 0);

  React.useEffect(() => {
    rotation.value = withTiming(isExpanded ? 180 : 0, { duration: 200 });
  }, [isExpanded, rotation]);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View
      style={{
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        paddingHorizontal: 24,
        paddingVertical: 20,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            fontFamily: 'Manrope-Medium',
            fontSize: 16,
            color: colors.bodyText,
            flex: 1,
            paddingRight: 16,
          }}
        >
          {faq.question}
        </Text>
        <Animated.View style={arrowStyle}>
          <View
            style={{
              width: 24,
              height: 24,
            }}
          >
            <Image
              source={ArrowDownIcon}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          </View>
        </Animated.View>
      </TouchableOpacity>

      {isExpanded && (
        <View
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: colors.bgStroke,
          }}
        >
          <Text
            style={{
              fontFamily: 'Manrope-Regular',
              fontSize: 14,
              color: colors.bodyText,
              lineHeight: 20,
            }}
          >
            {faq.answer}
          </Text>
        </View>
      )}
    </View>
  );
};

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    id: '1',
    question: 'Is Tiwi Protocol custodial?',
    answer: 'No, TIWI Protocol is non-custodial. You maintain full control of your private keys and funds. We never have access to your wallet or assets.',
  },
  {
    id: '2',
    question: 'Can I pay gas without native tokens?',
    answer: 'Yes, TIWI Protocol supports gasless transactions through our meta-transaction system. You can pay gas fees using any supported token in your wallet.',
  },
  {
    id: '3',
    question: 'Which chains are supported?',
    answer: 'TIWI Protocol currently supports Ethereum, Polygon, BSC, Arbitrum, Optimism, and Avalanche. More chains are being added regularly.',
  },
  {
    id: '4',
    question: 'What are the lending limits?',
    answer: 'Lending limits vary by asset and are determined by the liquidity pool size. Generally, you can lend up to 80% of the available pool liquidity for most assets.',
  },
  {
    id: '5',
    question: 'Can I stake NFTs?',
    answer: 'Yes, TIWI Protocol supports NFT staking. You can stake your NFTs to earn rewards. The staking period and rewards vary by NFT collection.',
  },
  {
    id: '6',
    question: 'How do merchants use TIWI Pay?',
    answer: 'Merchants can integrate TIWI Pay into their checkout process to accept cryptocurrency payments. The integration is simple and supports multiple cryptocurrencies.',
  },
];

export default function FAQsScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  // Handle phone back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings/support' as any);
    }
  };

  const handleFAQPress = (faqId: string) => {
    setExpandedFAQ(expandedFAQ === faqId ? null : faqId);
  };

  const filteredFAQs = faqs.filter((faq) =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Header */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 15,
            paddingVertical: 10,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleBackPress}
            style={{
              width: 24,
              height: 24,
            }}
          >
            <Image
              source={ChevronLeftIcon}
              className="w-full h-full"
              contentFit="contain"
            />
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 18,
              lineHeight: 18,
              color: colors.titleText,
              flex: 1,
              textAlign: 'center',
            }}
          >
            FAQs
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 40,
          paddingBottom: (bottom || 16) + 24,
          paddingHorizontal: 20,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Search Bar */}
          <View
            style={{
              height: 48,
              backgroundColor: '#1b1b1b',
              borderRadius: 20,
              paddingHorizontal: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <View
              style={{
                width: 16,
                height: 16,
              }}
            >
              <Image
                source={SearchIcon}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
            <TextInput
              style={{
                flex: 1,
                fontFamily: 'Manrope-Regular',
                fontSize: 14,
                color: 'rgba(255,255,255,0.7)',
                padding: 0,
              }}
              placeholder="Search"
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* FAQ List */}
          <View
            style={{
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {filteredFAQs.map((faq) => (
              <FAQItem
                key={faq.id}
                faq={faq}
                isExpanded={expandedFAQ === faq.id}
                onPress={() => handleFAQPress(faq.id)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

