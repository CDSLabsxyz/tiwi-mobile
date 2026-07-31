/**
 * Chain-family classification used by multi-send dispatching.
 *
 * Sourced from the canonical chain registry (`lib/backend/registry/chains.ts`)
 * so every chain the platform lists is classified consistently — all 50 EVM
 * chains, all Cosmos chains, Solana, TRON, TON, Sui, Aptos, Bitcoin, etc.
 * Falls back to the heuristic `getChainType()` for any chainId not in the
 * registry.
 */
import { getChainType } from "@/services/swap/core/utils/chain-helpers";
import { getCanonicalChain } from "@/services/swap/core/registry/chains";

export type ChainFamily =
  | "evm"
  | "solana"
  | "cosmos"
  | "tron"
  | "ton"
  | "sui"
  | "aptos"
  | "bitcoin"
  | "starknet"
  | "polkadot"
  | "unknown";

/** Reserved Sui chainIds. Sui mainnet has no canonical EVM-style chain ID;
 *  we use this convention internally to make dispatch possible once Sui is
 *  wired into the wallet stack. */
export const SUI_CHAIN_IDS = new Set<number>([
  // Placeholder. Update when Sui is integrated.
]);

/** Map a registry `CanonicalChain.type` value to a multi-send family. */
function familyFromRegistryType(type: string): ChainFamily {
  switch (type) {
    case "EVM":
      return "evm";
    case "Solana":
      return "solana";
    case "Cosmos":
    case "Osmosis":
      return "cosmos";
    case "TRON":
      return "tron";
    case "TON":
      return "ton";
    case "Sui":
      return "sui";
    case "Aptos":
      return "aptos";
    case "Bitcoin":
      return "bitcoin";
    case "Starknet":
      return "starknet";
    case "Polkadot":
      return "polkadot";
    default:
      return "unknown";
  }
}

export function chainFamily(chainId: number): ChainFamily {
  if (SUI_CHAIN_IDS.has(chainId)) return "sui";

  const canonical = getCanonicalChain(chainId);
  if (canonical) return familyFromRegistryType(canonical.type);

  // Fallback for chainIds not present in the registry.
  return getChainType(chainId) as ChainFamily;
}

/** Families the multi-send executor can actually execute today. */
export function isMultiSendSupported(family: ChainFamily): boolean {
  // Every recognized family now has a runner; only "unknown" is unsupported.
  return family !== "unknown";
}

export function chainFamilyLabel(family: ChainFamily): string {
  switch (family) {
    case "evm": return "EVM";
    case "solana": return "Solana";
    case "cosmos": return "Cosmos";
    case "tron": return "TRON";
    case "ton": return "TON";
    case "sui": return "Sui";
    case "aptos": return "Aptos";
    case "bitcoin": return "Bitcoin";
    case "starknet": return "Starknet";
    case "polkadot": return "Polkadot";
    default: return "Unknown chain";
  }
}
