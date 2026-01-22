/**
 * Auto-Lock Timer Screen
 * Auto-lock timer page with bottom sheet modal matching Figma design exactly (node-id: 3279-121743, 3279-121805)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, BackHandler, Modal, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/settings/arrow-left-02.svg');
const ArrowDownIcon = require('@/assets/home/arrow-down-01.svg');

// Radio button icons - will download from Figma
// const RadioButtonSelected = require('@/assets/settings/radio-button-selected.svg');
// const RadioButtonUnselected = require('@/assets/settings/radio-button-unselected.svg');

type AutoLockOption = 'Immediately' | '30 seconds' | '1 Minute' | '5 Minutes' | '10 Minutes' | 'Never';

const AUTO_LOCK_OPTIONS: AutoLockOption[] = [
  'Immediately',
  '30 seconds',
  '1 Minute',
  '5 Minutes',
  '10 Minutes',
  'Never',
];

// Radio Button Component
interface RadioButtonProps {
  selected: boolean;
  onPress: () => void;
  label: string;
}

const RadioButton: React.FC<RadioButtonProps> = ({ selected, onPress, label }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 17,
        paddingVertical: 10,
        borderRadius: 16,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          marginRight: 8,
        }}
      >
        {selected ? (
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: colors.bodyText,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 6,
                borderWidth: 1.5,
              borderColor: colors.bodyText,
              }}
            />
          </View>
        ) : (
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: '#b5b5b5',
            }}
          />
        )}
      </View>
      <Text
        style={{
          fontFamily: 'Manrope-Medium',
          fontSize: 16,
          color: colors.bodyText,
          flex: 1,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default function AutoLockTimerScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<AutoLockOption>('Immediately');
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Handle phone back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isModalVisible) {
        setIsModalVisible(false);
        return true;
      }
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, [isModalVisible]);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings/security' as any);
    }
  };

  const handleOptionSelect = (option: AutoLockOption) => {
    setSelectedOption(option);
    setIsModalVisible(false);
    // TODO: Save auto-lock timer setting
  };

  // Bottom sheet animation
  const { height: screenHeight } = Dimensions.get('window');
  const sheetHeight = 400; // Approximate height for 6 options
  const translateY = useSharedValue(sheetHeight);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isModalVisible) {
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
      backdropOpacity.value = withTiming(1, { duration: 250 });
    } else {
      translateY.value = withTiming(sheetHeight, { duration: 250 });
      backdropOpacity.value = withTiming(0, { duration: 250 });
    }
  }, [isModalVisible, sheetHeight, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const closeSheet = () => {
    setIsModalVisible(false);
  };

  const startY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = startY.value + event.translationY;
      translateY.value = Math.max(0, Math.min(sheetHeight, next));
    })
    .onEnd((event) => {
      if (event.translationY > 80) {
        translateY.value = withTiming(
          sheetHeight,
          { duration: 250 },
          (finished) => {
            if (finished) {
              runOnJS(closeSheet)();
            }
          }
        );
        backdropOpacity.value = withTiming(0, { duration: 250 });
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 90,
        });
      }
    });

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
              fontSize: 20,
              lineHeight: 20,
              color: colors.titleText,
              flex: 1,
              textAlign: 'center',
            }}
          >
            Autolock Timer
          </Text>
        </View>
      </View>

      {/* Content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 18,
          paddingTop: 103,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'column',
            gap: 8,
            width: '100%',
            maxWidth: 400,
          }}
        >
          <Text
            style={{
              fontFamily: 'Manrope-Regular',
              fontSize: 16,
              color: colors.bodyText,
            }}
          >
            Auto-lock will engage after
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsModalVisible(true)}
            style={{
              height: 56,
              backgroundColor: colors.bgSemi,
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
                color: colors.mutedText,
                flex: 1,
              }}
            >
              {selectedOption}
            </Text>
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
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Sheet Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
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
            onPress={closeSheet}
          >
            <Animated.View
              style={[
                {
                  flex: 1,
                  backgroundColor: 'rgba(1,5,1,0.7)',
                },
                backdropStyle,
              ]}
            />
          </Pressable>

          {/* Bottom Sheet */}
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: '#1b1b1b',
                  borderTopLeftRadius: 40,
                  borderTopRightRadius: 40,
                  paddingTop: 31,
                  paddingBottom: (bottom || 24) + 24,
                  paddingHorizontal: 17,
                },
                sheetStyle,
              ]}
            >
              <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {AUTO_LOCK_OPTIONS.map((option) => (
                    <RadioButton
                      key={option}
                      selected={selectedOption === option}
                      onPress={() => handleOptionSelect(option)}
                      label={option}
                    />
                  ))}
                </View>
              </Pressable>
            </Animated.View>
          </GestureDetector>
        </View>
      </Modal>
    </View>
  );
}

