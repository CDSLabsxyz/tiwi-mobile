/**
 * Bulk Add modal (mobile).
 *
 * Paste many addresses, pick ONE amount + token for all of them, then append or
 * replace the current recipient list. Mirrors the web allocation-rules modal.
 */

import { SendTokenSelectSheet } from "@/components/sections/Send/SendTokenSelectSheet";
import type { TokenOption } from "@/components/sections/Swap/TokenSelectSheet";
import { colors } from "@/constants/colors";
import { formatTokenQuantity, getColorFromSeed } from "@/utils/formatting";
import {
  isAddressForAnyChain,
  type MultiSendRow,
} from "@/utils/multiSend";
import { validateAddress } from "@/utils/addressValidation";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

function parseAddresses(text: string, chainId: number | null): { valid: string[]; invalidCount: number } {
  const parts = text.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
  const valid: string[] = [];
  let invalidCount = 0;
  for (const p of parts) {
    const ok = chainId === null ? isAddressForAnyChain(p) : validateAddress(p, chainId).isValid;
    if (ok) valid.push(p);
    else invalidCount++;
  }
  return { valid, invalidCount };
}

interface BulkAddModalProps {
  visible: boolean;
  onClose: () => void;
  availableTokens: TokenOption[];
  onApply: (rows: MultiSendRow[], mode: "replace" | "append") => void;
}

export const BulkAddModal: React.FC<BulkAddModalProps> = ({ visible, onClose, availableTokens, onApply }) => {
  const defaultToken = availableTokens[0] || null;
  const [addressesText, setAddressesText] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<TokenOption | null>(defaultToken);
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Keep default token in sync when tokens first load.
  React.useEffect(() => {
    if (!token && defaultToken) setToken(defaultToken);
  }, [defaultToken, token]);

  const { valid, invalidCount } = useMemo(
    () => parseAddresses(addressesText, token?.chainId ?? null),
    [addressesText, token?.chainId]
  );

  const amountNum = parseFloat(amount || "0");
  const canApply = valid.length > 0 && amountNum > 0 && !!token;
  const totalDisplay = (amountNum * valid.length).toString();

  const reset = () => {
    setAddressesText("");
    setAmount("");
  };

  const handleApply = () => {
    if (!canApply || !token) return;
    const rows: MultiSendRow[] = valid.map((addr, i) => ({
      id: `bulk_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      address: addr,
      amount,
      token,
    }));
    onApply(rows, mode);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 18 }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: colors.bgSemi, borderRadius: 20, borderWidth: 1, borderColor: colors.bgStroke, overflow: "hidden", maxHeight: "88%" }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.bgStroke }}>
            <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 15, color: colors.titleText }}>Bulk Add</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.bodyText} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
            {/* Addresses */}
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 12, color: colors.bodyText }}>Recipient addresses</Text>
                <Text style={{ fontFamily: "Manrope-Regular", fontSize: 10, color: colors.bodyText }}>
                  {valid.length} valid{invalidCount > 0 ? ` · ${invalidCount} invalid` : ""}
                </Text>
              </View>
              <TextInput
                value={addressesText}
                onChangeText={setAddressesText}
                placeholder={"0xabc...\n0xdef...\nOne per line, comma, or space"}
                placeholderTextColor={colors.bodyText}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                multiline
                textAlignVertical="top"
                style={{ height: 150, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.bgStroke, padding: 12, fontFamily: "Manrope-Medium", fontSize: 12, color: colors.titleText }}
              />
            </View>

            {/* Amount + token */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 12, color: colors.bodyText }}>Amount per recipient</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.bgStroke, paddingHorizontal: 12, paddingVertical: 8 }}>
                <TextInput
                  value={amount}
                  onChangeText={(t) => { if (t === "" || /^\d*\.?\d*$/.test(t.replace(/,/g, ""))) setAmount(t.replace(/,/g, "")); }}
                  placeholder="Amount each"
                  placeholderTextColor={colors.bodyText}
                  keyboardType="decimal-pad"
                  style={{ flex: 1, fontFamily: "Manrope-Medium", fontSize: 15, color: colors.titleText, padding: 0 }}
                />
                <TouchableOpacity activeOpacity={0.8} onPress={() => setPickerOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: token ? colors.bgCards : colors.primaryCTA, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6 }}>
                  {token ? (
                    <>
                      <View style={{ width: 20, height: 20, borderRadius: 10, overflow: "hidden", backgroundColor: colors.bgStroke, alignItems: "center", justifyContent: "center" }}>
                        {token.icon ? (
                          <Image source={{ uri: String(token.icon) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                        ) : (
                          <View style={{ width: "100%", height: "100%", backgroundColor: getColorFromSeed(token.symbol), alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ fontFamily: "Manrope-Bold", fontSize: 10, color: "#FFF" }}>{token.symbol.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontFamily: "Manrope-Bold", fontSize: 13, color: colors.titleText }}>{token.symbol}</Text>
                      <Ionicons name="chevron-down" size={13} color={colors.bodyText} />
                    </>
                  ) : (
                    <>
                      <Text style={{ fontFamily: "Manrope-Bold", fontSize: 13, color: colors.bg }}>Pick token</Text>
                      <Ionicons name="chevron-down" size={13} color={colors.bg} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
              {token && (
                <Text style={{ fontFamily: "Manrope-Regular", fontSize: 10, color: colors.bodyText }}>
                  Balance: {formatTokenQuantity(token.balanceToken)} {token.symbol}
                </Text>
              )}
            </View>

            {/* Summary */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.bgStroke, paddingHorizontal: 12, paddingVertical: 10 }}>
              <View>
                <Text style={{ fontFamily: "Manrope-Regular", fontSize: 10, color: colors.bodyText }}>Will add</Text>
                <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 14, color: colors.titleText }}>
                  {valid.length} recipient{valid.length === 1 ? "" : "s"}
                </Text>
              </View>
              {canApply && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontFamily: "Manrope-Regular", fontSize: 10, color: colors.bodyText }}>Total</Text>
                  <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 14, color: colors.primaryCTA }}>
                    {formatTokenQuantity(totalDisplay)} {token?.symbol}
                  </Text>
                </View>
              )}
            </View>

            {/* Mode */}
            <View style={{ flexDirection: "row", gap: 20 }}>
              {(["append", "replace"] as const).map((m) => (
                <TouchableOpacity key={m} activeOpacity={0.8} onPress={() => setMode(m)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: mode === m ? colors.primaryCTA : colors.bodyText, alignItems: "center", justifyContent: "center" }}>
                    {mode === m && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryCTA }} />}
                  </View>
                  <Text style={{ fontFamily: "Manrope-Medium", fontSize: 13, color: colors.bodyText }}>
                    {m === "append" ? "Append to list" : "Replace existing"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.bgStroke }}>
            <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={{ flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 100, borderWidth: 1, borderColor: colors.bgStroke, paddingVertical: 12 }}>
              <Text style={{ fontFamily: "Manrope-Medium", fontSize: 14, color: colors.bodyText }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={handleApply} disabled={!canApply} style={{ flex: 2, alignItems: "center", justifyContent: "center", borderRadius: 100, backgroundColor: canApply ? colors.primaryCTA : colors.bgCards, paddingVertical: 12 }}>
              <Text style={{ fontFamily: "Manrope-Medium", fontSize: 14, color: canApply ? colors.bg : colors.bodyText }}>Add to Preview</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>

      <SendTokenSelectSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(t) => { setToken(t); setPickerOpen(false); }} />
    </Modal>
  );
};
