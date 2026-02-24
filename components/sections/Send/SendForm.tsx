/**
 * Send Form Component
 * Form for entering recipient address and amount
 * Matches Figma design exactly (node-id: 3279-119800)
 */

import { colors } from "@/constants";
import { useSecurityStore } from "@/store/securityStore";
import { useSendStore } from "@/store/sendStore";
import { validateAddress, validateAmount } from "@/utils/addressValidation";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SendTokenSelector } from "./SendTokenSelector";
import { WhitelistSelectSheet } from "./WhitelistSelectSheet";

const CopyIcon = require("@/assets/wallet/copy-01.svg");
const CheckmarkIcon = require("@/assets/swap/checkmark-circle-01.svg");
const WalletIcon = require("@/assets/wallet/wallet-01.svg");
const AddressBookIcon = require("@/assets/settings/address-book.svg");
const PlusIcon = require("@/assets/settings/add-square.svg");

interface SendFormProps {
  onNext: () => void;
}

export const SendForm: React.FC<SendFormProps> = ({ onNext }) => {
  const sendStore = useSendStore();
  const { isStrictModeEnabled, whitelistedAddresses, addWhitelistedAddress } = useSecurityStore();
  const { selectedToken, selectedChain, recipientAddress, amount, usdValue, setRecipientAddress, setAmount, openTokenSheet } = sendStore;

  const [localAddress, setLocalAddress] = useState(recipientAddress);
  const [localAmount, setLocalAmount] = useState(amount);
  const [copied, setCopied] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const { top, bottom } = useSafeAreaInsets();

  // Whitelist state
  const [isWhitelistSheetVisible, setIsWhitelistSheetVisible] = useState(false);
  const [showSaveSuggestion, setShowSaveSuggestion] = useState(false);
  const [isSavingToWhitelist, setIsSavingToWhitelist] = useState(false);
  const [newAddressName, setNewAddressName] = useState("");

  // Validate address when it changes
  useEffect(() => {
    if (localAddress.trim()) {
      const chainIdStr = selectedChain?.id ? String(selectedChain.id) : undefined;
      const result = validateAddress(localAddress, chainIdStr);

      // Strict Mode Check
      if (result.isValid && isStrictModeEnabled) {
        const isWhitelisted = whitelistedAddresses.some(
          (a) => a.address.toLowerCase() === localAddress.toLowerCase()
        );
        if (!isWhitelisted) {
          setAddressError("Strict Mode: Recipient not in Whitelist");
          setShowSaveSuggestion(false);
          return;
        }
      }

      setAddressError(result.isValid ? null : result.error || null);

      // Check for whitelist suggestion
      if (result.isValid) {
        const isWhitelisted = whitelistedAddresses.some(
          (a) => a.address.toLowerCase() === localAddress.toLowerCase()
        );
        setShowSaveSuggestion(!isWhitelisted);
      } else {
        setShowSaveSuggestion(false);
      }
    } else {
      setAddressError(null);
      setShowSaveSuggestion(false);
    }
  }, [localAddress, selectedChain?.id, isStrictModeEnabled, whitelistedAddresses]);

  // Validate amount when it changes
  useEffect(() => {
    if (localAmount.trim()) {
      const result = validateAmount(localAmount);
      setAmountError(result.isValid ? null : result.error || null);
    } else {
      setAmountError(null);
    }
  }, [localAmount]);

  const handleMaxPress = () => {
    if (selectedToken) {
      const balance = parseFloat(selectedToken.balanceToken.split(" ")[0].replace(/,/g, "")) || 0;
      const maxAmount = balance * 0.9995; // 99.95% to leave gas
      const maxAmountStr = maxAmount.toFixed(8);
      setLocalAmount(maxAmountStr);
      sendStore.setAmount(maxAmountStr);
    }
  };

  const handleAddressChange = (text: string) => {
    setLocalAddress(text);
    setRecipientAddress(text);
  };

  const handleAmountChange = (text: string) => {
    // Only allow numbers and one decimal point
    if (text === "" || /^\d*\.?\d*$/.test(text)) {
      setLocalAmount(text);
      sendStore.setAmount(text);
    }
  };

  const handleCopyAddress = async () => {
    if (localAddress.trim()) {
      await Clipboard.setStringAsync(localAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveToWhitelist = () => {
    if (localAddress && newAddressName.trim()) {
      addWhitelistedAddress(localAddress, newAddressName.trim());
      setIsSavingToWhitelist(false);
      setNewAddressName("");
      setShowSaveSuggestion(false);
    }
  };

  const handleSelectFromWhitelist = (address: string) => {
    handleAddressChange(address);
    setIsWhitelistSheetVisible(false);
  };

  return (
    <View
      style={{
        width: "100%",
        flexDirection: "column",
        gap: 18,
        paddingTop: 0,
      }}
    >
      {/* Token Display - Reuse SendTokenSelector */}
      {selectedToken && (
        <View
          style={{
            width: "100%",
            alignItems: "flex-end",
          }}
        >
          <SendTokenSelector onTokenPress={openTokenSheet} />
        </View>
      )}

      {/* Recipient Address */}
      <View
        style={{
          flexDirection: "column",
          gap: 4,
        }}
      >
        <View
          style={{
            backgroundColor: colors.bgSemi,
            borderRadius: 16,
            paddingHorizontal: 17,
            paddingVertical: 10,
            borderWidth: addressError ? 1 : 0,
            borderColor: addressError ? "#EF4444" : "transparent",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 3,
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: "column",
                gap: 3,
                minWidth: 0,
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope-Regular",
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.bodyText,
                }}
              >
                To
              </Text>
              <TextInput
                placeholder="0x061974h639u9j5803T432"
                placeholderTextColor={colors.bodyText}
                value={localAddress}
                onChangeText={handleAddressChange}
                style={{
                  fontFamily: "Manrope-Medium",
                  fontSize: 16,
                  lineHeight: 24,
                  color: localAddress ? colors.titleText : colors.bodyText,
                  flex: 1,
                  padding: 0,
                  margin: 0,
                  minHeight: 24,
                }}
                multiline={false}
              />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsWhitelistSheetVisible(true)}
                style={{
                  width: 24,
                  height: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.bgSemi,
                  borderRadius: 12,
                }}
              >
                <Image
                  source={AddressBookIcon}
                  style={{ width: 22, height: 22 }}
                  contentFit="contain"
                />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleCopyAddress}
                style={{
                  width: 24,
                  height: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {copied ? (
                  <Image
                    source={CheckmarkIcon}
                    style={{ width: 20, height: 20 }}
                    contentFit="contain"
                  />
                ) : (
                  <Image
                    source={CopyIcon}
                    style={{ width: 20, height: 20 }}
                    contentFit="contain"
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Save Suggestion UI */}
        {showSaveSuggestion && !isSavingToWhitelist && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsSavingToWhitelist(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingLeft: 17,
              marginTop: 4,
            }}
          >
            <Image source={PlusIcon} style={{ width: 14, height: 14 }} contentFit="contain" />
            <Text
              style={{
                fontFamily: "Manrope-Medium",
                fontSize: 12,
                color: colors.primaryCTA,
              }}
            >
              Save to Address Book?
            </Text>
          </TouchableOpacity>
        )}

        {isSavingToWhitelist && (
          <View
            style={{
              backgroundColor: colors.bgSemi,
              borderRadius: 12,
              padding: 12,
              marginTop: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <TextInput
              autoFocus
              placeholder="Name (e.g. Mom's Wallet)"
              placeholderTextColor={colors.bodyText}
              value={newAddressName}
              onChangeText={setNewAddressName}
              style={{
                flex: 1,
                fontFamily: "Manrope-Medium",
                fontSize: 14,
                color: colors.titleText,
                padding: 0,
              }}
            />
            <TouchableOpacity
              onPress={() => setIsSavingToWhitelist(false)}
              style={{ paddingHorizontal: 8 }}
            >
              <Text style={{ fontFamily: "Manrope-Medium", fontSize: 12, color: colors.bodyText }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveToWhitelist}
              disabled={!newAddressName.trim()}
              style={{
                backgroundColor: newAddressName.trim() ? colors.primaryCTA : colors.bgCards,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 12, color: newAddressName.trim() ? colors.bg : colors.bodyText }}>Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {addressError && (
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 10,
              lineHeight: 14,
              color: "#EF4444",
              paddingLeft: 17,
              marginTop: 4,
            }}
          >
            {addressError}
          </Text>
        )}
      </View>

      {/* Amount Input */}
      <View
        style={{
          flexDirection: "column",
          gap: 8,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              lineHeight: 18,
              color: colors.bodyText,
            }}
          >
            Enter Amount
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              flexShrink: 0,
            }}
          >
            <View style={{ width: 14, height: 14 }}>
              <Image source={WalletIcon} style={{ width: "100%", height: "100%" }} contentFit="contain" />
            </View>
            <Text
              style={{
                fontFamily: "Manrope-Medium",
                fontSize: 12,
                lineHeight: 18,
                color: colors.bodyText,
              }}
            >
              {selectedToken?.balanceToken.split(" ")[0] || "0"}
            </Text>
            <TouchableOpacity activeOpacity={0.8} onPress={handleMaxPress}>
              <Text
                style={{
                  fontFamily: "Manrope-SemiBold",
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.primaryCTA,
                }}
              >
                Max
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View
          style={{
            flexDirection: "column",
            gap: 4,
          }}
        >
          <View
            style={{
              backgroundColor: colors.bgSemi,
              borderRadius: 16,
              height: 88,
              paddingHorizontal: 17,
              paddingVertical: 10,
              justifyContent: "center",
              borderWidth: amountError ? 1 : 0,
              borderColor: amountError ? "#EF4444" : "transparent",
            }}
          >
            <View
              style={{
                flexDirection: "column",
                gap: 3,
              }}
            >
              <TextInput
                placeholder="0.00"
                placeholderTextColor={colors.titleText}
                value={localAmount}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                style={{
                  fontFamily: "Manrope-Medium",
                  fontSize: 24,
                  lineHeight: 32,
                  color: colors.titleText,
                  padding: 0,
                  margin: 0,
                  minHeight: 32,
                }}
              />
              <Text
                style={{
                  fontFamily: "Manrope-Regular",
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.bodyText,
                }}
              >
                {usdValue}
              </Text>
            </View>
          </View>
          {amountError && (
            <Text
              style={{
                fontFamily: "Manrope-Regular",
                fontSize: 10,
                lineHeight: 14,
                color: "#EF4444",
                paddingLeft: 17,
              }}
            >
              {amountError}
            </Text>
          )}
        </View>
      </View>

      <WhitelistSelectSheet
        visible={isWhitelistSheetVisible}
        onClose={() => setIsWhitelistSheetVisible(false)}
        onSelect={handleSelectFromWhitelist}
        selectedAddress={localAddress}
      />
    </View>
  );
};
