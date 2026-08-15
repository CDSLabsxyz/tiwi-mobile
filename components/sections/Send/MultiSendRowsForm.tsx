/**
 * Multi-Send per-row form (mobile).
 *
 * Each row = address + amount + its own token. Mirrors the web multi-send:
 *   - MultiSendRowsForm: shows the latest row + a "N added" chip + Add User /
 *     Bulk Add. Used on the enter-details step.
 *   - MultiSendRowsList: every row visible + editable. Used inside the preview.
 */

import { SendTokenSelectSheet } from "@/components/sections/Send/SendTokenSelectSheet";
import { WhitelistSelectSheet } from "@/components/sections/Send/WhitelistSelectSheet";
import type { TokenOption } from "@/components/sections/Swap/TokenSelectSheet";
import { colors } from "@/constants/colors";
import { formatNumberInput, formatTokenQuantity, getColorFromSeed, parseNumberInput } from "@/utils/formatting";
import {
  createEmptyMultiSendRow,
  isRowValid,
  rowInvalidReason,
  type MultiSendRow,
} from "@/utils/multiSend";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import React, { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

const AddressBookIcon = require("@/assets/settings/address-book.svg");

// ----------------------------------------------------------------------------
// Editable row
// ----------------------------------------------------------------------------

function TokenChip({ token }: { token: TokenOption | null }) {
  if (!token) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primaryCTA, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 }}>
        <Text style={{ fontFamily: "Manrope-Bold", fontSize: 13, color: colors.bg }}>Pick token</Text>
        <Ionicons name="chevron-down" size={13} color={colors.bg} />
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.bgCards, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6 }}>
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
    </View>
  );
}

export function MultiSendRowItem({
  row,
  indexLabel,
  onPatch,
  onRemove,
  onOpenTokenPicker,
  onOpenAddressBook,
}: {
  row: MultiSendRow;
  indexLabel: number;
  onPatch: (patch: Partial<MultiSendRow>) => void;
  onRemove: () => void;
  onOpenTokenPicker: () => void;
  onOpenAddressBook?: () => void;
}) {
  const valid = isRowValid(row);
  const reason = rowInvalidReason(row);

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) onPatch({ address: text.trim() });
    } catch { /* clipboard unavailable */ }
  };

  return (
    <View style={{ borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.bgStroke, padding: 14, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <Text style={{ fontFamily: "Manrope-Medium", fontSize: 12, color: colors.bodyText }}>
          #{indexLabel}
          {valid ? "  ✓" : ""}
        </Text>
        <TouchableOpacity activeOpacity={0.7} onPress={onRemove} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={colors.bodyText} />
        </TouchableOpacity>
      </View>

      {/* Address */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.bgSemi, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 15, minHeight: 54 }}>
        <TextInput
          value={row.address}
          onChangeText={(t) => onPatch({ address: t })}
          placeholder="Enter address"
          placeholderTextColor={colors.bodyText}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType="default"
          returnKeyType="done"
          style={{ flex: 1, fontFamily: "Manrope-Medium", fontSize: 15, lineHeight: 22, color: row.address ? colors.titleText : colors.bodyText, paddingVertical: 0, paddingHorizontal: 0, margin: 0, minHeight: 22 }}
        />
        {onOpenAddressBook && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onOpenAddressBook}
            hitSlop={8}
            style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgCards, borderRadius: 8 }}
          >
            <Image source={AddressBookIcon} style={{ width: 18, height: 18 }} contentFit="contain" />
          </TouchableOpacity>
        )}
        <TouchableOpacity activeOpacity={0.7} onPress={handlePaste} hitSlop={8} style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="clipboard-outline" size={18} color={colors.titleText} />
        </TouchableOpacity>
      </View>

      {/* Amount + token */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.bgSemi, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 }}>
        <TextInput
          value={formatNumberInput(row.amount)}
          onChangeText={(t) => onPatch({ amount: parseNumberInput(t) })}
          placeholder="Amount"
          placeholderTextColor={colors.bodyText}
          keyboardType="decimal-pad"
          style={{ flex: 1, fontFamily: "Manrope-Medium", fontSize: 15, color: colors.titleText, padding: 0 }}
        />
        <TouchableOpacity activeOpacity={0.8} onPress={onOpenTokenPicker}>
          <TokenChip token={row.token} />
        </TouchableOpacity>
      </View>

      {/* Balance / reason */}
      {row.token ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <Text style={{ fontFamily: "Manrope-Regular", fontSize: 11, color: colors.bodyText }}>
            Balance: {formatTokenQuantity(row.token.balanceToken)} {row.token.symbol}
          </Text>
          {!valid && reason ? (
            <Text style={{ fontFamily: "Manrope-Regular", fontSize: 10, color: "#FFB347" }}>{reason}</Text>
          ) : null}
        </View>
      ) : reason ? (
        <Text style={{ fontFamily: "Manrope-Regular", fontSize: 10, color: "#FFB347" }}>{reason}</Text>
      ) : null}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Form view - only the latest row + Add User / Bulk Add
// ----------------------------------------------------------------------------

type FormProps = {
  rows: MultiSendRow[];
  onChange: (rows: MultiSendRow[]) => void;
  availableTokens: TokenOption[];
  onBulkAdd?: () => void;
};

export function MultiSendRowsForm({ rows, onChange, availableTokens, onBulkAdd }: FormProps) {
  const [pickerRowId, setPickerRowId] = useState<string | null>(null);
  const [bookRowId, setBookRowId] = useState<string | null>(null);
  const defaultToken = availableTokens[0] || null;

  const validCount = rows.filter(isRowValid).length;
  const lastRow = rows[rows.length - 1];
  const canAddRow = !!lastRow && isRowValid(lastRow);
  const committedCount = Math.max(rows.length - 1, 0);

  const updateRow = (id: string, patch: Partial<MultiSendRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    onChange(next.length === 0 ? [createEmptyMultiSendRow(defaultToken)] : next);
  };

  const addRow = () => {
    if (!canAddRow) return;
    onChange([...rows, createEmptyMultiSendRow(lastRow?.token || defaultToken)]);
  };

  return (
    <View style={{ borderRadius: 18, backgroundColor: colors.bgSemi, borderWidth: 1, borderColor: colors.bgStroke, padding: 18, gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: "Manrope-Medium", fontSize: 13, color: colors.bodyText, flex: 1, paddingRight: 8 }}>
          Add recipients with per-row amount and token.
        </Text>
        <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 13, color: colors.primaryCTA }}>{validCount} valid</Text>
      </View>

      {committedCount > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.bgStroke, paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.primaryCTA, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
            <Text style={{ fontFamily: "Manrope-Bold", fontSize: 11, color: colors.bg }}>{committedCount}</Text>
          </View>
          <Text style={{ flex: 1, fontFamily: "Manrope-Regular", fontSize: 11, color: colors.bodyText }}>
            {committedCount === 1 ? "recipient" : "recipients"} added - open Preview to view, edit, or delete.
          </Text>
        </View>
      )}

      {lastRow && (
        <MultiSendRowItem
          row={lastRow}
          indexLabel={rows.length}
          onPatch={(patch) => updateRow(lastRow.id, patch)}
          onRemove={() => removeRow(lastRow.id)}
          onOpenTokenPicker={() => setPickerRowId(lastRow.id)}
          onOpenAddressBook={() => setBookRowId(lastRow.id)}
        />
      )}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 2 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={addRow}
          disabled={!canAddRow}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 100, borderWidth: 1, borderStyle: "dashed", borderColor: canAddRow ? colors.primaryCTA : colors.bgStroke, paddingVertical: 15 }}
        >
          <Ionicons name="add-circle-outline" size={17} color={canAddRow ? colors.primaryCTA : colors.bodyText} />
          <Text style={{ fontFamily: "Manrope-Medium", fontSize: 14, color: canAddRow ? colors.primaryCTA : colors.bodyText }}>Add User</Text>
        </TouchableOpacity>
        {onBulkAdd && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onBulkAdd}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 100, borderWidth: 1, borderColor: colors.primaryCTA, paddingVertical: 15 }}
          >
            <Text style={{ fontFamily: "Manrope-Medium", fontSize: 14, color: colors.primaryCTA }}>Bulk Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <SendTokenSelectSheet
        visible={pickerRowId !== null}
        onClose={() => setPickerRowId(null)}
        onSelect={(token) => {
          if (pickerRowId) updateRow(pickerRowId, { token });
          setPickerRowId(null);
        }}
      />

      <WhitelistSelectSheet
        visible={bookRowId !== null}
        onClose={() => setBookRowId(null)}
        onSelect={(address) => {
          if (bookRowId) updateRow(bookRowId, { address });
          setBookRowId(null);
        }}
      />
    </View>
  );
}

// ----------------------------------------------------------------------------
// Editable list - every row (used inside the preview)
// ----------------------------------------------------------------------------

export function MultiSendRowsList({ rows, onChange, availableTokens }: FormProps) {
  const [pickerRowId, setPickerRowId] = useState<string | null>(null);
  const [bookRowId, setBookRowId] = useState<string | null>(null);
  const defaultToken = availableTokens[0] || null;

  const updateRow = (id: string, patch: Partial<MultiSendRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    onChange(next.length === 0 ? [createEmptyMultiSendRow(defaultToken)] : next);
  };

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, idx) => (
        <MultiSendRowItem
          key={row.id}
          row={row}
          indexLabel={idx + 1}
          onPatch={(patch) => updateRow(row.id, patch)}
          onRemove={() => removeRow(row.id)}
          onOpenTokenPicker={() => setPickerRowId(row.id)}
          onOpenAddressBook={() => setBookRowId(row.id)}
        />
      ))}

      <SendTokenSelectSheet
        visible={pickerRowId !== null}
        onClose={() => setPickerRowId(null)}
        onSelect={(token) => {
          if (pickerRowId) updateRow(pickerRowId, { token });
          setPickerRowId(null);
        }}
      />

      <WhitelistSelectSheet
        visible={bookRowId !== null}
        onClose={() => setBookRowId(null)}
        onSelect={(address) => {
          if (bookRowId) updateRow(bookRowId, { address });
          setBookRowId(null);
        }}
      />
    </View>
  );
}
