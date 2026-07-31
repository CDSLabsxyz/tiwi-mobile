/**
 * Meson bridge config — the non-CCTP stablecoin rail.
 *
 * Meson moves USDT/USDC across ~40 chains via an atomic-swap + LP model (no liquidity from us).
 * It fills the gap CCTP/LiFi/Relay leave: Tron, Core, and many long-tail chains. Combined with
 * the pre-swap executor (source token → USDC/USDT locally), it gives any-token → stablecoin-on-
 * any-Meson-chain, one signature.
 *
 * Integration flow (verified live 2026-07-14):
 *   POST /api/v1/swap {from:'bnb:usdt', to:'tron:usdt', amount:'50', fromAddress, recipient}
 *     → { encoded, signingRequest:{message,hash}, fee:{serviceFee,lpFee,totalFee}, tx:{to,data}, expireTs }
 *   user signs signingRequest.message → POST /api/v1/swap/{encoded} {fromAddress, recipient, signature}
 *   → Meson relayer posts on source (via the user's allowance to tx.to) and fills the destination.
 *   Poll GET /api/v1/swap/{encoded} for status. One approval + one signature; no dest action.
 *
 * v1 SCOPE: EVM SOURCE only (the user signs an EVM message). Destination may be any Meson chain,
 * including non-EVM (Tron/Solana) — the user only signs on the EVM source, Meson delivers to the
 * dest address. Non-EVM as SOURCE (e.g. USDT on Tron → …) is a later addition (needs Tron signing).
 */

export interface MesonChainConfig {
  chainId: number;       // app canonical chainId
  mesonId: string;       // Meson chain id ('bnb', 'tron', 'core', …)
  isEVM: boolean;        // EVM chains are source-capable in v1; non-EVM are destination-only
  usdt?: string;         // token address on this chain (lowercased for EVM), if Meson lists it
  usdc?: string;
}

export const MESON_RELAYER_API = 'https://relayer.meson.fi/api/v1';

/**
 * The Meson contract — approval spender for the source stablecoin. Verified deployed at this same
 * address on BSC/Arbitrum/Base/Polygon/Optimism/Avalanche/Linea (deterministic, like CCTP). The
 * signature flow lets Meson's relayer transferFrom the user via this allowance.
 */
export const MESON_CONTRACT = '0x25aB3Efd52e6470681CE037cD546Dc60726948D3';

/** app chainId → Meson config. EVM source chains + a few high-value non-EVM destinations. */
export const MESON_CHAINS: Record<number, MesonChainConfig> = {
  1: { chainId: 1, mesonId: 'eth', isEVM: true, usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7', usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  10: { chainId: 10, mesonId: 'opt', isEVM: true, usdt: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', usdc: '0x0b2c639c533813f4aa9d7837caf62653d097ff85' },
  25: { chainId: 25, mesonId: 'cronos', isEVM: true, usdt: '0x66e428c3f67a68878562e79a0234c1f83c208770', usdc: '0xc21223249ca28397b4b6541dffaecc539bff0c59' },
  56: { chainId: 56, mesonId: 'bnb', isEVM: true, usdt: '0x55d398326f99059ff775485246999027b3197955', usdc: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d' },
  130: { chainId: 130, mesonId: 'uni', isEVM: true, usdt: '0x9151434b16b9763660705744891fa906f660ecc5', usdc: '0x078d782b760474a361dda0af3839290b0ef57ad6' },
  137: { chainId: 137, mesonId: 'polygon', isEVM: true, usdt: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', usdc: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359' },
  146: { chainId: 146, mesonId: 'sonic', isEVM: true, usdc: '0x29219dd400f2bf60e5a23d13be72b486d4038894' },
  196: { chainId: 196, mesonId: 'xlayer', isEVM: true, usdt: '0x779ded0c9e1022225f8e0630b35a9b54be713736', usdc: '0x74b7f16337b8972027f6196a17a631ac6de26d22' },
  324: { chainId: 324, mesonId: 'zksync', isEVM: true, usdc: '0x1d17cbcf0d6d143135ae902365d2e5e2a16538d4' },
  999: { chainId: 999, mesonId: 'hype', isEVM: true, usdt: '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb' },
  1030: { chainId: 1030, mesonId: 'cfx', isEVM: true, usdt: '0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff', usdc: '0x6963efed0ab40f6c3d7bda44a05dcf1437c44372' },
  1116: { chainId: 1116, mesonId: 'core', isEVM: true, usdt: '0x900101d06a7426441ae63e9ab3b9b0f63be145f1', usdc: '0xa4151b2b3e269645181dccf2d426ce75fcbdeca9' },
  1329: { chainId: 1329, mesonId: 'sei', isEVM: true, usdt: '0x9151434b16b9763660705744891fa906f660ecc5', usdc: '0xe15fc38f6d8c56af07bbcbe3baf5708a2bf42392' },
  2818: { chainId: 2818, mesonId: 'morph', isEVM: true, usdt: '0xe7cd86e13ac4309349f30b3435a9d337750fc82d', usdc: '0xe34c91815d7fc18a9e2148bcd4241d0a5848b693' },
  4200: { chainId: 4200, mesonId: 'merlin', isEVM: true, usdt: '0x967aec3276b63c5e2262da9641db9dbebb07dc0d', usdc: '0x6b4ecada640f1b30dbdb68f77821a03a5f282ebe' },
  5000: { chainId: 5000, mesonId: 'mnt', isEVM: true, usdt: '0x779ded0c9e1022225f8e0630b35a9b54be713736', usdc: '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9' },
  8453: { chainId: 8453, mesonId: 'base', isEVM: true, usdc: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
  42161: { chainId: 42161, mesonId: 'arb', isEVM: true, usdt: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', usdc: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' },
  43114: { chainId: 43114, mesonId: 'avax', isEVM: true, usdt: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7', usdc: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e' },
  59144: { chainId: 59144, mesonId: 'linea', isEVM: true, usdt: '0xa219439258ca9da29e9cc4ce5596924745e12b93', usdc: '0x176211869ca2b568f2a7d4ee941e073a821ee1ff' },
  60808: { chainId: 60808, mesonId: 'bob', isEVM: true, usdt: '0x1217bfe6c773eec6cc4a38b5dc45b92292b6e189', usdc: '0xe75d0fb2c24a55ca1e3f96781a2bcc7bdba058f0' },
  534352: { chainId: 534352, mesonId: 'scroll', isEVM: true, usdt: '0xf55bec9cafdbe8730f096aa55dad6d22d44099df', usdc: '0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4' },

  // High-value non-EVM DESTINATIONS (v1: dest-only — user signs on the EVM source).
  // Token addresses are the app's canonical representations, used to match a chosen token.
  728126428: { chainId: 728126428, mesonId: 'tron', isEVM: false, usdt: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
  7565164: { chainId: 7565164, mesonId: 'solana', isEVM: false, usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', usdt: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
};

export function getMesonChain(chainId: number): MesonChainConfig | undefined {
  return MESON_CHAINS[chainId];
}

export function isMesonChain(chainId: number): boolean {
  return chainId in MESON_CHAINS;
}

/** True if this chain can be a Meson SOURCE (EVM signature) in v1. */
export function isMesonSource(chainId: number): boolean {
  return !!MESON_CHAINS[chainId]?.isEVM;
}

/** Match a token address to its Meson stable id ('usdt' | 'usdc') on that chain, else null. */
export function mesonTokenId(chainId: number, address?: string): 'usdt' | 'usdc' | null {
  const c = MESON_CHAINS[chainId];
  if (!c || !address) return null;
  const a = c.isEVM ? address.toLowerCase() : address;
  if (c.usdt && (c.isEVM ? c.usdt === a : c.usdt === a)) return 'usdt';
  if (c.usdc && (c.isEVM ? c.usdc === a : c.usdc === a)) return 'usdc';
  return null;
}

/** Build a Meson swap id, e.g. mesonSwapId(56,'usdt') → 'bnb:usdt'. */
export function mesonSwapId(chainId: number, token: 'usdt' | 'usdc'): string | null {
  const c = MESON_CHAINS[chainId];
  return c ? `${c.mesonId}:${token}` : null;
}

/**
 * Master gate — dormant until the executor is verified with a real small transfer, mirroring
 * NEXT_PUBLIC_CCTP_ENABLED. Set MESON_ENABLED / NEXT_PUBLIC_MESON_ENABLED = 'true' to activate.
 */
export function isMesonEnabled(): boolean {
  return process.env.EXPO_PUBLIC_MESON_ENABLED === 'true' || process.env.EXPO_PUBLIC_MESON_ENABLED === 'true';
}
