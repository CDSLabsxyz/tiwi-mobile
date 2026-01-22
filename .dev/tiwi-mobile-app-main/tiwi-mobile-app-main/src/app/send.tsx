/**
 * Send Screen
 * Main send page with two tabs: Send to One and Multi-Send
 * Matches Figma designs (node-id: 3279-118948, 3279-119800, etc.)
 */

import React, { useState, useEffect } from "react";
import { View, ScrollView, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";
import { StatusBar } from "@/components/ui/StatusBar";
import { WalletHeader } from "@/components/sections/Wallet/WalletHeader";
import { colors } from "@/theme";
import { WALLET_ADDRESS } from "@/utils/wallet";
import { useSendStore } from "@/store/sendStore";
import { SendTokenSelector } from "@/components/sections/Send/SendTokenSelector";
import { SendForm } from "@/components/sections/Send/SendForm";
import { SendReview } from "@/components/sections/Send/SendReview";
import { PasscodeScreen } from "@/components/sections/Send/PasscodeScreen";
import { MultiSendForm } from "@/components/sections/Send/MultiSendForm";
import { MultiSendReview } from "@/components/sections/Send/MultiSendReview";
import { SendTokenSelectSheet } from "@/components/sections/Send/SendTokenSelectSheet";
import { fetchWalletData } from "@/services/walletService";
import { mapAssetToTokenOption, mapAssetToChainOption } from "@/utils/assetMapping";
import { validateAddress, validateAmount, validateAddresses } from "@/utils/addressValidation";

export default function SendScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ assetId?: string }>();

  const sendStore = useSendStore();
  const {
    activeTab,
    selectedToken,
    currentStep,
    isTokenSheetVisible,
    setActiveTab,
    setCurrentStep,
    openTokenSheet,
    closeTokenSheet,
    resetSendState,
    prePopulateFromAsset,
  } = sendStore;

  // Check if we're coming from asset detail page
  useEffect(() => {
    if (params.assetId) {
      // Pre-populate from asset
      const loadAsset = async () => {
        try {
          const walletData = await fetchWalletData(WALLET_ADDRESS);
          const asset = walletData.portfolio.find((a) => a.id === params.assetId);
          if (asset) {
            const tokenOption = mapAssetToTokenOption(asset, asset.balance, asset.usdValue);
            const chainOption = mapAssetToChainOption(asset);
            if (tokenOption && chainOption) {
              prePopulateFromAsset(tokenOption, chainOption, asset.balance, asset.usdValue);
            }
          }
        } catch (error) {
          console.error("Failed to load asset:", error);
        }
      };
      loadAsset();
    } else {
      // Reset to initial state
      resetSendState();
    }
  }, [params.assetId]);

  // Handlers
  const handleBackPress = () => {
    if (currentStep === "select-asset") {
      router.back();
    } else if (currentStep === "enter-details") {
      setCurrentStep("select-asset");
    } else if (currentStep === "review") {
      setCurrentStep("enter-details");
    } else if (currentStep === "passcode") {
      setCurrentStep("review");
    }
  };

  const handleIrisScanPress = () => {
    // TODO: Implement iris scan
    console.log("Iris scan pressed");
  };

  const handleSettingsPress = () => {
    const currentRoute = pathname || "/send";
    router.push(`/settings?returnTo=${encodeURIComponent(currentRoute)}` as any);
  };

  const handleTokenSelect = async (token: any, chainId?: string) => {
    sendStore.setSelectedToken(token);
    // Set chain if provided
    if (chainId) {
      const { getChainOptionWithFallback } = require("@/utils/chainUtils");
      const chainOption = getChainOptionWithFallback(chainId);
      if (chainOption) {
        sendStore.setSelectedChain(chainOption);
      }
    } else {
      // Fallback: Get chain info from wallet data
      try {
        const walletData = await fetchWalletData(WALLET_ADDRESS);
        const asset = walletData.portfolio.find((a) => {
          const mappedToken = mapAssetToTokenOption(a, a.balance, a.usdValue);
          return mappedToken.id === token.id;
        });
        if (asset) {
          const chainOption = mapAssetToChainOption(asset);
          if (chainOption) {
            sendStore.setSelectedChain(chainOption);
          }
        }
      } catch (error) {
        console.error("Failed to load chain info:", error);
      }
    }
    closeTokenSheet();
    // Don't navigate - user must click Next button
  };

  const handleNextFromSelect = () => {
    if (selectedToken) {
      setCurrentStep("enter-details");
    } else {
      openTokenSheet();
    }
  };

  const handleNextFromForm = () => {
    setCurrentStep("review");
  };

  const handleConfirmFromReview = () => {
    setCurrentStep("passcode");
  };

  const handlePasscodeSuccess = () => {
    // TODO: Execute transaction
    console.log("Transaction confirmed!");
    // Navigate to success screen or back to wallet
    router.push("/wallet" as any);
  };

  // Render current step
  const renderContent = () => {
    if (currentStep === "select-asset") {
      return (
        <View
          style={{
            width: "100%",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 20,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-SemiBold",
              fontSize: 20,
              lineHeight: 20,
              color: colors.titleText,
              textTransform: "capitalize",
              textAlign: "center",
              marginBottom: 47,
            }}
          >
            Select Asset
          </Text>

          {/* Tab Switcher */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 25,
              width: 357,
              marginBottom: 47,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab("send-to-one")}
              style={{
                height: 46,
                width: 168,
                backgroundColor: activeTab === "send-to-one" ? colors.bgCards : "transparent",
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope-Medium",
                  fontSize: 16,
                  color: colors.bodyText,
                }}
              >
                Send to One
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab("multi-send")}
              style={{
                height: 46,
                width: 168,
                backgroundColor: activeTab === "multi-send" ? colors.bgCards : "transparent",
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope-Medium",
                  fontSize: 16,
                  color: colors.bodyText,
                }}
              >
                Multi-Send
              </Text>
            </TouchableOpacity>
          </View>

          {/* Token Selector */}
          <View
            style={{
              width: "100%",
              alignItems: "flex-end",
            }}
          >
            <SendTokenSelector onTokenPress={openTokenSheet} />
          </View>
        </View>
      );
    } else if (currentStep === "enter-details") {
      if (activeTab === "send-to-one") {
        return <SendForm onNext={handleNextFromForm} />;
      } else {
        return <MultiSendForm onNext={handleNextFromForm} />;
      }
    } else if (currentStep === "review") {
      if (activeTab === "send-to-one") {
        return <SendReview onConfirm={handleConfirmFromReview} />;
      } else {
        return <MultiSendReview onConfirm={handleConfirmFromReview} />;
      }
    } else if (currentStep === "passcode") {
      return <PasscodeScreen onSuccess={handlePasscodeSuccess} />;
    }
    return null;
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Sticky Header */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
        }}
      >
        <WalletHeader
          walletAddress={WALLET_ADDRESS}
          onIrisScanPress={handleIrisScanPress}
          onSettingsPress={handleSettingsPress}
          showBackButton
          onBackPress={handleBackPress}
        />
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View className="flex-1" style={{ position: "relative" }}>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 18,
              paddingTop: 20,
              paddingBottom: currentStep === "select-asset" || currentStep === "review" ? 100 : 80, // Space for fixed button or white space below
              alignItems: "center",
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderContent()}
          </ScrollView>

        {/* Fixed Next Button at Bottom - show on select-asset and enter-details steps */}
        {(currentStep === "select-asset" || currentStep === "enter-details") && (
          <View
            style={{
              position: "absolute",
              bottom: (bottom || 16) + 32, // Add white space below button
              left: 0,
              right: 0,
              paddingHorizontal: 18,
              alignItems: "center",
              // backgroundColor: colors.bg,
              paddingTop: 16,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={currentStep === "select-asset" ? handleNextFromSelect : handleNextFromForm}
              disabled={
                currentStep === "select-asset"
                  ? !selectedToken
                  : activeTab === "send-to-one"
                  ? !(
                      sendStore.recipientAddress.trim().length > 0 &&
                      validateAddress(sendStore.recipientAddress, sendStore.selectedChain?.id).isValid &&
                      parseFloat(sendStore.amount) > 0 &&
                      validateAmount(sendStore.amount).isValid &&
                      sendStore.selectedToken
                    )
                  : !(
                      sendStore.recipients.length > 0 &&
                      validateAddresses(sendStore.recipients.map(r => r.address), sendStore.selectedChain?.id).isValid &&
                      parseFloat(sendStore.amountPerRecipient) > 0 &&
                      validateAmount(sendStore.amountPerRecipient).isValid &&
                      sendStore.selectedToken
                    )
              }
              style={{
                width: 353,
                height: 54,
                backgroundColor:
                  currentStep === "select-asset"
                    ? selectedToken
                      ? colors.primaryCTA
                      : colors.bgCards
                    : activeTab === "send-to-one"
                    ? sendStore.recipientAddress.trim().length > 0 &&
                      validateAddress(sendStore.recipientAddress, sendStore.selectedChain?.id).isValid &&
                      parseFloat(sendStore.amount) > 0 &&
                      validateAmount(sendStore.amount).isValid &&
                      sendStore.selectedToken
                      ? colors.primaryCTA
                      : colors.bgCards
                    : sendStore.recipients.length > 0 &&
                      validateAddresses(sendStore.recipients.map(r => r.address), sendStore.selectedChain?.id).isValid &&
                      parseFloat(sendStore.amountPerRecipient) > 0 &&
                      validateAmount(sendStore.amountPerRecipient).isValid &&
                      sendStore.selectedToken
                    ? colors.primaryCTA
                    : colors.bgCards,
                borderRadius: 100,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope-Medium",
                  fontSize: 16,
                  color:
                    currentStep === "select-asset"
                      ? selectedToken
                        ? colors.bg
                        : colors.bodyText
                      : activeTab === "send-to-one"
                      ? sendStore.recipientAddress.trim().length > 0 &&
                        validateAddress(sendStore.recipientAddress, sendStore.selectedChain?.id).isValid &&
                        parseFloat(sendStore.amount) > 0 &&
                        validateAmount(sendStore.amount).isValid &&
                        sendStore.selectedToken
                        ? colors.bg
                        : colors.bodyText
                      : sendStore.recipients.length > 0 &&
                        validateAddresses(sendStore.recipients.map(r => r.address), sendStore.selectedChain?.id).isValid &&
                        parseFloat(sendStore.amountPerRecipient) > 0 &&
                        validateAmount(sendStore.amountPerRecipient).isValid &&
                        sendStore.selectedToken
                      ? colors.bg
                      : colors.bodyText,
                }}
              >
                Next
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Fixed Confirm Button at Bottom - show on review step */}
        {currentStep === "review" && (
          <View
            style={{
              position: "absolute",
              bottom: (bottom || 16) + 32, // Add white space below button
              left: 0,
              right: 0,
              paddingHorizontal: 18,
              alignItems: "center",
              paddingTop: 16,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleConfirmFromReview}
              style={{
                width: 353,
                height: 54,
                backgroundColor: colors.primaryCTA,
                borderRadius: 100,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope-Medium",
                  fontSize: 16,
                  color: colors.bg,
                }}
              >
                {activeTab === "send-to-one" ? "Confirm" : "Confirm Multi-Send"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </KeyboardAvoidingView>

      {/* Token Selection Sheet */}
      <SendTokenSelectSheet
        visible={isTokenSheetVisible}
        onClose={closeTokenSheet}
        onSelect={handleTokenSelect}
      />
    </View>
  );
}


