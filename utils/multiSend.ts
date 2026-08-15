/**
 * Multi-Send core model, grouping, preflight, chain-family + CSV parsing.
 *
 * Ported to mobile from the web app's per-row multi-send. Each recipient row
 * carries its OWN address + amount + token. Rows are grouped by (chain, token)
 * so each token becomes one on-chain batch (EVM disperse) or a per-recipient
 * loop (non-EVM / disperse-less EVM). See services/multiSendExecutor.ts.
 */

import type { TokenOption } from "@/components/sections/Swap/TokenSelectSheet";
import { getCosmosConfig } from "@/constants/cosmosChains";
import { validateAddress } from "@/utils/addressValidation";
import { toSmallestUnit } from "@/utils/formatting";
import { isNativeToken } from "@/utils/wallet";

// ============================================================================
// Row model
// ============================================================================

export type MultiSendRow = {
  id: string;
  address: string;
  amount: string;
  /** The per-row token - carries chainId + decimals + address. */
  token: TokenOption | null;
};

let rowSeq = 0;
export function createEmptyMultiSendRow(
  defaultToken: TokenOption | null = null
): MultiSendRow {
  rowSeq += 1;
  return {
    id: `row_${rowSeq}_${Math.random().toString(36).slice(2, 8)}`,
    address: "",
    amount: "",
    token: defaultToken,
  };
}

export function isRowValid(row: MultiSendRow): boolean {
  if (!row.token) return false;
  if (!validateAddress(row.address, row.token.chainId).isValid) return false;
  return parseFloat(row.amount || "0") > 0;
}

/** First human-readable reason a row is invalid (for inline hints). */
export function rowInvalidReason(row: MultiSendRow): string | null {
  const addressTouched = row.address.length > 0;
  const amountTouched = row.amount.length > 0;
  if (!addressTouched) return "Address required";
  if (
    row.token
      ? !validateAddress(row.address, row.token.chainId).isValid
      : false
  )
    return "Invalid address";
  if (!amountTouched) return "Amount required";
  if (!(parseFloat(row.amount || "0") > 0)) return "Amount must be > 0";
  if (!row.token) return "Token required";
  return null;
}

// ============================================================================
// Chain family
// ============================================================================

export type MsChainFamily =
  | "evm"
  | "solana"
  | "sui"
  | "aptos"
  | "cosmos"
  | "injective"
  | "bitcoin"
  | "starknet"
  | "unknown";

const SOLANA_CHAIN_IDS = [7565164, 1399811149];

/** Mirror of the family detection in services/transactionService.ts. */
export function chainFamilyForId(chainId: number | string | undefined): MsChainFamily {
  const id = Number(chainId);
  if (!id || Number.isNaN(id)) return "unknown";
  if (SOLANA_CHAIN_IDS.includes(id)) return "solana";
  if (id === 101 || id === 784) return "sui";
  if (id === 637) return "aptos";
  if (id === 8000001) return "injective";
  if (id === 8332) return "bitcoin";
  if (id === 23448594291968334) return "starknet";
  if (getCosmosConfig(id)) return "cosmos";
  // Anything else with a plausible EVM chainId is treated as EVM. The signer
  // engine validates the recipient format at send-time.
  return "evm";
}

export function chainFamilyLabel(family: MsChainFamily): string {
  switch (family) {
    case "evm":
      return "EVM";
    case "solana":
      return "Solana";
    case "sui":
      return "Sui";
    case "aptos":
      return "Aptos";
    case "cosmos":
      return "Cosmos";
    case "injective":
      return "Injective";
    case "bitcoin":
      return "Bitcoin";
    case "starknet":
      return "Starknet";
    default:
      return "this chain";
  }
}

/** Every recognized family is deliverable - EVM via disperse, others via a
 * per-recipient loop through the chain's single-send engine. */
export function isMultiSendSupported(family: MsChainFamily): boolean {
  return family !== "unknown";
}

// ============================================================================
// Grouping
// ============================================================================

export type MultiSendTokenGroup = {
  key: string;
  token: TokenOption;
  recipients: string[];
  /** smallest-unit amounts, parallel to recipients. */
  amountsRaw: bigint[];
  /** human-readable amounts, parallel to recipients. */
  amountsDisplay: string[];
  totalDisplay: string;
};

export function groupRowsByToken(rows: MultiSendRow[]): {
  groups: MultiSendTokenGroup[];
  invalidCount: number;
} {
  const grouped = new Map<string, MultiSendTokenGroup>();
  let invalidCount = 0;

  for (const row of rows) {
    const amountNum = parseFloat(row.amount || "0");
    if (
      !row.token ||
      !validateAddress(row.address, row.token.chainId).isValid ||
      !(amountNum > 0)
    ) {
      invalidCount++;
      continue;
    }

    const decimals = row.token.decimals ?? 18;
    let raw: bigint;
    try {
      raw = BigInt(toSmallestUnit(row.amount, decimals));
    } catch {
      invalidCount++;
      continue;
    }

    const key = `${row.token.chainId}:${(row.token.address || "").toLowerCase()}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.recipients.push(row.address);
      existing.amountsRaw.push(raw);
      existing.amountsDisplay.push(row.amount);
    } else {
      grouped.set(key, {
        key,
        token: row.token,
        recipients: [row.address],
        amountsRaw: [raw],
        amountsDisplay: [row.amount],
        totalDisplay: "0",
      });
    }
  }

  const groups = Array.from(grouped.values()).map((g) => ({
    ...g,
    totalDisplay: g.amountsDisplay
      .reduce((acc, v) => acc + parseFloat(v || "0"), 0)
      .toString(),
  }));

  return { groups, invalidCount };
}

// ============================================================================
// Preflight
// ============================================================================

export type PreflightLevel = "error" | "warning";
export type PreflightIssue = {
  level: PreflightLevel;
  token: string;
  chainId: number;
  message: string;
};
export type PreflightResult = {
  ok: boolean;
  issues: PreflightIssue[];
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
};

/** Parse a token's human-readable available balance (e.g. "12.5"). */
function parseBalanceFormatted(token: TokenOption): number {
  const raw = (token.balanceToken || "0").toString().split(" ")[0].replace(/,/g, "");
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Pre-flight validation run BEFORE signing. Errors block; warnings are advisory.
 * Uses human-readable balances (mobile balance data is already formatted) so a
 * chain missing balance data never produces a false "insufficient".
 */
export function preflightMultiSend(groups: MultiSendTokenGroup[]): PreflightResult {
  const issues: PreflightIssue[] = [];

  for (const group of groups) {
    const { token } = group;
    const label = token.symbol;
    const chainId = token.chainId;

    // 1. Chain support.
    const family = chainFamilyForId(chainId);
    if (!isMultiSendSupported(family)) {
      issues.push({
        level: "error",
        token: label,
        chainId,
        message: `Chain ${chainId} is not recognized - remove ${label} recipients.`,
      });
      continue;
    }

    // 2. Structural sanity.
    if (
      group.recipients.length !== group.amountsDisplay.length ||
      group.recipients.length === 0
    ) {
      issues.push({
        level: "error",
        token: label,
        chainId,
        message: `${label}: malformed recipient list.`,
      });
      continue;
    }

    // 3. Token sufficiency (human-readable comparison).
    const total = group.amountsDisplay.reduce((acc, v) => acc + parseFloat(v || "0"), 0);
    const have = parseBalanceFormatted(token);
    if (have > 0 && total > have) {
      issues.push({
        level: "error",
        token: label,
        chainId,
        message: `Insufficient ${label}: sending ${group.totalDisplay} but balance is ${have}. Lower the amounts or remove recipients.`,
      });
    }

    // 4. Duplicate recipients within the same token group.
    const seen = new Set<string>();
    let dupes = 0;
    for (const addr of group.recipients) {
      const k = addr.toLowerCase();
      if (seen.has(k)) dupes++;
      else seen.add(k);
    }
    if (dupes > 0) {
      issues.push({
        level: "warning",
        token: label,
        chainId,
        message: `${label}: ${dupes} duplicate recipient address${dupes > 1 ? "es" : ""} - each receives a separate transfer.`,
      });
    }
  }

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  return { ok: errors.length === 0, issues, errors, warnings };
}

// ============================================================================
// CSV parsing - `address,amount,tokenSymbol` per line
// ============================================================================

/**
 * Parse CSV/TXT content into MultiSendRow[]. Expected line: `address,amount,symbol`.
 * - `#`-prefixed lines are comments.
 * - Any line whose first column isn't a valid address (for the resolved token's
 *   chain, or any chain when the symbol is unknown) is skipped - covers header
 *   rows ("address,amount,token"), labels, and blank spreadsheet cells.
 */
export function parseMultiSendCsv(
  text: string,
  availableTokens: TokenOption[]
): { rows: MultiSendRow[]; skipped: number } {
  const cleaned = text.replace(/^﻿/, "");
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let skipped = 0;
  const rows: MultiSendRow[] = [];

  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    if (parts.length < 3) {
      skipped++;
      continue;
    }
    const [address, amount, symbolRaw] = parts;

    const symbol = symbolRaw.toLowerCase();
    const token =
      availableTokens.find((t) => t.symbol.toLowerCase() === symbol) || null;

    // Validate the address against the resolved token's chain when known,
    // otherwise accept any recognized chain-family format.
    const addrOk = token
      ? validateAddress(address, token.chainId).isValid
      : isAddressForAnyChain(address);
    if (!addrOk) {
      skipped++;
      continue;
    }

    rows.push({
      id: `csv_${rows.length}_${Math.random().toString(36).slice(2, 8)}`,
      address,
      amount,
      token,
    });
  }
  return { rows, skipped };
}

/** True if the string looks like a valid address on ANY supported chain family. */
export function isAddressForAnyChain(address: string): boolean {
  const candidates: (number | null)[] = [
    1, // EVM
    ...SOLANA_CHAIN_IDS,
    101, // Sui
    637, // Aptos
    8332, // Bitcoin
    23448594291968334, // Starknet
    118, // Cosmos hub (bech32)
  ];
  return candidates.some((c) => validateAddress(address, c as any).isValid);
}

// ============================================================================
// Helpers shared with the executor
// ============================================================================

export function groupIsNative(group: MultiSendTokenGroup): boolean {
  return isNativeToken(group.token.address);
}

/**
 * Merge bulk-generated rows into the current list. `replace` swaps the whole
 * list; `append` keeps existing rows (dropping a trailing empty one) then adds
 * the generated rows. Always leaves one trailing empty row for further edits.
 */
export function applyBulkRows(
  current: MultiSendRow[],
  generated: MultiSendRow[],
  mode: "replace" | "append",
  defaultToken: TokenOption | null
): MultiSendRow[] {
  if (mode === "replace") {
    return [...generated, createEmptyMultiSendRow(defaultToken)];
  }
  const last = current[current.length - 1];
  const trimmed =
    last && !last.address && !last.amount ? current.slice(0, -1) : current;
  return [...trimmed, ...generated, createEmptyMultiSendRow(defaultToken)];
}
