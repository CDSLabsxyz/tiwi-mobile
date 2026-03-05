/**
 * Send Form Component
 * Form for entering recipient address and amount
 * Matches Figma design exactly (node-id: 3279-119800)
 */

import { colors } from "@/constants";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { transactionService } from "@/services/transactionService";
import { useSecurityStore } from "@/store/securityStore";
import { useSendStore } from "@/store/sendStore";
import { useToastStore } from "@/store/useToastStore";
import { validateAddress, validateAmount } from "@/utils/addressValidation";
import { isNativeToken } from "@/utils/wallet";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseUnits } from "viem";

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
  const { selectedToken, selectedChain, recipientAddress, amount, usdValue, setRecipientAddress, setAmount, openTokenSheet, setInsufficientBalance, isInsufficientBalance } = sendStore;

  const [localAddress, setLocalAddress] = useState(recipientAddress);
  const [localAmount, setLocalAmount] = useState(amount);
  const [pasted, setPasted] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const { top, bottom } = useSafeAreaInsets();

  // Whitelist state
  const [isWhitelistSheetVisible, setIsWhitelistSheetVisible] = useState(false);
  const [showSaveSuggestion, setShowSaveSuggestion] = useState(false);
  const [isSavingToWhitelist, setIsSavingToWhitelist] = useState(false);
  const [newAddressName, setNewAddressName] = useState("");

  const { data: balanceData } = useWalletBalances();
  const { setInsufficientGas } = sendStore;

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
    const rawValue = parseRawValue(localAmount);
    if (rawValue.trim()) {
      const result = validateAmount(rawValue);
      setAmountError(result.isValid ? null : result.error || null);
    } else {
      setAmountError(null);
    }
  }, [localAmount]);

  // Comma formatting utilities
  const formatWithCommas = (value: string) => {
    if (!value) return "";
    const parts = value.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  const parseRawValue = (value: string) => {
    return value.replace(/,/g, "");
  };

  const getCleanBalance = () => {
    if (!selectedToken) return 0;
    return parseFloat(selectedToken.balanceToken.split(" ")[0].replace(/,/g, "")) || 0;
  };

  // Real-time Gas Check (Pre-computation)
  useEffect(() => {
    const runGasCheck = async () => {
      const rawAmount = parseRawValue(localAmount);
      const chainIdNum = Number(selectedChain?.id);
      const recipient = localAddress.trim();

      // Only run if basic validation passes
      if (selectedToken && chainIdNum && recipient && parseFloat(rawAmount) > 0 && !addressError) {
        try {
          const { gasCostNative } = await transactionService.estimateGas({
            tokenAddress: selectedToken.address,
            symbol: selectedToken.symbol,
            decimals: selectedToken.decimals,
            recipientAddress: recipient,
            amount: rawAmount,
            chainId: chainIdNum,
            isNative: isNativeToken(selectedToken.address),
          });

          // cross-check with actual balance
          const nativeToken = balanceData?.tokens?.find(t =>
            t.chainId === chainIdNum &&
            (t.address === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
              t.address === "0x0000000000000000000000000000000000000000")
          );

          if (nativeToken) {
            const nativeBalance = BigInt(nativeToken.balance);
            const isNative = isNativeToken(selectedToken.address);
            const totalCost = isNative
              ? BigInt(parseUnits(rawAmount, selectedToken.decimals)) + gasCostNative
              : gasCostNative;

            setInsufficientGas(nativeBalance < totalCost);
          }
        } catch (e) {
          // If gas estimation fails, we don't block yet, but we'll re-estimate on review
          console.warn("Real-time gas check failed", e);
        }
      }
    };

    const timer = setTimeout(runGasCheck, 600); // debounce to avoid spamming
    return () => clearTimeout(timer);
  }, [localAmount, localAddress, selectedToken, balanceData, addressError]);

  // Sync insufficient balance flag to store
  useEffect(() => {
    const rawAmount = parseRawValue(localAmount) || "0";
    const balance = getCleanBalance();
    const isInsufficient = selectedToken ? parseFloat(rawAmount) > balance : false;
    setInsufficientBalance(isInsufficient);
  }, [localAmount, selectedToken]);

  const handlePercentagePress = (percent: number) => {
    if (!selectedToken) return;
    const balance = getCleanBalance();

    let targetAmount = 0;
    if (percent === 100) {
      // Smart Max Logic: Use 99.5% for native to leave gas room
      const isNative = selectedToken.address === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
        selectedToken.address === "0x0000000000000000000000000000000000000000" ||
        selectedToken.symbol === "BNB" || selectedToken.symbol === "ETH";

      targetAmount = isNative ? (balance * 0.995) : balance;
    } else {
      targetAmount = balance * (percent / 100);
    }

    const amountStr = targetAmount === 0 ? "" : targetAmount.toFixed(6).replace(/\.?0+$/, "");
    setLocalAmount(formatWithCommas(amountStr));
    sendStore.setAmount(amountStr);
  };

  // Re-map handleMaxPress for safety
  const handleMaxPress = () => handlePercentagePress(100);

  const handleAddressChange = (text: string) => {
    setLocalAddress(text);
    setRecipientAddress(text);
  };

  const handleAmountChange = (text: string) => {
    const raw = parseRawValue(text);
    // Only allow numbers and one decimal point
    if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
      setLocalAmount(formatWithCommas(raw));
      sendStore.setAmount(raw);
    }
  };

  const handlePasteAddress = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        handleAddressChange(text);
        setPasted(true);
        setTimeout(() => setPasted(false), 2000);
      }
    } catch (error) {
      console.error("Failed to paste address:", error);
    }
  };

  const { showToast } = useToastStore();

  const handleSaveToWhitelist = () => {
    if (localAddress && newAddressName.trim()) {
      addWhitelistedAddress(localAddress, newAddressName.trim());
      setIsSavingToWhitelist(false);
      setNewAddressName("");
      setShowSaveSuggestion(false);
      showToast("Address saved to book!", "success");
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
                onPress={handlePasteAddress}
                style={{
                  width: 24,
                  height: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {pasted ? (
                  <Image
                    source={CheckmarkIcon}
                    style={{ width: 20, height: 20 }}
                    contentFit="contain"
                  />
                ) : (
                  <Ionicons
                    name="clipboard-outline"
                    size={22}
                    color={colors.titleText}
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
              borderWidth: (amountError || isInsufficientBalance) ? 1 : 0,
              borderColor: (amountError || isInsufficientBalance) ? "#EF4444" : "transparent",
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

          {/* Percentage Presets Row */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 4,
            width: '100%',
            gap: 12
          }}>
            {[25, 50, 75, 100].map((pct) => (
              <TouchableOpacity
                key={pct}
                onPress={() => handlePercentagePress(pct)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  height: 38,
                  backgroundColor: colors.bgSemi,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.05)'
                }}
              >
                <Text style={{
                  fontFamily: 'Manrope-SemiBold',
                  fontSize: 13,
                  color: colors.titleText
                }}>
                  {pct === 100 ? 'Max' : `${pct}%`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {(amountError || isInsufficientBalance) && (
            <Text
              style={{
                fontFamily: "Manrope-Regular",
                fontSize: 10,
                lineHeight: 14,
                color: "#EF4444",
                paddingLeft: 17,
                marginTop: 4
              }}
            >
              {isInsufficientBalance ? "Insufficient balance" : amountError}
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
