/**
 * Cosmos-family chain registry (isomorphic).
 *
 * All of the chains listed here derive their account from the SAME standard
 * secp256k1 key path (Cosmos `m/44'/118'/…`). That means one keypair produces
 * one 20-byte account hash, and the on-chain address is simply that hash
 * re-encoded under each chain's bech32 prefix. So `cosmos1abc…` and `dydx1abc…`
 * (etc.) are the *same* wallet — we can re-encode between them locally without a
 * mnemonic.
 *
 * Injective (chainId 8000001) is intentionally EXCLUDED: it derives addresses
 * from an Ethereum (eth_secp256k1 / keccak) key, so re-encoding a cosmos-slot
 * address to `inj` would produce a valid-looking but WRONG address. Only add
 * chains here that share the standard secp256k1 derivation.
 *
 * The chainId → prefix/denom/decimals data mirrors `COSMOS_CHAINS` in
 * `app/api/v1/cosmos-direct-balances/route.ts` — keep the two in sync.
 */
// bech32 v2 (what the mobile app pins) exposes the codec under a `bech32`
// namespace instead of top-level `decode`/`encode` like v1 did on web.
import { bech32 } from "bech32";

const bech32Decode = bech32.decode;
const bech32Encode = bech32.encode;

export interface CosmosChainInfo {
  chainId: number;
  prefix: string; // bech32 human-readable prefix (no trailing "1")
  denom: string; // base (micro) denom of the native staking token
  symbol: string;
  decimals: number;
  name: string;
}

export const COSMOS_CHAINS: readonly CosmosChainInfo[] = [
  { chainId: 118,     prefix: "cosmos",   denom: "uatom",  symbol: "ATOM", decimals: 6,  name: "Cosmos Hub" },
  { chainId: 249339,  prefix: "osmo",     denom: "uosmo",  symbol: "OSMO", decimals: 6,  name: "Osmosis" },
  { chainId: 8000002, prefix: "thor",     denom: "rune",   symbol: "RUNE", decimals: 8,  name: "THORChain" },
  { chainId: 8000003, prefix: "juno",     denom: "ujuno",  symbol: "JUNO", decimals: 6,  name: "Juno" },
  { chainId: 8000004, prefix: "stride",   denom: "ustrd",  symbol: "STRD", decimals: 6,  name: "Stride" },
  { chainId: 8000005, prefix: "dydx",     denom: "adydx",  symbol: "DYDX", decimals: 18, name: "dYdX" },
  { chainId: 8000006, prefix: "kujira",   denom: "ukuji",  symbol: "KUJI", decimals: 6,  name: "Kujira" },
  { chainId: 8000007, prefix: "secret",   denom: "uscrt",  symbol: "SCRT", decimals: 6,  name: "Secret" },
  { chainId: 8000008, prefix: "celestia", denom: "utia",   symbol: "TIA",  decimals: 6,  name: "Celestia" },
  { chainId: 8000009, prefix: "archway",  denom: "aarch",  symbol: "ARCH", decimals: 18, name: "Archway" },
  { chainId: 8000010, prefix: "saga",     denom: "usaga",  symbol: "SAGA", decimals: 6,  name: "Saga" },
  { chainId: 8000011, prefix: "neutron",  denom: "untrn",  symbol: "NTRN", decimals: 6,  name: "Neutron" },
  { chainId: 8000012, prefix: "nibi",     denom: "unibi",  symbol: "NIBI", decimals: 6,  name: "Nibiru" },
];

const BY_ID = new Map<number, CosmosChainInfo>(COSMOS_CHAINS.map((c) => [c.chainId, c]));
const PREFIXES = new Set<string>(COSMOS_CHAINS.map((c) => c.prefix));

/** Cosmos chain metadata for a chainId, or undefined if not a known Cosmos chain. */
export function getCosmosChain(chainId?: number | null): CosmosChainInfo | undefined {
  return chainId == null ? undefined : BY_ID.get(chainId);
}

/** True when the chainId is a known standard-secp256k1 Cosmos chain. */
export function isCosmosChainId(chainId?: number | null): boolean {
  return chainId != null && BY_ID.has(chainId);
}

/** True when `prefix` is a bech32 prefix of a known Cosmos chain. */
export function isKnownCosmosPrefix(prefix: string): boolean {
  return PREFIXES.has(prefix);
}

/** The bech32 prefix of a cosmos address, or null when it isn't bech32. */
export function getBech32Prefix(address: string): string | null {
  try {
    return bech32Decode(address).prefix;
  } catch {
    return null;
  }
}

/**
 * Re-encode a bech32 address under a different chain's prefix. Because all
 * standard secp256k1 Cosmos chains share the same 20-byte account, this returns
 * the caller's *real* address on the target chain. Returns null on failure
 * (non-bech32 input, or an over-long prefix that overflows bech32's length cap).
 */
export function reEncodeBech32(address: string, targetPrefix: string): string | null {
  try {
    const { words } = bech32Decode(address);
    return bech32Encode(targetPrefix, words);
  } catch {
    return null;
  }
}
