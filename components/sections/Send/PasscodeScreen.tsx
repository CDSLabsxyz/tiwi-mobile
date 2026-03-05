/**
 * Passcode Screen Component
 * Passcode input for transaction confirmation
 * Uses custom SecurityKeypad and PasscodeField to match Branding
 * Matches Figma design exactly (node-id: 3279-119940)
 */

import { PasscodeField } from "@/components/ui/security/PasscodeField";
import { SecurityKeypad } from "@/components/ui/security/SecurityKeypad";
import { colors } from "@/constants";
import { useTranslation } from "@/hooks/useLocalization";
import { useSecurityStore } from "@/store/securityStore";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PasscodeScreenProps {
  onSuccess: () => void;
}

type ValidationState = "idle" | "validating" | "valid" | "invalid";

export const PasscodeScreen: React.FC<PasscodeScreenProps> = ({ onSuccess }) => {
  const [passcode, setPasscode] = useState("");
  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const { verifyPasscode, isBiometricsEnabled } = useSecurityStore();
  const { t } = useTranslation();
  const { top, bottom } = useSafeAreaInsets();

  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const triggerShake = () => {
    shake.value = withTiming(-10, { duration: 50 }, () => {
      shake.value = withTiming(10, { duration: 50 }, () => {
        shake.value = withTiming(-10, { duration: 50 }, () => {
          shake.value = withTiming(10, { duration: 50 }, () => {
            shake.value = withTiming(0, { duration: 50 });
          });
        });
      });
    });
  };

  const handlePress = (digit: string) => {
    if (validationState === "validating" || validationState === "valid") return;

    if (passcode.length < 6) {
      const newPasscode = passcode + digit;
      setPasscode(newPasscode);

      if (newPasscode.length === 6) {
        handleVerify(newPasscode);
      }
    }
  };

  const handleDelete = () => {
    if (passcode.length > 0) {
      setPasscode(passcode.slice(0, -1));
      setValidationState("idle");
    }
  };

  const handleVerify = async (inputCode: string) => {
    setValidationState("validating");

    try {
      const isValid = await verifyPasscode(inputCode);

      if (isValid) {
        setValidationState("valid");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          onSuccess();
        }, 300);
      } else {
        setValidationState("invalid");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        triggerShake();

        // Reset passcode after showing error
        setTimeout(() => {
          setPasscode("");
          setValidationState("idle");
        }, 1200);
      }
    } catch (error) {
      console.error("Passcode validation error:", error);
      setValidationState("invalid");
      setTimeout(() => {
        setPasscode("");
        setValidationState("idle");
      }, 1200);
    }
  };

  const handleBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirm Transaction",
        fallbackLabel: "Use Passcode",
      });

      if (result.success) {
        setValidationState("valid");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess();
      }
    } catch (e) {
      console.log("Biometric error", e);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.innerContent, shakeStyle]}>
          {/* Title - Reverted to your preferred wording */}
          <Text style={styles.title}>Enter Passcode</Text>
          <Text style={styles.subtitle}>Enter your 6-digit passcode to confirm the transaction</Text>

          {/* Passcode Field */}
          <View style={styles.dotsContainer}>
            <PasscodeField
              length={6}
              passcode={passcode}
              isError={validationState === "invalid"}
            />
          </View>

          {validationState === "invalid" && (
            <Text style={styles.errorText}>{t('lock.incorrect')}</Text>
          )}
        </Animated.View>
      </View>

      {/* Security Keypad - Positioned at absolute bottom with minimal vertical padding */}
      <View style={[styles.keypadWrapper, { paddingBottom: bottom + 4 }]}>
        <SecurityKeypad
          onPress={handlePress}
          onDelete={handleDelete}
          onBiometric={isBiometricsEnabled ? handleBiometric : undefined}
          showBiometric={isBiometricsEnabled}
          biometricIcon={true}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  innerContent: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Manrope-Bold",
    fontSize: 24,
    color: colors.titleText,
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 16,
    color: colors.bodyText,
    textAlign: "center",
    marginBottom: 48,
    paddingHorizontal: 20,
  },
  dotsContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  errorText: {
    color: "#FF4D4D",
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    marginTop: 20,
    textAlign: "center",
  },
  keypadWrapper: {
    width: "100%",
  },
});
