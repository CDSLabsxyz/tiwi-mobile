/**
 * Approval & spend-amount policy (EVM swaps)
 *
 * Two invariants live here so they can be enforced consistently and unit-tested:
 *
 * 1. APPROVAL amount is always max/infinite. A given (token, spender) pair is then
 *    signed exactly ONCE, ever — repeat swaps and multi-send reuse the same allowance
 *    instead of prompting another approval. This is standard practice (Uniswap et al.).
 *
 * 2. SPEND amount (what a swap/transfer is actually authorized to move) is derived
 *    ONLY from the user-entered amount — never from the wallet balance and never from
 *    the allowance. Infinite approval grants *permission* to move up to max, but each
 *    swap must still move exactly `amountIn`. These two are deliberately decoupled:
 *    `getStandardApprovalAmount()` (permission) vs `resolveSpendAmountWei()` (spend).
 */
import { parseUnits } from 'viem';

/** 2^256 - 1. The ERC20 "infinite" allowance value. */
export const MAX_UINT256 = BigInt(
  '115792089237316195423570985008687907853269984665640564039457584007913129639935'
);

/**
 * Standard approval amount for every EVM swap/multi-send approval: max uint256.
 * Intentionally independent of the amount being swapped — the swap amount is bounded
 * by {@link resolveSpendAmountWei}, not by the allowance.
 */
export function getStandardApprovalAmount(): bigint {
  return MAX_UINT256;
}

/**
 * The amount a swap/transfer is authorized to move, in the token's smallest unit.
 * This is ALWAYS the user-entered `requestedAmount` — the function has no access to
 * (and must never be given) the wallet balance or the current allowance.
 *
 * @param requestedAmount Human-readable amount the user asked to swap, e.g. "10".
 * @param decimals        Token decimals.
 */
export function resolveSpendAmountWei(requestedAmount: string, decimals: number): bigint {
  return parseUnits(requestedAmount, decimals);
}

/**
 * Balance left after a swap of `spendWei` from a wallet holding `balanceWei`.
 * Present so the "remaining balance is untouched beyond the requested amount"
 * property is expressible and testable. Never returns negative.
 */
export function remainingBalanceAfterSpend(balanceWei: bigint, spendWei: bigint): bigint {
  const remaining = balanceWei - spendWei;
  return remaining > BigInt(0) ? remaining : BigInt(0);
}
