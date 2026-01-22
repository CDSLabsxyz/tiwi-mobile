import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { WALLET_ADDRESS, truncateAddress } from '@/utils/wallet';
import { fetchWalletBalance } from '@/services/walletService';

const TiwiCat = require('../../assets/home/tiwicat.svg');
const TransactionHistory = require('../../assets/home/transaction-history.svg');
const Settings = require('../../assets/home/settings-03.svg');

interface WalletModalProps {
  visible: boolean;
  onClose: () => void;
  walletAddress?: string;
  totalBalance?: string;
  onHistoryPress?: () => void;
  onSettingsPress?: () => void;
  onDisconnectPress?: () => void;
}

/**
 * Wallet Modal Component
 * Slides up from bottom with animation
 * Matches Figma design exactly (node-id: 3331-39288)
 * Dimensions: 393px × 441px
 */
export const WalletModal: React.FC<WalletModalProps> = ({
  visible,
  onClose,
  walletAddress,
  totalBalance: initialBalance,
  onHistoryPress,
  onSettingsPress,
  onDisconnectPress,
}) => {
  // Use provided address or default to main wallet address
  const fullAddress = walletAddress || WALLET_ADDRESS;
  const displayAddress = truncateAddress(fullAddress);
  
  const [totalBalance, setTotalBalance] = useState(initialBalance || '$0.00');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const { bottom } = useSafeAreaInsets();
  // Modal height from Figma: 441px
  const modalHeight = 441;
  const translateY = useSharedValue(modalHeight); // Start off-screen
  const opacity = useSharedValue(0);
  const [copied, setCopied] = useState(false);

  // Fetch wallet balance when modal opens
  useEffect(() => {
    if (visible) {
      const loadBalance = async () => {
        setIsLoadingBalance(true);
        try {
          const balance = await fetchWalletBalance(fullAddress);
          setTotalBalance(balance);
        } catch (error) {
          console.error('Failed to fetch wallet balance:', error);
          setTotalBalance('$0.00');
        } finally {
          setIsLoadingBalance(false);
        }
      };
      loadBalance();
    }
  }, [visible, fullAddress]);

  useEffect(() => {
    if (visible) {
      // Slide up animation
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      // Slide down animation
      translateY.value = withTiming(modalHeight, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [visible]);

  const modalStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const handleBackdropPress = () => {
    onClose();
  };

  const handleCopyAddress = async () => {
    // Copy the full address, not the truncated one
    await Clipboard.setStringAsync(fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const startY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = startY.value + event.translationY;
      translateY.value = Math.max(0, Math.min(modalHeight, next));
    })
    .onEnd((event) => {
      if (event.translationY > 80) {
        translateY.value = withTiming(modalHeight, { duration: 250 }, (finished) => {
          if (finished) {
            runOnJS(onClose)();
          }
        });
        opacity.value = withTiming(0, { duration: 250 });
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 90,
        });
      }
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        {/* Backdrop */}
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          onPress={handleBackdropPress}
        >
          <Animated.View
            style={[
              {
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
              },
              backdropStyle,
            ]}
          />
        </Pressable>

        {/* Modal Content */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: colors.bgSemi,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 0,
                paddingBottom: bottom || 24,
                paddingHorizontal: 0,
                width: '100%',
                height: modalHeight,
              },
              modalStyle,
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
          <View className="flex-col items-center" style={{ gap: 34, paddingBottom: 24 }}>
            {/* Top Handle Bar */}
            <View
              className="flex-row items-center justify-center"
              style={{
                paddingTop: 8,
                paddingBottom: 8,
                width: '100%',
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 4,
                  backgroundColor: colors.bgStroke,
                  borderRadius: 100,
                }}
              />
            </View>

            {/* Main Content */}
            <View
              className="flex-col items-center"
              style={{
                width: 353,
                gap: 16,
              }}
            >
              {/* Wallet Avatar and Address */}
              <View className="flex-col items-center" style={{ gap: 10 }}>
                {/* Tiwicat Avatar */}
                <View style={{ width: 80, height: 80 }}>
                  <Image
                    source={TiwiCat}
                    className="w-full h-full rounded-full"
                    contentFit="cover"
                  />
                </View>

                {/* Wallet Address with Copy */}
                <View
                  className="flex-row items-center justify-center"
                  style={{ gap: 10 }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 16,
                      color: '#EDEDED',
                    }}
                  >
                    {displayAddress}
                  </Text>
                  <TouchableOpacity
                    onPress={handleCopyAddress}
                    style={{ width: 20, height: 20 }}
                  >
                    {copied ? (
                      <Text
                        style={{
                          fontFamily: 'Manrope-SemiBold',
                          fontSize: 14,
                          color: colors.primaryCTA,
                        }}
                      >
                        ✓
                      </Text>
                    ) : (
                      <Image
                        source={require("@/assets/wallet/copy-01.svg")}
                        className="w-full h-full"
                        contentFit="contain"
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Cards Section */}
              <View className="flex-col items-start w-full" style={{ gap: 8 }}>
                {/* Total Balance Card */}
                <View
                  style={{
                    backgroundColor: colors.bgStroke,
                    borderRadius: 16,
                    padding: 16,
                    width: '100%',
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 14,
                      color: colors.bodyText,
                    }}
                  >
                    Total Balance
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Manrope-Bold',
                      fontSize: 18,
                      color: colors.titleText,
                    }}
                  >
                    {totalBalance}
                  </Text>
                </View>

                {/* History and Settings Cards */}
                <View
                  className="flex-row"
                  style={{
                    width: '100%',
                    gap: 8,
                  }}
                >
                  {/* History Card */}
                  <TouchableOpacity
                    onPress={onHistoryPress}
                    style={{
                      flex: 1,
                      backgroundColor: colors.bgCards,
                      borderRadius: 16,
                      padding: 16,
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View style={{ width: 24, height: 24 }}>
                      <Image
                        source={TransactionHistory}
                        className="w-full h-full"
                        contentFit="contain"
                      />
                    </View>
                    <Text
                      style={{
                        fontFamily: 'Manrope-Medium',
                        fontSize: 14,
                        color: colors.bodyText,
                      }}
                    >
                      History
                    </Text>
                  </TouchableOpacity>

                  {/* Settings Card */}
                  <TouchableOpacity
                    onPress={onSettingsPress}
                    style={{
                      flex: 1,
                      backgroundColor: colors.bgCards,
                      borderRadius: 16,
                      padding: 16,
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View style={{ width: 24, height: 24 }}>
                      <Image
                        source={Settings}
                        className="w-full h-full"
                        contentFit="contain"
                      />
                    </View>
                    <Text
                      style={{
                        fontFamily: 'Manrope-Medium',
                        fontSize: 14,
                        color: colors.bodyText,
                      }}
                    >
                      Settings
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Disconnect Button */}
            <TouchableOpacity
              onPress={onDisconnectPress}
              style={{
                width: 353,
                backgroundColor: '#564100',
                borderRadius: 100,
                paddingVertical: 12,
                paddingHorizontal: 106,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
              }}
            >
              <View style={{ width: 24, height: 24 }}>
                <Image
                  source={require("@/assets/wallet/logout-01.svg")}
                  className="w-full h-full"
                  contentFit="contain"
                />
              </View>
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 16,
                  color: colors.titleText,
                }}
              >
                Disconnect
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
};

