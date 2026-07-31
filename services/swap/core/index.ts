/**
 * Swap Executor Service
 * 
 * Main service for executing swaps across different routers.
 * Orchestrates router-specific executors and provides a unified interface.
 */

import type { SwapExecutionParams, SwapExecutionResult, SwapExecutionStatus, SwapRouterExecutor } from './types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { TiwiProtocolDEXExecutor } from './executors/tiwi-protocol-dex-executor';
import { BscGaslessExecutor } from './executors/bsc-gasless-executor';
import { BscDirectSwapExecutor } from './executors/bsc-direct-swap-executor';
import { BscRelayerExecutor } from './executors/bsc-relayer-executor';
import { BscNativeSwapExecutor } from './executors/bsc-native-swap-executor';
import { OpenOceanExecutor } from './executors/openocean-executor';
import { LiFiExecutor } from './executors/lifi-executor';
import { JupiterExecutor } from './executors/jupiter-executor';
import { PancakeSwapExecutor } from './executors/pancakeswap-executor';
import { UniswapExecutor } from './executors/uniswap-executor';
import { RubicExecutor } from './executors/rubic-executor';
import { RelayExecutor } from './executors/relay-executor';
import { TONExecutor } from './executors/ton-executor';
import { SquidExecutor } from './executors/squid-executor';
import { TronSwapExecutor } from './executors/tronswap-executor';
import { MultiStepExecutor } from './executors/multi-step-executor';
import { TiwiMultiSwapExecutor } from './executors/tiwi-multiswap-executor';
import { CrossChainPreSwapExecutor } from './executors/cross-chain-preswap-executor';
import { CrossChainOrchestratorExecutor } from './executors/cross-chain-orchestrator-executor';
import { TiwiCctpExecutor } from './executors/tiwi-cctp-executor';
import { MesonExecutor } from './executors/meson-executor';
import { AcrossExecutor } from './executors/across-executor';
import { CetusExecutor } from './executors/cetus-executor';
import { MayanSuiExecutor } from './executors/mayan-sui-executor';
import { SkipExecutor } from './executors/skip-executor';
import { TiwiPoolExecutor } from './executors/tiwi-pool-executor';
import { SwapExecutionError, SwapErrorCode } from './types';

// BLACKLISTED contracts — never allow TIWI Protocol users to interact with these
const BLACKLISTED_CONTRACTS = new Set([
  '0xac1ce734566f390a94b4571ce386795b52a5a288', // PancakeSwap Multicall V3
  '0x556b9306565093c855aea9ae92a594704c2cd59e', // PancakeSwap Multicall V2
]);

/**
 * Swap Executor Service
 *
 * Main entry point for executing swaps.
 * Automatically selects the appropriate router executor based on the route.
 */
export class SwapExecutor {
  private executors: SwapRouterExecutor[];

  constructor() {
    // Initialize all router executors
    // TiwiProtocolDEX is HIGHEST PRIORITY — single-signature swaps on BSC.
    // Falls through to old executors if contract not deployed (address = 0x0).
    // BscGaslessExecutor is the V2.1 fallback (needs 2-3 signatures).
    // MultiStepExecutor should be last as it handles universal routes.
    this.executors = [
      // Deep-linked "swap through this liquidity pool" (router:'tiwi-pool'). Settles
      // directly against a TiwiLiquidityPair (approve + swapExactTokensForTokens).
      // First so it never gets shadowed by a same-chain aggregator executor.
      new TiwiPoolExecutor(),
      new TiwiProtocolDEXExecutor(), // SINGLE SIGN: TiwiProtocolDEX contract (approve once, swap forever)
      new BscGaslessExecutor(), // V2.1 fallback: gasless but needs gas token approval
      new BscDirectSwapExecutor(), // BNB gas selected: user pays own gas
      new BscRelayerExecutor(), // V1 fallback
      new BscNativeSwapExecutor(), // Native BNB → Token swaps with 0.25% tax
      // Cross-chain FROM a taxed token (e.g. TWC): pre-swap to stable on source, then
      // bridge the stable via LiFi/Relay (Phase 4a). Must precede the aggregators.
      new CrossChainPreSwapExecutor(),
      new LiFiExecutor(),
      new JupiterExecutor(),
      new PancakeSwapExecutor(),
      new UniswapExecutor(),
      new OpenOceanExecutor(), // Sei aggregator (pre-built calldata from OpenOceanAdapter)
      new RubicExecutor(),
      new RelayExecutor(),
      new TONExecutor(),
      new SquidExecutor(),
      // Cosmos / IBC swaps via Skip (dYdX, Neutron, Osmosis, Celestia, …). Handles
      // router:'skip' by signing+broadcasting the source-chain Cosmos tx with the
      // internal wallet's cosmjs signer (or external Keplr/Leap). Only Cosmos routes.
      new SkipExecutor(),
      new TronSwapExecutor(),
      // Sui same-chain swaps via the Cetus aggregator (DeepBook/Aftermath/Turbos/
      // Kriya/FlowX). Signs with the internal seed wallet's Sui keypair or an
      // external Wallet-Standard Sui wallet. Only handles router:'cetus'.
      new CetusExecutor(),
      // Mayan cross-chain FROM Sui (native SUI → any token on a CCTP chain,
      // one Sui signature; relayer settles the destination). router:'mayan' +
      // Sui source only. Before MultiStep so it takes these over the (EVM-only)
      // multi-step path.
      new MayanSuiExecutor(),
      // One-sign escrow cross-chain (Phase 5): executes 'tiwi-bridge' routes via the
      // TiwiCrossChainOrchestrator. INERT unless NEXT_PUBLIC_ESCROW_ENABLED=true (needs
      // funded vaults + running relayer + audit). Before MultiStep so it takes over
      // tiwi-bridge routes from the 3-sig multi-step path once enabled.
      new CrossChainOrchestratorExecutor(),
      // CCTP any-to-any rail (Circle burn/mint USDC): executes 'tiwi-cctp' routes — source swap
      // to USDC + depositForBurn; the relayer delivers on the destination. INERT unless
      // NEXT_PUBLIC_CCTP_ENABLED=true. Before MultiStep so it takes tiwi-cctp routes.
      new TiwiCctpExecutor(),
      // Meson non-CCTP stablecoin bridge rail (Tron/Core + ~35 long-tail chains): executes
      // 'meson' routes via approve + signature (gasless fill by Meson's relayer). INERT unless
      // NEXT_PUBLIC_MESON_ENABLED. Before MultiStep so it takes 'meson' routes.
      new MesonExecutor(),
      // Client-side universal/V3/multi-DEX execution via TiwiMultiSwap on any EVM chain
      // where it's deployed (Phase 3b). Before MultiStep so it takes 1-hop universal routes.
      new TiwiMultiSwapExecutor(),
      new MultiStepExecutor(), // Handles universal routes and multi-step swaps
      new AcrossExecutor(), // Ultimate fallback
    ];
  }

  /**
   * Execute a swap
   * 
   * @param params - Swap execution parameters
   * @returns Swap execution result
   */
  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route } = params;

    // SECURITY: Check for blacklisted contracts in route data
    const routeAddresses = [
      route.raw?.steps?.[0]?.items?.[0]?.data?.to,
      route.raw?.steps?.[0]?.items?.[0]?.data?.approvalAddress,
      route.raw?.to,
    ].filter(Boolean);

    for (const addr of routeAddresses) {
      if (BLACKLISTED_CONTRACTS.has((addr as string).toLowerCase())) {
        throw new SwapExecutionError(
          `Blocked: This route uses a blacklisted contract. Swap cancelled for your safety.`,
          SwapErrorCode.UNSUPPORTED_ROUTER,
          route.router
        );
      }
    }

    const candidateExecutors = this.executors.filter((exec) => exec.canHandle(route));

    if (candidateExecutors.length === 0) {
      throw new SwapExecutionError(
        `No executor found for router: ${route.router}`,
        SwapErrorCode.UNSUPPORTED_ROUTER,
        route.router
      );
    }

    // Validate quote expiration
    this.validateQuoteExpiration(route);

    let lastError: unknown;

    for (let index = 0; index < candidateExecutors.length; index++) {
      const executor = candidateExecutors[index];
      const isLastCandidate = index === candidateExecutors.length - 1;

      try {
        return await executor.execute({
          ...params,
          onStatusUpdate: this.wrapStatusUpdater(params.onStatusUpdate, isLastCandidate),
        });
      } catch (error) {
        lastError = error;

        if (!this.shouldTryFallback(executor, error) || isLastCandidate) {
          throw error;
        }

        console.warn(
          `[SwapExecutor] ${this.getExecutorName(executor)} failed, falling back to ${this.getExecutorName(candidateExecutors[index + 1])}:`,
          error
        );

        params.onStatusUpdate?.({
          stage: 'preparing',
          message: 'Trying backup swap engine...',
        });
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new SwapExecutionError(
        `Swap failed for router: ${route.router}`,
        SwapErrorCode.EXECUTION_FAILED,
        route.router
      );
  }
  
  /**
   * Get the spender address for a route
   * 
   * @param route - Router route
   * @returns Spender address or null if no approval needed
   */
  async getSpenderAddress(route: any): Promise<string | null> {
    // Find executor that can handle this route
    const executor = this.executors.find((exec) => exec.canHandle(route));
    if (!executor || !executor.getSpenderAddress) {
      return null;
    }
    
    return executor.getSpenderAddress(route);
  }

  /**
   * Validate that quote hasn't expired
   */
  private validateQuoteExpiration(route: any): void {
    const now = Date.now(); // Use milliseconds consistently
    let expiresAt = route.expiresAt || route.raw?.expireAt;

    // Handle if expiresAt is in seconds (< year 2100 in ms = 4102444800000)
    // Values less than 10000000000000 (year 2286) are likely seconds
    if (expiresAt && expiresAt < 10000000000000) {
      expiresAt = expiresAt * 1000; // Convert to milliseconds
    }

    if (expiresAt && now >= expiresAt) {
      throw new SwapExecutionError(
        'Quote has expired. Please get a new quote and try again.',
        SwapErrorCode.QUOTE_EXPIRED
      );
    }
  }

  /**
   * Register a custom executor
   */
  registerExecutor(executor: SwapRouterExecutor): void {
    this.executors.push(executor);
  }

  /**
   * True if at least one registered executor can handle (execute) this route.
   * Used to avoid serving a quote whose winning route nothing can settle — e.g. a
   * universal/V3 route on an EVM chain where TiwiMultiSwap isn't deployed yet.
   */
  canExecute(route: RouterRoute): boolean {
    try {
      return this.executors.some((e) => {
        try { return e.canHandle(route); } catch { return false; }
      });
    } catch {
      return false;
    }
  }

  private getExecutorName(executor: SwapRouterExecutor): string {
    return executor.constructor?.name || 'UnknownExecutor';
  }

  private wrapStatusUpdater(
    onStatusUpdate: SwapExecutionParams['onStatusUpdate'],
    isLastCandidate: boolean
  ): SwapExecutionParams['onStatusUpdate'] {
    if (!onStatusUpdate) {
      return undefined;
    }

    return (status: SwapExecutionStatus) => {
      if (status.stage === 'failed' && !isLastCandidate) {
        return;
      }

      onStatusUpdate(status);
    };
  }

  private shouldTryFallback(executor: SwapRouterExecutor, error: unknown): boolean {
    const lowerMessage = this.extractErrorMessage(error).toLowerCase();

    // NEVER fall through on user rejection — user explicitly cancelled
    if (/rejected|user rejected|user_rejected|cancelled|denied|declined/.test(lowerMessage)) {
      return false;
    }

    // NEVER fall through on insufficient balance — no point trying another executor
    if (
      lowerMessage.includes('insufficient balance') ||
      lowerMessage.includes('not enough balance') ||
      lowerMessage.includes('exceeds balance')
    ) {
      return false;
    }

    // TiwiProtocolDEX: ALWAYS fall through on any other error.
    // The on-chain contract may not be fully configured (router not whitelisted, tax not set).
    if (executor instanceof TiwiProtocolDEXExecutor) {
      return true;
    }

    // BscGasless: fall through on relayer/network issues
    if (executor instanceof BscGaslessExecutor) {
      return (
        lowerMessage.includes('failed to fetch') ||
        lowerMessage.includes('network') ||
        lowerMessage.includes('rpc') ||
        lowerMessage.includes('timeout') ||
        lowerMessage.includes('relayer') ||
        lowerMessage.includes('gasless-swap') ||
        lowerMessage.includes('backend') ||
        lowerMessage.includes('execution reverted') ||
        lowerMessage.includes('no valid swap path')
      );
    }

    // BscDirect/BscRelayer: fall through on execution reverts and network errors
    if (executor instanceof BscDirectSwapExecutor || executor instanceof BscRelayerExecutor) {
      return (
        lowerMessage.includes('execution reverted') ||
        lowerMessage.includes('failed to fetch') ||
        lowerMessage.includes('network') ||
        lowerMessage.includes('rpc') ||
        lowerMessage.includes('timeout') ||
        lowerMessage.includes('no valid swap path') ||
        lowerMessage.includes('no liquidity')
      );
    }

    // For all other executors: fall through on network/rpc errors only
    return (
      lowerMessage.includes('failed to fetch') ||
      lowerMessage.includes('network') ||
      lowerMessage.includes('rpc') ||
      lowerMessage.includes('timeout')
    );
  }

  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      const err = error as any;
      return (
        err.shortMessage ||
        err.message ||
        (err.cause && typeof err.cause === 'object' ? err.cause.message || err.cause.shortMessage : '') ||
        err.details ||
        err.reason ||
        String(error)
      );
    }

    return String(error ?? '');
  }
}

// Export singleton instance
export const swapExecutor = new SwapExecutor();

// Export types
export type {
  SwapExecutionParams,
  SwapExecutionResult,
  SwapExecutionStatus,
  SwapStage,
} from './types';

// Export error types and utilities
export { SwapExecutionError, SwapErrorCode } from './types';
export { formatErrorMessage, createSwapError } from './utils/error-handler';
