/**
 * Send Review Component
 * Review screen before confirming transaction
 * Matches Figma design (node-id: 3279-119877)
 */

import { colors } from "@/constants";
import { RiskCheckResult, securityGuard } from "@/services/securityGuard";
import { transactionService } from "@/services/transactionService";
import { useSecurityStore } from "@/store/securityStore";
import { useSendStore } from "@/store/sendStore";
import { useWalletStore } from "@/store/walletStore";
import { formatTokenAmount } from "@/utils/formatting";
import { isNativeToken, truncateAddress } from "@/utils/wallet";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatEther } from "viem";

const AlertIcon = require("@/assets/wallet/alert-square.svg");
const CheckmarkIcon = require("@/assets/swap/checkmark-circle-01.svg");

interface SendReviewProps {
  onConfirm: () => void;
}

export const SendReview: React.FC<SendReviewProps> = ({ onConfirm }) => {
  const { address: activeAddress } = useWalletStore();
  const { selectedToken, selectedChain, recipientAddress, amount, usdValue, networkFee, networkFeeUSD, setNetworkFee } = useSendStore();
  const { isFlaggedAddressEnabled, isTransactionRiskEnabled } = useSecurityStore();

  const [riskResult, setRiskResult] = useState<RiskCheckResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isEstimatingGas, setIsEstimatingGas] = useState(false);

  useEffect(() => {
    const runInitialChecks = async () => {
      // 1. Security Check
      if (isFlaggedAddressEnabled || isTransactionRiskEnabled) {
        setIsScanning(true);
        const chainIdStr = selectedChain?.id ? String(selectedChain.id) : '1';
        const result = await securityGuard.checkAddressRisk(recipientAddress, chainIdStr);
        setRiskResult(result);
        setIsScanning(false);
      }

      // 2. Gas Estimation
      if (selectedToken && selectedChain && recipientAddress && amount) {
        setIsEstimatingGas(true);
        try {
          const { gasCostNative, gasCostUSD } = await transactionService.estimateGas({
            tokenAddress: selectedToken.address,
            symbol: selectedToken.symbol,
            decimals: selectedToken.decimals,
            recipientAddress: recipientAddress,
            amount: amount,
            chainId: Number(selectedChain.id),
            isNative: isNativeToken(selectedToken.address),
          });

          const nativeSymbol = selectedChain.id === 56 ? 'BNB' : (selectedChain.id === 1 ? 'ETH' : 'Native');
          const feeStr = `${formatEther(gasCostNative).slice(0, 8)} ${nativeSymbol}`;
          const feeUSDStr = `$${gasCostUSD.toFixed(4)}`;

          setNetworkFee(feeStr, feeUSDStr);
        } catch (e) {
          console.error('Failed to estimate gas in review:', e);
        } finally {
          setIsEstimatingGas(false);
        }
      }
    };

    runInitialChecks();
  }, [recipientAddress, selectedChain?.id, isFlaggedAddressEnabled, isTransactionRiskEnabled, amount, selectedToken]);

  return (
    <View style={styles.container}>
      {/* Amount Display */}
      <View style={styles.amountDisplay}>
        <Text style={styles.confirmTitle}>Confirm</Text>
        <View style={styles.amountWrapper}>
          <Text
            style={styles.amountText}
            adjustsFontSizeToFit={true}
            numberOfLines={1}
            minimumFontScale={0.5}
          >
            {formatTokenAmount(amount)} {selectedToken?.symbol || ""}
          </Text>
          <Text style={styles.usdText}>{usdValue}</Text>
        </View>
      </View>

      {/* Transaction Details */}
      <View style={styles.detailsCard}>
        {/* From */}
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>From</Text>
          <Text style={styles.detailValue}>{truncateAddress(activeAddress || "")}</Text>
        </View>

        {/* To and Network */}
        <View style={styles.row}>
          <View style={[styles.detailItem, { flex: 1 }]}>
            <Text style={styles.detailLabel}>To</Text>
            <Text style={styles.detailValueSmall}>{truncateAddress(recipientAddress)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Network</Text>
            <Text style={styles.detailValue}>{selectedChain?.name || "N/A"}</Text>
          </View>
        </View>
      </View>

      {/* Network Fee */}
      <View style={styles.feeCard}>
        <View style={styles.feeLabelWrapper}>
          <Text style={styles.detailLabel}>Network Fee</Text>
          <View style={styles.infoIcon}>
            <Image source={AlertIcon} style={styles.fullSize} contentFit="contain" />
          </View>
        </View>
        <View style={styles.feeValueWrapper}>
          <Text style={styles.detailValueSmall}>{isEstimatingGas ? 'Calculating...' : networkFee}</Text>
          <Text style={styles.feeDetail}>{isEstimatingGas ? '...' : networkFeeUSD}</Text>
        </View>
      </View>

      {/* Risk Assessment Indicator */}
      {(isFlaggedAddressEnabled || isTransactionRiskEnabled) && (
        <View
          style={[
            styles.riskCard,
            {
              backgroundColor: isScanning ? colors.bgSemi : (riskResult?.isSafe ? 'rgba(74, 222, 128, 0.05)' : 'rgba(239, 68, 68, 0.05)'),
              borderColor: isScanning ? 'rgba(255, 255, 255, 0.1)' : (riskResult?.isSafe ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
            }
          ]}
        >
          <View style={styles.riskHeader}>
            <View style={styles.riskIcon}>
              <Image
                source={riskResult?.isSafe ? CheckmarkIcon : AlertIcon}
                style={styles.fullSize}
                contentFit="contain"
                tintColor={isScanning ? '#FFFFFF' : (riskResult?.isSafe ? '#4ADE80' : '#EF4444')}
              />
            </View>
            <Text style={[
              styles.riskTitle,
              { color: isScanning ? '#FFFFFF' : (riskResult?.isSafe ? '#4ADE80' : '#EF4444') }
            ]}>
              {isScanning ? 'Scanning for security risks...' : (riskResult?.isSafe ? 'No security risks detected' : 'Security Warning detected')}
            </Text>
          </View>

          {!isScanning && riskResult && riskResult.warnings.length > 0 && (
            <View style={styles.warningsList}>
              {riskResult.warnings.map((warning, idx) => (
                <Text key={idx} style={styles.warningText}>
                  • {warning}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "column",
    gap: 12,
    paddingTop: 20,
  },
  amountDisplay: {
    flexDirection: "column",
    alignItems: "center",
    gap: 30,
    marginBottom: 10,
  },
  confirmTitle: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 20,
    lineHeight: 20,
    color: colors.titleText,
    textTransform: "capitalize",
  },
  amountWrapper: {
    flexDirection: "column",
    alignItems: "center",
  },
  amountText: {
    fontFamily: "Manrope-Medium",
    fontSize: 36,
    color: colors.titleText,
  },
  usdText: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: colors.bodyText,
    textAlign: "center",
  },
  detailsCard: {
    backgroundColor: colors.bgSemi,
    borderRadius: 16,
    paddingHorizontal: 17,
    paddingVertical: 10,
    flexDirection: "column",
    gap: 12,
  },
  detailItem: {
    flexDirection: "column",
    gap: 3,
  },
  detailLabel: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: colors.bodyText,
  },
  detailValue: {
    fontFamily: "Manrope-Medium",
    fontSize: 16,
    color: colors.bodyText,
  },
  detailValueSmall: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: colors.bodyText,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  feeCard: {
    backgroundColor: colors.bgSemi,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  feeLabelWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  infoIcon: {
    width: 18,
    height: 18,
  },
  feeValueWrapper: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  feeDetail: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: colors.bodyText,
    textAlign: "right",
  },
  riskCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'column',
    gap: 8,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riskIcon: {
    width: 16,
    height: 16,
  },
  riskTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
  },
  warningsList: {
    gap: 4,
  },
  warningText: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    color: '#EF4444',
  },
  fullSize: {
    width: '100%',
    height: '100%',
  }
});
