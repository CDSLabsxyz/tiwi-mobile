/**
 * Referral Info Screen (Rules Page)
 * First page showing referral rules and code entry
 * Matches Figma design exactly (node-id: 3279-116990)
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { StatusBar } from '@/components/ui/StatusBar';
import { WalletHeader } from '@/components/sections/Wallet/WalletHeader';
import { WALLET_ADDRESS } from '@/utils/wallet';
import { getReferralCode, createReferralLink, isValidReferralCode } from '@/utils/referral';

// Icons
const ArrowRight03 = require('@/assets/referral/arrow-right-03.svg');
const CopyIcon = require('@/assets/referral/copy-01.svg');

// Images from Figma (using URLs - can be replaced with local assets)
const imgUntitled11 = 'https://www.figma.com/api/mcp/asset/4984d369-773e-485e-8e2f-ffa58827f3ff';
const imgEllipse1080 = 'https://www.figma.com/api/mcp/asset/b750a645-d4b1-46cf-8dab-5618fbaa7b08';
const imgEllipse1079 = 'https://www.figma.com/api/mcp/asset/bd11bfec-bcb8-40ce-878d-1967e56a95e0';

const referralRules = [
  'When someone signs up using your referral link or code, they become your referee permanently.',
  'You earn a percentage of the TIWI Protocol fee (0.25%) from their spot trades only.',
  'Rebates are paid in USDT, not in TIWI tokens.',
  'Your earnings depend on your Referral Level, which is based on how much your referees traded in the past 28 days.',
  'You only earn from spot trading volume made by people you referred.',
  'Fees are automatically converted to USDT and stored for monthly payout.',
  'Your rebate rate increases as your referees generate more trading volume.',
  'Rebate earnings update continuously throughout the month.',
  'The claim window opens every 28th of the month.',
  'You can claim your USDT directly to your wallet once claims are enabled.',
];

export default function ReferralInfoScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [userReferralCode] = useState(getReferralCode());

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as any);
    }
  };

  const handleIrisScanPress = () => {
    // TODO: Implement scan functionality
    console.log('Iris scan pressed');
  };

  const handleSettingsPress = () => {
    router.push('/settings' as any);
  };

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(userReferralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy referral code');
    }
  };

  const handleConfirmReferralCode = () => {
    if (!referralCodeInput.trim()) {
      Alert.alert('Error', 'Please enter a referral code');
      return;
    }

    if (!isValidReferralCode(referralCodeInput.trim())) {
      Alert.alert('Error', 'Invalid referral code format');
      return;
    }

    // TODO: Submit referral code to backend
    Alert.alert('Success', 'Referral code confirmed!');
  };

  const handleGenerateReferralCode = () => {
    // Navigate to main referral page
    router.push('/referral' as any);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Sticky Header */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
        }}
      >
        <WalletHeader
          walletAddress={WALLET_ADDRESS}
          onIrisScanPress={handleIrisScanPress}
          onSettingsPress={handleSettingsPress}
        />
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: (bottom || 16) + 24,
          paddingHorizontal: 17,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner - Invite Friends. Unlock Rewards. */}
        <View
          style={{
            height: 149,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#4e634b',
            overflow: 'hidden',
            marginBottom: 16,
            position: 'relative',
          }}
        >
          {/* Gradient Background */}
          <LinearGradient
            colors={['rgba(177, 241, 40, 1)', 'rgba(0, 198, 95, 1)', 'rgba(0, 146, 136, 1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          
          {/* Text Content */}
          <View
            style={{
              position: 'absolute',
              left: 25,
              top: 39,
              zIndex: 2,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Bold',
                fontSize: 20,
                lineHeight: 17.11,
                color: colors.bg,
                marginBottom: 6,
              }}
            >
              Invite Friends.
            </Text>
            <Text
              style={{
                fontFamily: 'Manrope-Bold',
                fontSize: 20,
                lineHeight: 17.11,
                color: colors.bg,
              }}
            >
              Unlock Rewards.
            </Text>
          </View>

          {/* Decorative Elements */}
          <View
            style={{
              position: 'absolute',
              left: 230,
              top: 31,
              width: 163,
              height: 163,
            }}
          >
            <Image
              source={{ uri: imgEllipse1080 }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          </View>
          <View
            style={{
              position: 'absolute',
              left: 261,
              top: 62,
              width: 123,
              height: 123,
            }}
          >
            <Image
              source={{ uri: imgEllipse1079 }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          </View>
          <View
            style={{
              position: 'absolute',
              left: 211,
              top: -14,
              width: 136,
              height: 176,
            }}
          >
            <Image
              source={{ uri: imgUntitled11 }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          </View>
        </View>

        {/* Recent Invite Notification */}
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.bgStroke,
            borderRadius: 16,
            paddingHorizontal: 18,
            paddingVertical: 10,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, marginRight: 27 }}>
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 12,
                lineHeight: 14.03,
                color: colors.titleText,
                marginBottom: 5,
              }}
            >
              0x09....879 has recently Invited ...
            </Text>
            <Text
              style={{
                fontFamily: 'Manrope-SemiBold',
                fontSize: 16,
                lineHeight: 18.7,
                color: colors.primaryCTA,
              }}
            >
              20.61 USDT
            </Text>
          </View>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 14,
                lineHeight: 16.37,
                color: colors.bodyText,
              }}
            >
              Position
            </Text>
            <Image
              source={ArrowRight03}
              style={{ width: 18, height: 18 }}
              contentFit="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Referral Code Input Section */}
        <View
          style={{
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 15,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: '100%',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 14,
                lineHeight: 20,
                color: colors.bodyText,
              }}
            >
              Enter Referral Code (Optional)
            </Text>
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.bgSemi,
                  borderRadius: 16,
                  paddingHorizontal: 17,
                  paddingVertical: 10,
                  height: 64,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <TextInput
                  value={referralCodeInput}
                  onChangeText={setReferralCodeInput}
                  placeholder="Enter Referral Code"
                  placeholderTextColor={colors.mutedText}
                  style={{
                    flex: 1,
                    fontFamily: 'Manrope-Medium',
                    fontSize: 14,
                    color: colors.mutedText,
                  }}
                />
                <TouchableOpacity onPress={handleCopyCode}>
                  <Image
                    source={CopyIcon}
                    style={{ width: 20, height: 20 }}
                    contentFit="contain"
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={handleConfirmReferralCode}
                style={{
                  backgroundColor: colors.bgShade20,
                  borderWidth: 1.5,
                  borderColor: colors.accentDark40,
                  borderRadius: 100,
                  paddingHorizontal: 24,
                  paddingVertical: 9,
                  height: 54,
                  justifyContent: 'center',
                  alignItems: 'center',
                  minWidth: 87,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-SemiBold',
                    fontSize: 16,
                    lineHeight: 25.6,
                    color: '#498f00',
                  }}
                >
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleGenerateReferralCode}
            style={{
              width: '100%',
              borderWidth: 1.5,
              borderColor: colors.primaryCTA,
              borderRadius: 100,
              paddingHorizontal: 24,
              paddingVertical: 9,
              height: 54,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-SemiBold',
                fontSize: 16,
                lineHeight: 25.6,
                color: colors.primaryCTA,
              }}
            >
              Generate Referral Code
            </Text>
          </TouchableOpacity>
        </View>

        {/* Referral Rules Section */}
        <View
          style={{
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <Text
            style={{
              fontFamily: 'Manrope-SemiBold',
              fontSize: 16,
              lineHeight: 18.7,
              color: colors.titleText,
            }}
          >
            Referral Rules
          </Text>
          <View
            style={{
              backgroundColor: colors.bgSemi,
              borderRadius: 16,
              paddingHorizontal: 8,
              paddingVertical: 5,
            }}
          >
            {referralRules.map((rule, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  marginBottom: index < referralRules.length - 1 ? 10 : 0,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    lineHeight: 18,
                    color: colors.titleText,
                    marginRight: 8,
                    minWidth: 20,
                  }}
                >
                  {index + 1}.
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    lineHeight: 18,
                    color: colors.titleText,
                  }}
                >
                  {rule}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

