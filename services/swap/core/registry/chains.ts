/**
 * Chain Registry
 *
 * Single source of truth for chain identity and provider mappings.
 * This registry maps our canonical chain IDs to provider-specific identifiers.
 *
 * Canonical ID rules:
 * - EVM chains use their real EIP-155 chainId (universally recognized).
 * - Non-EVM chains use unique numeric IDs that do not collide with any EVM chainId.
 *   Existing canonical IDs (Solana 7565164, TON 1100, TRON 728126428, Cosmos 118,
 *   Osmosis 249339, Sui 101) are preserved for backward compatibility.
 *
 * providerIds are only populated for chains where the provider is known to support
 * the chain. New chains start empty - fill them in when wiring up the new router stack.
 */

import type { CanonicalChain } from '@/services/swap/core/registry/types';

// ============================================================================
// Chain Registry - 80 chains
// ============================================================================

export const CHAIN_REGISTRY: CanonicalChain[] = [
  // --------------------------------------------------------------------------
  // EVM Ecosystem (1–50)
  // --------------------------------------------------------------------------
  {
    id: 1,
    name: 'Ethereum',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {
      lifi: 1,
      dexscreener: 'ethereum',
      relay: 1,
      rubic: 1,
    },
  },
  {
    id: 56,
    name: 'BNB Chain',
    type: 'EVM',
    nativeCurrency: { symbol: 'BNB', decimals: 18 },
    providerIds: {
      lifi: 56,
      dexscreener: 'bsc',
      relay: 56,
      rubic: 56,
    },
  },
  {
    id: 137,
    name: 'Polygon',
    type: 'EVM',
    nativeCurrency: { symbol: 'POL', decimals: 18 },
    providerIds: {
      lifi: 137,
      dexscreener: 'polygon',
      relay: 137,
      rubic: 137,
    },
  },
  {
    id: 43114,
    name: 'Avalanche',
    type: 'EVM',
    nativeCurrency: { symbol: 'AVAX', decimals: 18 },
    providerIds: {
      lifi: 43114,
      dexscreener: 'avalanche',
      relay: 43114,
      rubic: 43114,
    },
  },
  {
    id: 42161,
    name: 'Arbitrum',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {
      lifi: 42161,
      dexscreener: 'arbitrum',
      relay: 42161,
      rubic: 42161,
    },
  },
  {
    id: 10,
    name: 'Optimism',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {
      lifi: 10,
      dexscreener: 'optimism',
      relay: 10,
      rubic: 10,
    },
  },
  {
    id: 8453,
    name: 'Base',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {
      lifi: 8453,
      dexscreener: 'base',
      relay: 8453,
      rubic: 8453,
    },
  },
  {
    id: 250,
    name: 'Fantom',
    type: 'EVM',
    nativeCurrency: { symbol: 'FTM', decimals: 18 },
    providerIds: {},
  },
  {
    id: 25,
    name: 'Cronos',
    type: 'EVM',
    nativeCurrency: { symbol: 'CRO', decimals: 18 },
    providerIds: {},
  },
  {
    id: 42220,
    name: 'Celo',
    type: 'EVM',
    nativeCurrency: { symbol: 'CELO', decimals: 18 },
    providerIds: {},
  },
  {
    id: 1284,
    name: 'Moonbeam',
    type: 'EVM',
    nativeCurrency: { symbol: 'GLMR', decimals: 18 },
    providerIds: {},
  },
  {
    id: 1285,
    name: 'Moonriver',
    type: 'EVM',
    nativeCurrency: { symbol: 'MOVR', decimals: 18 },
    providerIds: {},
  },
  {
    id: 2222,
    name: 'Kava',
    type: 'EVM',
    nativeCurrency: { symbol: 'KAVA', decimals: 18 },
    providerIds: {},
  },
  {
    id: 100,
    name: 'Gnosis',
    type: 'EVM',
    nativeCurrency: { symbol: 'xDAI', decimals: 18 },
    providerIds: {},
  },
  {
    id: 1313161554,
    name: 'Aurora',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 324,
    name: 'zkSync Era',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    // Starknet uses Cairo VM, not EVM. SN_MAIN network ID expressed as decimal.
    id: 23448594291968334,
    name: 'Starknet',
    type: 'Starknet',
    nativeCurrency: { symbol: 'STRK', decimals: 18 },
    metadata: { chainId: 'SN_MAIN' },
    providerIds: {},
  },
  {
    id: 59144,
    name: 'Linea',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 534352,
    name: 'Scroll',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 5000,
    name: 'Mantle',
    type: 'EVM',
    nativeCurrency: { symbol: 'MNT', decimals: 18 },
    providerIds: {},
  },
  {
    id: 81457,
    name: 'Blast',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 34443,
    name: 'Mode',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 1088,
    name: 'Metis',
    type: 'EVM',
    nativeCurrency: { symbol: 'METIS', decimals: 18 },
    providerIds: {},
  },
  {
    id: 169,
    name: 'Manta Pacific',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 13371,
    name: 'Immutable zkEVM',
    type: 'EVM',
    nativeCurrency: { symbol: 'IMX', decimals: 18 },
    providerIds: {},
  },
  {
    id: 2020,
    name: 'Ronin',
    type: 'EVM',
    nativeCurrency: { symbol: 'RON', decimals: 18 },
    providerIds: {},
  },
  {
    id: 1116,
    name: 'Core',
    type: 'EVM',
    nativeCurrency: { symbol: 'CORE', decimals: 18 },
    providerIds: {},
  },
  {
    id: 1329,
    name: 'Sei',
    type: 'EVM',
    nativeCurrency: { symbol: 'SEI', decimals: 18 },
    providerIds: { lifi: 1329, dexscreener: 'seiv2' },
  },
  // Additional EVM chains - native-currency data sourced from viem/chains so the
  // direct-RPC balance reader (see useWalletBalances) can cover them.
  // providerIds.lifi = the EVM chainId. Populated after verifying (2026-07) that
  // LiFi serves a token list for each - without it, resolveChain's static fast-path
  // returns the empty registry entry and shadows LiFi, so the selector showed no tokens.
  { id: 288, name: 'Boba Network', type: 'EVM', nativeCurrency: { symbol: 'ETH', decimals: 18 }, providerIds: { lifi: 288 } },
  { id: 42170, name: 'Arbitrum Nova', type: 'EVM', nativeCurrency: { symbol: 'ETH', decimals: 18 }, providerIds: { lifi: 42170 } },
  { id: 1135, name: 'Lisk', type: 'EVM', nativeCurrency: { symbol: 'ETH', decimals: 18 }, providerIds: { lifi: 1135 } },
  { id: 130, name: 'Unichain', type: 'EVM', nativeCurrency: { symbol: 'ETH', decimals: 18 }, providerIds: { lifi: 130, dexscreener: 'unichain' } },
  { id: 146, name: 'Sonic', type: 'EVM', nativeCurrency: { symbol: 'S', decimals: 18 }, providerIds: { lifi: 146, dexscreener: 'sonic' } },
  // Swellchain / Corn: no LiFi token list and no index platform - genuinely sourceless.
  { id: 1923, name: 'Swellchain', type: 'EVM', nativeCurrency: { symbol: 'ETH', decimals: 18 }, providerIds: {} },
  { id: 21000000, name: 'Corn', type: 'EVM', nativeCurrency: { symbol: 'BTCN', decimals: 18 }, providerIds: {} },
  { id: 2741, name: 'Abstract', type: 'EVM', nativeCurrency: { symbol: 'ETH', decimals: 18 }, providerIds: { lifi: 2741, dexscreener: 'abstract' } },
  { id: 33139, name: 'ApeChain', type: 'EVM', nativeCurrency: { symbol: 'APE', decimals: 18 }, providerIds: { lifi: 33139, dexscreener: 'apechain' } },
  { id: 43111, name: 'Hemi', type: 'EVM', nativeCurrency: { symbol: 'ETH', decimals: 18 }, providerIds: { lifi: 43111 } },
  { id: 57073, name: 'Ink', type: 'EVM', nativeCurrency: { symbol: 'ETH', decimals: 18 }, providerIds: { lifi: 57073, dexscreener: 'ink' } },
  { id: 80094, name: 'Berachain', type: 'EVM', nativeCurrency: { symbol: 'BERA', decimals: 18 }, providerIds: { lifi: 80094, dexscreener: 'berachain' } },
  { id: 747, name: 'Flow EVM', type: 'EVM', nativeCurrency: { symbol: 'FLOW', decimals: 18 }, providerIds: { lifi: 747, dexscreener: 'flowevm' } },
  { id: 747474, name: 'Katana', type: 'EVM', nativeCurrency: { symbol: 'ETH', decimals: 18 }, providerIds: { lifi: 747474, dexscreener: 'katana' } },
  { id: 999, name: 'HyperEVM', type: 'EVM', nativeCurrency: { symbol: 'HYPE', decimals: 18 }, providerIds: { lifi: 999, dexscreener: 'hyperevm' } },
  { id: 9745, name: 'Plasma', type: 'EVM', nativeCurrency: { symbol: 'XPL', decimals: 18 }, providerIds: { lifi: 9745, dexscreener: 'plasma' } },
  // Superposition: no LiFi token list and no index platform - genuinely sourceless.
  { id: 55244, name: 'Superposition', type: 'EVM', nativeCurrency: { symbol: 'ETH', decimals: 18 }, providerIds: {} },
  { id: 5031, name: 'Somnia', type: 'EVM', nativeCurrency: { symbol: 'SOMI', decimals: 18 }, providerIds: { lifi: 5031 } },
  { id: 1625, name: 'Gravity', type: 'EVM', nativeCurrency: { symbol: 'G', decimals: 18 }, providerIds: { lifi: 1625 } },
  { id: 1868, name: 'Soneium', type: 'EVM', nativeCurrency: { symbol: 'ETH', decimals: 18 }, providerIds: { lifi: 1868, dexscreener: 'soneium' } },
  { id: 98866, name: 'Plume', type: 'EVM', nativeCurrency: { symbol: 'PLUME', decimals: 18 }, providerIds: { lifi: 98866 } },
  {
    id: 1030,
    name: 'Conflux eSpace',
    type: 'EVM',
    nativeCurrency: { symbol: 'CFX', decimals: 18 },
    providerIds: {},
  },
  {
    id: 4689,
    name: 'IoTeX',
    type: 'EVM',
    nativeCurrency: { symbol: 'IOTX', decimals: 18 },
    providerIds: {},
  },
  {
    id: 30,
    name: 'Rootstock',
    type: 'EVM',
    nativeCurrency: { symbol: 'RBTC', decimals: 18 },
    providerIds: {},
  },
  {
    id: 50,
    name: 'XDC Network',
    type: 'EVM',
    nativeCurrency: { symbol: 'XDC', decimals: 18 },
    providerIds: {},
  },
  {
    id: 1101,
    name: 'Polygon zkEVM',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 167000,
    name: 'Taiko',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 7777777,
    name: 'Zora',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 252,
    name: 'Fraxtal',
    type: 'EVM',
    nativeCurrency: { symbol: 'frxETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 255,
    name: 'Kroma',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 60808,
    name: 'BOB',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 4200,
    name: 'Merlin Chain',
    type: 'EVM',
    nativeCurrency: { symbol: 'BTC', decimals: 18 },
    providerIds: {},
  },
  {
    id: 6001,
    name: 'BounceBit',
    type: 'EVM',
    nativeCurrency: { symbol: 'BB', decimals: 18 },
    providerIds: {},
  },
  {
    // Monad mainnet (chainId 143) - live; default tokens use verified addresses.
    id: 143,
    name: 'Monad',
    type: 'EVM',
    nativeCurrency: { symbol: 'MON', decimals: 18 },
    providerIds: {},
  },
  {
    // MegaETH - currently testnet (chainId 6342). Update when mainnet launches.
    id: 6342,
    name: 'MegaETH',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    metadata: { status: 'testnet' },
    providerIds: {},
  },
  {
    // Movement (chainId 30732) - EVM testnet; mainnet is Move-VM, not EVM.
    id: 30732,
    name: 'Movement',
    type: 'EVM',
    nativeCurrency: { symbol: 'MOVE', decimals: 18 },
    metadata: { status: 'testnet' },
    providerIds: {},
  },
  {
    id: 480,
    name: 'World Chain',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 232,
    name: 'Lens Chain',
    type: 'EVM',
    nativeCurrency: { symbol: 'GHO', decimals: 18 },
    providerIds: {},
  },
  {
    id: 2818,
    name: 'Morph',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 7560,
    name: 'Cyber',
    type: 'EVM',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    providerIds: {},
  },
  {
    id: 660279,
    name: 'Xai',
    type: 'EVM',
    nativeCurrency: { symbol: 'XAI', decimals: 18 },
    providerIds: {},
  },
  {
    id: 248,
    name: 'Oasys',
    type: 'EVM',
    nativeCurrency: { symbol: 'OAS', decimals: 18 },
    providerIds: {},
  },
  {
    id: 88,
    name: 'Viction',
    type: 'EVM',
    nativeCurrency: { symbol: 'VIC', decimals: 18 },
    providerIds: {},
  },
  {
    // SKALE Europa Hub (chainId 2046399126) - primary SKALE hub.
    id: 2046399126,
    name: 'SKALE Europa',
    type: 'EVM',
    nativeCurrency: { symbol: 'sFUEL', decimals: 18 },
    providerIds: {},
  },

  // --------------------------------------------------------------------------
  // Cosmos Ecosystem (51–65)
  // --------------------------------------------------------------------------
  {
    id: 118,
    name: 'Cosmos Hub',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'ATOM', decimals: 6 },
    metadata: { chainId: 'cosmoshub-4' },
    providerIds: {
      lifi: 'cosmoshub-4',
      dexscreener: 'cosmos',
      squid: 'cosmoshub-4',
      rubic: 'cosmos',
    },
  },
  {
    id: 8000001,
    name: 'Injective',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'INJ', decimals: 18 },
    metadata: { chainId: 'injective-1' },
    providerIds: {},
  },
  {
    id: 8000002,
    name: 'THORChain',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'RUNE', decimals: 8 },
    metadata: { chainId: 'thorchain-1' },
    providerIds: {},
  },
  {
    id: 249339,
    name: 'Osmosis',
    type: 'Osmosis',
    nativeCurrency: { symbol: 'OSMO', decimals: 6 },
    metadata: { chainId: 'osmosis-1' },
    providerIds: {},
  },
  {
    id: 8000003,
    name: 'Juno',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'JUNO', decimals: 6 },
    metadata: { chainId: 'juno-1' },
    providerIds: {},
  },
  {
    id: 8000004,
    name: 'Stride',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'STRD', decimals: 6 },
    metadata: { chainId: 'stride-1' },
    providerIds: {},
  },
  {
    id: 8000005,
    name: 'dYdX',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'DYDX', decimals: 18 },
    metadata: { chainId: 'dydx-mainnet-1' },
    providerIds: {},
  },
  {
    id: 8000006,
    name: 'Kujira',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'KUJI', decimals: 6 },
    metadata: { chainId: 'kaiyo-1' },
    providerIds: {},
  },
  {
    // Evmos uses its EVM chainId (dual-stack EVM/Cosmos).
    id: 9001,
    name: 'Evmos',
    type: 'EVM',
    nativeCurrency: { symbol: 'EVMOS', decimals: 18 },
    metadata: { chainId: 'evmos_9001-2' },
    providerIds: {},
  },
  {
    id: 8000007,
    name: 'Secret',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'SCRT', decimals: 6 },
    metadata: { chainId: 'secret-4' },
    providerIds: {},
  },
  {
    id: 8000008,
    name: 'Celestia',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'TIA', decimals: 6 },
    metadata: { chainId: 'celestia' },
    providerIds: {},
  },
  {
    id: 8000009,
    name: 'Archway',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'ARCH', decimals: 18 },
    metadata: { chainId: 'archway-1' },
    providerIds: {},
  },
  {
    id: 8000010,
    name: 'Saga',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'SAGA', decimals: 6 },
    metadata: { chainId: 'ssc-1' },
    providerIds: {},
  },
  {
    id: 8000011,
    name: 'Neutron',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'NTRN', decimals: 6 },
    metadata: { chainId: 'neutron-1' },
    providerIds: {},
  },
  {
    id: 8000012,
    name: 'Nibiru',
    type: 'Cosmos',
    nativeCurrency: { symbol: 'NIBI', decimals: 6 },
    metadata: { chainId: 'cataclysm-1' },
    providerIds: {},
  },

  // --------------------------------------------------------------------------
  // Solana Ecosystem (66)
  // --------------------------------------------------------------------------
  {
    id: 7565164,
    name: 'Solana',
    type: 'Solana',
    nativeCurrency: { symbol: 'SOL', decimals: 9 },
    providerIds: {
      lifi: 1151111081099710,  // LiFi's special Solana ID
      dexscreener: 'solana',
      relay: 792703809,         // Relay's Solana ID
      rubic: 'solana',
      squid: 'solana-mainnet-beta',
    },
  },

  // --------------------------------------------------------------------------
  // Bitcoin / UTXO Ecosystem (67–75)
  // Canonical IDs derived from each network's default RPC/P2P port.
  // --------------------------------------------------------------------------
  {
    id: 8332,
    name: 'Bitcoin',
    type: 'Bitcoin',
    nativeCurrency: { symbol: 'BTC', decimals: 8 },
    providerIds: {},
  },
  {
    id: 9332,
    name: 'Litecoin',
    type: 'Bitcoin',
    nativeCurrency: { symbol: 'LTC', decimals: 8 },
    providerIds: {},
  },
  {
    id: 22555,
    name: 'Dogecoin',
    type: 'Bitcoin',
    nativeCurrency: { symbol: 'DOGE', decimals: 8 },
    providerIds: {},
  },
  {
    id: 8338,
    name: 'Bitcoin Cash',
    type: 'Bitcoin',
    nativeCurrency: { symbol: 'BCH', decimals: 8 },
    providerIds: {},
  },
  {
    id: 20443,
    name: 'Stacks',
    type: 'Bitcoin',
    nativeCurrency: { symbol: 'STX', decimals: 6 },
    providerIds: {},
  },
  {
    id: 16110,
    name: 'Kaspa',
    type: 'Bitcoin',
    nativeCurrency: { symbol: 'KAS', decimals: 8 },
    providerIds: {},
  },
  {
    id: 8114,
    name: 'Nervos Network',
    type: 'Bitcoin',
    nativeCurrency: { symbol: 'CKB', decimals: 8 },
    providerIds: {},
  },

  // --------------------------------------------------------------------------
  // Other Major Ecosystems (76–80)
  // --------------------------------------------------------------------------
  {
    id: 354,
    name: 'Polkadot',
    type: 'Polkadot',
    nativeCurrency: { symbol: 'DOT', decimals: 10 },
    providerIds: {},
  },
  {
    id: 101,
    name: 'Sui',
    type: 'Sui',
    nativeCurrency: { symbol: 'SUI', decimals: 9 },
    metadata: { chainId: 'sui:mainnet' },
    providerIds: {},
  },
  {
    id: 637,
    name: 'Aptos',
    type: 'Aptos',
    nativeCurrency: { symbol: 'APT', decimals: 8 },
    providerIds: {},
  },
  {
    id: 1100,
    name: 'TON',
    type: 'TON',
    nativeCurrency: { symbol: 'TON', decimals: 9 },
    logoURI: 'https://assets.coingecko.com/coins/images/17980/standard/ton_symbol.png',
    providerIds: {
      lifi: 'ton',
      dexscreener: 'ton',
      rubic: 'ton',
    },
  },
  {
    id: 728126428,
    name: 'TRON',
    type: 'TRON',
    nativeCurrency: { symbol: 'TRX', decimals: 6 },
    logoURI: 'https://assets.coingecko.com/coins/images/1094/standard/tron-logo.png',
    providerIds: {
      lifi: 'tron',
      dexscreener: 'tron',
      rubic: 'tron',
    },
  },
];

// ============================================================================
// Lookup Functions
// ============================================================================

/**
 * Get canonical chain by our internal chain ID
 */
export function getCanonicalChain(chainId: number): CanonicalChain | null {
  return CHAIN_REGISTRY.find(chain => chain.id === chainId) || null;
}

/**
 * Get canonical chain by provider-specific chain ID
 */
export function getCanonicalChainByProviderId(
  provider: 'lifi' | 'dexscreener' | 'relay' | 'squid' | 'rubic',
  providerChainId: string | number
): CanonicalChain | null {
  return CHAIN_REGISTRY.find(chain => {
    const providerId = chain.providerIds[provider];
    if (providerId === null || providerId === undefined) return false;
    return String(providerId).toLowerCase() === String(providerChainId).toLowerCase();
  }) || null;
}

/**
 * Get all canonical chains
 */
export function getCanonicalChains(): CanonicalChain[] {
  return CHAIN_REGISTRY;
}

/**
 * Chain lifecycle statuses that should be hidden from user-facing chain lists
 * (token selector, network pickers, portfolio universe). These chains have no
 * real, swappable tokens yet. Flip the chain's metadata.status in the registry
 * to bring it back once mainnet launches.
 */
const HIDDEN_CHAIN_STATUSES = new Set(['testnet', 'pre-mainnet']);

/**
 * Live mainnet chains that have NO token source (no provider token list and no
 * index platform coverage as of 2026-07), so selecting them renders an empty
 * token list. Hidden from user-facing chain lists until a source exists - remove
 * the id here once the chain is wired to LiFi/CoinGecko/GeckoTerminal/etc.
 */
const HIDDEN_CHAIN_IDS = new Set<number>([
  660279,   // Xai - CoinGecko has no matching platform; GeckoTerminal 'xai' indexes 0 pools
  1923,     // Swellchain - no LiFi token list, no index platform
  21000000, // Corn - no LiFi token list, no index platform
  55244,    // Superposition - no LiFi token list, no index platform
  9332,     // Litecoin - UTXO, no contract-token standard
  354,      // Polkadot - no CoinGecko/GeckoTerminal contract-token platform
  8000002,  // THORChain - native RUNE only, no contract tokens
]);

/**
 * True if the chain is live on mainnet and safe to show to users.
 */
export function isChainLive(chain: CanonicalChain): boolean {
  if (HIDDEN_CHAIN_IDS.has(chain.id)) return false;
  return !HIDDEN_CHAIN_STATUSES.has(chain.metadata?.status as string);
}

/**
 * Canonical chains minus the not-yet-live (testnet / pre-mainnet) ones.
 * Use this anywhere a chain list is surfaced to users.
 */
export function getLiveChains(): CanonicalChain[] {
  return CHAIN_REGISTRY.filter(isChainLive);
}

/**
 * Get chain badge identifier for UI display
 * Format: "{type}-{name}" (e.g., "evm-ethereum", "solana-mainnet")
 */
export function getChainBadge(chain: CanonicalChain): string {
  const typePrefix = chain.type.toLowerCase();
  const nameSlug = chain.name.toLowerCase().replace(/\s+/g, '-');
  return `${typePrefix}-${nameSlug}`;
}
