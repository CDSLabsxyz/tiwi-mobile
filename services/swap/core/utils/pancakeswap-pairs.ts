// PancakeSwap V2 pair utilities - matches tiwi-test implementation exactly

import { type Address, getAddress } from 'viem';
import { getCachedClient, getCachedPairAddress, fastRpcCall } from './pancakeswap-optimization';
import { PANCAKESWAP_V2_FACTORY } from './pancakeswap-constants';

// Factory ABI (for getPair)
const FACTORY_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'tokenA', type: 'address' },
      { internalType: 'address', name: 'tokenB', type: 'address' },
    ],
    name: 'getPair',
    outputs: [{ internalType: 'address', name: 'pair', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Pair ABI (for getReserves)
export const PAIR_ABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { internalType: 'uint112', name: 'reserve0', type: 'uint112' },
      { internalType: 'uint112', name: 'reserve1', type: 'uint112' },
      { internalType: 'uint32', name: 'blockTimestampLast', type: 'uint32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Get PancakeSwap V2 pair address (optimized with caching and fast RPC)
 */
export const getPairAddress = async (
  tokenA: Address,
  tokenB: Address,
  chainId: number
): Promise<Address | null> => {
  const factoryAddress = PANCAKESWAP_V2_FACTORY[chainId];
  if (!factoryAddress) {
    console.warn(`[getPairAddress] Chain ${chainId} not supported by PancakeSwap V2`);
    return null;
  }

  const checksummedTokenA = getAddress(tokenA);
  const checksummedTokenB = getAddress(tokenB);
  const checksummedFactory = getAddress(factoryAddress);

  // Use cached lookup with TTL
  return getCachedPairAddress(
    checksummedTokenA,
    checksummedTokenB,
    chainId,
    async () => {
      try {
        const publicClient = getCachedClient(chainId);
        
        // Try primary order with fast timeout
        const pairAddress = await fastRpcCall(async () => {
          return await publicClient.readContract({
            address: checksummedFactory,
            abi: FACTORY_ABI,
            functionName: 'getPair',
            args: [checksummedTokenA, checksummedTokenB],
          }) as `0x${string}`;
        }, 500); // 500ms timeout for pair checks

        // If zero address, try reverse order
        if (!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') {
          try {
            const reversePair = await fastRpcCall(async () => {
              return await publicClient.readContract({
                address: checksummedFactory,
                abi: FACTORY_ABI,
                functionName: 'getPair',
                args: [checksummedTokenB, checksummedTokenA],
              }) as `0x${string}`;
            }, 500);
            
            if (reversePair && reversePair !== '0x0000000000000000000000000000000000000000') {
              return getAddress(reversePair);
            }
          } catch {
            // Reverse order failed, continue
          }
          return null;
        }

        return getAddress(pairAddress);
      } catch (error: any) {
        const errorMsg = error?.message || error?.toString() || '';
        const errorName = error?.name || '';
        
        if (errorName === 'ContractFunctionZeroDataError' || 
            errorMsg.includes('returned no data') ||
            errorMsg.includes('execution reverted') ||
            errorMsg.includes('timeout')) {
          return null;
        }
        
        console.warn(`[getPairAddress] Error: ${errorMsg}`);
        return null;
      }
    }
  );
};

/**
 * Get pair reserves to check liquidity (optimized with caching)
 */
export const getPairReserves = async (
  tokenA: Address,
  tokenB: Address,
  chainId: number
): Promise<{ reserve0: bigint; reserve1: bigint } | null> => {
  try {
    const pairAddress = await getPairAddress(tokenA, tokenB, chainId);
    if (!pairAddress) {
      return null;
    }

    const publicClient = getCachedClient(chainId);
    
    const reserves = await fastRpcCall(async () => {
      return await publicClient.readContract({
        address: pairAddress,
        abi: PAIR_ABI,
        functionName: 'getReserves',
      });
    }, 1000); // 1s timeout for reserves

    return {
      reserve0: reserves[0],
      reserve1: reserves[1],
    };
  } catch (error) {
    console.error('Error getting pair reserves:', error);
    return null;
  }
};

/**
 * Verify that all pairs in a swap path exist
 */
export const verifySwapPath = async (
  path: Address[],
  chainId: number
): Promise<{ valid: boolean; missingPairs: Array<{ tokenA: Address; tokenB: Address }> }> => {
  const missingPairs: Array<{ tokenA: Address; tokenB: Address }> = [];
  
  if (path.length < 2) {
    return { valid: false, missingPairs };
  }
  
  // Check each consecutive pair in the path
  for (let i = 0; i < path.length - 1; i++) {
    const tokenA = path[i];
    const tokenB = path[i + 1];
    
    const pairAddress = await getPairAddress(tokenA, tokenB, chainId);
    if (!pairAddress) {
      missingPairs.push({ tokenA, tokenB });
    }
  }
  
  return {
    valid: missingPairs.length === 0,
    missingPairs
  };
};

/**
 * Verify pair exists (with retries for RPC indexing delays)
 */
export const verifyPairExists = async (
  tokenA: Address,
  tokenB: Address,
  chainId: number,
  maxRetries: number = 1, // Reduced to 1 (no retries)
  retryDelay: number = 0 // No delay
): Promise<Address | null> => {
  // Fast single check with caching
  return await getPairAddress(tokenA, tokenB, chainId);
};

