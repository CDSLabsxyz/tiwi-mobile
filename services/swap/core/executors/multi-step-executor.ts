/**
 * Multi-Step Swap Executor
 *
 * Executes complex routes with multiple steps:
 * - Multiple swaps on same chain (multi-hop)
 * - Cross-chain bridges
 * - Unwrap operations
 *
 * Each step may require a separate user signature (approval + swap).
 * The executor handles token approvals for intermediate tokens automatically.
 */

import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute, RouteStep } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { PancakeSwapExecutor } from './pancakeswap-executor';
import { UniswapExecutor } from './uniswap-executor';
import { ensureCorrectChain } from '../utils/wallet-helpers';
import { isSolanaChain, isTONChain, isTRONChain, isCosmosChain } from '../utils/chain-helpers';
import { ensureTokenApproval } from '../services/approval-handler';

/** True for chains this EVM-only executor cannot drive (Solana/TON/TRON/Cosmos). */
const isNonEvmChain = (chainId?: number): boolean =>
  !!chainId && (isSolanaChain(chainId) || isTONChain(chainId) || isTRONChain(chainId) || isCosmosChain(chainId));
import type { Address } from 'viem';

// Router addresses per chain for approval
const PANCAKESWAP_V2_ROUTER: Record<number, string> = {
  56: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  1: '0xEfF92A263d31888d860bD50809A8D171709b7b1c',
};

const UNISWAP_V2_ROUTER: Record<number, string> = {
  1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  42161: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
  10: '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2',
  8453: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
  137: '0xedf6066a2b290C185783862C7F4776A2C8077AD1',
};

/**
 * Check if token address is a native token (ETH, BNB, etc.)
 */
function isNativeToken(address: string): boolean {
  const lower = address.toLowerCase();
  return (
    lower === '0x0000000000000000000000000000000000000000' ||
    lower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  );
}

/**
 * Get the router contract address for a given protocol and chain
 */
function getRouterAddressForProtocol(protocol: string, chainId: number): string | null {
  const protocolLower = protocol.toLowerCase();

  if (protocolLower.includes('pancake')) {
    return PANCAKESWAP_V2_ROUTER[chainId] || null;
  }

  if (protocolLower.includes('uniswap') || protocolLower.includes('sushi')) {
    return UNISWAP_V2_ROUTER[chainId] || null;
  }

  // For LiFi, approval is handled by the LiFi SDK
  return null;
}

/**
 * Multi-Step Executor
 *
 * Handles routes with multiple steps (swaps, bridges, unwraps).
 * Each step is executed sequentially with proper token approvals.
 */
export class MultiStepExecutor implements SwapRouterExecutor {
  /**
   * Check if this executor can handle the given route
   */
  canHandle(route: RouterRoute): boolean {
    // Handle universal routes, multi-hop routes, cross-chain multi-hop routes, or routes with multiple steps
    const isMultiStep =
      route.router === 'universal' ||
      route.router === 'multi-hop' ||
      route.router === 'multi-hop-bridge' ||
      (route.steps && Array.isArray(route.steps) && route.steps.length > 1);
    if (!isMultiStep) return false;

    // This executor drives every leg with EVM clients (ensureCorrectChain / viem). It CANNOT handle
    // a non-EVM source or leg - attempting to throws "Chain <id> is not an EVM chain". Decline those
    // so canExecute() is false and useSwapQuote falls back to a VM-aware aggregator (relay/rubic/…).
    if (isNonEvmChain(route.fromToken.chainId)) return false;
    if (isNonEvmChain(route.toToken.chainId)) return false;
    if (Array.isArray(route.steps) && route.steps.some((s: any) => isNonEvmChain(s?.chainId))) return false;
    return true;
  }

  /**
   * Execute multi-step route
   *
   * Each step may require:
   * 1. Chain switch (if moving to a different chain)
   * 2. Token approval (user signs approval tx)
   * 3. Swap/bridge execution (user signs swap tx)
   */
  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, toToken, fromAmount, userAddress, onStatusUpdate } = params;

    try {
      // Validate route has steps
      if (!route.steps || !Array.isArray(route.steps) || route.steps.length === 0) {
        throw new SwapExecutionError(
          'Route has no steps',
          SwapErrorCode.INVALID_ROUTE
        );
      }

      const totalSteps = route.steps.length;
      console.log(`[MultiStepExecutor] 🚀 Starting multi-step execution with ${totalSteps} steps`);

      // Track state across steps
      let currentAmount = fromAmount;
      let currentChain = fromToken.chainId || route.fromToken.chainId;
      const allTxHashes: string[] = [];
      let lastTxHash: string | undefined;

      // Ensure wallet is on the correct initial chain
      await ensureCorrectChain(currentChain);

      for (let i = 0; i < totalSteps; i++) {
        const step = route.steps[i] as RouteStep;
        const stepNumber = i + 1;

        console.log(`[MultiStepExecutor] 📍 Executing step ${stepNumber}/${totalSteps}:`, {
          type: step.type,
          protocol: step.protocol,
          chainId: step.chainId,
          fromToken: step.fromToken?.address?.slice(0, 10),
          toToken: step.toToken?.address?.slice(0, 10),
        });

        // Update status
        onStatusUpdate?.({
          stage: 'preparing',
          message: `Step ${stepNumber}/${totalSteps}: ${this.getStepDescription(step)}`,
          progress: Math.round(((stepNumber - 1) / totalSteps) * 100),
        });

        // Switch chain if needed
        const stepChainId = step.chainId || currentChain;
        if (stepChainId !== currentChain) {
          onStatusUpdate?.({
            stage: 'preparing',
            message: `Switching to ${this.getChainName(stepChainId)}...`,
          });
          await ensureCorrectChain(stepChainId);
          currentChain = stepChainId;
        }

        // Execute step based on type
        let stepResult: {
          success: boolean;
          amountOut: string;
          txHash?: string;
          error?: string;
        };

        switch (step.type) {
          case 'swap':
            stepResult = await this.executeSwapStep(
              step,
              currentAmount,
              stepChainId,
              userAddress,
              onStatusUpdate,
              stepNumber,
              totalSteps
            );
            break;

          case 'bridge':
            stepResult = await this.executeBridgeStep(
              step,
              currentAmount,
              stepChainId,
              userAddress,
              onStatusUpdate,
              stepNumber,
              totalSteps
            );
            break;

          case 'unwrap':
            stepResult = await this.executeUnwrapStep(
              step,
              currentAmount,
              stepChainId,
              userAddress,
              onStatusUpdate
            );
            break;

          default:
            stepResult = { success: false, amountOut: '0', error: `Unknown step type: ${step.type}` };
        }

        if (!stepResult.success) {
          throw new SwapExecutionError(
            `Step ${stepNumber}/${totalSteps} failed: ${stepResult.error}`,
            SwapErrorCode.EXECUTION_FAILED
          );
        }

        // Update tracking
        currentAmount = stepResult.amountOut;
        if (stepResult.txHash) {
          allTxHashes.push(stepResult.txHash);
          lastTxHash = stepResult.txHash;
        }

        console.log(`[MultiStepExecutor] ✅ Step ${stepNumber}/${totalSteps} complete. Output: ${currentAmount}`);
      }

      onStatusUpdate?.({
        stage: 'completed',
        message: `Success`,
        progress: 100,
        txHash: lastTxHash,
      });

      return {
        success: true,
        txHash: lastTxHash || allTxHashes[0] || '',
        txHashes: allTxHashes,
      };
    } catch (error: any) {
      console.error('[MultiStepExecutor] ❌ Execution failed:', error);

      const { formatErrorMessage } = await import('../utils/error-handler');
      onStatusUpdate?.({
        stage: 'failed',
        message: formatErrorMessage(error),
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return {
        success: false,
        txHash: '',
        error: error instanceof Error ? error : new Error(error.message || 'Unknown error'),
      };
    }
  }

  /**
   * Execute a swap step
   *
   * This handles:
   * 1. Token approval for the fromToken to the router
   * 2. Selecting the correct executor (PancakeSwap, Uniswap, etc.)
   * 3. Executing the swap
   */
  private async executeSwapStep(
    step: RouteStep,
    currentAmount: string,
    chainId: number,
    userAddress: string,
    onStatusUpdate?: (status: any) => void,
    stepNumber?: number,
    totalSteps?: number
  ): Promise<{ success: boolean; amountOut: string; txHash?: string; error?: string }> {
    try {
      const fromTokenAddress = step.fromToken.address;
      const toTokenAddress = step.toToken.address;
      const protocol = step.protocol || '';

      console.log(`[MultiStepExecutor] 🔄 Swap step: ${fromTokenAddress.slice(0, 10)} → ${toTokenAddress.slice(0, 10)} via ${protocol}`);

      // Step 1: Token approval (if not native token)
      if (!isNativeToken(fromTokenAddress)) {
        const routerAddress = getRouterAddressForProtocol(protocol, chainId);

        if (routerAddress) {
          onStatusUpdate?.({
            stage: 'approving',
            message: `Step ${stepNumber}/${totalSteps}: Approving ${step.fromToken.symbol || 'token'}...`,
          });

          console.log(`[MultiStepExecutor] Checking/approving token ${fromTokenAddress} for router ${routerAddress}`);

          await ensureTokenApproval(
            fromTokenAddress,
            userAddress,
            routerAddress,
            currentAmount, // Amount to approve
            chainId,
            (msg) => {
              onStatusUpdate?.({
                stage: 'approving',
                message: `Step ${stepNumber}/${totalSteps}: ${msg}`,
              });
            }
          );
        }
      }

      // Step 2: Select executor based on protocol
      let executor: SwapRouterExecutor;
      const protocolLower = protocol.toLowerCase();

      if (protocolLower.includes('pancake')) {
        executor = new PancakeSwapExecutor();
      } else if (protocolLower.includes('uniswap') || protocolLower.includes('sushi')) {
        executor = new UniswapExecutor();
      } else if (protocolLower.includes('lifi')) {
        // For LiFi, use LiFi executor
        const { LiFiExecutor } = await import('./lifi-executor');
        executor = new LiFiExecutor();
      } else {
        // Default: try PancakeSwap for BSC, Uniswap for others
        if (chainId === 56) {
          executor = new PancakeSwapExecutor();
        } else {
          executor = new UniswapExecutor();
        }
        console.log(`[MultiStepExecutor] No specific executor for protocol "${protocol}", defaulting to ${chainId === 56 ? 'PancakeSwap' : 'Uniswap'}`);
      }

      // Step 3: Build a proper RouterRoute for the executor
      const stepRoute: RouterRoute = {
        router: protocolLower.includes('pancake') ? 'pancakeswap' :
          protocolLower.includes('uniswap') || protocolLower.includes('sushi') ? 'uniswap' :
            protocolLower.includes('lifi') ? 'lifi' :
              chainId === 56 ? 'pancakeswap' : 'uniswap',
        routeId: `step-${stepNumber}-${Date.now()}`,
        fromToken: {
          chainId,
          address: fromTokenAddress,
          symbol: step.fromToken.symbol || '',
          amount: currentAmount,
          decimals: step.fromToken.decimals || 18,
        },
        toToken: {
          chainId,
          address: toTokenAddress,
          symbol: step.toToken.symbol || '',
          amount: step.toToken.amount || '0',
          decimals: step.toToken.decimals || 18,
        },
        exchangeRate: '0',
        priceImpact: '0',
        slippage: '1', // Higher slippage for intermediate hops
        fees: {
          protocol: '0',
          gas: '0',
          gasUSD: '0',
          total: '0',
        },
        steps: [step],
        estimatedTime: 0,
        expiresAt: Date.now() + 120000, // 2 min expiry
        raw: {
          path: [fromTokenAddress, toTokenAddress],
          isMultiHopStep: true,
        },
      };

      // Step 4: Execute the swap - user will sign the transaction
      onStatusUpdate?.({
        stage: 'signing',
        message: `Step ${stepNumber}/${totalSteps}: Sign swap ${step.fromToken.symbol || 'token'} → ${step.toToken.symbol || 'token'}...`,
      });

      const result = await executor.execute({
        route: stepRoute,
        fromToken: {
          chainId,
          address: fromTokenAddress,
          symbol: step.fromToken.symbol || '',
          decimals: step.fromToken.decimals || 18,
        } as any,
        toToken: {
          chainId,
          address: toTokenAddress,
          symbol: step.toToken.symbol || '',
          decimals: step.toToken.decimals || 18,
        } as any,
        fromAmount: currentAmount,
        userAddress,
        onStatusUpdate: (status: any) => {
          // Prefix step number to status messages
          onStatusUpdate?.({
            ...status,
            message: `Step ${stepNumber}/${totalSteps}: ${status.message}`,
          });
        },
      });

      if (!result.success) {
        return {
          success: false,
          amountOut: '0',
          error: result.error?.message || 'Swap step failed',
        };
      }

      // Use the output amount from the step data or the actual result
      const amountOut = result.actualToAmount || step.toToken.amount || currentAmount;

      return {
        success: true,
        amountOut,
        txHash: result.txHash,
      };
    } catch (error: any) {
      console.error('[MultiStepExecutor] Swap step error:', error);
      return {
        success: false,
        amountOut: '0',
        error: error.message || 'Swap step failed',
      };
    }
  }

  /**
   * Execute a bridge step
   *
   * Uses LiFi router for cross-chain bridging.
   * The user will need to sign the bridge transaction.
   */
  private async executeBridgeStep(
    step: RouteStep,
    currentAmount: string,
    chainId: number,
    userAddress: string,
    onStatusUpdate?: (status: any) => void,
    stepNumber?: number,
    totalSteps?: number
  ): Promise<{ success: boolean; amountOut: string; txHash?: string; error?: string }> {
    try {
      const fromTokenAddress = step.fromToken.address;
      const toTokenAddress = step.toToken.address;
      const protocol = step.protocol || 'lifi';

      console.log(`[MultiStepExecutor] 🌉 Bridge step: ${fromTokenAddress.slice(0, 10)} (chain ${chainId}) → ${toTokenAddress.slice(0, 10)} via ${protocol}`);

      // For bridge steps, use LiFi executor which handles cross-chain
      const { LiFiExecutor } = await import('./lifi-executor');
      const lifiExecutor = new LiFiExecutor();

      // Extract destination chain from step description or route
      const destChainMatch = step.description?.match(/to (\d+)/);
      const destChainId = destChainMatch ? parseInt(destChainMatch[1]) : chainId;

      // Token approval for bridge
      if (!isNativeToken(fromTokenAddress)) {
        onStatusUpdate?.({
          stage: 'approving',
          message: `Step ${stepNumber}/${totalSteps}: Approving ${step.fromToken.symbol || 'token'} for bridge...`,
        });

        // LiFi handles approval internally, but we can pre-approve if needed
      }

      // Build bridge route
      const bridgeRoute: RouterRoute = {
        router: 'lifi',
        routeId: `bridge-step-${stepNumber}-${Date.now()}`,
        fromToken: {
          chainId,
          address: fromTokenAddress,
          symbol: step.fromToken.symbol || '',
          amount: currentAmount,
          decimals: step.fromToken.decimals || 18,
        },
        toToken: {
          chainId: destChainId,
          address: toTokenAddress,
          symbol: step.toToken.symbol || '',
          amount: step.toToken.amount || '0',
          decimals: step.toToken.decimals || 18,
        },
        exchangeRate: '0',
        priceImpact: '0',
        slippage: '1',
        fees: {
          protocol: '0',
          gas: '0',
          gasUSD: '0',
          total: '0',
        },
        steps: [step],
        estimatedTime: 0,
        expiresAt: Date.now() + 300000, // 5 min expiry for bridge
        raw: {
          isBridgeStep: true,
        },
      };

      onStatusUpdate?.({
        stage: 'signing',
        message: `Step ${stepNumber}/${totalSteps}: Sign bridge transaction...`,
      });

      const result = await lifiExecutor.execute({
        route: bridgeRoute,
        fromToken: {
          chainId,
          address: fromTokenAddress,
          symbol: step.fromToken.symbol || '',
          decimals: step.fromToken.decimals || 18,
        } as any,
        toToken: {
          chainId: destChainId,
          address: toTokenAddress,
          symbol: step.toToken.symbol || '',
          decimals: step.toToken.decimals || 18,
        } as any,
        fromAmount: currentAmount,
        userAddress,
        onStatusUpdate: (status: any) => {
          onStatusUpdate?.({
            ...status,
            message: `Step ${stepNumber}/${totalSteps}: ${status.message}`,
          });
        },
      });

      if (!result.success) {
        return {
          success: false,
          amountOut: '0',
          error: result.error?.message || 'Bridge step failed',
        };
      }

      const amountOut = result.actualToAmount || step.toToken.amount || currentAmount;

      return {
        success: true,
        amountOut,
        txHash: result.txHash,
      };
    } catch (error: any) {
      console.error('[MultiStepExecutor] Bridge step error:', error);
      return {
        success: false,
        amountOut: '0',
        error: error.message || 'Bridge step failed',
      };
    }
  }

  /**
   * Execute unwrap step (WETH → ETH)
   */
  private async executeUnwrapStep(
    step: RouteStep,
    currentAmount: string,
    chainId: number,
    userAddress: string,
    onStatusUpdate?: (status: any) => void
  ): Promise<{ success: boolean; amountOut: string; txHash?: string; error?: string }> {
    try {
      // WETH unwrap transaction
      const WETH_ABI = [
        {
          inputs: [{ internalType: 'uint256', name: 'wad', type: 'uint256' }],
          name: 'withdraw',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ] as const;

      const WETH_ADDRESSES: Record<number, Address> = {
        1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address,
        56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
        42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address,
        10: '0x4200000000000000000000000000000000000006' as Address,
        8453: '0x4200000000000000000000000000000000000006' as Address,
        137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' as Address,
      };

      const wethAddress = WETH_ADDRESSES[chainId];
      if (!wethAddress) {
        return { success: false, amountOut: '0', error: `WETH not found for chain ${chainId}` };
      }

      const { getEVMWalletClient, getEVMPublicClient } = await import('../utils/wallet-helpers');

      const walletClient = await getEVMWalletClient(chainId);
      const publicClient = getEVMPublicClient(chainId);

      onStatusUpdate?.({
        stage: 'signing',
        message: 'Signing unwrap transaction...',
      });

      const amountIn = BigInt(currentAmount);
      const hash = await walletClient.writeContract({
        address: wethAddress,
        abi: WETH_ABI,
        functionName: 'withdraw',
        args: [amountIn],
      } as any);

      onStatusUpdate?.({
        stage: 'confirming',
        message: 'Waiting for unwrap confirmation...',
      });

      await publicClient.waitForTransactionReceipt({ hash });

      return {
        success: true,
        amountOut: currentAmount, // 1:1 unwrap
        txHash: hash,
      };
    } catch (error: any) {
      return { success: false, amountOut: '0', error: error.message || 'Unwrap step failed' };
    }
  }

  /**
   * Get description for step
   */
  private getStepDescription(step: RouteStep): string {
    const fromSymbol = step.fromToken?.symbol || 'token';
    const toSymbol = step.toToken?.symbol || 'token';

    switch (step.type) {
      case 'swap':
        return `Swapping ${fromSymbol} → ${toSymbol} via ${step.protocol || 'DEX'}`;
      case 'bridge':
        return `Bridging ${fromSymbol} to destination chain`;
      case 'unwrap':
        return 'Unwrapping to native token';
      default:
        return 'Processing';
    }
  }

  /**
   * Get chain name
   */
  private getChainName(chainId: number): string {
    const names: Record<number, string> = {
      1: 'Ethereum',
      56: 'BSC',
      137: 'Polygon',
      42161: 'Arbitrum',
      10: 'Optimism',
      8453: 'Base',
    };
    return names[chainId] || `Chain ${chainId}`;
  }
}
