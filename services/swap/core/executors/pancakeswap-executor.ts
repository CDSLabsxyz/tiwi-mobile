/**
 * PancakeSwap Swap Executor
 * 
 * Executes swaps using PancakeSwap V2 on BSC and other supported chains.
 */

import { getAddress, type Address, encodeFunctionData } from 'viem';
import { EVMDEXExecutor } from './evm-dex-executor';
import type { SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';

// PancakeSwap V2 Router addresses
const PANCAKESWAP_V2_ROUTER: Record<number, string> = {
  56: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // BSC Mainnet
  // Note: Other chains may use different routers or SushiSwap
  1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Ethereum (Uniswap V2)
  42161: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // Arbitrum (SushiSwap)
  10: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // Optimism (SushiSwap)
  137: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Polygon (SushiSwap)
  8453: '0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891', // Base (SushiSwap)
};

// PancakeSwap V2 Router ABI (includes getAmountsOut + fee-on-transfer support)
const PANCAKESWAP_ROUTER_ABI = [
  // getAmountsOut (used by router; matches tiwi-test ROUTER_ABI)
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsOut',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  // swapExactTokensForTokens
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // swapExactTokensForTokensSupportingFeeOnTransferTokens
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // swapExactETHForTokens
  {
    inputs: [
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactETHForTokens',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  // swapExactETHForTokensSupportingFeeOnTransferTokens
  {
    inputs: [
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  // swapExactTokensForETH
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForETH',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // swapExactTokensForETHSupportingFeeOnTransferTokens
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

/**
 * PancakeSwap executor implementation
 */
export class PancakeSwapExecutor extends EVMDEXExecutor implements SwapRouterExecutor {
  /**
   * Check if this executor can handle the given route
   */
  canHandle(route: RouterRoute): boolean {
    return route.router === 'pancakeswap';
  }

  /**
   * Get router contract address for a chain
   */
  protected getRouterAddressFromChain(chainId: number): string {
    const routerAddress = PANCAKESWAP_V2_ROUTER[chainId];
    if (!routerAddress) {
      throw new Error(`PancakeSwap router not supported on chain ${chainId}`);
    }
    return routerAddress;
  }

  /**
   * Get swap function ABI
   */
  protected getSwapABI(): readonly any[] {
    return PANCAKESWAP_ROUTER_ABI;
  }

  /**
   * Build swap transaction data
   * ✅ EXACTLY matches tiwi-test's getPancakeSwapV2SwapData
   */
  protected buildSwapData(
    route: RouterRoute,
    amountIn: string,
    amountOutMin: string,
    recipient: string,
    deadline: number,
    isFeeOnTransfer?: boolean  // Whether to use fee-on-transfer supporting functions
  ): { to: string; data: string; value: string } {
    const routerAddress = this.getRouterAddress(route.fromToken.chainId, route);
    console.log("🚀 ~ PancakeSwapExecutor ~ buildSwapData ~ routerAddress:", {route, amountIn, amountOutMin, recipient, deadline, isFeeOnTransfer})
    
    // ✅ EXACTLY match tiwi-test: Use route.raw.path first (exact path from router)
    // This is the same path used in simulation, ensuring consistency
    const path = route.raw?.path || this.extractPathFromRoute(route) || [
      route.fromToken.address,
      route.toToken.address,
    ];

    // ✅ Filter out invalid addresses (like 0x0000...)
    const validPath = path.filter((addr: string) => 
      addr && 
      addr !== '0x0000000000000000000000000000000000000000' &&
      addr.toLowerCase() !== '0x0000000000000000000000000000000000000000'
    );

    if (validPath.length < 2) {
      throw new Error('Invalid swap path: path must have at least 2 addresses');
    }

    const recipientAddress = getAddress(recipient) as Address;

    // ✅ Use original token addresses from raw data (matches tiwi-test)
    // This matches tiwi-test's approach: check original tokenIn/tokenOut, not route token addresses
    const originalTokenIn = route.raw?.tokenIn || route.fromToken.address;
    const originalTokenOut = route.raw?.tokenOut || route.toToken.address;
    const tokenInLower = originalTokenIn.toLowerCase();
    const tokenOutLower = originalTokenOut.toLowerCase();
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const nativeAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    // Check if native token (ETH/BNB)
    const isNativeInput = tokenInLower === zeroAddress || tokenInLower === nativeAddress;
    console.log("🚀 ~ PancakeSwapExecutor ~ buildSwapData ~ isNativeInput:", isNativeInput)
    const isNativeOutput = tokenOutLower === zeroAddress || tokenOutLower === nativeAddress;
    console.log("🚀 ~ PancakeSwapExecutor ~ buildSwapData ~ isNativeOutput:", isNativeOutput)

    // Convert path to proper type
    const pathAddresses = validPath.map((addr: string) => getAddress(addr)) as readonly `0x${string}`[];
    const deadlineBigInt = BigInt(deadline);

    // ✅ EXACTLY match tiwi-test: Default to fee-on-transfer functions (useFeeOnTransfer !== false)
    // This matches PancakeSwap UI behavior - always use supporting functions unless explicitly disabled
    // Line 1595 in tiwi-test: const useFeeOnTransferFunc = useFeeOnTransfer !== false;
    const useFeeOnTransferFunc = isFeeOnTransfer !== false; // Default to true (matches tiwi-test)

    let functionName: string;
    let args: readonly [bigint, bigint, readonly `0x${string}`[], `0x${string}`, bigint] | readonly [bigint, readonly `0x${string}`[], `0x${string}`, bigint];
    let value: string;

    if (isNativeInput && !isNativeOutput) {
      // ETH/BNB -> Token
      functionName = useFeeOnTransferFunc
        ? 'swapExactETHForTokensSupportingFeeOnTransferTokens'
        : 'swapExactETHForTokens';
      args = [BigInt(amountOutMin), pathAddresses, recipientAddress, deadlineBigInt] as const;
      value = amountIn;
    } else if (!isNativeInput && isNativeOutput) {
      // Token -> ETH/BNB
      functionName = useFeeOnTransferFunc
        ? 'swapExactTokensForETHSupportingFeeOnTransferTokens'
        : 'swapExactTokensForETH';
      args = [BigInt(amountIn), BigInt(amountOutMin), pathAddresses, recipientAddress, deadlineBigInt] as const;
      value = '0';
    } else {
      // Token -> Token
      functionName = useFeeOnTransferFunc
        ? 'swapExactTokensForTokensSupportingFeeOnTransferTokens'
        : 'swapExactTokensForTokens';
      args = [BigInt(amountIn), BigInt(amountOutMin), pathAddresses, recipientAddress, deadlineBigInt] as const;
      value = '0';
    }

    const data = encodeFunctionData({
      abi: PANCAKESWAP_ROUTER_ABI,
      functionName: functionName as any,
      args,
    });

    return {
      to: routerAddress,
      data,
      value: value, // Already a string (matches tiwi-test which returns BigInt but we convert to string for consistency)
    };
  }

  /**
   * Extract swap path from route steps
   */
  protected extractPathFromRoute(route: RouterRoute): string[] | null {
    // Try to extract path from route steps
    if (route.steps && route.steps.length > 0) {
      const path: string[] = [];
      
      // Add from token
      path.push(route.fromToken.address);
      
      // Add intermediate tokens from steps
      route.steps.forEach((step) => {
        if ('toToken' in step && step.toToken.address) {
          if (!path.includes(step.toToken.address)) {
            path.push(step.toToken.address);
          }
        }
      });
      
      // Ensure to token is at the end
      if (!path.includes(route.toToken.address)) {
        path.push(route.toToken.address);
      }
      
      return path.length >= 2 ? path : null;
    }
    
    // Fallback: simple two-token path
    return [route.fromToken.address, route.toToken.address];
  }
}

