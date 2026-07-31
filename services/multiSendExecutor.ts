/**
 * Multi-send executor for LOCAL (Tiwi) wallets.
 *
 * Consumes token groups (output of groupRowsByToken) and dispatches each group:
 *   - EVM group with a deployed Disperse contract + >1 recipient → one disperse
 *     transaction via transactionService.multiSend (handles ERC20 approval).
 *   - Everything else (non-EVM, disperse-less EVM, single recipient) → a
 *     per-recipient loop through transactionService.sendToken, which already
 *     routes to the correct signer engine per chain family.
 *
 * External-wallet multi-send is handled in useTransactionExecution (wagmi).
 */

import { DISPERSE_CONTRACTS } from "@/constants/contracts";
import { transactionService } from "@/services/transactionService";
import {
  chainFamilyForId,
  chainFamilyLabel,
  groupIsNative,
  isMultiSendSupported,
  type MultiSendTokenGroup,
} from "@/utils/multiSend";

export type MultiSendProgress = {
  current: number;
  total: number;
  success: number;
  failed: number;
};

export type MultiSendHash = { token: string; hash: string; chainId: number };

export type MultiSendFailure = {
  token: string;
  chainId: number;
  error: string;
  /** For per-recipient paths: how many recipients settled before the failure. */
  sentCount?: number;
  totalCount?: number;
  lastHash?: string;
};

export type MultiSendResult = {
  hashes: MultiSendHash[];
  failedGroups: MultiSendFailure[];
};

export type MultiSendExecOptions = {
  groups: MultiSendTokenGroup[];
  onStatus?: (msg: string) => void;
  onProgress?: (p: MultiSendProgress) => void;
  onGroupComplete?: (group: MultiSendTokenGroup, hash: string) => void;
};

/**
 * Execute every group. Groups are independent — a failure in one never blocks
 * the others, and partially-sent per-recipient groups report how much landed so
 * the UI can warn the user not to re-send those recipients.
 */
export async function executeMultiSendGroups(
  opts: MultiSendExecOptions
): Promise<MultiSendResult> {
  const { groups, onStatus, onProgress, onGroupComplete } = opts;

  const hashes: MultiSendHash[] = [];
  const failedGroups: MultiSendFailure[] = [];
  const total = groups.length;

  const report = () =>
    onProgress?.({
      current: hashes.length + failedGroups.length >= total
        ? total
        : hashes.length + failedGroups.length,
      total,
      success: hashes.length,
      failed: failedGroups.length,
    });

  report();

  for (const group of groups) {
    const chainId = group.token.chainId;
    const symbol = group.token.symbol;
    const family = chainFamilyForId(chainId);
    const label = `${symbol} (${group.recipients.length})`;

    if (!isMultiSendSupported(family)) {
      failedGroups.push({
        token: symbol,
        chainId,
        error: `Multi-send on ${chainFamilyLabel(family)} isn't available — skipped ${symbol}.`,
      });
      report();
      continue;
    }

    const isNative = groupIsNative(group);
    const disperseAddress = DISPERSE_CONTRACTS[chainId];
    const canDisperse =
      family === "evm" && !!disperseAddress && group.recipients.length > 1;

    try {
      if (canDisperse) {
        onStatus?.(`Preparing batch transfer for ${label}...`);
        const res = await transactionService.multiSend({
          tokenAddress: group.token.address,
          symbol,
          decimals: group.token.decimals,
          chainId,
          isNative,
          recipients: group.recipients,
          amounts: group.amountsDisplay,
        });
        if (res.status === "success" && res.hash) {
          hashes.push({ token: symbol, hash: res.hash, chainId });
          onGroupComplete?.(group, res.hash);
        } else {
          // Fall back to per-recipient — the disperse contract may not be
          // deployed at the recorded address on this chain.
          onStatus?.(`Batch transfer unavailable for ${label} — sending per recipient...`);
          await sendPerRecipient(group, isNative, hashes, failedGroups, onStatus, onGroupComplete);
        }
      } else {
        if (group.recipients.length > 1) {
          onStatus?.(`Sending ${label} per recipient...`);
        }
        await sendPerRecipient(group, isNative, hashes, failedGroups, onStatus, onGroupComplete);
      }
    } catch (err: any) {
      failedGroups.push({
        token: symbol,
        chainId,
        error: err?.message || "Failed",
      });
    }

    report();
  }

  onProgress?.({ current: total, total, success: hashes.length, failed: failedGroups.length });
  return { hashes, failedGroups };
}

/**
 * Send one transaction per recipient for a single token group. Records the last
 * successful hash for the group and, on failure, how many recipients settled so
 * a retry doesn't double-pay.
 */
async function sendPerRecipient(
  group: MultiSendTokenGroup,
  isNative: boolean,
  hashes: MultiSendHash[],
  failedGroups: MultiSendFailure[],
  onStatus?: (msg: string) => void,
  onGroupComplete?: (group: MultiSendTokenGroup, hash: string) => void
): Promise<void> {
  const symbol = group.token.symbol;
  const chainId = group.token.chainId;
  const totalCount = group.recipients.length;
  let sent = 0;
  let lastHash: string | undefined;

  for (let i = 0; i < totalCount; i++) {
    const recipient = group.recipients[i];
    const amount = group.amountsDisplay[i];
    onStatus?.(
      `Sending ${symbol} ${i + 1}/${totalCount} → ${recipient.slice(0, 8)}...`
    );
    const res = await transactionService.sendToken({
      tokenAddress: group.token.address,
      symbol,
      decimals: group.token.decimals,
      recipientAddress: recipient,
      amount,
      chainId,
      isNative,
    });
    if (res.status !== "success" || !res.hash) {
      const base = res.error || "Transfer failed";
      failedGroups.push({
        token: symbol,
        chainId,
        error:
          sent > 0
            ? `${base} — ${sent} of ${totalCount} already sent; do NOT re-send those recipients.`
            : base,
        sentCount: sent,
        totalCount,
        lastHash,
      });
      return;
    }
    lastHash = res.hash;
    sent++;
  }

  if (lastHash) {
    hashes.push({ token: symbol, hash: lastHash, chainId });
    onGroupComplete?.(group, lastHash);
  }
}
