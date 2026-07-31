/**
 * Swap Execution Types
 * 
 * Type definitions for the swap execution system.
 * These types define the contract between the swap executor and router-specific handlers.
 */

import type { Token } from '@/services/swap/core/token-types';
import type { RouterRoute } from '@/services/swap/core/router-types';

// ============================================================================
// Execution Parameters
// ============================================================================

/**
 * Parameters for executing a swap
 */
export interface SwapExecutionParams {
  // Route information
  route: RouterRoute;

  // Token information
  fromToken: Token;
  toToken: Token;
  fromAmount: string;  // Human-readable amount (e.g., "100.5")

  // User information
  userAddress: string;  // User's wallet address
  recipientAddress?: string;  // Optional recipient (for cross-chain)

  // Execution options
  slippage?: number;  // Override slippage (optional)
  isFeeOnTransfer?: boolean;  // Whether to use fee-on-transfer supporting functions (defaults to true)
  skipTax?: boolean;  // Skip Tiwi tax collection for THIS execution. Set on the 2nd leg of a
                      // multi-leg swap so the platform fee is only ever charged once (on leg 1).
  onStatusUpdate?: (status: SwapExecutionStatus) => void;  // Status callback
  walletClient?: any; // Wallet client for signing (optional)
}

/**
 * Status updates during swap execution
 */
export interface SwapExecutionStatus {
  stage: SwapStage;
  message: string;
  progress?: number;  // 0-100
  txHash?: string;  // Transaction hash (if available)
  error?: Error;  // Error (if failed)
}

export type SwapStage =
  | 'preparing'      // Preparing swap
  | 'approving'      // Approving token (EVM only)
  | 'signing'        // Waiting for user signature
  | 'submitting'     // Submitting transaction
  | 'confirming'     // Waiting for confirmation
  | 'completed'      // Swap completed
  | 'failed';        // Swap failed

// ============================================================================
// Execution Result
// ============================================================================

/**
 * Result of swap execution
 */
export interface SwapExecutionResult {
  success: boolean;
  txHash: string;  // Primary transaction hash
  txHashes?: string[];  // All transaction hashes (for multi-step swaps)
  receipt?: any;  // Transaction receipt
  error?: Error;  // Error (if failed)
  actualToAmount?: string;  // Actual output amount (after execution)
}

// ============================================================================
// Router-Specific Execution Handlers
// ============================================================================

/**
 * Interface for router-specific execution handlers
 */
export interface SwapRouterExecutor {
  /**
   * Execute a swap using this router
   */
  execute(params: SwapExecutionParams): Promise<SwapExecutionResult>;

  /**
   * Check if this executor can handle the given route
   */
  canHandle(route: RouterRoute): boolean;

  /**
   * Get the spender address for token approval if needed
   */
  getSpenderAddress?(route: RouterRoute): Promise<string | null>;
}

// ============================================================================
// Approval Information
// ============================================================================

/**
 * Token approval information
 */
export interface ApprovalInfo {
  tokenAddress: string;
  spenderAddress: string;
  amount: string;  // Amount to approve (in smallest unit)
  currentAllowance: string;  // Current allowance
  needsApproval: boolean;
}

// ============================================================================
// Transaction Helpers
// ============================================================================

/**
 * EVM transaction data
 */
export interface EVMTransactionData {
  to: string;
  data: string;
  value?: string;  // Native token amount (if needed)
  gasLimit?: string;
  chainId: number;
}

/**
 * Solana transaction data
 */
export interface SolanaTransactionData {
  transaction: string;  // Base64 encoded transaction
  recentBlockhash: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Swap execution error
 */
export class SwapExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public router?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SwapExecutionError';
  }
}

/**
 * Common error codes
 */
export enum SwapErrorCode {
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  APPROVAL_REJECTED = 'APPROVAL_REJECTED',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  QUOTE_EXPIRED = 'QUOTE_EXPIRED',
  INVALID_ROUTE = 'INVALID_ROUTE',
  UNSUPPORTED_ROUTER = 'UNSUPPORTED_ROUTER',
  NETWORK_ERROR = 'NETWORK_ERROR',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  USER_REJECTED = 'USER_REJECTED',
  CHAIN_SWITCH_FAILED = 'CHAIN_SWITCH_FAILED',
}

