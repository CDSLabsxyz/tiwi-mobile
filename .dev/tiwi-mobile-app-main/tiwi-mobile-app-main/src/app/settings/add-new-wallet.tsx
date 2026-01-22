/**
 * Add New Wallet Screen
 * Allows users to add a wallet with name, address, and type.
 * Matches the add-new-wallet flow designs.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  BackHandler,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from "@/components/ui/StatusBar";
import { Image } from "@/tw";
import { colors } from "@/theme";

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const ArrowDownIcon = require('@/assets/home/arrow-down-01.svg');

type WalletType = 'Crypto Wallet' | 'Bank Account' | 'Mobile Money';

const WALLET_TYPES: WalletType[] = ['Crypto Wallet', 'Bank Account', 'Mobile Money'];

export default function AddNewWalletScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();

  const [walletName, setWalletName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletType, setWalletType] = useState<WalletType | ''>('');
  const [errors, setErrors] = useState<{ name?: string; address?: string; type?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isTypeModalVisible, setIsTypeModalVisible] = useState(false);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });
    return () => backHandler.remove();
  }, [params.returnTo]);

  const handleBackPress = () => {
    const returnTo = params.returnTo as string | undefined;
    if (returnTo) {
      router.push(returnTo as any);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings' as any);
    }
  };

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!walletName.trim()) {
      newErrors.name = 'Wallet name is required';
    } else if (walletName.trim().length < 2) {
      newErrors.name = 'Wallet name must be at least 2 characters';
    }

    if (!walletAddress.trim()) {
      newErrors.address = 'Wallet address is required';
    } else if (walletAddress.trim().length < 8) {
      newErrors.address = 'Wallet address looks too short';
    }

    if (!walletType) {
      newErrors.type = 'Select a wallet type';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (isSaving) return;
    const isValid = validate();
    if (!isValid) return;

    try {
      setIsSaving(true);
      // TODO: Persist the new wallet (API or local storage)
      Alert.alert('Success', 'Wallet saved successfully', [
        {
          text: 'OK',
          onPress: () => {
            const returnTo = params.returnTo as string | undefined;
            if (returnTo) {
              router.push(returnTo as any);
            } else if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/settings' as any);
            }
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save wallet. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = useMemo(
    () => walletName.trim().length >= 2 && walletAddress.trim().length >= 8 && !!walletType,
    [walletName, walletAddress, walletType]
  );

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
            <Image source={ChevronLeftIcon} className="w-full h-full" contentFit="contain" />
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
            Add New Wallet
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 32,
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
            gap: 20,
          }}
        >
          {/* Wallet Name */}
          <View style={{ flexDirection: 'column', gap: 8 }}>
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              Wallet Name
            </Text>
            <View
              style={{
                backgroundColor: colors.bgSemi,
                borderRadius: 16,
                paddingHorizontal: 17,
                paddingVertical: 10,
                borderWidth: errors.name ? 1 : 0,
                borderColor: errors.name ? colors.error : 'transparent',
              }}
            >
              <TextInput
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 16,
                  color: colors.titleText,
                  padding: 0,
                }}
                placeholder="Enter wallet name"
                placeholderTextColor={colors.mutedText}
                value={walletName}
                onChangeText={setWalletName}
              />
            </View>
            {errors.name && (
              <Text
                style={{
                  fontFamily: 'Manrope-Regular',
                  fontSize: 12,
                  color: colors.error,
                }}
              >
                {errors.name}
              </Text>
            )}
          </View>

          {/* Wallet Address */}
          <View style={{ flexDirection: 'column', gap: 8 }}>
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              Wallet Address
            </Text>
            <View
              style={{
                backgroundColor: colors.bgSemi,
                borderRadius: 16,
                paddingHorizontal: 17,
                paddingVertical: 10,
                borderWidth: errors.address ? 1 : 0,
                borderColor: errors.address ? colors.error : 'transparent',
              }}
            >
              <TextInput
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 16,
                  color: colors.titleText,
                  padding: 0,
                }}
                placeholder="Enter wallet address"
                placeholderTextColor={colors.mutedText}
                value={walletAddress}
                onChangeText={setWalletAddress}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {errors.address && (
              <Text
                style={{
                  fontFamily: 'Manrope-Regular',
                  fontSize: 12,
                  color: colors.error,
                }}
              >
                {errors.address}
              </Text>
            )}
          </View>

          {/* Wallet Type */}
          <View style={{ flexDirection: 'column', gap: 8 }}>
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: colors.titleText,
              }}
            >
              Wallet Type
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsTypeModalVisible(true)}
              style={{
                height: 56,
                backgroundColor: colors.bgSemi,
                borderRadius: 16,
                paddingHorizontal: 17,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: errors.type ? 1 : 0,
                borderColor: errors.type ? colors.error : 'transparent',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 16,
                  color: colors.mutedText,
                }}
              >
                {walletType || 'Select Wallet Type'}
              </Text>
              <View style={{ width: 24, height: 24 }}>
                <Image source={ArrowDownIcon} style={{ width: '100%', height: '100%' }} contentFit="contain" />
              </View>
            </TouchableOpacity>
            {errors.type && (
              <Text
                style={{
                  fontFamily: 'Manrope-Regular',
                  fontSize: 12,
                  color: colors.error,
                }}
              >
                {errors.type}
              </Text>
            )}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={!isFormValid || isSaving}
            style={{
              width: '100%',
              height: 54,
              backgroundColor: isFormValid ? colors.primaryCTA : colors.bgCards,
              borderRadius: 100,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingVertical: 14,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                color: isFormValid ? '#050201' : colors.bodyText,
              }}
            >
              {isSaving ? 'Saving…' : 'Save Wallet'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Wallet Type Modal */}
      <Modal visible={isTypeModalVisible} transparent animationType="fade" statusBarTranslucent>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(1,5,1,0.7)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setIsTypeModalVisible(false)}
        >
          <Pressable
            style={{
              backgroundColor: '#1b1b1b',
              borderTopLeftRadius: 40,
              borderTopRightRadius: 40,
              paddingHorizontal: 17,
              paddingTop: 31,
              paddingBottom: (bottom || 24) + 24,
              width: '100%',
              alignSelf: 'center',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'column', gap: 4 }}>
              {WALLET_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  activeOpacity={0.8}
                  onPress={() => {
                    setWalletType(type);
                    setErrors((prev) => ({ ...prev, type: undefined }));
                    setIsTypeModalVisible(false);
                  }}
                  style={{
                    height: 56,
                    borderRadius: 16,
                    paddingHorizontal: 17,
                    paddingVertical: 10,
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
                    }}
                  >
                    {type}
                  </Text>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: type === walletType ? colors.primaryCTA : colors.mutedText,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {type === walletType && (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: colors.primaryCTA,
                        }}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}





