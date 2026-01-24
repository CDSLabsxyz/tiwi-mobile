/**
 * Passcode Screen Component
 * Passcode input for transaction confirmation
 * Uses native numeric keyboard (industry standard)
 * Matches Figma design exactly (node-id: 3279-119940)
 */

import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Keyboard } from "react-native";
import { colors } from "@/constants";

interface PasscodeScreenProps {
  onSuccess: () => void;
}

type ValidationState = "idle" | "validating" | "valid" | "invalid";

export const PasscodeScreen: React.FC<PasscodeScreenProps> = ({ onSuccess }) => {
  const [passcode, setPasscode] = useState<string[]>(Array(6).fill(""));
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => {
    // Small delay to ensure component is mounted
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  }, []);

  // Handle passcode completion and validation
  useEffect(() => {
    const isComplete = passcode.every((digit) => digit !== "") && passcode.length === 6;
    if (isComplete && validationState === "idle") {
      // Validate passcode with backend
      Keyboard.dismiss();
      const fullPasscode = passcode.join("");
      
      setValidationState("validating");
      
      // Backend validation (mock for now)
      const validatePasscode = async (code: string) => {
        try {
          // TODO: Replace with actual backend API call
          // const response = await fetch('/api/validate-passcode', {
          //   method: 'POST',
          //   body: JSON.stringify({ passcode: code }),
          // });
          // const result = await response.json();
          
          // Mock validation - in production, use actual backend
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Mock: accept "123456" as valid, reject others
          const isValid = code === "123456";
          
          if (isValid) {
            setValidationState("valid");
            // Initiate transaction via wallet provider
            // TODO: await walletProvider.initiateTransaction(transactionData)
            setTimeout(() => {
              onSuccess();
            }, 500);
          } else {
            setValidationState("invalid");
            // Reset passcode after showing error
            setTimeout(() => {
              setPasscode(Array(6).fill(""));
              setFocusedIndex(0);
              setValidationState("idle");
              inputRefs.current[0]?.focus();
            }, 2000);
          }
        } catch (error) {
          console.error("Passcode validation error:", error);
          setValidationState("invalid");
          setTimeout(() => {
            setPasscode(Array(6).fill(""));
            setFocusedIndex(0);
            setValidationState("idle");
            inputRefs.current[0]?.focus();
          }, 2000);
        }
      };
      
      validatePasscode(fullPasscode);
    }
  }, [passcode, validationState, onSuccess]);

  const handleTextChange = (text: string, index: number) => {
    // Only allow single digit
    if (text.length > 1) {
      text = text.slice(-1);
    }
    
    // Only allow numbers (0-9)
    if (text && !/^[0-9]$/.test(text)) {
      return;
    }

    const newPasscode = [...passcode];
    newPasscode[index] = text;
    setPasscode(newPasscode);

    // Auto-advance to next input if digit entered
    if (text && index < 5) {
      setFocusedIndex(index + 1);
      // Small delay to ensure smooth transition
      setTimeout(() => {
        inputRefs.current[index + 1]?.focus();
      }, 50);
    } else if (text && index === 5) {
      // Last digit entered, dismiss keyboard
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace - move to previous input if current is empty
    if (e.nativeEvent.key === "Backspace") {
      if (!passcode[index] && index > 0) {
        // Clear previous input and move focus
        const newPasscode = [...passcode];
        newPasscode[index - 1] = "";
        setPasscode(newPasscode);
        setFocusedIndex(index - 1);
        setTimeout(() => {
          inputRefs.current[index - 1]?.focus();
        }, 50);
      } else if (passcode[index]) {
        // Clear current input
        const newPasscode = [...passcode];
        newPasscode[index] = "";
        setPasscode(newPasscode);
      }
    }
  };

  const handleBoxPress = (index: number) => {
    setFocusedIndex(index);
    inputRefs.current[index]?.focus();
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    // Keep focus if passcode is incomplete
    if (!passcode.every((digit) => digit !== "")) {
      // Don't blur if there are empty inputs
    }
  };

  return (
    <View
      style={{
        width: "100%",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 40,
        paddingBottom: 20,
      }}
    >
      {/* Title */}
      <Text
        style={{
          fontFamily: "Manrope-SemiBold",
          fontSize: 20,
          lineHeight: 28,
          color: colors.titleText,
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        Enter Passcode
      </Text>

      {/* Passcode Input Boxes */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 14.5,
          marginBottom: 24,
        }}
      >
        {Array.from({ length: 6 }).map((_, index) => {
          // Determine border color based on validation state
          let borderColor: string = colors.bodyText;
          if (validationState === "valid") {
            borderColor = "#10B981"; // Green
          } else if (validationState === "invalid") {
            borderColor = "#EF4444"; // Red
          } else if (focusedIndex === index) {
            borderColor = colors.primaryCTA;
          }
          
          return (
          <TouchableOpacity
            key={index}
            activeOpacity={0.8}
            onPress={() => handleBoxPress(index)}
            style={{
              width: 50,
              height: 50,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: borderColor as any,
              backgroundColor: colors.bgSemi,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Hidden TextInput for keyboard - uses native numeric keyboard */}
            <TextInput
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              value={passcode[index]}
              onChangeText={(text) => handleTextChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              onFocus={() => handleFocus(index)}
              onBlur={handleBlur}
              keyboardType="number-pad"
              maxLength={1}
              returnKeyType="next"
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                opacity: 0,
              }}
              autoFocus={index === 0}
              secureTextEntry={false}
            />
            
            {/* Visual indicator (dot) - shows when digit is entered */}
            {passcode[index] ? (
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: colors.titleText,
                }}
              />
            ) : null}
          </TouchableOpacity>
          );
        })}
      </View>

      {/* Helper Text */}
      <Text
        style={{
          fontFamily: "Manrope-Regular",
          fontSize: 14,
          lineHeight: 20,
          color: colors.bodyText,
          textAlign: "center",
          paddingHorizontal: 40,
        }}
      >
        Enter your 6-digit passcode to confirm the transaction
      </Text>
    </View>
  );
};
