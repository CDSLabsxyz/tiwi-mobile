/**
 * Filter Modal Component
 * Bottom sheet modal for filtering assets
 * Matches Figma design exactly (node-id: 3279-120621)
 */

import React, { useEffect } from "react";
import { Modal, Pressable, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme";
import { useFilterStore, type SortOption, type TokenCategory, type ChainFilter } from "@/store/filterStore";

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Filter Checkbox Component
 */
interface FilterCheckboxProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

const FilterCheckbox: React.FC<FilterCheckboxProps> = ({ label, checked, onToggle }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onToggle}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Checkbox - Rectangular with rounded corners (6px) */}
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 6, // Rectangular with 6px rounded corners (not circular)
          borderWidth: 0.5,
          borderColor: checked ? colors.primaryCTA : "#7C7C7C",
          backgroundColor: checked ? colors.primaryCTA : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && (
          <Svg
            width={12}
            height={12}
            viewBox="0 0 12 12"
            fill="none"
          >
            <Path
              d="M10 3L4.5 8.5L2 6"
              stroke={colors.bg}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </View>

      {/* Label */}
      <Text
        style={{
          fontFamily: "Manrope-Regular",
          fontSize: 12,
          lineHeight: 18,
          color: colors.titleText,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * Radio Button Component for Sort By
 */
interface RadioButtonProps {
  label: string;
  checked: boolean;
  onPress: () => void;
}

const RadioButton: React.FC<RadioButtonProps> = ({ label, checked, onPress }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Radio Button - Rectangular with rounded corners (squarish) */}
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 6, // Rectangular with 6px rounded corners (squarish, not circular)
          borderWidth: 0.5,
          borderColor: checked ? colors.primaryCTA : "#7C7C7C",
          backgroundColor: checked ? colors.primaryCTA : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2, // Small square indicator inside (slightly rounded)
              backgroundColor: colors.bg,
            }}
          />
        )}
      </View>

      {/* Label */}
      <Text
        style={{
          fontFamily: "Manrope-Regular",
          fontSize: 12,
          lineHeight: 18,
          color: colors.titleText,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * Filter Modal - Bottom sheet for asset filtering
 */
export const FilterModal: React.FC<FilterModalProps> = ({ visible, onClose }) => {
  const { bottom } = useSafeAreaInsets();
  
  // Subscribe to filter store values to ensure reactivity
  const sortBy = useFilterStore((state) => state.sortBy);
  const tokenCategories = useFilterStore((state) => state.tokenCategories);
  const chains = useFilterStore((state) => state.chains);
  const setSortBy = useFilterStore((state) => state.setSortBy);
  const toggleTokenCategory = useFilterStore((state) => state.toggleTokenCategory);
  const toggleChain = useFilterStore((state) => state.toggleChain);
  const resetFilters = useFilterStore((state) => state.resetFilters);

  const translateY = useSharedValue(400);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
      backdropOpacity.value = withTiming(1, { duration: 250 });
    } else {
      translateY.value = withTiming(400, { duration: 250 });
      backdropOpacity.value = withTiming(0, { duration: 250 });
    }
  }, [visible, translateY, backdropOpacity]);

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
    .onStart((event) => {
      startY.value = event.translationY;
    })
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100) {
        translateY.value = withTiming(400, { duration: 250 });
        backdropOpacity.value = withTiming(0, { duration: 250 });
        runOnJS(closeSheet)();
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 90,
        });
      }
    });

  const handleSortByChange = (sort: SortOption) => {
    setSortBy(sort);
  };

  const handleResetFilters = () => {
    resetFilters();
  };

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

        {/* Bottom Sheet */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              {
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: "#1B1B1B",
                borderTopLeftRadius: 40,
                borderTopRightRadius: 40,
                paddingTop: 32,
                paddingBottom: (bottom || 24) + 24,
                paddingHorizontal: 20,
                maxHeight: "85%",
              },
              sheetStyle,
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingBottom: 24,
                }}
              >
                {/* Sort By Section */}
                <View
                  style={{
                    flexDirection: "column",
                    gap: 12,
                    marginBottom: 18,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      fontSize: 16,
                      lineHeight: 24,
                      color: colors.titleText,
                    }}
                  >
                    Sort By
                  </Text>

                  <RadioButton
                    label="Highest Value → Lowest"
                    checked={sortBy === "highest-value"}
                    onPress={() => handleSortByChange("highest-value")}
                  />

                  <RadioButton
                    label="Recent Activity"
                    checked={sortBy === "recent-activity"}
                    onPress={() => handleSortByChange("recent-activity")}
                  />
                </View>

                {/* Token Category Section */}
                <View
                  style={{
                    flexDirection: "column",
                    gap: 18,
                    marginBottom: 18,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      fontSize: 16,
                      lineHeight: 24,
                      color: colors.titleText,
                    }}
                  >
                    Token Category
                  </Text>

                  {/* Two Column Layout */}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 91,
                      alignItems: "flex-start",
                    }}
                  >
                    {/* Left Column */}
                    <View
                      style={{
                        flexDirection: "column",
                        gap: 12,
                        width: 126,
                      }}
                    >
                      <FilterCheckbox
                        label="DeFi Tokens"
                        checked={tokenCategories.has("defi")}
                        onToggle={() => toggleTokenCategory("defi")}
                      />
                      <FilterCheckbox
                        label="Meme Coins"
                        checked={tokenCategories.has("meme")}
                        onToggle={() => toggleTokenCategory("meme")}
                      />
                    </View>

                    {/* Right Column */}
                    <View
                      style={{
                        flexDirection: "column",
                        gap: 12,
                        width: 129,
                      }}
                    >
                      <FilterCheckbox
                        label="Gaming"
                        checked={tokenCategories.has("gaming")}
                        onToggle={() => toggleTokenCategory("gaming")}
                      />
                      <FilterCheckbox
                        label="New Listings"
                        checked={tokenCategories.has("new-listings")}
                        onToggle={() => toggleTokenCategory("new-listings")}
                      />
                    </View>
                  </View>
                </View>

                {/* Chain Section */}
                <View
                  style={{
                    flexDirection: "column",
                    gap: 12,
                    marginBottom: 24,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      fontSize: 16,
                      lineHeight: 24,
                      color: colors.titleText,
                    }}
                  >
                    Chain
                  </Text>

                  {/* Two Column Layout */}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 91,
                      alignItems: "flex-start",
                    }}
                  >
                    {/* Left Column */}
                    <View
                      style={{
                        flexDirection: "column",
                        gap: 12,
                        width: 126,
                      }}
                    >
                      <FilterCheckbox
                        label="BSC"
                        checked={chains.has("bsc")}
                        onToggle={() => toggleChain("bsc")}
                      />
                      <FilterCheckbox
                        label="Ethereum"
                        checked={chains.has("ethereum")}
                        onToggle={() => toggleChain("ethereum")}
                      />
                    </View>

                    {/* Right Column */}
                    <View
                      style={{
                        flexDirection: "column",
                        gap: 12,
                        width: 129,
                      }}
                    >
                      <FilterCheckbox
                        label="Polygon"
                        checked={chains.has("polygon")}
                        onToggle={() => toggleChain("polygon")}
                      />
                      <FilterCheckbox
                        label="Solana"
                        checked={chains.has("solana")}
                        onToggle={() => toggleChain("solana")}
                      />
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Reset Filters Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleResetFilters}
                style={{
                  backgroundColor: colors.primaryCTA,
                  borderRadius: 100,
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 24,
                  width: 353,
                  alignSelf: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 16,
                    lineHeight: 25.6,
                    color: "#050201",
                  }}
                >
                  Reset filters
                </Text>
              </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
};

