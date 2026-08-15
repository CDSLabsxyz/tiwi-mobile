/**
 * Canonical chain id → display name, mirroring the web app's
 * `lib/backend/registry/chains.ts` CHAIN_REGISTRY (100 chains).
 *
 * The balance pipeline uses this as its chain whitelist: a token on any chain
 * NOT listed here did not come from one of our readers and is treated as
 * airdrop spam (it would otherwise render with an "Unknown" chain label).
 * Before this existed the mobile hook whitelisted only ~25 ids, which silently
 * dropped every long-tail token the server portfolio route discovers.
 *
 * Keep in sync when the web registry gains a chain. `hooks/useChains.ts` fetches
 * the live registry from the backend for names/logos - this static copy exists
 * so filtering works offline and before that query resolves.
 */
export const KNOWN_CHAIN_NAMES: Record<number, string> = {
  // ── EVM ──
  1: 'Ethereum',
  10: 'Optimism',
  25: 'Cronos',
  30: 'Rootstock',
  50: 'XDC Network',
  56: 'BNB Chain',
  88: 'Viction',
  100: 'Gnosis',
  130: 'Unichain',
  137: 'Polygon',
  143: 'Monad',
  146: 'Sonic',
  169: 'Manta Pacific',
  232: 'Lens Chain',
  248: 'Oasys',
  250: 'Fantom',
  252: 'Fraxtal',
  255: 'Kroma',
  288: 'Boba Network',
  324: 'zkSync Era',
  480: 'World Chain',
  747: 'Flow EVM',
  999: 'HyperEVM',
  1030: 'Conflux eSpace',
  1088: 'Metis',
  1101: 'Polygon zkEVM',
  1116: 'Core',
  1135: 'Lisk',
  1284: 'Moonbeam',
  1285: 'Moonriver',
  1329: 'Sei',
  1625: 'Gravity',
  1868: 'Soneium',
  1923: 'Swellchain',
  2020: 'Ronin',
  2222: 'Kava',
  2741: 'Abstract',
  2818: 'Morph',
  4200: 'Merlin Chain',
  4689: 'IoTeX',
  5000: 'Mantle',
  5031: 'Somnia',
  6001: 'BounceBit',
  6342: 'MegaETH',
  7560: 'Cyber',
  7777777: 'Zora',
  9001: 'Evmos',
  9745: 'Plasma',
  13371: 'Immutable zkEVM',
  30732: 'Movement',
  33139: 'ApeChain',
  34443: 'Mode',
  42161: 'Arbitrum',
  42170: 'Arbitrum Nova',
  42220: 'Celo',
  43111: 'Hemi',
  43114: 'Avalanche',
  55244: 'Superposition',
  57073: 'Ink',
  59144: 'Linea',
  60808: 'BOB',
  80094: 'Berachain',
  81457: 'Blast',
  98866: 'Plume',
  167000: 'Taiko',
  534352: 'Scroll',
  660279: 'Xai',
  747474: 'Katana',
  8453: 'Base',
  21000000: 'Corn',
  1313161554: 'Aurora',
  2046399126: 'SKALE Europa',

  // ── Cosmos family ──
  118: 'Cosmos Hub',
  249339: 'Osmosis',
  8000001: 'Injective',
  8000002: 'THORChain',
  8000003: 'Juno',
  8000004: 'Stride',
  8000005: 'dYdX',
  8000006: 'Kujira',
  8000007: 'Secret',
  8000008: 'Celestia',
  8000009: 'Archway',
  8000010: 'Saga',
  8000011: 'Neutron',
  8000012: 'Nibiru',

  // ── Other ecosystems ──
  101: 'Sui',
  354: 'Polkadot',
  637: 'Aptos',
  1100: 'TON',
  7565164: 'Solana',
  8114: 'Nervos Network',
  8332: 'Bitcoin',
  8338: 'Bitcoin Cash',
  9332: 'Litecoin',
  16110: 'Kaspa',
  20443: 'Stacks',
  22555: 'Dogecoin',
  23448594291968334: 'Starknet',
  728126428: 'TRON',
};

/**
 * Legacy / alternate ids that reach us from upstream providers and must stay
 * renderable even though they aren't the canonical registry id.
 *  • 7777777 - Nexxend tags Injective vouchers with this (it's Zora's real id,
 *    already above); the canonical Injective id is 8000001.
 *  • 10000004 / 136105027 - older Osmosis / TON ids still present in some
 *    provider payloads.
 */
export const ALIAS_CHAIN_NAMES: Record<number, string> = {
  10000004: 'Osmosis',
  136105027: 'TON',
};

/** Every chain id the balance pipeline accepts as legitimate. */
export const KNOWN_CHAIN_IDS: ReadonlySet<number> = new Set<number>([
  ...Object.keys(KNOWN_CHAIN_NAMES).map(Number),
  ...Object.keys(ALIAS_CHAIN_NAMES).map(Number),
]);

/**
 * Native symbol → every chain it is genuinely native on, derived from the web
 * registry's `nativeCurrency`. The balance filter uses this to reject a token
 * that CLAIMS a native symbol on a chain where that asset isn't native (the
 * classic "BNB on TON" / "TON on BSC" airdrop-spam shape).
 *
 * It must list EVERY legitimate home chain or real balances get dropped - ETH
 * alone is native on 31 chains, which is why a hand-maintained 5-entry list was
 * hiding genuine L2 balances.
 */
export const NATIVE_SYMBOL_CHAINS: Record<string, number[]> = {
  ETH: [
    1, 10, 130, 169, 255, 288, 324, 480, 1101, 1135, 1868, 1923, 2741, 2818,
    6342, 7560, 7777777, 8453, 34443, 42161, 42170, 43111, 55244, 57073, 59144,
    60808, 81457, 167000, 534352, 747474, 1313161554,
  ],
  BTC: [4200, 8332],
  BNB: [56],
  POL: [137],
  AVAX: [43114],
  FTM: [250],
  CRO: [25],
  CELO: [42220],
  GLMR: [1284],
  MOVR: [1285],
  KAVA: [2222],
  XDAI: [100],
  STRK: [23448594291968334],
  MNT: [5000],
  METIS: [1088],
  IMX: [13371],
  RON: [2020],
  CORE: [1116],
  SEI: [1329],
  CFX: [1030],
  IOTX: [4689],
  RBTC: [30],
  XDC: [50],
  BB: [6001],
  MON: [143],
  MOVE: [30732],
  GHO: [232],
  XAI: [660279],
  OAS: [248],
  VIC: [88],
  ATOM: [118],
  INJ: [8000001, 7777777], // 7777777 = legacy Nexxend tag for Injective
  RUNE: [8000002],
  OSMO: [249339, 10000004],
  JUNO: [8000003],
  STRD: [8000004],
  DYDX: [8000005],
  KUJI: [8000006],
  EVMOS: [9001],
  SCRT: [8000007],
  TIA: [8000008],
  ARCH: [8000009],
  SAGA: [8000010],
  NTRN: [8000011],
  NIBI: [8000012],
  SOL: [7565164],
  LTC: [9332],
  DOGE: [22555],
  BCH: [8338],
  STX: [20443],
  KAS: [16110],
  CKB: [8114],
  DOT: [354],
  SUI: [101],
  APT: [637],
  TON: [1100, 136105027],
  TRX: [728126428],
  S: [146],
  APE: [33139],
  BERA: [80094],
  FLOW: [747],
  HYPE: [999],
  XPL: [9745],
  SOMI: [5031],
  PLUME: [98866],
  // Aliases upstream sources still emit for the same native asset.
  MATIC: [137],
  WSOL: [7565164],
};

/** Display name for a chain id, or undefined when we don't know it. */
export function knownChainName(chainId: number | string | undefined): string | undefined {
  if (chainId === undefined || chainId === null) return undefined;
  const id = typeof chainId === 'string' ? Number(chainId) : chainId;
  if (!Number.isFinite(id)) return undefined;
  return KNOWN_CHAIN_NAMES[id] || ALIAS_CHAIN_NAMES[id];
}
