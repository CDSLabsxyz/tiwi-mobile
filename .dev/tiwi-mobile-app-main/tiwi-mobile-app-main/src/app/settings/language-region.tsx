/**
 * Language & Region Settings Screen
 * Language and region settings page matching Figma design exactly (node-id: 3279-121043)
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

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const ArrowDownIcon = require('@/assets/home/arrow-down-01.svg');

type Language = 'English' | 'French' | 'Spanish' | 'Chinese' | 'Arabic' | 'Portuguese';
type Currency = 'USD' | 'EUR' | 'NGN' | 'GBP' | 'CNY' | 'JPY';
type RegionalFormat = 'MM/DD/YY' | 'DD/MM/YY' | 'YYYY-MM-DD';

const LANGUAGES: Language[] = ['English', 'French', 'Spanish', 'Chinese', 'Arabic', 'Portuguese'];
const CURRENCIES: Currency[] = ['USD', 'EUR', 'NGN', 'GBP', 'CNY', 'JPY'];
const REGIONAL_FORMATS: RegionalFormat[] = ['MM/DD/YY', 'DD/MM/YY', 'YYYY-MM-DD'];

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
          alignItems: 'center',
          justifyContent: 'center',
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
                borderRadius: 5,
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

// Bottom Sheet Component
interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  selectedOption: string;
  onSelect: (option: string) => void;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  options,
  selectedOption,
  onSelect,
}) => {
  const { bottom } = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  const sheetHeight = Math.min(options.length * 60 + 62, screenHeight * 0.6);
  const translateY = useSharedValue(sheetHeight);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
      backdropOpacity.value = withTiming(1, { duration: 250 });
    } else {
      translateY.value = withTiming(sheetHeight, { duration: 250 });
      backdropOpacity.value = withTiming(0, { duration: 250 });
    }
  }, [visible, sheetHeight, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const closeSheet = () => {
    onClose();
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

  const handleSelect = (option: string) => {
    onSelect(option);
    closeSheet();
  };

  return (
    <Modal
      visible={visible}
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
                maxHeight: '80%',
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
                {options.map((option) => (
                  <RadioButton
                    key={option}
                    selected={selectedOption === option}
                    onPress={() => handleSelect(option)}
                    label={option}
                  />
                ))}
              </View>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
};

export default function LanguageRegionScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('English');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('USD');
  const [selectedFormat, setSelectedFormat] = useState<RegionalFormat>('MM/DD/YY');
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [isCurrencyModalVisible, setIsCurrencyModalVisible] = useState(false);
  const [isFormatModalVisible, setIsFormatModalVisible] = useState(false);

  // Handle phone back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isLanguageModalVisible) {
        setIsLanguageModalVisible(false);
        return true;
      }
      if (isCurrencyModalVisible) {
        setIsCurrencyModalVisible(false);
        return true;
      }
      if (isFormatModalVisible) {
        setIsFormatModalVisible(false);
        return true;
      }
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, [isLanguageModalVisible, isCurrencyModalVisible, isFormatModalVisible]);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings' as any);
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
            Language & Region
          </Text>
        </View>
      </View>

      {/* Content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 88,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 358,
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Application Language */}
          <View
            style={{
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 16,
                color: colors.bodyText,
              }}
            >
              Application Language
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsLanguageModalVisible(true)}
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
                {selectedLanguage}
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

          {/* Currency Display */}
          <View
            style={{
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 16,
                color: colors.bodyText,
              }}
            >
              Currency Display
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsCurrencyModalVisible(true)}
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
                {selectedCurrency}
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

          {/* Regional Format */}
          <View
            style={{
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 16,
                color: colors.bodyText,
              }}
            >
              Regional Format
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsFormatModalVisible(true)}
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
                {selectedFormat}
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
      </View>

      {/* Language Bottom Sheet */}
      <BottomSheet
        visible={isLanguageModalVisible}
        onClose={() => setIsLanguageModalVisible(false)}
        title="Language"
        options={LANGUAGES}
        selectedOption={selectedLanguage}
        onSelect={(option) => setSelectedLanguage(option as Language)}
      />

      {/* Currency Bottom Sheet */}
      <BottomSheet
        visible={isCurrencyModalVisible}
        onClose={() => setIsCurrencyModalVisible(false)}
        title="Currency"
        options={CURRENCIES}
        selectedOption={selectedCurrency}
        onSelect={(option) => setSelectedCurrency(option as Currency)}
      />

      {/* Regional Format Bottom Sheet */}
      <BottomSheet
        visible={isFormatModalVisible}
        onClose={() => setIsFormatModalVisible(false)}
        title="Regional Format"
        options={REGIONAL_FORMATS}
        selectedOption={selectedFormat}
        onSelect={(option) => setSelectedFormat(option as RegionalFormat)}
      />
    </View>
  );
}

