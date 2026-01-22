/**
 * Account Settings Screen
 * Account details page matching Figma design exactly (node-id: 3279-120860)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { WALLET_ADDRESS, truncateAddress } from '@/utils/wallet';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const PencilEditIcon = require('@/assets/settings/pencil-edit-01.svg');
const CloudUploadIcon = require('@/assets/settings/cloud-upload.svg');
const LogoutIcon = require('@/assets/wallet/logout-01.svg');
const CopyIcon = require('@/assets/wallet/copy-01.svg');
const IrisScanIcon = require('@/assets/home/iris-scan.svg');

// Mock chain icons - will be replaced with actual chain logos
const ChainIcon = require('@/assets/home/chains/bsc.svg');

// Mock wallet name - in production, this should come from storage
const DEFAULT_WALLET_NAME = 'Wallet 1';

export default function AccountSettingsScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [walletName, setWalletName] = useState(DEFAULT_WALLET_NAME);
  const [copied, setCopied] = useState(false);

  // Handle phone back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, [params.returnTo]);

  const handleBackPress = () => {
    router.replace('/settings' as any);
  };

  const handleCopyAddress = async () => {
    try {
      await Clipboard.setStringAsync(WALLET_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  const handleIrisScan = () => {
    // TODO: Implement iris scan functionality
    console.log('Iris scan pressed');
  };

  const handleEditWalletName = () => {
    router.push('/settings/accounts/edit-wallet-name' as any);
  };

  const handleExportPrivateKey = () => {
    router.push('/settings/accounts/export-private-key' as any);
  };

  const handleExportRecoveryPhrase = () => {
    router.push('/settings/accounts/export-recovery-phrase' as any);
  };

  const handleDisconnectWallet = () => {
    router.push('/settings/accounts/disconnect-wallet' as any);
  };

  // Mock connected networks - in production, fetch from wallet service
  const connectedNetworks = Array(8).fill(null);

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
        {/* Header with Back Button and Title - Matching Figma: 68px gap, 10px vertical padding */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 68,
            paddingVertical: 10,
          }}
        >
          {/* Back Button */}
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

          {/* Title - Matching Figma: 20px font, General Sans Medium */}
          <Text
            style={{
              fontFamily: 'Manrope-Medium', // Using Manrope as General Sans equivalent
              fontSize: 20,
              lineHeight: 20,
              color: colors.titleText,
            }}
          >
            Account Settings
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: (bottom || 16) + 24,
          paddingHorizontal: 20,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Wallet Info Section - Matching Figma: 20px gap between items */}
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            flexDirection: 'column',
            gap: 20,
            marginBottom: 24,
          }}
        >
          {/* Wallet Name */}
          <View
            style={{
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              Wallet Name:
            </Text>
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              {walletName}
            </Text>
          </View>

          {/* Wallet Address */}
          <View
            style={{
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              Wallet Address:
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
                  fontFamily: 'Manrope-Medium',
                  fontSize: 16,
                  color: colors.titleText,
                  flex: 1,
                }}
              >
                {truncateAddress(WALLET_ADDRESS)}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {/* Copy Icon */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleCopyAddress}
                  style={{
                    width: 20,
                    height: 20,
                  }}
                >
                  <Image
                    source={CopyIcon}
                    className="w-full h-full"
                    contentFit="contain"
                  />
                </TouchableOpacity>

                {/* Iris Scan Icon */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleIrisScan}
                  style={{
                    width: 20,
                    height: 20,
                  }}
                >
                  <Image
                    source={IrisScanIcon}
                    className="w-full h-full"
                    contentFit="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Account Type */}
          <View
            style={{
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              Account Type:
            </Text>
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              Non-custodial
            </Text>
          </View>

          {/* Network(s) connected */}
          <View
            style={{
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.bodyText,
              }}
            >
              Network(s) connected:
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              {connectedNetworks.map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: 20.25,
                    height: 20.25,
                    borderRadius: 10.125,
                    overflow: 'hidden',
                  }}
                >
                  <Image
                    source={ChainIcon}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Action Buttons - Matching Figma: 8px gap, 54px height, rounded-full */}
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Edit Wallet Name */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleEditWalletName}
            style={{
              width: '100%',
              height: 54,
              backgroundColor: colors.bgCards,
              borderRadius: 100,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 10,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
              }}
            >
              <Image
                source={PencilEditIcon}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              Edit Wallet Name
            </Text>
          </TouchableOpacity>

          {/* Export Private Key */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleExportPrivateKey}
            style={{
              width: '100%',
              height: 54,
              backgroundColor: colors.bgCards,
              borderRadius: 100,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 10,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
              }}
            >
              <Image
                source={CloudUploadIcon}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              Export Private Key
            </Text>
          </TouchableOpacity>

          {/* Export Recovery Phrase */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleExportRecoveryPhrase}
            style={{
              width: '100%',
              height: 54,
              backgroundColor: colors.bgCards,
              borderRadius: 100,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 10,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
              }}
            >
              <Image
                source={CloudUploadIcon}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              Export Recovery Phrase
            </Text>
          </TouchableOpacity>

          {/* Disconnect Wallet */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleDisconnectWallet}
            style={{
              width: '100%',
              height: 54,
              backgroundColor: colors.bgCards,
              borderRadius: 100,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 10,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
              }}
            >
              <Image
                source={LogoutIcon}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              Disconnect Wallet
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
