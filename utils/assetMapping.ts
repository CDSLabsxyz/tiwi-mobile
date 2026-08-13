/**
 * Asset Mapping Utilities
 * Maps asset symbols/names to token and chain options for swap functionality
 * Production-ready mapping that uses chainId from asset data
 */

import type { ChainOption } from "@/components/sections/Swap/ChainSelectSheet";
import type { TokenOption } from "@/components/sections/Swap/TokenSelectSheet";
import type { AssetDetail, PortfolioItem } from "@/services/walletService";
import { normalizeTokenLogoUrl, resolveTokenLogo } from "@/utils/admin-token-logos";

const TWCIcon = require("@/assets/home/tiwicat-token.svg");
const USDCIcon = require("@/assets/home/coins-02.svg");
const TetherIcon = require("@/assets/home/coins-02-1.svg");
const BNBIcon = require("@/assets/home/coins-01.svg");
const EthereumIcon = require("@/assets/home/chains/ethereum.svg");
const AegisIcon = require("@/assets/home/chains/solana.svg");

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
  const chainId = typeof asset.chainId === 'number' ? asset.chainId : 56;
  const assetLogo = resolveTokenLogo({
    address: asset.address,
    chainId,
    logoURI: typeof asset.logo === 'string' ? asset.logo : undefined,
  }) || normalizeTokenLogoUrl(typeof asset.logo === 'string' ? asset.logo : undefined);
  const logoIcon = assetLogo ? { uri: assetLogo } : null;

  // Map common token symbols - use asset logo if available, otherwise use mapped icon
  const tokenMap: Record<string, Partial<TokenOption>> = {
    btc: {
      id: "btc",
      symbol: "BTC",
      name: "Bitcoin",
      icon: logoIcon || BNBIcon,
    },
    eth: {
      id: "eth",
      symbol: "ETH",
      name: "Ethereum",
      icon: logoIcon || EthereumIcon,
    },
    sol: {
      id: "sol",
      symbol: "SOL",
      name: "Solana",
      icon: logoIcon || AegisIcon,
    },
    bnb: {
      id: "bnb",
      symbol: "BNB",
      name: "BNB Smart Chain",
      icon: logoIcon || BNBIcon,
    },
    usdc: {
      id: "usdc",
      symbol: "USDC",
      name: "USDC",
      icon: logoIcon || USDCIcon,
    },
    tether: {
      id: "tether",
      symbol: "Tether",
      name: "Tether",
      icon: logoIcon || TetherIcon,
    },
    twc: {
      id: "twc",
      symbol: "TWC",
      name: "TWC",
      icon: logoIcon || TWCIcon,
    },
  };

  const tokenData = tokenMap[symbol] || tokenMap[name];

  if (!tokenData) {
    // Return a default token option if not found
    return {
      id: symbol,
      symbol: asset.symbol,
      name: asset.name,
      icon: logoIcon || TWCIcon,
      tvl: "$0",
      balanceFiat: usdValue,
      balanceToken: `${balance} ${asset.symbol}`,
      address: asset.address,
      chainId,
      decimals: asset.decimals,
    };
  }

  return {
    ...tokenData,
    address: asset.address || tokenData.address || '',
    decimals: asset.decimals || tokenData.decimals || ((asset.address || tokenData.address || '').toLowerCase() === '0xda1060158f7d593667cce0a15db346bb3ffb3596' ? 9 : 18),
    tvl: "$1,000,000",
    balanceFiat: usdValue,
    balanceToken: `${balance} ${tokenData.symbol || asset.symbol.toUpperCase()}`,
    chainId, // Default to BSC if not found
  } as TokenOption;
};

/**
 * Maps asset to chain option using chainId from asset data
 * Note: This returns a skeleton ChainOption that should be enriched by the UI
 * using the live chains API.
 */
export const mapAssetToChainOption = (
  asset: PortfolioItem | AssetDetail
): ChainOption => {
  const chainId = 'chainId' in asset && asset.chainId ? asset.chainId : 1; // Default to 1 (Ethereum)

  return {
    id: chainId,
    name: "Loading...",
    icon: null,
  };
};
