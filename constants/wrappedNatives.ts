/**
 * Wrapped-native token registry.
 *
 * Every entry here is a token that is redeemable 1:1 for its chain's native
 * coin - WBNB → BNB, WETH → ETH, WSOL → SOL. Holding one is almost always an
 * accident (a leftover swap leg, a bridge output), so the wallet surfaces a
 * bold "Unwrap" action wherever one of these shows up.
 *
 * Matching is by (chainId, address) ONLY - never by symbol. A token that
 * merely calls itself "WETH" on some chain we don't list here simply gets no
 * unwrap button, which is the safe failure mode. `services/unwrapService.ts`
 * additionally simulates `withdraw()` before signing, so a mis-registered
 * address surfaces as an error instead of a burned transaction.
 *
 * EVM entries all follow the canonical WETH9 interface (deposit/withdraw).
 * Solana's WSOL is not a contract - it is unwrapped by closing the associated
 * token account, which is why `family` is carried on every row.
 */

import { isSignerSupportedChain } from '@/services/signer/SignerUtils';

export type WrappedFamily = 'evm' | 'solana';

export interface WrappedNativeInfo {
  chainId: number;
  family: WrappedFamily;
  /** Contract address (EVM) or mint (Solana). */
  address: string;
  /** Symbol of the wrapped token, e.g. WBNB. */
  wrappedSymbol: string;
  /** Symbol of the native coin it unwraps into, e.g. BNB. */
  nativeSymbol: string;
  decimals: number;
}

/** Solana's canonical chain id in this app (see constants/knownChains.ts). */
export const SOLANA_CHAIN_ID = 7565164;

/** Native SOL mint - the "wrapped SOL" SPL token. */
export const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

const evm = (
  chainId: number,
  address: string,
  wrappedSymbol: string,
  nativeSymbol: string,
  decimals = 18,
): WrappedNativeInfo => ({ chainId, family: 'evm', address, wrappedSymbol, nativeSymbol, decimals });

export const WRAPPED_NATIVES: WrappedNativeInfo[] = [
  // --- Majors -------------------------------------------------------------
  evm(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 'WETH', 'ETH'),
  evm(56, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 'WBNB', 'BNB'),
  evm(137, '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', 'WPOL', 'POL'),
  evm(42161, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 'WETH', 'ETH'),
  evm(8453, '0x4200000000000000000000000000000000000006', 'WETH', 'ETH'),
  evm(10, '0x4200000000000000000000000000000000000006', 'WETH', 'ETH'),
  evm(43114, '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', 'WAVAX', 'AVAX'),

  // --- OP-stack / ETH-native L2s -----------------------------------------
  evm(480, '0x4200000000000000000000000000000000000006', 'WETH', 'ETH'),        // World Chain
  evm(130, '0x4200000000000000000000000000000000000006', 'WETH', 'ETH'),        // Unichain
  evm(57073, '0x4200000000000000000000000000000000000006', 'WETH', 'ETH'),      // Ink
  evm(1868, '0x4200000000000000000000000000000000000006', 'WETH', 'ETH'),       // Soneium
  evm(1135, '0x4200000000000000000000000000000000000006', 'WETH', 'ETH'),       // Lisk
  evm(34443, '0x4200000000000000000000000000000000000006', 'WETH', 'ETH'),      // Mode
  evm(7777777, '0x4200000000000000000000000000000000000006', 'WETH', 'ETH'),    // Zora
  evm(81457, '0x4300000000000000000000000000000000000004', 'WETH', 'ETH'),      // Blast
  evm(534352, '0x5300000000000000000000000000000000000004', 'WETH', 'ETH'),     // Scroll
  evm(59144, '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f', 'WETH', 'ETH'),      // Linea
  evm(324, '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', 'WETH', 'ETH'),        // zkSync Era
  evm(1101, '0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9', 'WETH', 'ETH'),       // Polygon zkEVM
  evm(167000, '0xA51894664A773981C6C112C43ce576f315d5b1B6', 'WETH', 'ETH'),     // Taiko
  evm(1313161554, '0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB', 'WETH', 'ETH'), // Aurora
  evm(42170, '0x722E8BdD2ce80A4422E880164f2079488e115365', 'WETH', 'ETH'),      // Arbitrum Nova

  // --- Own-gas-token chains ----------------------------------------------
  evm(250, '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83', 'WFTM', 'FTM'),        // Fantom
  evm(146, '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38', 'wS', 'S'),            // Sonic
  evm(100, '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', 'WXDAI', 'XDAI'),      // Gnosis
  evm(25, '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23', 'WCRO', 'CRO'),         // Cronos
  evm(5000, '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8', 'WMNT', 'MNT'),       // Mantle
  evm(1284, '0xAcc15dC74880C9944775448304B263D191c6077F', 'WGLMR', 'GLMR'),     // Moonbeam
  evm(1285, '0x98878B06940aE243284CA214f92Bb71a2b032B8A', 'WMOVR', 'MOVR'),     // Moonriver
  evm(1088, '0x75cb093E4D61d2A2e65D8e0BBb01DE8d89b53481', 'WMETIS', 'METIS'),   // Metis
  evm(1329, '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7', 'WSEI', 'SEI'),       // Sei
  evm(999, '0x5555555555555555555555555555555555555555', 'WHYPE', 'HYPE'),      // HyperEVM
  evm(80094, '0x6969696969696969696969696969696969696969', 'WBERA', 'BERA'),    // Berachain
  evm(33139, '0x48b62137EdfA95a428D35C09E44256a739F6B557', 'WAPE', 'APE'),      // ApeChain
  evm(2222, '0xc86c7C0eFbd6A49B35E8714C5f59D99De09A225b', 'WKAVA', 'KAVA'),     // Kava
  evm(1116, '0x191E94fa59739e188dcE837F7f6978d84727AD01', 'WCORE', 'CORE'),     // Core
  evm(2020, '0xe514d9DEB7966c8BE0ca922de8a064264eA6bcd4', 'WRON', 'RON'),       // Ronin
  evm(30, '0x542fDA317318eBF1d3DEAf76E0b632741A7e677d', 'WRBTC', 'RBTC'),       // Rootstock

  // --- Solana -------------------------------------------------------------
  {
    chainId: SOLANA_CHAIN_ID,
    family: 'solana',
    address: NATIVE_SOL_MINT,
    wrappedSymbol: 'WSOL',
    nativeSymbol: 'SOL',
    decimals: 9,
  },
];

const key = (chainId: number | string, address: string) =>
  `${Number(chainId)}:${address.toLowerCase()}`;

/** Every known wrapped native, regardless of whether we can sign on its chain. */
const ALL_BY_KEY = new Map<string, WrappedNativeInfo>(
  WRAPPED_NATIVES.map((w) => [key(w.chainId, w.address), w]),
);

/**
 * The unwrap-eligible subset: EVM entries the local signer has a real chain
 * definition for. `getChainById` falls back to Ethereum mainnet, so an unlisted
 * chain would be signed with chainId 1 - better to show no unwrap button than to
 * broadcast a withdrawal against the wrong network.
 */
const BY_KEY = new Map<string, WrappedNativeInfo>(
  WRAPPED_NATIVES.filter((w) => w.family !== 'evm' || isSignerSupportedChain(w.chainId))
    .map((w) => [key(w.chainId, w.address), w]),
);

/**
 * The wrapped-native descriptor for a held token, or `null` when the token
 * isn't a wrapped native on that chain.
 *
 * `symbol` is an optional disambiguator and worth passing whenever the caller
 * has one: several data sources express NATIVE SOL using the wrapped-SOL mint,
 * so address alone would mark a plain SOL holding as unwrappable. A row whose
 * symbol is the native symbol is never treated as wrapped.
 */
export function getWrappedNative(
  chainId: number | string | undefined,
  address: string | undefined,
  symbol?: string,
): WrappedNativeInfo | null {
  if (chainId === undefined || chainId === null || !address) return null;
  const id = Number(chainId);
  if (!Number.isFinite(id)) return null;
  const info = BY_KEY.get(key(id, address));
  if (!info) return null;
  if (symbol && symbol.trim().toUpperCase() === info.nativeSymbol.toUpperCase()) return null;
  return info;
}

/**
 * True when `(chainId, address)` is a canonical wrapped native - regardless of
 * whether we can *sign* on that chain.
 *
 * This is the DISPLAY-side question, and it is deliberately not gated on signer
 * support: a wrapped native must survive the portfolio's spam/impersonation
 * filters everywhere, even on a chain where we can't offer the unwrap button.
 * Use `getWrappedNative` when deciding whether unwrapping is possible.
 */
export function getKnownWrappedNative(
  chainId: number | string | undefined,
  address: string | undefined,
): WrappedNativeInfo | null {
  if (chainId === undefined || chainId === null || !address) return null;
  const id = Number(chainId);
  if (!Number.isFinite(id)) return null;
  return ALL_BY_KEY.get(key(id, address)) ?? null;
}

/** Boolean form of {@link getKnownWrappedNative}. */
export function isKnownWrappedNative(
  chainId: number | string | undefined,
  address: string | undefined,
): boolean {
  return getKnownWrappedNative(chainId, address) !== null;
}

/** True when `address` on `chainId` can be unwrapped into the native coin. */
export function isWrappedNative(
  chainId: number | string | undefined,
  address: string | undefined,
  symbol?: string,
): boolean {
  return getWrappedNative(chainId, address, symbol) !== null;
}
