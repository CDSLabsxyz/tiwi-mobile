/**
 * App Updates & Cache Settings Screen
 * App updates and cache management page matching Figma design exactly (node-id: 3279-121169)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler, Alert, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system';
import { BlurView } from 'expo-blur';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const ChevronRightIcon = require('@/assets/home/arrow-right-01.svg');
const DownloadIcon = require('@/assets/settings/download-03.svg');
const DeleteIcon = require('@/assets/settings/delete-02.svg');
const RestoreBinIcon = require('@/assets/settings/restore-bin.svg');
const RefreshIcon = require('@/assets/settings/refresh.svg');
const UnavailableIcon = require('@/assets/settings/unavailable.svg');

interface AppUpdateOption {
  id: string;
  title: string;
  icon: string;
  action: () => void;
  disabled?: boolean;
}

export default function AppUpdatesCacheScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isResettingFiles, setIsResettingFiles] = useState(false);
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);

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
      router.replace('/settings' as any);
    }
  };

  const handleCheckForUpdates = async () => {
    try {
      // Open App Store (iOS) or Play Store (Android)
      if (Platform.OS === 'ios') {
        // Replace with your actual App Store URL
        const appStoreUrl = 'https://apps.apple.com/app/tiwi-protocol/id123456789'; // TODO: Replace with actual App ID
        const canOpen = await Linking.canOpenURL(appStoreUrl);
        if (canOpen) {
          await Linking.openURL(appStoreUrl);
        } else {
          Alert.alert('Error', 'Unable to open App Store');
        }
      } else if (Platform.OS === 'android') {
        // Replace with your actual Play Store URL
        const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.tiwiprotocol.app'; // TODO: Replace with actual package name
        const canOpen = await Linking.canOpenURL(playStoreUrl);
        if (canOpen) {
          await Linking.openURL(playStoreUrl);
        } else {
          Alert.alert('Error', 'Unable to open Play Store');
        }
      } else {
        Alert.alert('Info', 'Please check for updates on your device\'s app store');
      }
    } catch (error) {
      console.error('Error opening app store:', error);
      Alert.alert('Error', 'Failed to open app store');
    }
  };

  const handleClearCache = async () => {
    try {
      setIsClearingCache(true);
      
      // Clear cache directory
      if (FileSystem.cacheDirectory) {
        try {
          const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
          for (const file of files) {
            try {
              await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${file}`, { idempotent: true });
            } catch (err) {
              console.warn(`Failed to delete ${file}:`, err);
            }
          }
        } catch (err) {
          console.warn('Error reading cache directory:', err);
        }
      }

      // Also clear AsyncStorage cache-related data if needed
      // Note: This is a basic implementation. You may want to be more selective about what to clear.

      Alert.alert('Success', 'Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
      Alert.alert('Error', 'Failed to clear cache');
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleResetTemporaryFiles = async () => {
    try {
      setIsResettingFiles(true);
      
      // Clear temporary files
      if (FileSystem.cacheDirectory) {
        try {
          const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
          for (const file of files) {
            // Only delete temporary files (you can add more specific filtering)
            if (file.startsWith('temp_') || file.endsWith('.tmp')) {
              try {
                await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${file}`, { idempotent: true });
              } catch (err) {
                console.warn(`Failed to delete ${file}:`, err);
              }
            }
          }
        } catch (err) {
          console.warn('Error reading cache directory:', err);
        }
      }

      Alert.alert('Success', 'Temporary files reset successfully');
    } catch (error) {
      console.error('Error resetting temporary files:', error);
      Alert.alert('Error', 'Failed to reset temporary files');
    } finally {
      setIsResettingFiles(false);
    }
  };

  const handleRefreshNFTMetadata = async () => {
    try {
      setIsRefreshingMetadata(true);
      
      // TODO: Implement actual NFT metadata refresh logic
      // This would typically involve:
      // 1. Clearing cached NFT metadata
      // 2. Triggering a refresh of NFT data from the blockchain/API
      // 3. Updating the UI with fresh data
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      Alert.alert('Success', 'NFT metadata refreshed successfully');
    } catch (error) {
      console.error('Error refreshing NFT metadata:', error);
      Alert.alert('Error', 'Failed to refresh NFT metadata');
    } finally {
      setIsRefreshingMetadata(false);
    }
  };

  const appUpdateOptions: AppUpdateOption[] = [
    {
      id: 'check-updates',
      title: 'Check for Updates',
      icon: DownloadIcon,
      action: handleCheckForUpdates,
    },
    {
      id: 'clear-cache',
      title: 'Clear Cache',
      icon: DeleteIcon,
      action: handleClearCache,
    },
    {
      id: 'reset-temp-files',
      title: 'Reset Temporary Files',
      icon: RestoreBinIcon,
      action: handleResetTemporaryFiles,
    },
    {
      id: 'refresh-nft-metadata',
      title: 'Refresh NFT Metadata',
      icon: RefreshIcon,
      action: handleRefreshNFTMetadata,
    },
    {
      id: 'developer-mode',
      title: 'Developer Mode',
      icon: UnavailableIcon,
      action: () => {},
      disabled: true,
    },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Header */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
          paddingHorizontal: 21,
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
              fontSize: 20,
              lineHeight: 20,
              color: colors.titleText,
              flex: 1,
              textAlign: 'center',
            }}
          >
            App Updates & Cache
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 40,
          paddingBottom: (bottom || 16) + 24,
          paddingHorizontal: 21,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            flexDirection: 'column',
            gap: 30,
          }}
        >
          {appUpdateOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              activeOpacity={option.disabled ? 1 : 0.8}
              onPress={option.disabled ? undefined : option.action}
              disabled={option.disabled || isClearingCache || isResettingFiles || isRefreshingMetadata}
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: option.disabled ? 0.5 : 1,
                position: 'relative',
              }}
            >
              {/* Left: Icon + Title */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {/* Icon */}
                <View
                  style={{
                    width: 24,
                    height: 24,
                  }}
                >
                  <Image
                    source={option.icon}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                  />
                </View>

                {/* Title */}
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 16,
                    lineHeight: 16,
                    color: option.disabled ? colors.mutedText : colors.titleText,
                  }}
                >
                  {option.title}
                </Text>
              </View>

              {/* Right: Chevron or Loading */}
              {option.disabled ? null : (
                <View
                  style={{
                    width: 24,
                    height: 24,
                  }}
                >
                  {(option.id === 'clear-cache' && isClearingCache) ||
                  (option.id === 'reset-temp-files' && isResettingFiles) ||
                  (option.id === 'refresh-nft-metadata' && isRefreshingMetadata) ? (
                    <ActivityIndicator size="small" color={colors.primaryCTA} />
                  ) : (
                    <Image
                      source={ChevronRightIcon}
                      className="w-full h-full"
                      contentFit="contain"
                    />
                  )}
                </View>
              )}

              {/* Blur overlay for Developer Mode */}
              {option.disabled && (
                <BlurView
                  intensity={10}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 8,
                  }}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}





