import React, { useEffect } from "react";
import { Modal, Pressable, View, Text, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { colors } from "@/theme";
import { Image } from "@/tw";

const SearchIcon = require("@/assets/swap/search-01.svg");

interface SelectionBottomSheetProps {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  showSearchIcon?: boolean;
  height?: number; // defaults to Figma 694px
}

/**
 * Reusable bottom sheet used for chain & token selection
 * Matches Figma dropdown menu container (rounded 40px, 694px height)
 */
export const SelectionBottomSheet: React.FC<SelectionBottomSheetProps> = ({
  visible,
  title,
  children,
  onClose,
  showSearchIcon = true,
  height,
}) => {
  const { height: screenHeight, width: screenWidth } = Dimensions.get("window");
  // Figma proportions: sheet height 694 on 852px screen => ~81.5%
  const SHEET_HEIGHT_RATIO = 694 / 852;
  const baseHeight = height ?? 694;
  const sheetHeight = Math.min(baseHeight, screenHeight * SHEET_HEIGHT_RATIO);

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
      // Clamp between fully open (0) and fully closed (sheetHeight)
      translateY.value = Math.max(0, Math.min(sheetHeight, next));
    })
    .onEnd((event) => {
      // If user dragged down enough, close the sheet
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
        // Snap back to open state
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
        {/* Backdrop (semi-transparent, with room for blur in future) */}
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          onPress={onClose}
        >
          <Animated.View
            style={[
              {
                flex: 1,
                backgroundColor: "rgba(1,5,1,0.7)",
              },
              backdropStyle,
            ]}
          />
        </Pressable>

        {/* Bottom sheet with drag-to-close */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: sheetHeight,
                borderTopLeftRadius: 40,
                borderTopRightRadius: 40,
                backgroundColor: "#1B1B1B",
                overflow: "hidden",
                alignItems: "center",
              },
              sheetStyle,
            ]}
          >
            {/* Handle bar */}
            <View
              style={{
                marginTop: 16,
                marginBottom: 16,
                alignItems: "center",
                width: "100%",
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 4,
                  borderRadius: 100,
                  backgroundColor: colors.bodyText,
                }}
              />
            </View>

            {/* Header */}
            <View
              style={{
                width: Math.min(393, screenWidth),
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 24,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontFamily: "Manrope-SemiBold",
                  fontSize: 16,
                  color: colors.titleText,
                  textTransform: "capitalize",
                }}
              >
                {title}
              </Text>
              {showSearchIcon && (
                <View
                  style={{
                    position: "absolute",
                    right: 24,
                    width: 24,
                    height: 24,
                  }}
                >
                  <Image
                    source={SearchIcon}
                    className="w-full h-full"
                    contentFit="contain"
                  />
                </View>
              )}
            </View>

            {/* Content */}
            <View
              style={{
                flex: 1,
                width: 353,
                alignSelf: "center",
              }}
            >
              {children}
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
};


