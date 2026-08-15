/**
 * Multi-Send Preview (review step, mobile).
 *
 * Groups the per-row recipients by token, runs preflight, shows per-token totals
 * and an editable row list. The parent (send.tsx) owns the Confirm button and
 * gates it on `preflightMultiSend(groups).ok`.
 */

import { MultiSendRowsList } from "@/components/sections/Send/MultiSendRowsForm";
import { colors } from "@/constants/colors";
import { useMultiSendTokens } from "@/hooks/useMultiSendTokens";
import { formatTokenQuantity, getColorFromSeed } from "@/utils/formatting";
import { groupRowsByToken, preflightMultiSend } from "@/utils/multiSend";
import { useSendStore } from "@/store/sendStore";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export const MultiSendPreview: React.FC = () => {
  const { multiSendRows, setMultiSendRows } = useSendStore();
  const availableTokens = useMultiSendTokens();
  const [showRows, setShowRows] = useState(false);

  const { groups, invalidCount } = useMemo(() => groupRowsByToken(multiSendRows), [multiSendRows]);
  const preflight = useMemo(() => preflightMultiSend(groups), [groups]);
  const totalRecipients = groups.reduce((acc, g) => acc + g.recipients.length, 0);

  return (
    <View style={{ width: "100%", gap: 12, paddingTop: 20 }}>
      <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 20, color: colors.titleText, textAlign: "center", marginBottom: 8 }}>
        Multi-Send Preview
      </Text>

      {/* Recipients / tokens */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.bgSemi, borderRadius: 16, borderWidth: 1, borderColor: colors.bgStroke, paddingHorizontal: 16, paddingVertical: 12 }}>
        <View>
          <Text style={{ fontFamily: "Manrope-Regular", fontSize: 11, color: colors.bodyText }}>Valid recipients</Text>
          <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 18, color: colors.titleText }}>{totalRecipients}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: "Manrope-Regular", fontSize: 11, color: colors.bodyText }}>Tokens</Text>
          <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 18, color: colors.titleText }}>{groups.length}</Text>
        </View>
      </View>

      {invalidCount > 0 && (
        <View style={{ backgroundColor: "rgba(255,179,71,0.1)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ fontFamily: "Manrope-Regular", fontSize: 11, color: "#FFB347" }}>
            {invalidCount} row{invalidCount === 1 ? "" : "s"} incomplete - fix or delete below.
          </Text>
        </View>
      )}

      {/* Preflight issues */}
      {preflight.issues.map((issue, i) => (
        <View
          key={i}
          style={{ backgroundColor: issue.level === "error" ? "rgba(255,110,110,0.1)" : "rgba(255,179,71,0.1)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Text style={{ fontFamily: "Manrope-Regular", fontSize: 11, color: issue.level === "error" ? "#FF6E6E" : "#FFB347" }}>
            {issue.message}
          </Text>
        </View>
      ))}

      {/* Totals by token */}
      {groups.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: "Manrope-Regular", fontSize: 10, color: colors.bodyText, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 2 }}>
            Totals by token
          </Text>
          {groups.map((g) => (
            <View key={g.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.bgStroke, paddingHorizontal: 12, paddingVertical: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, overflow: "hidden", backgroundColor: colors.bgStroke, alignItems: "center", justifyContent: "center" }}>
                  {g.token.icon ? (
                    <Image source={{ uri: String(g.token.icon) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <View style={{ width: "100%", height: "100%", backgroundColor: getColorFromSeed(g.token.symbol), alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontFamily: "Manrope-Bold", fontSize: 10, color: "#FFF" }}>{g.token.symbol.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 13, color: colors.titleText }}>{g.token.symbol}</Text>
                <Text style={{ fontFamily: "Manrope-Regular", fontSize: 10, color: colors.bodyText }}>× {g.recipients.length}</Text>
              </View>
              <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 13, color: colors.primaryCTA }}>
                {formatTokenQuantity(g.totalDisplay)} {g.token.symbol}
              </Text>
            </View>
          ))}
          {groups.length > 1 && (
            <Text style={{ fontFamily: "Manrope-Regular", fontSize: 10, color: colors.bodyText, paddingHorizontal: 2 }}>
              Executes as {groups.length} transactions (one per token).
            </Text>
          )}
        </View>
      )}

      {/* Edit rows toggle */}
      <TouchableOpacity activeOpacity={0.8} onPress={() => setShowRows((v) => !v)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 }}>
        <Text style={{ fontFamily: "Manrope-Medium", fontSize: 13, color: colors.primaryCTA }}>
          {showRows ? "Hide recipients" : `Edit recipients (${multiSendRows.length})`}
        </Text>
      </TouchableOpacity>

      {showRows && (
        <MultiSendRowsList rows={multiSendRows} onChange={setMultiSendRows} availableTokens={availableTokens} />
      )}
    </View>
  );
};
