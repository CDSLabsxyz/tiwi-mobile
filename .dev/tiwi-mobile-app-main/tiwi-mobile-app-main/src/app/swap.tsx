import React, { useState } from "react";
import { View, ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { StatusBar } from "@/components/ui/StatusBar";
import { WalletModal } from "@/components/ui/WalletModal";
import { colors } from "@/theme";
import {
  SwapHeader,
  SwapTabs,
  ChainSelectorCard,
  SwapTokenCard,
  SwapDirectionButton,
  SwapConfirmButton,
  ChainSelectSheet,
  TokenSelectSheet,
  SwapLoadingOverlay,
  SwapSuccessModal,
  SwapDetailsCard,
  LimitWhenPriceCard,
  ExpiresSection,
} from "@/components/sections/Swap";
import { WALLET_ADDRESS } from "@/utils/wallet";
import type { ChainOption } from "@/components/sections/Swap/ChainSelectSheet";
import type { TokenOption } from "@/components/sections/Swap/TokenSelectSheet";
import { executeSwap } from "@/services/swapService";
import { useSwapStore, useUIStore } from "@/store";
import { useSwapQuote } from "@/hooks";

export default function SwapScreen() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  // Zustand stores
  const swapState = useSwapStore();
  const { isWalletModalVisible, openWalletModal, closeWalletModal } = useUIStore();
  const { isLoading: isLoadingQuote } = useSwapQuote();

  // Local state only for swap execution UI feedback
  const [isLoadingSwap, setIsLoadingSwap] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

  // Handlers - simple wrappers that call store actions
  const handleFromAmountChange = (value: string) => {
    swapState.setFromAmount(value);
  };

  const handleSwapDirection = () => {
    swapState.swapDirection();
  };

  const handleWalletPress = () => {
    openWalletModal();
  };

  const handleCloseWalletModal = () => {
    closeWalletModal();
  };

  const handleHistoryPress = () => {
    closeWalletModal();
    router.push("/wallet" as any);
  };

  const handleSettingsPress = () => {
    closeWalletModal();
    const currentRoute = pathname || "/swap";
    router.push(`/settings?returnTo=${encodeURIComponent(currentRoute)}` as any);
  };

  const handleDisconnectPress = () => {
    closeWalletModal();
    // Future: add disconnect logic
  };

  const handleFromTokenPress = () => {
    swapState.openChainSheet("from");
  };

  const handleToTokenPress = () => {
    swapState.openChainSheet("to");
  };

  const handleWhenPriceTokenPress = () => {
    // For when price, we use the same chain as fromChain, so go directly to token selection
    swapState.openTokenSheet("whenPrice");
  };

  const handleWhenPriceAmountChange = (value: string) => {
    swapState.setWhenPrice(value);
  };

  const handleChainSelect = (option: ChainOption) => {
    const currentTarget = swapState.chainSheetTarget;
    
    // For "whenPrice", we don't need to set a chain (it uses the same chain as the swap)
    if (currentTarget === "whenPrice") {
      swapState.closeChainSheet();
      setTimeout(() => {
        swapState.openTokenSheet("whenPrice");
      }, 200);
      return;
    }
    
    // Set chain based on target
    if (currentTarget === "from") {
      swapState.setFromChain(option);
    } else {
      swapState.setToChain(option);
    }
    
    swapState.closeChainSheet();
    
    // Small delay to ensure state is set before opening token sheet
    setTimeout(() => {
      swapState.openTokenSheet(currentTarget);
    }, 200);
  };

  const handleTokenSelect = (token: TokenOption) => {
    const currentTarget = swapState.tokenSheetTarget;
    
    if (currentTarget === "from") {
      swapState.setFromToken(token);
    } else if (currentTarget === "to") {
      swapState.setToToken(token);
    } else if (currentTarget === "whenPrice") {
      swapState.setWhenPriceToken(token);
    } else {
      // Fallback: default to "from"
      swapState.setFromToken(token);
    }
    
    swapState.closeTokenSheet();
  };

  const handleConfirmSwap = async () => {
    if (!swapState.isFormValid() || !swapState.fromToken) return;

    // Require TO token for actual swap execution
    if (!swapState.toToken) {
      console.warn("TO token must be selected for swap");
      return;
    }

    setIsLoadingSwap(true);

    try {
      await executeSwap(
        swapState.fromAmount,
        swapState.fromToken.id,
        swapState.toToken.id
      );

      setIsLoadingSwap(false);
      setIsSuccessModalVisible(true);
    } catch (error) {
      console.error("Swap failed:", error);
      setIsLoadingSwap(false);
      // TODO: Show error toast/modal
    }
  };

  const handleSuccessDone = () => {
    setIsSuccessModalVisible(false);
    swapState.resetSwapState();
    router.push("/wallet" as any);
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.bg }}
    >
      <StatusBar />

      <View className="flex-1">
        {/* Wallet modal used across screens */}
        <WalletModal
          visible={isWalletModalVisible}
          onClose={handleCloseWalletModal}
          walletAddress={WALLET_ADDRESS}
          onHistoryPress={handleHistoryPress}
          onSettingsPress={handleSettingsPress}
          onDisconnectPress={handleDisconnectPress}
        />

        {/* Chain selection sheet */}
        <ChainSelectSheet
          visible={swapState.isChainSheetVisible}
          selectedChainId={
            swapState.chainSheetTarget === "from"
              ? swapState.fromChain?.id || null
              : swapState.chainSheetTarget === "to"
              ? swapState.toChain?.id || null
              : swapState.fromChain?.id || null
          }
          onSelect={handleChainSelect}
          onClose={swapState.closeChainSheet}
        />

        {/* Token selection sheet */}
        <TokenSelectSheet
          visible={swapState.isTokenSheetVisible}
          chainId={
            swapState.tokenSheetTarget === "from"
              ? swapState.fromChain?.id || null
              : swapState.tokenSheetTarget === "to"
              ? swapState.toChain?.id || null
              : swapState.fromChain?.id || null
          }
          selectedTokenId={
            swapState.tokenSheetTarget === "from"
              ? swapState.fromToken?.id || null
              : swapState.tokenSheetTarget === "to"
              ? swapState.toToken?.id || null
              : swapState.whenPriceToken?.id || null
          }
          onClose={swapState.closeTokenSheet}
          onSelect={handleTokenSelect}
        />

        {/* Loading overlay for swap confirmation */}
        <SwapLoadingOverlay visible={isLoadingSwap} />

        {/* Success modal */}
        <SwapSuccessModal
          visible={isSuccessModalVisible}
          onDone={handleSuccessDone}
          activeTab={swapState.activeTab}
        />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
            alignItems: "center",
            paddingBottom: (bottom || 16) + 76 + 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          <SwapHeader onWalletPress={handleWalletPress} />
          <SwapTabs activeTab={swapState.activeTab} onChange={swapState.setActiveTab} />

          <View className="mt-8" />
          <ChainSelectorCard
            chainName={swapState.fromChain?.name || "Select Chain"}
            chainIcon={swapState.fromChain?.icon || require("@/assets/home/chains/ethereum.svg")}
            onPress={handleFromTokenPress}
          />

          {/* Token section label */}
          <View
            style={{
              width: 353,
              marginBottom: 16,
              marginTop: 32,
        }}
      >
        <Text
          style={{
                fontFamily: "Manrope-Medium",
                fontSize: 14,
            color: colors.titleText,
                lineHeight: 14,
          }}
        >
              Token
        </Text>
          </View>

          {/* From / To cards container - matches Figma grid structure exactly */}
          {/* Figma structure: grid container with From (h-[96.232px]), To (mt-[101px]), direction button (ml-[165px] mt-[82px]) */}
          <View
            style={{
              width: 353,
              position: "relative",
            }}
          >
            {/* From card - normal flow, height ~96.232px */}
            <SwapTokenCard
              variant="from"
              tokenSelected={!!swapState.fromToken}
              tokenSymbol={swapState.fromToken.symbol}
              tokenChain={swapState.fromChain?.name || "Select Chain"}
              tokenIcon={swapState.fromToken.icon}
              chainBadgeIcon={swapState.fromChain?.icon || require("@/assets/home/chains/ethereum.svg")}
              amount={swapState.fromAmount}
              fiatAmount="$0"
              balanceText={swapState.fromToken.balanceToken || `0.00 ${swapState.fromToken.symbol}`}
              onAmountChange={handleFromAmountChange}
              onTokenPress={handleFromTokenPress}
              isLoadingQuote={false}
            />

            {/* To card - positioned with exact Figma spacing: mt-[101px] from grid top */}
            {/* Since From card is in normal flow, we calculate: 101px - From card height = gap */}
            {/* From card height is approximately 96.232px, so gap = 101 - 96.232 = 4.768px */}
            {/* But to match Figma exactly, we use marginTop: 101 - (From card actual height) */}
            {/* For simplicity and visual match, using a calculated gap that results in To card at 101px from container top */}
            <View
              style={{
                marginTop: 4.768, // 101 - 96.232 = exact gap to position To card at 101px from container
              }}
            >
              <SwapTokenCard
                variant="to"
                tokenSelected={!!swapState.toToken}
                tokenSymbol={swapState.toToken?.symbol}
                tokenChain={swapState.toChain?.name}
                tokenIcon={swapState.toToken?.icon}
                chainBadgeIcon={swapState.toChain?.icon}
                amount={swapState.toAmount}
                fiatAmount={swapState.toFiatAmount}
                balanceText={swapState.toToken ? `0.00 ${swapState.toToken.symbol}` : "0.00"}
                onAmountChange={() => {}} // TO card is read-only, no-op handler
                onTokenPress={handleToTokenPress}
                isLoadingQuote={isLoadingQuote}
              />
            </View>

            {/* Direction button - absolute positioned: ml-[165px] mt-[82px] from container */}
            <SwapDirectionButton onPress={handleSwapDirection} />
          </View>

          {/* Limit tab specific: When Price card */}
          {swapState.activeTab === "limit" && (
            <View style={{ marginTop: 6, width: 353, alignSelf: "center" }}>
              <LimitWhenPriceCard
                tokenSymbol={swapState.whenPriceToken?.symbol}
                tokenSelected={!!swapState.whenPriceToken}
                tokenIcon={swapState.whenPriceToken?.icon}
                amount={swapState.whenPrice}
                fiatAmount="$0"
                balanceText={swapState.whenPriceToken ? `0.00 ${swapState.whenPriceToken.symbol}` : "0.00"}
                onAmountChange={handleWhenPriceAmountChange}
                onTokenPress={handleWhenPriceTokenPress}
              />
            </View>
          )}

          {/* Swap Details Card - Always visible */}
          <SwapDetailsCard
            gasFee={swapState.swapQuote?.gasFee}
            slippageTolerance={swapState.swapQuote?.slippage}
            twcFee={swapState.swapQuote?.twcFee}
            source={swapState.swapQuote?.source}
            isLoading={isLoadingQuote}
          />

          {/* Limit tab specific: Expires section */}
          {swapState.activeTab === "limit" && (
            <View style={{ marginTop: 16, width: 353, alignSelf: "center" }}>
              <ExpiresSection
                selectedOption={swapState.expiresOption}
                onSelect={swapState.setExpiresOption}
              />
            </View>
          )}

          {/* Confirm button inside scroll flow to avoid overlapping content */}
          <View style={{ height: 32 }} />
          <SwapConfirmButton
            disabled={!swapState.isFormValid() || isLoadingSwap}
            loading={isLoadingSwap}
            onPress={handleConfirmSwap}
            activeTab={swapState.activeTab}
            hasValidQuote={swapState.hasValidQuote()}
          />
      </ScrollView>
      </View>
    </View>
  );
}

