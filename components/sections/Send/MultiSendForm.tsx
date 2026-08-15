/**
 * Multi-Send Form (mobile) - per-row multi-token model.
 *
 * Each recipient row carries its own address + amount + token. Supports
 * Add User, Bulk Add (many addresses / one amount+token), and Attach CSV
 * (`address,amount,tokenSymbol` per line). Rows are grouped by token at
 * review/execution time (see utils/multiSend.ts + services/multiSendExecutor.ts).
 */

import { BulkAddModal } from "@/components/sections/Send/BulkAddModal";
import { MultiSendRowsForm } from "@/components/sections/Send/MultiSendRowsForm";
import { colors } from "@/constants/colors";
import { useMultiSendTokens } from "@/hooks/useMultiSendTokens";
import { useSendStore } from "@/store/sendStore";
import { useToastStore } from "@/store/useToastStore";
import { isValidCSVFile } from "@/utils/csvParser";
import {
  applyBulkRows,
  createEmptyMultiSendRow,
  parseMultiSendCsv,
  type MultiSendRow,
} from "@/utils/multiSend";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import React, { useEffect, useState } from "react";
import { Alert, Platform, Text, TouchableOpacity, View } from "react-native";

const AttachmentIcon = require("@/assets/wallet/attachment-square.svg");

interface MultiSendFormProps {
  onNext: () => void;
  onKeyboardToggle?: (visible: boolean) => void;
}

export const MultiSendForm: React.FC<MultiSendFormProps> = () => {
  const { multiSendRows, setMultiSendRows, selectedToken } = useSendStore();
  const availableTokens = useMultiSendTokens();
  const { showToast } = useToastStore();
  const [bulkOpen, setBulkOpen] = useState(false);

  // Prefer the token chosen on the select-asset step, else the top holding.
  const defaultToken = selectedToken || availableTokens[0] || null;

  // Seed one empty row (defaulting to the top token) on first mount.
  useEffect(() => {
    if (multiSendRows.length === 0) {
      setMultiSendRows([createEmptyMultiSendRow(defaultToken)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTokens.length]);

  const handleBulkApply = (rows: MultiSendRow[], mode: "replace" | "append") => {
    setMultiSendRows(applyBulkRows(multiSendRows, rows, mode, defaultToken));
    showToast(`${rows.length} recipient${rows.length === 1 ? "" : "s"} added`, "success");
  };

  const handleAttachCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === "ios"
          ? ["public.comma-separated-values-text", "public.data", "public.text"]
          : ["text/csv", "text/plain", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      if (!isValidCSVFile(file.name, file.mimeType || undefined) && !file.name.toLowerCase().endsWith(".txt")) {
        Alert.alert("Invalid File", "Please select a CSV or text file (address,amount,token per line).");
        return;
      }

      const content = await new File(file.uri).text();
      const { rows, skipped } = parseMultiSendCsv(content, availableTokens);

      if (rows.length === 0) {
        Alert.alert("No Recipients Found", "Could not parse any rows. Expected: address,amount,token per line.");
        return;
      }

      setMultiSendRows(applyBulkRows(multiSendRows, rows, "replace", defaultToken));
      Alert.alert("Imported", `${rows.length} recipient(s) imported${skipped ? ` · ${skipped} line(s) skipped` : ""}.`);
    } catch (e) {
      console.error("CSV import failed:", e);
      Alert.alert("Error", "Failed to read the file. Please try again.");
    }
  };

  return (
    <View style={{ width: "100%", gap: 22, paddingTop: 24 }}>
      <Text style={{ fontFamily: "Manrope-Medium", fontSize: 15, lineHeight: 22, color: colors.bodyText }}>
        Add recipients - each row can send a different amount and token.
      </Text>

      <MultiSendRowsForm
        rows={multiSendRows}
        onChange={setMultiSendRows}
        availableTokens={availableTokens}
        onBulkAdd={() => setBulkOpen(true)}
      />

      {/* Attach CSV */}
      <TouchableOpacity activeOpacity={0.8} onPress={handleAttachCSV} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
        <View style={{ width: 22, height: 22 }}>
          <Image source={AttachmentIcon} style={{ width: "100%", height: "100%" }} contentFit="contain" />
        </View>
        <Text style={{ fontFamily: "Manrope-Medium", fontSize: 14, color: colors.bodyText }}>Attach CSV / Text File</Text>
      </TouchableOpacity>
      <Text style={{ fontFamily: "Manrope-Regular", fontSize: 12, lineHeight: 18, color: colors.bodyText }}>
        CSV format: address, amount, token - one recipient per line. Header rows are auto-skipped.
      </Text>

      <BulkAddModal
        visible={bulkOpen}
        onClose={() => setBulkOpen(false)}
        availableTokens={availableTokens}
        onApply={handleBulkApply}
      />
    </View>
  );
};
