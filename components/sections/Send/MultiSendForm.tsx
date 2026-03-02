/**
 * Multi-Send Form Component
 * Form for entering multiple recipient addresses and amount per recipient
 * Matches Figma design (node-id: 3279-119061)
 */

import { colors } from "@/constants";
import { useSendStore } from "@/store/sendStore";
import { validateAddresses, validateAmount } from "@/utils/addressValidation";
import { isValidCSVFile, parseCSVAddresses } from "@/utils/csvParser";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { Alert, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useToastStore } from "@/store/useToastStore";
import { SendTokenSelector } from "./SendTokenSelector";
import { WhitelistSelectSheet } from "./WhitelistSelectSheet";

const AttachmentIcon = require("@/assets/wallet/attachment-square.svg");
const WalletIcon = require("@/assets/wallet/wallet-01.svg");
const AddressBookIcon = require("@/assets/settings/address-book.svg");

interface MultiSendFormProps {
  onNext: () => void;
}

export const MultiSendForm: React.FC<MultiSendFormProps> = ({ onNext }) => {
  const sendStore = useSendStore();
  const { selectedToken, selectedChain, amountPerRecipient, setRecipients, setAmountPerRecipient, openTokenSheet } = sendStore;

  const [addressesInput, setAddressesInput] = useState("");
  const [localAmount, setLocalAmount] = useState(amountPerRecipient);
  const [addressErrors, setAddressErrors] = useState<string[]>([]);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [pasted, setPasted] = useState(false);
  const { showToast } = useToastStore();

  // Whitelist state
  const [isWhitelistSheetVisible, setIsWhitelistSheetVisible] = useState(false);

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
      setAmountPerRecipient(maxAmountStr);
    }
  };

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
    // Only allow numbers and one decimal point
    if (text === "" || /^\d*\.?\d*$/.test(text)) {
      setLocalAmount(text);
      setAmountPerRecipient(text);
      // Update existing recipients with new amount
      const addresses = addressesInput
        .split(/[\s\n,;]+/)
        .map((addr) => addr.trim())
        .filter((addr) => addr.length > 0);
      const recipients = addresses.map((address) => ({
        address,
        amount: text,
      }));
      setRecipients(recipients);
    }
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
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleMaxPress}
            >
              <Text
                style={{
                  fontFamily: "Manrope-SemiBold",
                  fontSize: 12,
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
                ${(parseFloat(localAmount || "0") * sendStore.totalRecipients * 1000).toFixed(2)}
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
        onSelect={() => { }} // Not used in multi-select mode
        multiSelect
        onMultiSelect={handleMultiSelectWhitelist}
      />
    </View>
  );
};
