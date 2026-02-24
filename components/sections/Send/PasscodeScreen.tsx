/**
 * Passcode Screen Component
 * Passcode input for transaction confirmation
 * Uses custom SecurityKeypad and PasscodeField to match Branding
 * Matches Figma design exactly (node-id: 3279-119940)
 */

import { PasscodeField } from "@/components/ui/security/PasscodeField";
import { SecurityKeypad } from "@/components/ui/security/SecurityKeypad";
import { colors } from "@/constants";
import { useSecurityStore } from "@/store/securityStore";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

interface PasscodeScreenProps {
  onSuccess: () => void;
}

type ValidationState = "idle" | "validating" | "valid" | "invalid";

export const PasscodeScreen: React.FC<PasscodeScreenProps> = ({ onSuccess }) => {
  const [passcode, setPasscode] = useState("");
  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const { verifyPasscode, isBiometricsEnabled } = useSecurityStore();

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
    <View style={styles.container}>
      <Animated.View style={[styles.content, shakeStyle]}>
        {/* Title */}
        <Text style={styles.title}>Enter Passcode</Text>

        {/* Passcode Field */}
        <View style={styles.dotsContainer}>
          <PasscodeField
            length={6}
            passcode={passcode}
            isError={validationState === "invalid"}
          />
        </View>

        {validationState === "invalid" ? (
          <Text style={styles.errorText}>Incorrect passcode</Text>
        ) : (
          <Text style={styles.helperText}>
            Enter your 6-digit passcode to confirm the transaction
          </Text>
        )}
      </Animated.View>

      {/* Security Keypad */}
      <View style={styles.keypadWrapper}>
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
    width: "100%",
    minHeight: 500,
    flexDirection: "column",
    alignItems: "center",
  },
  content: {
    width: "100%",
    alignItems: "center",
    paddingTop: 20,
    marginBottom: 40,
  },
  title: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 20,
    lineHeight: 28,
    color: colors.titleText,
    textAlign: "center",
    marginBottom: 32,
  },
  dotsContainer: {
    marginBottom: 24,
  },
  errorText: {
    color: "#EF4444",
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    marginBottom: 16,
  },
  helperText: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.bodyText,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  keypadWrapper: {
    width: "100%",
  },
});
