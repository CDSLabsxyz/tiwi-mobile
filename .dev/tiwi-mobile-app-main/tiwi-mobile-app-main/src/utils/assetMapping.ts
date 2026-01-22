/**
 * Asset Mapping Utilities
 * Maps asset symbols/names to token and chain options for swap functionality
 * Production-ready mapping that uses chainId from asset data
 */

import type { TokenOption } from "@/components/sections/Swap/TokenSelectSheet";
import type { ChainOption } from "@/components/sections/Swap/ChainSelectSheet";
import type { PortfolioItem, AssetDetail } from "@/services/walletService";
import { getChainOptionWithFallback } from "./chainUtils";

const TWCIcon = require("@/assets/home/tiwicat-token.svg");
const USDCIcon = require("@/assets/home/coins-02.svg");
const TetherIcon = require("@/assets/home/coins-02-1.svg");
const BNBIcon = require("@/assets/home/coins-01.svg");
const EthereumIcon = require("@/assets/home/chains/ethereum.svg");
const ApexIcon = require("@/assets/home/chains/near.svg");
const VerdantIcon = require("@/assets/home/chains/polygon.svg");
const AegisIcon = require("@/assets/home/chains/solana.svg");
const CortexIcon = require("@/assets/home/chains/avalanche.svg");

/**
 * Maps asset symbol to token option
 */
export const mapAssetToTokenOption = (
  asset: PortfolioItem | AssetDetail,
  balance: string,
  usdValue: string
): TokenOption | null => {
  const symbol = asset.symbol.toLowerCase();
  const name = asset.name.toLowerCase();

  // Map common token symbols - use asset logo if available, otherwise use mapped icon
  const tokenMap: Record<string, Partial<TokenOption>> = {
    btc: {
      id: "btc",
      symbol: "BTC",
      name: "Bitcoin",
      icon: asset.logo ? { uri: asset.logo } : BNBIcon,
    },
    eth: {
      id: "eth",
      symbol: "ETH",
      name: "Ethereum",
      icon: asset.logo ? { uri: asset.logo } : EthereumIcon,
    },
    sol: {
      id: "sol",
      symbol: "SOL",
      name: "Solana",
      icon: asset.logo ? { uri: asset.logo } : AegisIcon,
    },
    bnb: {
      id: "bnb",
      symbol: "BNB",
      name: "BNB Smart Chain",
      icon: asset.logo ? { uri: asset.logo } : BNBIcon,
    },
    usdc: {
      id: "usdc",
      symbol: "USDC",
      name: "USDC",
      icon: asset.logo ? { uri: asset.logo } : USDCIcon,
    },
    tether: {
      id: "tether",
      symbol: "Tether",
      name: "Tether",
      icon: asset.logo ? { uri: asset.logo } : TetherIcon,
    },
    twc: {
      id: "twc",
      symbol: "TWC",
      name: "TWC",
      icon: asset.logo ? { uri: asset.logo } : TWCIcon,
    },
  };

  const tokenData = tokenMap[symbol] || tokenMap[name];

  if (!tokenData) {
    // Return a default token option if not found
    return {
      id: symbol,
      symbol: asset.symbol,
      name: asset.name,
      icon: asset.logo ? { uri: asset.logo } : TWCIcon,
      tvl: "$0",
      balanceFiat: usdValue,
      balanceToken: `${balance} ${asset.symbol}`,
    };
  }

  return {
    ...tokenData,
    tvl: "$1,000,000",
    balanceFiat: usdValue,
    balanceToken: `${balance} ${tokenData.symbol || asset.symbol.toUpperCase()}`,
  } as TokenOption;
};

/**
 * Maps asset to chain option using chainId from asset data
 * Production-ready function that uses the chainId field from the asset
 * Falls back to inference if chainId is not available (for backward compatibility)
 */
export const mapAssetToChainOption = (
  asset: PortfolioItem | AssetDetail
): ChainOption | null => {
  // Priority 1: Use chainId from asset data (production-ready approach)
  if ('chainId' in asset && asset.chainId) {
    return getChainOptionWithFallback(asset.chainId);
  }

  // Priority 2: Fallback to inference (for backward compatibility)
  // This should not be needed in production, but kept for safety
  const name = asset.name.toLowerCase();
  const symbol = asset.symbol.toLowerCase();

  // Map asset names and symbols to chains (fallback only)
  const chainMap: Record<string, ChainId> = {
    bitcoin: "ethereum",
    btc: "ethereum",
    ethereum: "ethereum",
    eth: "ethereum",
    solana: "aegis",
    sol: "aegis",
    "bnb smart chain": "apex",
    bnb: "apex",
    usdc: "ethereum",
    tether: "ethereum",
    twc: "ethereum",
  };

  // Check symbol first (more specific)
  if (chainMap[symbol]) {
    return getChainOptionWithFallback(chainMap[symbol]);
  }

  // Check for exact name match
  if (chainMap[name]) {
    return getChainOptionWithFallback(chainMap[name]);
  }

  // Check for partial matches in name
  for (const [key, chainId] of Object.entries(chainMap)) {
    if (name.includes(key) || key.includes(name)) {
      return getChainOptionWithFallback(chainId);
    }
  }

  // Default to Ethereum
  return getChainOptionWithFallback("ethereum");
};

