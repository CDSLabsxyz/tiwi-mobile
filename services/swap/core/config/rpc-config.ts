/**
 * RPC Configuration for all supported chains.
 * 
 * Uses Alchemy RPC URLs for reliable connections with proper timeouts.
 * Can be overridden via environment variables.
 */

/**
 * Chain ID to RPC URL mapping.
 * Supports environment variable overrides.
 * 
 * IMPORTANT: Uses NEXT_PUBLIC_ prefix for client-side access in browser.
 */
export const RPC_CONFIG: Record<number, string[]> = {
  // Ethereum Mainnet (1)
  1: [
    process.env.EXPO_PUBLIC_ETH_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    'https://ethereum-rpc.publicnode.com', // reliable CORS-friendly fallback (the shared Alchemy key is rate-limited)
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth'
  ],

  // Arbitrum One (42161)
  42161: [
    process.env.EXPO_PUBLIC_ARBITRUM_RPC_URL || 'https://arb-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    'https://arbitrum-one-rpc.publicnode.com', // reliable fallback (shared Alchemy key rate-limited)
    'https://arb1.arbitrum.io/rpc',
    'https://rpc.ankr.com/arbitrum'
  ],

  // Optimism (10)
  10: [
    process.env.EXPO_PUBLIC_OPTIMISM_RPC_URL || 'https://opt-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    'https://optimism-rpc.publicnode.com', // reliable fallback (shared Alchemy key rate-limited)
    'https://mainnet.optimism.io',
    'https://rpc.ankr.com/optimism'
  ],

  // Polygon (137)
  137: [
    process.env.EXPO_PUBLIC_POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    'https://polygon-bor-rpc.publicnode.com', // reliable fallback (shared Alchemy key rate-limited)
    'https://polygon-rpc.com',
    'https://rpc.ankr.com/polygon'
  ],

  // Base (8453)
  8453: [
    process.env.EXPO_PUBLIC_BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    'https://base-rpc.publicnode.com', // reliable fallback (shared Alchemy key rate-limited)
    'https://mainnet.base.org',
    'https://rpc.ankr.com/base'
  ],

  // BSC / Binance Smart Chain (56)
  // Note: bsc-dataseed.binance.org is CORS-blocked in browsers - do not add back.
  // llamarpc has been intermittently unreachable from browsers - keep publicnode as primary.
  56: [
    process.env.EXPO_PUBLIC_BSC_RPC_URL || 'https://bsc-rpc.publicnode.com',
    'https://bsc.drpc.org',
    'https://binance.llamarpc.com',
    'https://rpc.ankr.com/bsc',
    'https://56.rpc.thirdweb.com'
  ],

  // --------------------------------------------------------------------------
  // Additional EVM chains (public, CORS-friendly endpoints). Used by features
  // like multi-send that need to reach any listed EVM chain, not just the six
  // primaries above. Prefer publicnode / drpc which expose permissive CORS.
  // --------------------------------------------------------------------------

  // Avalanche C-Chain (43114)
  43114: ['https://avalanche-c-chain-rpc.publicnode.com', 'https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.drpc.org'],
  // Fantom (250)
  250: ['https://fantom-rpc.publicnode.com', 'https://rpc.ftm.tools', 'https://fantom.drpc.org'],
  // Celo (42220)
  42220: ['https://celo-rpc.publicnode.com', 'https://forno.celo.org', 'https://celo.drpc.org'],
  // Gnosis (100)
  100: ['https://gnosis-rpc.publicnode.com', 'https://rpc.gnosischain.com', 'https://gnosis.drpc.org'],
  // Cronos (25)
  25: ['https://cronos-evm-rpc.publicnode.com', 'https://evm.cronos.org', 'https://cronos.drpc.org'],
  // Linea (59144)
  59144: ['https://linea-rpc.publicnode.com', 'https://rpc.linea.build', 'https://linea.drpc.org'],
  // Scroll (534352)
  534352: ['https://scroll-rpc.publicnode.com', 'https://rpc.scroll.io', 'https://scroll.drpc.org'],
  // Blast (81457)
  81457: ['https://blast-rpc.publicnode.com', 'https://rpc.blast.io', 'https://blast.drpc.org'],
  // zkSync Era (324)
  324: ['https://mainnet.era.zksync.io', 'https://zksync.drpc.org'],
  // Mantle (5000)
  5000: ['https://mantle-rpc.publicnode.com', 'https://rpc.mantle.xyz', 'https://mantle.drpc.org'],
  // Polygon zkEVM (1101)
  1101: ['https://polygon-zkevm-rpc.publicnode.com', 'https://zkevm-rpc.com', 'https://polygon-zkevm.drpc.org'],
  // Moonbeam (1284)
  1284: ['https://moonbeam-rpc.publicnode.com', 'https://rpc.api.moonbeam.network', 'https://moonbeam.drpc.org'],
  // Moonriver (1285)
  1285: ['https://moonriver-rpc.publicnode.com', 'https://rpc.api.moonriver.moonbeam.network', 'https://moonriver.drpc.org'],
  // Metis (1088)
  1088: ['https://metis-rpc.publicnode.com', 'https://andromeda.metis.io/?owner=1088', 'https://metis.drpc.org'],
  // Mode (34443)
  34443: ['https://mode-rpc.publicnode.com', 'https://mainnet.mode.network', 'https://mode.drpc.org'],
  // Manta Pacific (169)
  169: ['https://pacific-rpc.manta.network/http', 'https://manta-pacific.drpc.org'],
  // Aurora (1313161554)
  1313161554: ['https://mainnet.aurora.dev', 'https://aurora.drpc.org'],
  // Taiko (167000)
  167000: ['https://rpc.mainnet.taiko.xyz', 'https://taiko.drpc.org'],
  // Zora (7777777)
  7777777: ['https://rpc.zora.energy', 'https://zora.drpc.org'],
  // World Chain (480)
  480: ['https://worldchain-mainnet.g.alchemy.com/public', 'https://worldchain.drpc.org'],
  // Core (1116)
  1116: ['https://rpc.coredao.org', 'https://core.drpc.org'],
  // Sei EVM / Pacific (1329)
  1329: ['https://evm-rpc.sei-apis.com', 'https://sei.drpc.org'],
  // Solana mainnet (synthetic chainId 7565164). dRPC (via getDrpcUrl) is prepended as primary
  // when dRPC_API_Key is set; this public endpoint is the fallback (rate-limited under load).
  7565164: ['https://api.mainnet-beta.solana.com'],
  // --- Additional EVM chains (dRPC public endpoint preferred - CORS-friendly -
  //     with the official RPC as fallback). Native data lives in the registry. ---
  255: ['https://kroma.drpc.org', 'https://api.kroma.network'],                         // Kroma
  4200: ['https://merlin.drpc.org', 'https://rpc.merlinchain.io'],                      // Merlin Chain
  2818: ['https://morph.drpc.org', 'https://rpc.morphl2.io'],                           // Morph
  660279: ['https://xai.drpc.org', 'https://xai-chain.net/rpc'],                        // Xai
  248: ['https://oasys.drpc.org', 'https://rpc.mainnet.oasys.games'],                   // Oasys
  88: ['https://viction.drpc.org', 'https://rpc.viction.xyz'],                          // Viction
  6001: ['https://fullnode-mainnet.bouncebitapi.com'],                                  // BounceBit
  288: ['https://boba-eth.drpc.org', 'https://mainnet.boba.network'],                   // Boba Network
  42170: ['https://arbitrum-nova.drpc.org', 'https://nova.arbitrum.io/rpc'],            // Arbitrum Nova
  1135: ['https://lisk.drpc.org', 'https://rpc.api.lisk.com'],                          // Lisk
  130: ['https://unichain.drpc.org', 'https://mainnet.unichain.org'],                   // Unichain
  146: ['https://sonic.drpc.org', 'https://rpc.soniclabs.com'],                         // Sonic
  1923: ['https://swell.drpc.org', 'https://swell-mainnet.alt.technology'],             // Swellchain
  21000000: ['https://corn-maizenet.drpc.org', 'https://maizenet-rpc.usecorn.com'],     // Corn
  2741: ['https://abstract.drpc.org', 'https://api.mainnet.abs.xyz'],                   // Abstract
  33139: ['https://apechain.drpc.org', 'https://rpc.apechain.com/http'],                // ApeChain
  43111: ['https://hemi.drpc.org', 'https://rpc.hemi.network/rpc'],                     // Hemi
  57073: ['https://ink.drpc.org', 'https://rpc-gel.inkonchain.com'],                    // Ink
  80094: ['https://berachain.drpc.org', 'https://rpc.berachain.com'],                   // Berachain
  747: ['https://flow.drpc.org', 'https://mainnet.evm.nodes.onflow.org'],               // Flow EVM
  747474: ['https://katana.drpc.org', 'https://rpc.katana.network'],                    // Katana
  999: ['https://hyperliquid.drpc.org', 'https://rpc.hyperliquid.xyz/evm'],             // HyperEVM
  9745: ['https://plasma.drpc.org', 'https://rpc.plasma.to'],                           // Plasma
  55244: ['https://rpc.superposition.so'],                                              // Superposition
  5031: ['https://somnia.drpc.org', 'https://api.infra.mainnet.somnia.network'],        // Somnia
  1625: ['https://gravity.drpc.org', 'https://rpc.gravity.xyz'],                        // Gravity
  1868: ['https://soneium.drpc.org', 'https://rpc.soneium.org'],                        // Soneium
  98866: ['https://plume.drpc.org', 'https://rpc.plume.org'],                           // Plume
  // Kava EVM (2222)
  2222: ['https://kava-evm-rpc.publicnode.com', 'https://evm.kava.io', 'https://kava.drpc.org'],
  // Ronin (2020)
  2020: ['https://ronin.lgns.net/rpc', 'https://api.roninchain.com/rpc'],
  // Rootstock (30)
  30: ['https://public-node.rsk.co', 'https://rootstock.drpc.org'],
  // XDC Network (50)
  50: ['https://erpc.xinfin.network', 'https://rpc.xdcrpc.com'],
  // Immutable zkEVM (13371)
  13371: ['https://rpc.immutable.com', 'https://immutable-zkevm.drpc.org'],
  // IoTeX (4689)
  4689: ['https://babel-api.mainnet.iotex.io', 'https://iotex.drpc.org'],
  // Conflux eSpace (1030)
  1030: ['https://evm.confluxrpc.com', 'https://conflux-espace.drpc.org'],
  // Fraxtal (252)
  252: ['https://rpc.frax.com', 'https://fraxtal.drpc.org'],
  // BOB (60808)
  60808: ['https://rpc.gobob.xyz', 'https://bob.drpc.org'],
  // Monad (143)
  143: ['https://rpc.monad.xyz'],
  // Lens Chain (232)
  232: ['https://rpc.lens.xyz'],
  // Cyber (7560)
  7560: ['https://cyber.alt.technology', 'https://rpc.cyber.co'],
};

/**
 * dRPC network slugs per chain. ONE dRPC API key serves all chains, so this is
 * preferred as the primary RPC when `dRPC_API_Key` is set.
 *
 * IMPORTANT: `dRPC_API_Key` has NO NEXT_PUBLIC_ prefix, so it is undefined in the
 * browser bundle - the authenticated dRPC URL (which embeds the paid key) is only
 * ever built server-side. Client code transparently falls back to the public list.
 */
const DRPC_NETWORKS: Record<number, string> = {
  1: 'ethereum', 56: 'bsc', 137: 'polygon', 42161: 'arbitrum', 10: 'optimism',
  8453: 'base', 43114: 'avalanche', 250: 'fantom', 59144: 'linea', 534352: 'scroll',
  81457: 'blast', 100: 'gnosis', 42220: 'celo', 25: 'cronos', 324: 'zksync',
  1284: 'moonbeam', 1285: 'moonriver', 5000: 'mantle',
  7565164: 'solana', // Solana mainnet (synthetic chainId) - dRPC ?network=solana&dkey=…
};

function getDrpcUrl(chainId: number): string | undefined {
  const key = process.env.EXPO_PUBLIC_DRPC_API_KEY;
  const net = DRPC_NETWORKS[chainId];
  if (!key || !net) return undefined;
  return `https://lb.drpc.org/ogrpc?network=${net}&dkey=${key}`;
}

/**
 * Get the full RPC URL list for a chain. When a dRPC key is configured (server-side),
 * dRPC is prepended as the reliable primary, with the existing public endpoints as
 * fallbacks. This is what route verification uses via a viem fallback() transport.
 */
export function getRpcUrls(chainId: number): string[] | undefined {
  const base = RPC_CONFIG[chainId];
  const drpc = getDrpcUrl(chainId);
  if (drpc) return [drpc, ...(base ?? [])];
  return base;
}

/**
 * Get primary RPC URL for a specific chain ID (dRPC first when available).
 */
export function getRpcUrl(chainId: number): string | undefined {
  const urls = getRpcUrls(chainId);
  return urls && urls.length > 0 ? urls[0] : undefined;
}

/**
 * Check if a chain has a custom RPC configured.
 * 
 * @param chainId - Chain ID
 * @returns true if custom RPC is configured
 */
export function hasCustomRpc(chainId: number): boolean {
  return chainId in RPC_CONFIG;
}

/**
 * HTTP transport options for RPC calls.
 * Applied to all Alchemy RPCs for consistency.
 */
export const RPC_TRANSPORT_OPTIONS = {
  timeout: 25000, // 25 second timeout for deep discovery
  retryCount: 2,  // Retry up to 2 times
} as const;

