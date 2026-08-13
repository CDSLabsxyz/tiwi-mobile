/**
 * Error Handler Utilities
 * 
 * Utilities for handling and formatting swap execution errors.
 */

import { SwapExecutionError, SwapErrorCode } from '../types';

function isGasShortageMessage(lowerMessage: string): boolean {
  return (
    lowerMessage.includes("insufficient fund for gas") ||
    lowerMessage.includes("intrinsic gas too low") ||
    lowerMessage.includes("doesn't have enough funds") ||
    lowerMessage.includes("gas required exceeds allowance") ||
    lowerMessage.includes("gas * price + value")
  );
}

function isOutputShortageMessage(lowerMessage: string): boolean {
  return /insufficient[_\s-]*output(?:[_\s-]*amount)?/.test(lowerMessage);
}

function isBalanceShortageMessage(lowerMessage: string): boolean {
  return (
    (lowerMessage.includes("insufficient balance") ||
      lowerMessage.includes("not enough balance") ||
      lowerMessage.includes("exceeds balance") ||
      lowerMessage.includes("insufficient")) &&
    !isGasShortageMessage(lowerMessage) &&
    !isOutputShortageMessage(lowerMessage)
  );
}

/**
 * Format error message for user display
 */
export function formatErrorMessage(error: unknown): string {
  if (!error) return "Failed";

  // Deep extract message from various error structures
  let rawMessage = "";

  if (typeof error === "string") {
    rawMessage = error;
  } else if (error && typeof error === 'object') {
    // Try to find the most useful message property
    const err = error as any;
    rawMessage =
      err.shortMessage ||
      err.message ||
      (err.cause && typeof err.cause === 'object' ? err.cause.message || err.cause.shortMessage : "") ||
      err.details ||
      err.reason ||
      String(error);
  } else {
    rawMessage = String(error);
  }

  const lowerMessage = rawMessage.toLowerCase();

  if (isOutputShortageMessage(lowerMessage)) {
    return "Price moved beyond the protected minimum — refresh the quote and try again";
  }

  // 1. GLOBAL REJECTION CHECK (The most important one)
  // If ANY part of the error message contains rejection keywords, return ONLY "User rejected"
  if (
    /rejected|user rejected|user_rejected|cancelled|denied|declined/i.test(lowerMessage)
  ) {
    return "User rejected";
  }

  // 2. STRIP TECHNICAL TRACES
  // If we see typical viem/RPC technical markers, we classify but don't show the trace
  if (
    lowerMessage.includes("request arguments:") ||
    lowerMessage.includes("details:") ||
    lowerMessage.includes("version: viem") ||
    lowerMessage.includes("raw error:") ||
    lowerMessage.includes("rpc error:") ||
    lowerMessage.includes("contract call:") ||
    rawMessage.length > 200 // Likely a technical trace if it's this long
  ) {
    if (isGasShortageMessage(lowerMessage)) return "Insufficient gas";
    if (isBalanceShortageMessage(lowerMessage)) return "Insufficient balance";
    if (lowerMessage.includes("gas estimation") || lowerMessage.includes("estimategas") || lowerMessage.includes("gas uint64 overflow") || lowerMessage.includes("execution reverted")) return "Transaction failed — try again";
    if (lowerMessage.includes("allowance") || lowerMessage.includes("approve")) return "Approval failed";
    if (lowerMessage.includes("slippage")) return "High slippage";
    if (lowerMessage.includes("expired") || lowerMessage.includes("deadline")) return "Price expired";
    return "Transaction failed";
  }

  // 3. Balance issues (Simplified)
  if (isGasShortageMessage(lowerMessage)) {
    return "Insufficient gas";
  }
  if (isBalanceShortageMessage(lowerMessage)) {
    return "Insufficient balance";
  }
  if (lowerMessage.includes("gas estimation") || lowerMessage.includes("estimategas")) {
    return "Transaction failed — try again";
  }
  if (lowerMessage.includes("allowance") || lowerMessage.includes("approve") || lowerMessage.includes("permitted")) {
    return "Approval failed";
  }

  // 5. Network/Connection
  if (
    /network|rpc|failed to fetch|fetch|connection|timeout|provider/i.test(lowerMessage)
  ) {
    return "Connection error";
  }

  // 6. Swap specifics
  if (lowerMessage.includes("slippage") || lowerMessage.includes("price movement") || lowerMessage.includes("too much")) {
    return "High slippage";
  }
  if (lowerMessage.includes("expired") || lowerMessage.includes("deadline")) {
    return "Price expired";
  }
  // Check wallet-connection errors BEFORE the route mapping — otherwise a message
  // like "TRON wallet not found" matches "not found" and mis-renders as
  // "No route found", masking the real cause.
  if (lowerMessage.includes("wallet not connected") || lowerMessage.includes("wallet not found")) {
    return "Wallet not connected";
  }
  // A route that quoted but has no executor (e.g. a Cosmos/Skip route on a build
  // without the Skip executor). This is NOT "no route" — surface it honestly.
  if (lowerMessage.includes("no executor found")) {
    return "This swap route isn’t supported yet";
  }
  // Genuine routing failures only. Deliberately does NOT match a bare "route"
  // (that also matches "router:" in messages like "No executor found for
  // router: skip"), a bare "not found", or authored "…isn’t supported yet"
  // guidance — those must fall through to the verbatim passthrough below rather
  // than being masked as "No route found".
  if (
    /no route|route not found|no path|no liquidity|cannot find a route|unable to find a (swap )?route/i.test(lowerMessage)
  ) {
    return "No route found";
  }

  // 7. Authored, human-readable messages — pass through verbatim.
  // Executors intentionally surface clean guidance (e.g. the cross-chain
  // minimum: "Amount too small for a cross-chain swap (~$0.76)…"). These carry
  // no technical noise (hex data, JSON, viem/stack traces), so show them as-is
  // instead of flattening to "Transaction failed". Short messages always pass;
  // longer ones pass only when they look human (no hex blobs / braces / newlines).
  const looksTechnical = /0x[0-9a-f]{6,}|[{}]|\n|\bat\s+0x|reverted|revert reason/i.test(rawMessage);
  if (rawMessage.length < 35 || (!looksTechnical && rawMessage.length <= 180)) {
    return rawMessage;
  }

  // ULTIMATE FALLBACK: Return generic short message for anything complex
  return "Transaction failed";
}

/**
 * Create a SwapExecutionError from various error types
 */
export function createSwapError(
  error: unknown,
  code: SwapErrorCode,
  router?: string
): SwapExecutionError {
  if (error instanceof SwapExecutionError) {
    return error;
  }

  const message = formatErrorMessage(error);
  const originalError = error instanceof Error ? error : undefined;

  return new SwapExecutionError(message, code, router, originalError);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof SwapExecutionError) {
    // Network errors are retryable
    if (error.code === SwapErrorCode.NETWORK_ERROR) {
      return true;
    }
    // User rejection is not retryable
    if (error.code === SwapErrorCode.TRANSACTION_REJECTED ||
      error.code === SwapErrorCode.APPROVAL_REJECTED) {
      return false;
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Retryable errors
    if (
      message.includes('network') ||
      message.includes('rpc') ||
      message.includes('timeout') ||
      message.includes('connection')
    ) {
      return true;
    }

    // Solana blockhash expiration is retryable (tx was sent, just confirmation timed out)
    if (message.includes('block height exceeded') || message.includes('blockheightexceeded')) {
      return true;
    }

    // Non-retryable errors
    if (
      message.includes('rejected') ||
      message.includes('insufficient') ||
      message.includes('expired')
    ) {
      return false;
    }
  }

  // Default to not retryable
  return false;
}

/**
 * Extract error code from error
 */
export function getErrorCode(error: unknown): SwapErrorCode {
  if (error instanceof SwapExecutionError) {
    return error.code as SwapErrorCode;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('rejected')) {
      return SwapErrorCode.TRANSACTION_REJECTED;
    }
    if (message.includes('insufficient') && !isOutputShortageMessage(message)) {
      return SwapErrorCode.INSUFFICIENT_BALANCE;
    }
    if (message.includes('network') || message.includes('rpc')) {
      return SwapErrorCode.NETWORK_ERROR;
    }
    // Solana blockhash expiration is not a quote expiration
    if (message.includes('expired') && !message.includes('block height')) {
      return SwapErrorCode.QUOTE_EXPIRED;
    }
  }

  return SwapErrorCode.UNKNOWN_ERROR;
}
