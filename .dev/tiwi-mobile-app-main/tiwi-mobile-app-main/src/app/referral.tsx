/**
 * Referral Dashboard Screen (Main Page)
 * Shows referral stats, leaderboard, FAQs, and QR code
 * Matches Figma design exactly (node-id: 3279-116844)
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { StatusBar } from '@/components/ui/StatusBar';
import { WalletHeader } from '@/components/sections/Wallet/WalletHeader';
import { WALLET_ADDRESS } from '@/utils/wallet';
import { getReferralCode, createReferralLink } from '@/utils/referral';

// Icons
const ArrowRight03 = require('@/assets/referral/arrow-right-03.svg');
const CopyIcon = require('@/assets/referral/copy-01.svg');
const ShareIcon = require('@/assets/referral/share-01.svg');
const ArrowDown01 = require('@/assets/home/arrow-down-01.svg');
const Ellipse1076 = require('@/assets/referral/ellipse-1076.svg');

// Images from Figma (using URLs - can be replaced with local assets)
const imgUntitled11 = 'https://www.figma.com/api/mcp/asset/17f25b43-48f9-4809-95f8-7717d9bc22e0';
const imgEllipse1080 = 'https://www.figma.com/api/mcp/asset/5d282359-8d57-4b51-bfa5-f3aaa64d135f';
const imgEllipse1079 = 'https://www.figma.com/api/mcp/asset/bba6c18b-eb9d-4f0b-99ad-a21a9a0bc9d1';
const imgClient3DIcons = 'https://www.figma.com/api/mcp/asset/f638af52-96a5-459f-b090-197531ae579e';
const imgCheckmark3D = 'https://www.figma.com/api/mcp/asset/2b2c1987-117a-4129-81ee-9acaf1371998';
const imgGeminiDollar = 'https://www.figma.com/api/mcp/asset/ad2edd22-32ee-4f1c-a415-de5d842e91ec';
const imgLine341 = 'https://www.figma.com/api/mcp/asset/6bc4d419-2e13-4648-a0b4-d9c590f8ab10';
const imgLevelIndicator = 'https://www.figma.com/api/mcp/asset/68caa16f-4a34-4d4a-b235-ed7d06f9bfda';
const imgLevelDot = 'https://www.figma.com/api/mcp/asset/0ad389e9-cd79-4bd0-b1e9-c5501f170401';

interface RebateLevel {
  level: number;
  volume: string;
  rebate: string;
  isCurrent?: boolean;
}

const rebateLevels: RebateLevel[] = [
  { level: 1, volume: '<=$100,0000', rebate: '30%', isCurrent: true },
  { level: 2, volume: '>$100,0000', rebate: '35%' },
  { level: 3, volume: '>$5,000,0000', rebate: '40%' },
  { level: 4, volume: '>$10,000,0000', rebate: '45%' },
  { level: 5, volume: '>$12,500,0000', rebate: '50%' },
  { level: 6, volume: '>$20,500,0000', rebate: '60%' },
];

const faqs = [
  { question: 'What is the referral rebate', expanded: false },
  { question: 'How is my rebate calculated', expanded: false },
  { question: 'When can I claim my rebate', expanded: false },
  { question: 'Can I change my referrer', expanded: false },
];

export default function ReferralScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'rebate'>('rebate');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [expandedFaqs, setExpandedFaqs] = useState<Record<number, boolean>>({});

  const referralCode = getReferralCode();
  const referralLink = createReferralLink(referralCode);

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
      await Clipboard.setStringAsync(referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy referral code');
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy referral link');
    }
  };

  const handleShare = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(referralLink, {
          message: `Join TIWI Protocol using my referral link: ${referralLink}`,
        });
      } else {
        // Fallback to clipboard
        await handleCopyLink();
        Alert.alert('Copied', 'Referral link copied to clipboard');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share referral link');
    }
  };

  const handleClaim = () => {
    // TODO: Implement claim functionality
    Alert.alert('Claim', 'Claim functionality will be implemented');
  };

  const toggleFaq = (index: number) => {
    setExpandedFaqs((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const currentLevel = rebateLevels.find((l) => l.isCurrent) || rebateLevels[0];

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
          paddingBottom: (bottom || 16) + 104 + 24, // Bottom bar height + padding
          paddingHorizontal: 15,
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

        {/* Main Content */}
        <View style={{ flexDirection: 'column', gap: 42 }}>
          {/* Recent Invite & How To Invite Section */}
          <View style={{ flexDirection: 'column', gap: 32 }}>
            {/* Recent Invite Notification */}
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.bgStroke,
                borderRadius: 16,
                paddingHorizontal: 18,
                paddingVertical: 10,
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

            {/* How To Invite Section */}
            <View style={{ flexDirection: 'column', gap: 16 }}>
              <Text
                style={{
                  fontFamily: 'Manrope-SemiBold',
                  fontSize: 16,
                  lineHeight: 18.7,
                  color: colors.titleText,
                }}
              >
                How To Invite
              </Text>
              <View
                style={{
                  backgroundColor: colors.bgSemi,
                  borderWidth: 1,
                  borderColor: colors.bgStroke,
                  borderRadius: 16,
                  height: 102,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <View style={{ width: 294, alignItems: 'center' }}>
                  {/* Icons */}
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 63,
                      marginBottom: 5,
                    }}
                  >
                    <Image
                      source={{ uri: imgClient3DIcons }}
                      style={{ width: 42, height: 42 }}
                      contentFit="contain"
                    />
                    <Image
                      source={{ uri: imgCheckmark3D }}
                      style={{ width: 45, height: 45 }}
                      contentFit="contain"
                    />
                    <Image
                      source={{ uri: imgGeminiDollar }}
                      style={{ width: 45, height: 45 }}
                      contentFit="contain"
                    />
                  </View>
                  {/* Labels */}
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 11,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Manrope-Medium',
                        fontSize: 14,
                        lineHeight: 16.37,
                        color: colors.titleText,
                        textAlign: 'center',
                        width: 78,
                      }}
                    >
                      Share Your Link
                    </Text>
                    <Image
                      source={Ellipse1076}
                      style={{ width: 8, height: 8 }}
                      contentFit="contain"
                    />
                    <Text
                      style={{
                        fontFamily: 'Manrope-Medium',
                        fontSize: 14,
                        lineHeight: 16.37,
                        color: colors.titleText,
                        textAlign: 'center',
                        width: 78,
                      }}
                    >
                      Friend Signs Up
                    </Text>
                    <Image
                      source={Ellipse1076}
                      style={{ width: 8, height: 8 }}
                      contentFit="contain"
                    />
                    <Text
                      style={{
                        fontFamily: 'Manrope-Medium',
                        fontSize: 14,
                        lineHeight: 16.37,
                        color: colors.titleText,
                        textAlign: 'center',
                        width: 78,
                      }}
                    >
                      Earn Together
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* My Referrals Section */}
          <View style={{ flexDirection: 'column', gap: 16 }}>
            <Text
              style={{
                fontFamily: 'Manrope-SemiBold',
                fontSize: 16,
                lineHeight: 18.7,
                color: colors.titleText,
              }}
            >
              My Referrals
            </Text>
            <View
              style={{
                flexDirection: 'row',
                gap: 4,
                flexWrap: 'wrap',
              }}
            >
              {/* Total Invites Card */}
              <View
                style={{
                  flex: 1,
                  minWidth: 181,
                  backgroundColor: colors.bgCards,
                  borderRadius: 16,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-SemiBold',
                    fontSize: 12,
                    color: colors.titleText,
                    marginBottom: 2,
                  }}
                >
                  Total Invites
                </Text>
                <Text
                  style={{
                    fontFamily: 'Manrope-Bold',
                    fontSize: 14,
                    color: colors.bodyText,
                  }}
                >
                  0
                </Text>
              </View>

              {/* Total Bonuses Card */}
              <View
                style={{
                  flex: 1,
                  minWidth: 181,
                  backgroundColor: colors.bgCards,
                  borderRadius: 16,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-SemiBold',
                    fontSize: 12,
                    color: colors.titleText,
                    marginBottom: 2,
                  }}
                >
                  Total Bonuses (USDT)
                </Text>
                <Text
                  style={{
                    fontFamily: 'Manrope-Bold',
                    fontSize: 14,
                    color: colors.bodyText,
                  }}
                >
                  0.0000
                </Text>
              </View>

              {/* Claimable Rewards Card */}
              <View
                style={{
                  width: 174,
                  backgroundColor: colors.bgCards,
                  borderRadius: 16,
                  padding: 12,
                  justifyContent: 'center',
                }}
              >
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontFamily: 'Manrope-Bold',
                      fontSize: 14,
                      color: colors.bodyText,
                      marginBottom: 2,
                    }}
                  >
                    Claimable Rewards
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Manrope-Bold',
                      fontSize: 16,
                      color: colors.titleText,
                    }}
                  >
                    $0.00
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleClaim}
                  style={{
                    backgroundColor: colors.bgShade20,
                    borderWidth: 1.5,
                    borderColor: colors.accentDark40,
                    borderRadius: 100,
                    paddingHorizontal: 24,
                    paddingVertical: 9,
                    height: 42,
                    justifyContent: 'center',
                    alignItems: 'center',
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
                    Claim
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Referral Code and Link */}
            <View
              style={{
                flexDirection: 'column',
                gap: 18,
                alignItems: 'center',
              }}
            >
              {/* Referral Code */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: 334,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-Regular',
                    fontSize: 14,
                    color: colors.bodyText,
                  }}
                >
                  My Referral Code
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-SemiBold',
                      fontSize: 14,
                      color: colors.titleText,
                    }}
                  >
                    {referralCode}
                  </Text>
                  <TouchableOpacity onPress={handleCopyCode}>
                    <Image
                      source={CopyIcon}
                      style={{ width: 20, height: 20 }}
                      contentFit="contain"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Divider */}
              <View style={{ width: '100%', height: 1 }}>
                <Image
                  source={{ uri: imgLine341 }}
                  style={{ width: '100%', height: 1 }}
                  contentFit="contain"
                />
              </View>

              {/* Referral Link */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-Regular',
                    fontSize: 14,
                    color: colors.bodyText,
                  }}
                >
                  My Referral Link
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-SemiBold',
                      fontSize: 14,
                      color: colors.titleText,
                    }}
                    numberOfLines={1}
                  >
                    {referralLink.length > 20
                      ? `${referralLink.slice(0, 20)}...`
                      : referralLink}
                  </Text>
                  <TouchableOpacity onPress={handleCopyLink}>
                    <Image
                      source={CopyIcon}
                      style={{ width: 20, height: 20 }}
                      contentFit="contain"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Referral Leaderboard / Rebate Level Section */}
          <View style={{ flexDirection: 'column', gap: 16, width: 353 }}>
            {/* Tabs */}
            <View
              style={{
                flexDirection: 'row',
                gap: 16,
              }}
            >
              <TouchableOpacity
                onPress={() => setActiveTab('leaderboard')}
                style={{ flex: 1 }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-SemiBold',
                    fontSize: 15,
                    lineHeight: 17.54,
                    color: activeTab === 'leaderboard' ? colors.primaryCTA : colors.bodyText,
                  }}
                >
                  Referral Leaderboard
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('rebate')}
                style={{ flex: 1 }}
              >
                <View style={{ flexDirection: 'column', gap: 8 }}>
                  <Text
                    style={{
                      fontFamily: 'Manrope-SemiBold',
                      fontSize: 15,
                      lineHeight: 17.54,
                      color: activeTab === 'rebate' ? colors.primaryCTA : colors.bodyText,
                    }}
                  >
                    Rebate Level
                  </Text>
                  {activeTab === 'rebate' && (
                    <View style={{ height: 1, width: 97 }}>
                      <Image
                        source={{ uri: imgLevelIndicator }}
                        style={{ width: '100%', height: 1 }}
                        contentFit="contain"
                      />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Rebate Level Content */}
            {activeTab === 'rebate' && (
              <View style={{ flexDirection: 'column', gap: 14 }}>
                <Text
                  style={{
                    fontFamily: 'Manrope-SemiBold',
                    fontSize: 14,
                    lineHeight: 16.37,
                    color: colors.titleText,
                  }}
                >
                  My Rebate Level: {currentLevel.level}
                </Text>

                {/* Stats */}
                <View style={{ flexDirection: 'column', gap: 32 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 32,
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: 'Manrope-Medium',
                          fontSize: 14,
                          lineHeight: 16.37,
                          color: colors.bodyText,
                          marginBottom: 4,
                        }}
                      >
                        Invited Frens
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Manrope-Medium',
                          fontSize: 14,
                          lineHeight: 16.37,
                          color: colors.titleText,
                        }}
                      >
                        0
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text
                        style={{
                          fontFamily: 'Manrope-Medium',
                          fontSize: 14,
                          lineHeight: 16.37,
                          color: colors.bodyText,
                          marginBottom: 4,
                        }}
                      >
                        Frens' Spot Vol.
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Manrope-Medium',
                          fontSize: 14,
                          lineHeight: 16.37,
                          color: colors.titleText,
                          textAlign: 'right',
                        }}
                      >
                        $0
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text
                        style={{
                          fontFamily: 'Manrope-Medium',
                          fontSize: 14,
                          lineHeight: 16.37,
                          color: colors.bodyText,
                          marginBottom: 4,
                        }}
                      >
                        Frens' Perp Vol.
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Manrope-Medium',
                          fontSize: 14,
                          lineHeight: 16.37,
                          color: colors.titleText,
                          textAlign: 'right',
                        }}
                      >
                        -
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 18,
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          fontFamily: 'Manrope-Medium',
                          fontSize: 14,
                          lineHeight: 16.37,
                          color: colors.bodyText,
                          marginBottom: 4,
                        }}
                      >
                        My Spot Rebate
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Manrope-Medium',
                          fontSize: 14,
                          lineHeight: 16.37,
                          color: colors.titleText,
                        }}
                      >
                        {currentLevel.rebate}
                      </Text>
                    </View>
                    <View>
                      <Text
                        style={{
                          fontFamily: 'Manrope-Medium',
                          fontSize: 14,
                          lineHeight: 16.37,
                          color: colors.bodyText,
                          marginBottom: 4,
                        }}
                      >
                        My Perp Rebate
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Manrope-Medium',
                          fontSize: 14,
                          lineHeight: 16.37,
                          color: colors.titleText,
                        }}
                      >
                        -
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Rebate Level Table */}
                <View
                  style={{
                    backgroundColor: colors.bg,
                    borderWidth: 1,
                    borderColor: colors.bgStroke,
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  {/* Table Header */}
                  <View
                    style={{
                      backgroundColor: colors.bgStroke,
                      flexDirection: 'row',
                      paddingHorizontal: 20,
                      paddingVertical: 5,
                      gap: 29,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Manrope-Medium',
                        fontSize: 13,
                        lineHeight: 15.2,
                        color: colors.titleText,
                        width: 48,
                        textAlign: 'right',
                      }}
                    >
                      Level
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Manrope-Medium',
                        fontSize: 13,
                        lineHeight: 15.2,
                        color: colors.titleText,
                        flex: 1,
                        textAlign: 'center',
                      }}
                    >
                      28 day referee spot/perp vol
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Manrope-Medium',
                        fontSize: 13,
                        lineHeight: 15.2,
                        color: colors.titleText,
                        width: 99,
                        textAlign: 'center',
                      }}
                    >
                      Rebate share applied to 0.25% fee
                    </Text>
                  </View>

                  {/* Table Rows */}
                  {rebateLevels.map((level, index) => (
                    <View
                      key={level.level}
                      style={{
                        flexDirection: 'row',
                        paddingHorizontal: level.isCurrent ? 11 : 20,
                        paddingVertical: 15,
                        gap: 29,
                        backgroundColor:
                          index % 2 === 1 ? colors.bgStroke : 'transparent',
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          width: 58,
                        }}
                      >
                        {level.isCurrent && (
                          <Image
                            source={{ uri: imgLevelDot }}
                            style={{ width: 8, height: 8 }}
                            contentFit="contain"
                          />
                        )}
                        <Text
                          style={{
                            fontFamily: 'Manrope-Medium',
                            fontSize: 14,
                            lineHeight: 16.37,
                            color: colors.titleText,
                            textAlign: 'right',
                            flex: 1,
                          }}
                        >
                          Level {level.level}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: 'Manrope-Medium',
                          fontSize: 14,
                          lineHeight: 16.37,
                          color: colors.titleText,
                          flex: 1,
                          textAlign: 'center',
                        }}
                      >
                        {level.volume}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Manrope-Medium',
                          fontSize: 14,
                          lineHeight: 16.37,
                          color: colors.titleText,
                          width: 99,
                          textAlign: 'center',
                        }}
                      >
                        {level.rebate}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* FAQs Section */}
          <View style={{ flexDirection: 'column', gap: 18 }}>
            <Text
              style={{
                fontFamily: 'Manrope-SemiBold',
                fontSize: 16,
                lineHeight: 18.7,
                color: colors.titleText,
              }}
            >
              Frequently Asked Questions (FAQs)
            </Text>
            <View style={{ flexDirection: 'column', gap: 4 }}>
              {faqs.map((faq, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => toggleFaq(index)}
                  style={{
                    backgroundColor: colors.bgCards,
                    borderRadius: 16,
                    paddingHorizontal: 24,
                    paddingVertical: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 14,
                      lineHeight: 16.37,
                      color: colors.bodyText,
                      flex: 1,
                    }}
                  >
                    {faq.question}
                  </Text>
                  <Image
                    source={ArrowDown01}
                    style={{
                      width: 24,
                      height: 24,
                      transform: [{ rotate: expandedFaqs[index] ? '180deg' : '0deg' }],
                    }}
                    contentFit="contain"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.bgSemi,
          borderTopWidth: 1,
          borderTopColor: colors.bg,
          height: 104,
          paddingTop: 18,
          paddingBottom: bottom || 0,
          paddingHorizontal: 2,
          shadowColor: colors.primaryCTA,
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            paddingHorizontal: 15,
          }}
        >
          {/* Invite Friend Button */}
          <TouchableOpacity
            onPress={handleShare}
            style={{
              backgroundColor: colors.primaryCTA,
              borderRadius: 100,
              paddingHorizontal: 24,
              paddingVertical: 9,
              height: 54,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              flex: 1,
              maxWidth: 267,
            }}
          >
            <Image
              source={ShareIcon}
              style={{ width: 24, height: 24 }}
              contentFit="contain"
            />
            <Text
              style={{
                fontFamily: 'Manrope-SemiBold',
                fontSize: 16,
                lineHeight: 25.6,
                color: colors.bg,
              }}
            >
              Invite Friend
            </Text>
          </TouchableOpacity>

          {/* QR Code Button */}
          <TouchableOpacity
            style={{
              width: 65,
              height: 65,
              borderRadius: 100,
              backgroundColor: colors.titleText,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                backgroundColor: colors.titleText,
                borderRadius: 100,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <QRCode
                value={referralLink}
                size={56}
                color="#000000"
                backgroundColor={colors.titleText}
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

