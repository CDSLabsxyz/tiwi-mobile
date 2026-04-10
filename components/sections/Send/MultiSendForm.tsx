/**
 * Multi-Send Form Component
 * Form for entering multiple recipient addresses and amount per recipient
 * Matches Figma design (node-id: 3279-119061)
 */

import { colors } from "@/constants";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { transactionService } from "@/services/transactionService";
import { useSendStore } from "@/store/sendStore";
import { useToastStore } from "@/store/useToastStore";
import { validateAddresses, validateAmount } from "@/utils/addressValidation";
import { isValidCSVFile, parseCSVAddresses } from "@/utils/csvParser";
import { isNativeToken } from "@/utils/wallet";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { Alert, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import { parseUnits } from "viem";
import { SendTokenSelector } from "./SendTokenSelector";
import { WhitelistSelectSheet } from "./WhitelistSelectSheet";
import { SwapKeyboard } from "@/components/sections/Swap";

const AttachmentIcon = require("@/assets/wallet/attachment-square.svg");
const WalletIcon = require("@/assets/wallet/wallet-01.svg");
const AddressBookIcon = require("@/assets/settings/address-book.svg");

interface MultiSendFormProps {
  onNext: () => void;
  onKeyboardToggle?: (visible: boolean) => void;
}

export const MultiSendForm: React.FC<MultiSendFormProps> = ({ onNext, onKeyboardToggle }) => {
  const sendStore = useSendStore();
  const { selectedToken, selectedChain, amountPerRecipient, setRecipients, setAmountPerRecipient, openTokenSheet, setInsufficientBalance, isInsufficientBalance, totalRecipients } = sendStore;

  const [addressesInput, setAddressesInput] = useState("");
  const [localAmount, setLocalAmount] = useState(amountPerRecipient);
  const [addressErrors, setAddressErrors] = useState<string[]>([]);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [pasted, setPasted] = useState(false);
  const { showToast } = useToastStore();

  // Whitelist state
  const [isWhitelistSheetVisible, setIsWhitelistSheetVisible] = useState(false);

  // Custom numeric keyboard
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  useEffect(() => {
    onKeyboardToggle?.(isKeyboardVisible);
  }, [isKeyboardVisible, onKeyboardToggle]);

  const { data: balanceData } = useWalletBalances();
  const { setInsufficientGas } = sendStore;

  // Validate addresses when they change
  useEffect(() => {
    if (addressesInput.trim()) {
      const addresses = addressesInput
        .split(/[\s\n]+/)
        .map((addr) => addr.trim())
        .filter((addr) => addr.length > 0);

      if (addresses.length > 0) {
        const validation = validateAddresses(addresses, selectedChain?.id);
        setAddressErrors(validation.errors);
      } else {
        setAddressErrors([]);
      }
    } else {
      setAddressErrors([]);
    }
  }, [addressesInput, selectedChain?.id]);

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

  // Real-time Gas Check (Pre-computation for Multi-Send)
  useEffect(() => {
    const runGasCheck = async () => {
      const rawAmount = parseRawValue(localAmount);
      const chainIdNum = Number(selectedChain?.id);

      // Only run if addresses exist and amount is valid
      if (selectedToken && chainIdNum && totalRecipients > 0 && parseFloat(rawAmount) > 0 && addressErrors.length === 0) {
        try {
          const { gasCostNative } = await transactionService.estimateGas({
            tokenAddress: selectedToken.address,
            symbol: selectedToken.symbol,
            decimals: selectedToken.decimals,
            recipientAddress: sendStore.recipients[0].address, // Estimate with first as proxy for total gas pattern
            amount: rawAmount,
            chainId: chainIdNum,
            isNative: isNativeToken(selectedToken.address),
            isMultiSend: true,
            recipientCount: totalRecipients
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

            // Total cost = (Amount * Recipients) + Gas
            const totalTransferAmount = BigInt(parseUnits(rawAmount, selectedToken.decimals)) * BigInt(totalRecipients);
            const totalCost = isNative ? totalTransferAmount + gasCostNative : gasCostNative;

            setInsufficientGas(nativeBalance < totalCost);
          }
        } catch (e) {
          console.warn("Multi-send gas check failed", e);
        }
      }
    };

    const timer = setTimeout(runGasCheck, 600);
    return () => clearTimeout(timer);
  }, [localAmount, totalRecipients, selectedToken, balanceData, addressErrors]);

  // Sync insufficient balance flag to store
  useEffect(() => {
    const rawAmount = parseFloat(parseRawValue(localAmount) || "0");
    const totalNeeded = rawAmount * totalRecipients;
    const balance = getCleanBalance();
    setInsufficientBalance(selectedToken ? totalNeeded > balance : false);
  }, [localAmount, totalRecipients, selectedToken]);

  const handlePercentagePress = (percent: number) => {
    if (!selectedToken || totalRecipients === 0) return;
    const balance = getCleanBalance();

    let totalTarget = 0;
    if (percent === 100) {
      const isNative = selectedToken.address === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
        selectedToken.symbol === "BNB" || selectedToken.symbol === "ETH";

      totalTarget = isNative ? (balance * 0.995) : balance;
    } else {
      totalTarget = balance * (percent / 100);
    }

    const perRecipient = totalTarget / totalRecipients;
    const amountStr = perRecipient.toFixed(6).replace(/\.?0+$/, "");
    setLocalAmount(formatWithCommas(amountStr));
    setAmountPerRecipient(amountStr);

    // Update recipients
    const addresses = addressesInput.split(/[\s\n,;]+/).map(a => a.trim()).filter(a => a.length > 0);
    setRecipients(addresses.map(address => ({ address, amount: amountStr })));
  };

  const handleMaxPress = () => handlePercentagePress(100);

  const handleAddressesChange = (text: string) => {
    setAddressesInput(text);
    // Parse addresses (separated by spaces, newlines, commas, or semicolons)
    const addresses = text
      .split(/[\s\n,;]+/)
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);
    const recipients = addresses.map((address) => ({
      address,
      amount: localAmount,
    }));
    setRecipients(recipients);
  };

  const handleAmountChange = (text: string) => {
    const raw = parseRawValue(text);
    // Only allow numbers and one decimal point
    if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
      setLocalAmount(formatWithCommas(raw));
      setAmountPerRecipient(raw);
      // Update existing recipients with new amount
      const addresses = addressesInput
        .split(/[\s\n,;]+/)
        .map((addr) => addr.trim())
        .filter((addr) => addr.length > 0);
      const recipients = addresses.map((address) => ({
        address,
        amount: raw,
      }));
      setRecipients(recipients);
    }
  };

  // Custom-keyboard key handler
  const handleKeyPress = (key: string) => {
    const current = parseRawValue(localAmount);
    if (key === "DELETE") {
      handleAmountChange(current.slice(0, -1));
      return;
    }
    if (key === "." && current.includes(".")) return;
    if (key === "." && (!current || current === "")) {
      handleAmountChange("0.");
      return;
    }
    if (current.includes(".")) {
      const [, dec] = current.split(".");
      if (dec && dec.length >= 6) return;
    }
    handleAmountChange(current + key);
  };

  const handlePasteAddresses = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        handleAddressesChange(text);
        setPasted(true);
        setTimeout(() => setPasted(false), 2000);
        showToast("Addresses pasted!", "success");
      }
    } catch (error) {
      console.error("Failed to paste addresses:", error);
    }
  };
  const handleAttachCSV = async () => {
    try {
      // Request document picker
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === "ios"
          ? ["public.comma-separated-values-text", "public.data"]
          : ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];

      // Validate file type
      if (!isValidCSVFile(file.name, file.mimeType || undefined)) {
        Alert.alert("Invalid File", "Please select a CSV or Excel file (.csv, .xlsx, .xls)");
        return;
      }

      // Read file content
      const fileContent = await new File(file.uri).text();

      // Parse addresses from CSV
      const extractedAddresses = parseCSVAddresses(fileContent);

      if (extractedAddresses.length === 0) {
        Alert.alert("No Addresses Found", "Could not find any valid addresses in the file. Please check the file format.");
        return;
      }

      // Populate addresses into input
      const addressesText = extractedAddresses.join(" ");
      setAddressesInput(addressesText);

      // Update recipients
      const recipients = extractedAddresses.map((address) => ({
        address,
        amount: localAmount,
      }));
      setRecipients(recipients);

      Alert.alert("Success", `Found and imported ${extractedAddresses.length} address(es) from the file.`);
    } catch (error) {
      console.error("Error reading CSV file:", error);
      Alert.alert("Error", "Failed to read the file. Please try again.");
    }
  };

  const handleMultiSelectWhitelist = (selectedAddresses: string[]) => {
    const currentAddresses = addressesInput
      .split(/[\s\n,;]+/)
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);

    // Merge only new unique addresses
    const uniqueNew = selectedAddresses.filter(addr => !currentAddresses.includes(addr));
    const updatedAddresses = [...currentAddresses, ...uniqueNew];

    const newText = updatedAddresses.join(" ");
    handleAddressesChange(newText);
  };

  return (
    <View
      style={{
        width: "100%",
        flexDirection: "column",
        gap: 18,
        paddingTop: 20,
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

      {/* Instructions */}
      <Text
        style={{
          fontFamily: "Manrope-Medium",
          fontSize: 14,
          color: colors.bodyText,
        }}
      >
        Add multiple wallet addresses or upload a list.
      </Text>

      {/* Recipient Addresses Input */}
      <View
        style={{
          flexDirection: "column",
          gap: 8,
        }}
      >
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
              minHeight: 120,
              paddingHorizontal: 17,
              paddingVertical: 12,
              borderWidth: addressErrors.length > 0 ? 1 : 0,
              borderColor: addressErrors.length > 0 ? "#EF4444" : "transparent",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-Regular",
                    fontSize: 12,
                    color: colors.bodyText,
                  }}
                >
                  To
                </Text>
                <TextInput
                  placeholder="Separate each address with a space."
                  placeholderTextColor={colors.bodyText}
                  value={addressesInput}
                  onChangeText={handleAddressesChange}
                  multiline
                  textAlignVertical="top"
                  numberOfLines={4}
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 14,
                    lineHeight: 20,
                    color: addressesInput ? colors.titleText : colors.bodyText,
                    flex: 1,
                    minHeight: 80,
                    padding: 0,
                    margin: 0,
                  }}
                />
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePasteAddresses}
                style={{
                  width: 24,
                  height: 24,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {pasted ? (
                  <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primaryCTA} />
                  </View>
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
          {addressErrors.length > 0 && (
            <View
              style={{
                flexDirection: "column",
                gap: 2,
                paddingLeft: 17,
              }}
            >
              {addressErrors.slice(0, 3).map((error, index) => (
                <Text
                  key={index}
                  style={{
                    fontFamily: "Manrope-Regular",
                    fontSize: 10,
                    lineHeight: 14,
                    color: "#EF4444",
                  }}
                >
                  {error}
                </Text>
              ))}
              {addressErrors.length > 3 && (
                <Text
                  style={{
                    fontFamily: "Manrope-Regular",
                    fontSize: 10,
                    lineHeight: 14,
                    color: "#EF4444",
                  }}
                >
                  +{addressErrors.length - 3} more error(s)
                </Text>
              )}
            </View>
          )}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsWhitelistSheetVisible(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
              }}
            >
              <Image
                source={AddressBookIcon}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            </View>
            <Text
              style={{
                fontFamily: "Manrope-Medium",
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              Add from Address Book
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAttachCSV}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
              }}
            >
              <Image
                source={AttachmentIcon}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            </View>
            <Text
              style={{
                fontFamily: "Manrope-Medium",
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              Attach CSV File
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Amount Per Recipient */}
      <View
        style={{
          flexDirection: "column",
          gap: 8,
          marginTop: 8,
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
              color: colors.bodyText,
            }}
          >
            Enter Amount Per Address
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
            }}
          >
            <View style={{ width: 14, height: 14 }}>
              <Image
                source={WalletIcon}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            </View>
            <Text
              style={{
                fontFamily: "Manrope-Medium",
                fontSize: 12,
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
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsKeyboardVisible(true)}
                style={{ minHeight: 32, justifyContent: "center" }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 24,
                    lineHeight: 32,
                    color: localAmount ? colors.titleText : colors.bodyText,
                    padding: 0,
                    margin: 0,
                  }}
                  numberOfLines={1}
                >
                  {localAmount || "0.00"}
                </Text>
              </TouchableOpacity>
              <Text
                style={{
                  fontFamily: "Manrope-Regular",
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.bodyText,
                }}
              >
                {(() => {
                  const perRecipient = parseFloat(parseRawValue(localAmount) || "0");
                  const totalTokens = perRecipient * totalRecipients;
                  const price = parseFloat(selectedToken?.priceUSD || "0");
                  const totalUsd = totalTokens * price;
                  const fmtUsd = totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  const fmtTokens = totalTokens.toLocaleString(undefined, { maximumFractionDigits: 6 });
                  const sym = selectedToken?.symbol || "";
                  return `Total: ${fmtTokens} ${sym}${price > 0 ? `  ≈  $${fmtUsd}` : ""}`;
                })()}
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
              {isInsufficientBalance ? "Insufficient balance for total send" : amountError}
            </Text>
          )}
        </View>
      </View>

      <WhitelistSelectSheet
        visible={isWhitelistSheetVisible}
        onClose={() => setIsWhitelistSheetVisible(false)}
        onSelect={() => { }} // Not used in multi-select mode
        multiSelect
        onMultiSelect={handleMultiSelectWhitelist}
      />

      <SwapKeyboard
        visible={isKeyboardVisible}
        onKeyPress={handleKeyPress}
        onPercentagePress={handlePercentagePress}
        onMaxPress={() => handlePercentagePress(100)}
        onClose={() => setIsKeyboardVisible(false)}
      />
    </View>
  );
};
