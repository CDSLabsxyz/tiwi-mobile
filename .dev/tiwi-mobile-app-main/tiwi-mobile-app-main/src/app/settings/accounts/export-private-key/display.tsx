/**
 * Export Private Key - Display Screen
 * Shows private key with copy and download buttons matching Figma design exactly (node-id: 3279-122024)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, BackHandler, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const CopyIcon = require('@/assets/wallet/copy-01.svg');
const DownloadIcon = require('@/assets/settings/download-03.svg');

// Mock private key - in production, this should be retrieved securely after passcode validation
const MOCK_PRIVATE_KEY = '0xdeadbeef1234567890abcdefdeadbeef1234567890abcdefdeadbeef1234567890ab';

export default function ExportPrivateKeyDisplayScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
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
    router.replace('/settings/accounts' as any);
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(MOCK_PRIVATE_KEY);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy private key:', error);
      Alert.alert('Error', 'Failed to copy private key');
    }
  };

  const handleDownload = async () => {
    try {
      // Create file content
      const fileContent = JSON.stringify({
        privateKey: MOCK_PRIVATE_KEY,
        exportedAt: new Date().toISOString(),
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', // TODO: Get from wallet
      }, null, 2);

      // For web, create a blob and download
      if (Platform.OS === 'web') {
        const blob = new Blob([fileContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `private-key-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      // For mobile, try to create file in a temporary location
      const fileName = `private-key-${Date.now()}.json`;
      // Use a temporary file path (will fallback to text sharing if this fails)
      const fileUri = `file:///tmp/${fileName}`;

      try {
        await FileSystem.writeAsStringAsync(fileUri, fileContent);

        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Save Private Key',
          });
        } else {
          // Fallback: share as text
          await Sharing.shareAsync(fileContent, {
            mimeType: 'text/plain',
            dialogTitle: 'Private Key',
          });
        }
      } catch (fileError) {
        // If file creation fails, share as text
        console.log('File creation failed, sharing as text:', fileError);
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileContent, {
            mimeType: 'text/plain',
            dialogTitle: 'Private Key',
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      }
    } catch (error) {
      console.error('Failed to download private key:', error);
      Alert.alert('Error', 'Failed to download private key');
    }
  };

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
            gap: 68,
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
              fontSize: 20,
              lineHeight: 20,
              color: colors.titleText,
            }}
          >
            Export Private Key
          </Text>
        </View>
      </View>

      {/* Content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 24,
          alignItems: 'center',
        }}
      >
        {/* Private Key Display Box - Matching Figma: 353px width, min 99px height, 16px border radius, grows to fit content */}
        <View
          style={{
            width: 353,
            maxWidth: '100%',
            minHeight: 99,
            backgroundColor: colors.bgSemi,
            borderRadius: 16,
            paddingHorizontal: 17,
            paddingVertical: 10,
            marginBottom: 24,
            overflow: 'hidden',
          }}
        >
          <Text
            style={{
              fontFamily: 'Manrope-Regular',
              fontSize: 16,
              color: colors.titleText,
              textAlign: 'left',
              width: '100%',
              paddingTop: 10,
              flexWrap: 'wrap',
            }}
            selectable
          >
            {MOCK_PRIVATE_KEY}
          </Text>
        </View>

        {/* Action Buttons - Matching Figma: 13px gap, 100px width each */}
        <View
          style={{
            flexDirection: 'row',
            gap: 13,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Copy Button */}
          <View
            style={{
              width: 100,
              flexDirection: 'column',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCopy}
              style={{
                width: '100%',
                height: 56,
                backgroundColor: colors.bgCards,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                }}
              >
                <Image
                  source={CopyIcon}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </View>
            </TouchableOpacity>
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 14,
                color: colors.titleText,
                textAlign: 'center',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Text>
          </View>

          {/* Download Button */}
          <View
            style={{
              width: 100,
              flexDirection: 'column',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleDownload}
              style={{
                width: '100%',
                height: 56,
                backgroundColor: colors.bgCards,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                }}
              >
                <Image
                  source={DownloadIcon }
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </View>
            </TouchableOpacity>
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 14,
                color: colors.titleText,
                textAlign: 'center',
              }}
            >
              Download
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

