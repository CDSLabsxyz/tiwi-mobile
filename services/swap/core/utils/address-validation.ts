/**
 * Address validation per chain family. viem's `isAddress` only knows EVM —
 * for Solana, Cosmos, TRON, TON, etc. we apply chain-specific format checks.
 *
 * These checks are *format-level*, not on-chain existence. They mirror the
 * patterns used elsewhere in this repo (single-send validation in
 * portfolio/page.tsx and the backend nexxend-rest-client helpers).
 */

import { isAddress as isEvmAddress } from "viem";
import { chainFamily, type ChainFamily } from "./chain-family";

const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const TON_RAW_RE = /^-?[0-9]:[a-fA-F0-9]{64}$/;
const TON_FRIENDLY_RE = /^[a-zA-Z0-9_-]{48}$/;
const COSMOS_RE = /^[a-z]{1,83}1[a-z0-9]{38,58}$/;
const SUI_RE = /^0x[a-fA-F0-9]{64}$/;
// Aptos addresses are 0x + up to 64 hex (often padded to 64, but shorter forms
// with trimmed leading zeros are valid too).
const APTOS_RE = /^0x[a-fA-F0-9]{1,64}$/;
// Starknet (Cairo felt) addresses: 0x + up to 64 hex.
const STARKNET_RE = /^0x[a-fA-F0-9]{1,64}$/;
// Bitcoin: bech32 (bc1…) or legacy base58 (1…/3…). Format-level only.
const BITCOIN_RE = /^(bc1[a-z0-9]{6,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/;
// Polkadot SS58 (base58, ~46-48 chars).
const POLKADOT_RE = /^[1-9A-HJ-NP-Za-km-z]{46,48}$/;

export function isAddressForFamily(address: string, family: ChainFamily): boolean {
  const trimmed = address.trim();
  switch (family) {
    case "evm":
      return isEvmAddress(trimmed, { strict: false });
    case "solana":
      if (trimmed.startsWith("0x")) return false;
      return SOLANA_RE.test(trimmed);
    case "tron":
      return TRON_RE.test(trimmed);
    case "ton":
      return TON_FRIENDLY_RE.test(trimmed) || TON_RAW_RE.test(trimmed);
    case "cosmos":
      return COSMOS_RE.test(trimmed.toLowerCase());
    case "sui":
      return SUI_RE.test(trimmed);
    case "aptos":
      return APTOS_RE.test(trimmed);
    case "starknet":
      return STARKNET_RE.test(trimmed);
    case "bitcoin":
      return BITCOIN_RE.test(trimmed);
    case "polkadot":
      return POLKADOT_RE.test(trimmed);
    default:
      return false;
  }
}

export function isAddressForChain(address: string, chainId: number): boolean {
  return isAddressForFamily(address, chainFamily(chainId));
}

/** True if the address is well-formed for any chain family we recognize. */
export function isAddressForAnyChain(address: string): boolean {
  const families: ChainFamily[] = ["evm", "solana", "cosmos", "tron", "ton", "sui", "aptos", "starknet", "bitcoin", "polkadot"];
  return families.some((f) => isAddressForFamily(address, f));
}
