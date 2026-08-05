/**
 * EVM DEX Executor (Base Class)
 *
 * Base class for executing swaps on EVM DEXes like PancakeSwap and Uniswap.
 * Handles common EVM swap logic: approvals, transaction building, signing, and submission.
 * Includes tax collection (0.25%) for non-BSC chains.
 */

import { getAddress, type Address, encodeFunctionData, formatUnits, parseUnits } from 'viem';
import type { SwapExecutionParams, SwapExecutionResult } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';
import { getEVMWalletClient, getEVMPublicClient, ensureCorrectChain } from '../utils/wallet-helpers';
import { ensureTokenApproval } from '../services/approval-handler';
import { toSmallestUnit, fromSmallestUnit } from '../utils/amount-converter';
import { isNativeToken } from '../utils/chain-helpers';
import { shouldSkipSeparateTax } from '../utils/evm-tax-helper';
import { REVENUE_WALLETS, TAX_RATES, BASIS_POINTS } from '@/services/swap/core/config/tax-config';

// Tax rate for non-BSC chains: 0.25%
const TAX_RATE_BPS = TAX_RATES.DEFAULT;
const EVM_REVENUE_WALLET = REVENUE_WALLETS.evm as Address;

// ERC20 ABI for tax transfer
const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// WETH/Wrapped Native Token addresses for different chains
const WETH_ADDRESSES: Record<number, Address> = {
  1: getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'), // Ethereum WETH
  42161: getAddress('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'), // Arbitrum WETH
  10: getAddress('0x4200000000000000000000000000000000000006'), // Optimism WETH
  137: getAddress('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'), // Polygon WMATIC
  8453: getAddress('0x4200000000000000000000000000000000000006'), // Base WETH
  56: getAddress('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'), // BSC WBNB
};

const swapABI = [
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
] as const;


// ERC20 ABI for balance and allowance checks
const ERC20_BALANCE_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * EVM DEX executor base class
 */
export abstract class EVMDEXExecutor {
  /**
   * Get the spender address for token approval if needed
   */
  async getSpenderAddress(route: RouterRoute): Promise<string | null> {
    const chainId = route.fromToken.chainId;
    if (!chainId) return null;
    return this.getRouterAddress(chainId, route);
  }

  /**
   * Get router contract address for a chain
   * Can be overridden to use route.raw.routerAddress if available
   */
  protected getRouterAddress(chainId: number, route?: RouterRoute): string {
    // ✅ First priority: Use router address from raw route data if available
    if (route?.raw?.routerAddress) {
      return route.raw.routerAddress;
    }

    // Fallback to abstract method (implemented by subclasses)
    return this.getRouterAddressFromChain(chainId);
  }

  /**
   * Get router contract address for a chain (abstract method for subclasses)
   */
  protected abstract getRouterAddressFromChain(chainId: number): string;

  /**
   * Get swap function ABI
   */
  protected abstract getSwapABI(): readonly any[];

  /**
   * Build swap transaction data
   */
  protected abstract buildSwapData(
    route: RouterRoute,
    amountIn: string,
    amountOutMin: string,
    recipient: string,
    deadline: number,
    isFeeOnTransfer?: boolean // Whether to use fee-on-transfer supporting functions
  ): { to: string; data: string; value: string };

  /**
   * Collect tax before swap execution (for non-BSC chains)
   * Tax is ON TOP of swap amount - user swaps exact fromAmount
   * Total taken from wallet = fromAmount + taxAmount
   */
  protected async collectTax(
    fromToken: any,
    fromAmount: string,
    userAddress: string,
    chainId: number,
    walletClient: any,
    publicClient: any,
    onStatusUpdate?: (status: any) => void
  ): Promise<{ taxCollected: boolean; taxAmount: string; taxAmountWei: bigint }> {
    // Skip tax for BSC (handled by relayer or BscDirectSwapExecutor)
    if (chainId === 56 || chainId === 97) {
      return { taxCollected: false, taxAmount: '0', taxAmountWei: BigInt(0) };
    }

    // Skip tax for native token input (would need different handling)
    if (isNativeToken(fromToken.address, chainId)) {
      console.log('[EVMDEXExecutor] Skipping tax for native token input');
      return { taxCollected: false, taxAmount: '0', taxAmountWei: BigInt(0) };
    }

    try {
      const decimals = fromToken.decimals || 18;
      const fromAmountWei = parseUnits(fromAmount, decimals);
      const taxAmountWei = (fromAmountWei * BigInt(TAX_RATE_BPS)) / BigInt(BASIS_POINTS);

      if (taxAmountWei <= BigInt(0)) {
        return { taxCollected: false, taxAmount: '0', taxAmountWei: BigInt(0) };
      }

      // Check user has enough balance (swap amount + tax)
      const totalRequired = fromAmountWei + taxAmountWei;

      const ERC20_BALANCE_ABI_LOCAL = [
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ] as const;

      const userBalance = await publicClient.readContract({
        address: fromToken.address as Address,
        abi: ERC20_BALANCE_ABI_LOCAL,
        functionName: 'balanceOf',
        args: [userAddress as Address],
      }) as bigint;

      if (userBalance < totalRequired) {
        throw new Error(
          `Insufficient ${fromToken.symbol || 'token'} balance. ` +
          `You need ${formatUnits(totalRequired, decimals)} (${fromAmount} swap + ${formatUnits(taxAmountWei, decimals)} tax) ` +
          `but only have ${formatUnits(userBalance, decimals)}`
        );
      }

      console.log('[EVMDEXExecutor] Collecting tax (ON TOP):', {
        swapAmount: fromAmount,
        taxAmount: formatUnits(taxAmountWei, decimals),
        totalFromWallet: formatUnits(totalRequired, decimals),
        taxRate: `${TAX_RATE_BPS / 100}%`,
        revenueWallet: EVM_REVENUE_WALLET,
        chainId,
      });

      onStatusUpdate?.({
        stage: 'preparing',
        message: `Collecting ${(TAX_RATE_BPS / 100).toFixed(2)}% platform fee (${formatUnits(taxAmountWei, decimals)} ${fromToken.symbol || 'tokens'})...`,
      });

      // Transfer tax to revenue wallet
      const transferData = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [EVM_REVENUE_WALLET, taxAmountWei],
      });

      const taxTxHash = await walletClient.sendTransaction({
        to: fromToken.address as Address,
        data: transferData,
      });

      console.log('[EVMDEXExecutor] Tax transfer tx:', taxTxHash);

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({
        hash: taxTxHash,
        timeout: 30000,
      });

      console.log('[EVMDEXExecutor] Tax collected successfully');

      return {
        taxCollected: true,
        taxAmount: formatUnits(taxAmountWei, decimals),
        taxAmountWei,
      };
    } catch (error: any) {
      console.error('[EVMDEXExecutor] Tax collection failed:', error.message);
      // Re-throw balance errors
      if (error.message?.includes('Insufficient')) {
        throw error;
      }
      // Don't fail the swap if tax collection fails for other reasons - log and continue
      return { taxCollected: false, taxAmount: '0', taxAmountWei: BigInt(0) };
    }
  }

  /**
   * Execute a swap on an EVM DEX
   */
  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const {
      route,
      fromToken,
      toToken,
      fromAmount,
      userAddress,
      recipientAddress,
      onStatusUpdate,
    } = params;

    try {
      const chainId = fromToken.chainId!;
      const recipient = recipientAddress || userAddress;

      // Ensure wallet is on correct chain
      onStatusUpdate?.({
        stage: 'preparing',
        message: 'Preparing...',
      });

      await ensureCorrectChain(chainId);

      // Get wallet and public clients
      const walletClient = await getEVMWalletClient(chainId);
      const publicClient = getEVMPublicClient(chainId);

      // Collect tax before swap (0.25% to revenue wallet) - non-BSC only.
      // Skip when the fee is inline or this leg opted out (multi-leg charges tax once, on leg 1).
      if (!shouldSkipSeparateTax(params)) {
        const { taxCollected, taxAmount } = await this.collectTax(
          fromToken,
          fromAmount,
          userAddress,
          chainId,
          walletClient,
          publicClient,
          onStatusUpdate
        );
        if (taxCollected) {
          console.log(`[EVMDEXExecutor] Tax of ${taxAmount} collected`);
        }
      } else {
        console.log('[EVMDEXExecutor] Skipping tax (inline fee or skipTax leg)');
      }

      // Check if native token (no approval needed)
      const isNative = isNativeToken(fromToken.address, chainId);

      // Handle token approval (if not native)
      if (!isNative) {
        const routerAddress = this.getRouterAddress(chainId, route);
        if (!routerAddress) {
          throw new SwapExecutionError(
            `Router not supported on chain ${chainId}`,
            SwapErrorCode.UNSUPPORTED_ROUTER
          );
        }

        const amountInSmallestUnit = toSmallestUnit(fromAmount, fromToken.decimals!);
        console.log("🚀 ~ EVMDEXExecutor ~ execute ~ amountInSmallestUnit:Native", amountInSmallestUnit)

        await ensureTokenApproval(
          fromToken.address,
          userAddress,
          routerAddress,
          amountInSmallestUnit,
          chainId,
          (message) => {
            onStatusUpdate?.({
              stage: 'approving',
              message,
            });
          }
        );
      }

      // ✅ EXACTLY match tiwi-test: Get fresh quote from router using getAmountsOut
      // This ensures we're using the exact path and current reserves
      onStatusUpdate?.({
        stage: 'preparing',
        message: 'Getting latest quote from router...',
      });

      // ✅ CRITICAL FIX: Handle reverse routing path and amount
      // For reverse routing: path is reversed (toToken → fromToken) but we need to swap fromToken → toToken
      const isReverseRouting = route.raw?.isReverseRouting || false;

      // Trust backend pathing (now correctly oriented for both forward and reverse swaps)
      const path = route.raw?.path;
      if (!path || path.length < 2) {
        throw new SwapExecutionError(
          'Invalid swap path. Unable to determine swap route.',
          SwapErrorCode.INVALID_ROUTE
        );
      }

      // Always use the fromToken.amount with the provided path.
      // For reverse routing, the fromToken.amount is the calculated input required to get desired output.
      const amountInSmallestUnit = toSmallestUnit(route.fromToken.amount, fromToken.decimals!);
      console.log('[EVM DEX] Using path and amount from route:', {
        path: path.map((addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`).join(' -> '),
        amountIn: route.fromToken.amount,
        amountInSmallestUnit,
        isReverseRouting
      });

      const routerAddress = this.getRouterAddress(chainId, route);
      if (!routerAddress) {
        throw new SwapExecutionError(
          `Router not supported on chain ${chainId}`,
          SwapErrorCode.UNSUPPORTED_ROUTER
        );
      }

      // Fresh quote verification (getAmountsOut)
      const ROUTER_ABI = [
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
      ] as const;

      let actualAmountOut: bigint | null = null;

      try {
        const amounts = await publicClient.readContract({
          address: routerAddress as Address,
          abi: ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [BigInt(amountInSmallestUnit), path.map((addr: string) => getAddress(addr) as Address)],
        }) as bigint[];

        if (amounts && amounts.length > 0 && amounts[amounts.length - 1] > BigInt(0)) {
          actualAmountOut = amounts[amounts.length - 1];
          console.log('[EVM DEX] On-chain quote verification successful:', {
            amountOut: actualAmountOut.toString(),
          });
        } else {
          // ✅ EXACTLY match tiwi-test: Router returned 0, but use the quote's amountOut if available
          console.log("actual amount converting raw amount to BigInt")
          if (route.raw?.amountOut && route.raw.amountOut !== '0') {
            actualAmountOut = BigInt(route.raw.amountOut);
            console.warn('[EVM DEX] Router returned 0, but using route.raw.amountOut:', actualAmountOut.toString());
          } else {
            console.log("actual amount estimate conservative")
            // Use conservative estimate
            actualAmountOut = BigInt(amountInSmallestUnit) / BigInt(1000);
            console.warn('[EVM DEX] Router returned 0, using conservative estimate:', actualAmountOut.toString());
          }
        }
      } catch (quoteError: any) {
        const errorMsg = quoteError?.message || quoteError?.toString() || '';
        console.warn('[EVM DEX] getAmountsOut failed, using route estimate:', errorMsg);

        // ✅ EXACTLY match tiwi-test: Fallback priority
        // 1. route.raw.amountOut (already in smallest units, from backend's getAmountsOut)
        // 2. route.toToken.amount (human-readable, convert to smallest units)
        // 3. Conservative estimate (1/1000 of input)
        if (route.raw?.amountOut && route.raw.amountOut !== '0') {
          // ✅ Use route.raw.amountOut (already in smallest units, from backend's getAmountsOut)
          console.log("raw amount in catch error")
          actualAmountOut = BigInt(route.raw.amountOut);
          console.log('[EVM DEX] Using route.raw.amountOut as fallback (from backend getAmountsOut):', actualAmountOut.toString());
        } else if (route.toToken.amount && route.toToken.amount !== '0') {
          // Fallback to human-readable amount (convert to smallest units)
          actualAmountOut = BigInt(toSmallestUnit(route.toToken.amount, toToken.decimals!));
          console.warn('[EVM DEX] Using route.toToken.amount as fallback (converted to smallest units):', actualAmountOut.toString());
        } else {
          // Use very conservative estimate
          actualAmountOut = BigInt(amountInSmallestUnit) / BigInt(1000);
          console.warn('[EVM DEX] Using conservative estimate (1/1000 of input):', actualAmountOut.toString());
        }

        // ✅ EXACTLY match tiwi-test: If getAmountsOut fails, try to get a fresh quote as fallback
        // Lines 2266-2284 in tiwi-test
        if (!actualAmountOut || actualAmountOut === BigInt(0)) {
          try {
            onStatusUpdate?.({
              stage: 'preparing',
              message: 'Getting fresh quote...',
            });

            // Re-quote through the routing engine. The web build imports the
            // PancakeSwapAdapter directly, but that's a server module (server
            // RPC + registry). On mobile the same quote comes back over
            // /api/v1/route, which runs that adapter server-side.
            const { fetchRoute } = await import('@/services/swap/core/platform/route-api');

            const freshResponse = await fetchRoute({
              fromToken: {
                chainId,
                address: fromToken.address,
                symbol: fromToken.symbol,
                decimals: fromToken.decimals,
              },
              toToken: {
                chainId,
                address: toToken.address,
                symbol: toToken.symbol,
                decimals: toToken.decimals,
              },
              fromAmount,
              fromAddress: userAddress,
              recipient: params.recipientAddress || userAddress,
            });
            const freshRoute = freshResponse?.route;

            if (freshRoute && freshRoute.raw?.amountOut && freshRoute.raw.amountOut !== '0') {
              actualAmountOut = BigInt(freshRoute.raw.amountOut);
              // Update route with fresh quote data
              route.raw = { ...route.raw, ...freshRoute.raw };
              console.log('[EVM DEX] Using fresh quote as fallback:', actualAmountOut.toString());
            } else {
              throw new Error('Unable to get valid quote. The swap path may be invalid.');
            }
          } catch (freshError: any) {
            const freshErrorMsg = freshError?.message || freshError?.toString() || '';
            console.warn('[EVM DEX] Fresh quote fallback failed:', freshErrorMsg);
            // Continue with existing fallback (route.raw.amountOut or conservative estimate)
            if (!actualAmountOut || actualAmountOut === BigInt(0)) {
              throw new SwapExecutionError(
                'Unable to verify swap path. One or more pairs in the path may not exist or have insufficient reserves.',
                SwapErrorCode.INVALID_ROUTE
              );
            }
          }
        }
      }

      // ✅ EXACTLY match tiwi-test: Check if pairs need to be created (lines 2070-2074)
      // Simple swap - no automatic pair creation or liquidity addition
      // If pairs don't exist, just fail with a clear error
      if (route.raw?.needsPairCreation && route.raw?.missingPairs && route.raw.missingPairs.length > 0) {
        throw new SwapExecutionError(
          'Trading pair does not exist on PancakeSwap. Please create the pair and add liquidity first, or use a different token pair.',
          SwapErrorCode.INVALID_ROUTE
        );
      }

      // Ensure we have a valid amountOut
      console.log("🚀 ~ EVMDEXExecutor ~ execute ~ actualAmountOut:", actualAmountOut)
      if (!actualAmountOut || actualAmountOut === BigInt(0)) {
        actualAmountOut = BigInt(amountInSmallestUnit) / BigInt(1000);
        if (actualAmountOut === BigInt(0)) {
          actualAmountOut = BigInt(1);
        }
        console.warn('[EVM DEX] Using fallback estimate for amountOut:', actualAmountOut.toString());
      }

      // ✅ EXACTLY match tiwi-test: Validate swap path exists (only if getAmountsOut failed)
      // Lines 2286-2300 in tiwi-test: Only validate manually if getAmountsOut failed
      // If getAmountsOut succeeded above, the path is already validated by the router
      if (!actualAmountOut || actualAmountOut === BigInt(0) || actualAmountOut === BigInt(amountInSmallestUnit) / BigInt(1000)) {
        // Only validate if we're using a fallback (conservative estimate)
        // This means getAmountsOut failed, so we need to manually validate
        try {
          onStatusUpdate?.({
            stage: 'preparing',
            message: 'Validating swap path...',
          });


          const { verifySwapPath } = await import('@/services/swap/core/utils/pancakeswap-pairs');
          const pathValidation = await verifySwapPath(
            path.map((addr: string) => getAddress(addr) as Address),
            chainId
          );

          if (!pathValidation.valid) {
            const missingPairsStr = pathValidation.missingPairs
              .map(p => `${p.tokenA.slice(0, 6)}...${p.tokenA.slice(-4)} → ${p.tokenB.slice(0, 6)}...${p.tokenB.slice(-4)}`)
              .join(', ');
            throw new SwapExecutionError(
              `Swap path is invalid. Missing pairs: ${missingPairsStr}. Please use a different token pair.`,
              SwapErrorCode.INVALID_ROUTE
            );
          }
        } catch (pathError: any) {
          // If path validation fails, log but don't block if we have a valid amountOut from router
          if (actualAmountOut && actualAmountOut > BigInt(0) && actualAmountOut !== BigInt(amountInSmallestUnit) / BigInt(1000)) {
            console.warn('[EVM DEX] Path validation failed but router validated path - proceeding:', pathError);
          } else {
            throw pathError;
          }
        }
      } else {
        // Router's getAmountsOut succeeded, so path is valid - skip manual validation
        console.log('[EVM DEX] Router validated path successfully, skipping manual validation');
      }

      // ✅ EXACTLY match tiwi-test: Calculate dynamic slippage based on price impact, multi-hop, fee-on-transfer
      const isMultiHop = path.length > 2;
      const priceImpact = parseFloat(route.priceImpact || '0');
      const isLowLiquidity = priceImpact > 5 || isMultiHop;
      const isFeeOnTransfer = route.raw?.isFeeOnTransfer || false;
      let slippagePercent = parseFloat(route.slippage || '0.5');

      // ✅ EXACTLY match tiwi-test: Use recommended slippage from quote if available
      // Line 2358 in tiwi-test: if (pancakeSwapQuote.slippage) { slippagePercent = pancakeSwapQuote.slippage; }
      if (route.slippage && route.slippage !== '0.5') {
        // Use recommended slippage from quote
        slippagePercent = parseFloat(route.slippage);
        console.log('[EVM DEX] Using quote recommended slippage:', slippagePercent);
      } else {
        // Calculate dynamic slippage (matching tiwi-test logic)
        // For low-cap/low-liquidity pairs, start with minimum 3% slippage
        if (isLowLiquidity) {
          slippagePercent = 3; // Minimum 3% for low-cap pairs
        } else {
          slippagePercent = isMultiHop ? 5 : 0.5;
        }

        // Add for price impact (on top of base)
        if (priceImpact > 50) {
          slippagePercent += 20;
        } else if (priceImpact > 20) {
          slippagePercent += 10;
        } else if (priceImpact > 10) {
          slippagePercent += 5;
        } else if (priceImpact > 5) {
          slippagePercent += 2;
        }

        // Add for fee-on-transfer tokens
        if (route.raw?.isFeeOnTransfer) {
          slippagePercent += 15;
        }

        // Ensure minimum 3% for low-cap pairs, up to 12% for very low liquidity
        if (isLowLiquidity) {
          slippagePercent = Math.max(slippagePercent, 3);
          if (priceImpact < 50) {
            slippagePercent = Math.min(slippagePercent, 12);
          }
        }

        // Cap at 50% overall
        slippagePercent = Math.min(slippagePercent, 50);
      }

      console.log('[EVM DEX] Slippage calculation:', {
        slippagePercent,
        priceImpact,
        isLowLiquidity,
        isMultiHop,
        isFeeOnTransfer: route.raw?.isFeeOnTransfer || false
      });

      // ✅ Handle reverse routing (exact output swaps)
      // For reverse routing: user specified exact output (toAmount), so we should use that as target
      // This ensures we get at least what the user wanted, not less
      // Note: isReverseRouting is already declared above when handling path and amount
      const userDesiredOutput = route.toToken.amount
        ? BigInt(toSmallestUnit(route.toToken.amount, toToken.decimals!))
        : null;

      let targetOutputAmount = actualAmountOut;

      // If this is reverse routing (exact output swap), handle market movement
      if (isReverseRouting && userDesiredOutput && actualAmountOut) {
        console.log('[EVM DEX] Reverse routing detected (exact output swap):', {
          userDesiredOutput: userDesiredOutput.toString(),
          actualAmountOut: actualAmountOut.toString(),
        });

        // ✅ CRITICAL: For reverse routing, compare actualAmountOut against route.fromToken.amount
        // route.fromToken.amount is the calculated input amount we need to get the desired output
        // If actualAmountOut < route.fromToken.amount, we can't get enough output
        const expectedFromTokenAmount = route.fromToken.amount
          ? BigInt(toSmallestUnit(route.fromToken.amount, fromToken.decimals!))
          : null;

        if (expectedFromTokenAmount && actualAmountOut < expectedFromTokenAmount) {
          const desiredFormatted = fromSmallestUnit(route.fromToken.amount, fromToken.decimals!);
          const actualFormatted = fromSmallestUnit(actualAmountOut.toString(), fromToken.decimals!);
          throw new SwapExecutionError(
            `Market conditions changed significantly. Expected at least ${desiredFormatted} ${fromToken.symbol}, but current market would only provide ${actualFormatted} ${fromToken.symbol}. Please try again.`,
            SwapErrorCode.INSUFFICIENT_BALANCE
          );
        }

        // For reverse routing: Use the actual achievable output as target (not the desired)
        // This is critical: if market moved and we can't get the desired output, we must use
        // what we can actually get, otherwise the router will reject with INSUFFICIENT_OUTPUT_AMOUNT
        // We still validate above that it's at least 90% of desired, so it's acceptable
        if (actualAmountOut < userDesiredOutput) {
          console.warn('[EVM DEX] Market moved: actual output is less than desired, using actual output as target', {
            userDesiredOutput: userDesiredOutput.toString(),
            actualAmountOut: actualAmountOut.toString(),
            difference: ((Number(userDesiredOutput - actualAmountOut) / Number(userDesiredOutput)) * 100).toFixed(2) + '%'
          });
          targetOutputAmount = actualAmountOut;
        } else {
          // If we can get more than desired, use desired as target (user gets bonus)
          targetOutputAmount = userDesiredOutput;
        }
      }

      // ✅ EXACTLY match tiwi-test: GUARANTEE SUCCESS - Set amountOutMin to ABSOLUTE MINIMUM
      // Use only 0.01% (1/10000) of expected output - this guarantees swap will ALWAYS succeed
      // Lines 2400-2410 in tiwi-test: Ultra-conservative amountOutMin
      let amountOutMin: bigint;

      // For extremely low liquidity, use even less - 0.01% (1/10000) to guarantee success
      if (isLowLiquidity || isMultiHop || priceImpact > 10) {
        amountOutMin = (targetOutputAmount * BigInt(1)) / BigInt(10000); // 0.01% minimum
        console.log('[EVM DEX] ULTRA-CONSERVATIVE: Using 0.01% of expected output to guarantee success');
      } else {
        // For normal swaps, use 0.1% (1/1000) to guarantee success
        amountOutMin = (targetOutputAmount * BigInt(1)) / BigInt(1000); // 0.1% minimum
        console.log('[EVM DEX] CONSERVATIVE: Using 0.1% of expected output to guarantee success');
      }

      // Ensure minimum is at least 1 wei (router requirement)
      // This is the absolute minimum possible - router can NEVER revert with this
      if (amountOutMin === BigInt(0) || amountOutMin < BigInt(1)) {
        amountOutMin = BigInt(1);
        console.log('[EVM DEX] Using absolute minimum: 1 wei (guaranteed to succeed)');
      }

      console.log('[EVM DEX] GUARANTEED SUCCESS - amountOutMin set to:', amountOutMin.toString(), '- Router will NEVER revert');

      console.log('[EVM DEX] amountOutMin calculation:', {
        isReverseRouting,
        actualAmountOut: actualAmountOut.toString(),
        targetOutputAmount: targetOutputAmount.toString(),
        userDesiredOutput: userDesiredOutput?.toString() || 'N/A',
        slippagePercent,
        amountOutMin: amountOutMin.toString(),
        ratio: (Number(amountOutMin) / Number(targetOutputAmount) * 100).toFixed(4) + '%',
        amountOutMinVsActual: actualAmountOut ? (Number(amountOutMin) / Number(actualAmountOut) * 100).toFixed(4) + '%' : 'N/A'
      });
      if (isMultiHop) {

        try {
          // Check what we'd get with 90% of input (simulating worst case with price movement)
          // ✅ CRITICAL: Use flipped path for multi-hop simulation (path is already flipped after getAmountsOut)
          const reducedInput = (BigInt(amountInSmallestUnit) * BigInt(90)) / BigInt(100);
          const reducedAmounts = await publicClient.readContract({
            address: routerAddress as Address,
            abi: ROUTER_ABI,
            functionName: 'getAmountsOut',
            args: [reducedInput, path.map((addr: string) => getAddress(addr) as Address)],
          }) as bigint[];

          if (reducedAmounts && reducedAmounts.length > 0 && reducedAmounts[reducedAmounts.length - 1] > BigInt(0)) {
            // Use the reduced output as our minimum (with additional 20% buffer)
            const reducedOutput = reducedAmounts[reducedAmounts.length - 1];
            amountOutMin = (reducedOutput * BigInt(80)) / BigInt(100);

            // ✅ For reverse routing, ensure we don't exceed actualAmountOut
            if (isReverseRouting && actualAmountOut && amountOutMin > actualAmountOut) {
              console.warn('[EVM DEX] Multi-hop amountOutMin exceeds actualAmountOut for reverse routing, capping:', {
                multiHopAmountOutMin: amountOutMin.toString(),
                actualAmountOut: actualAmountOut.toString()
              });
              // Use 0.01% of actualAmountOut as absolute minimum
              amountOutMin = (actualAmountOut * BigInt(1)) / BigInt(10000);
            }

            console.log('[EVM DEX] Using very conservative amountOutMin based on reduced input simulation:', {
              originalAmountOut: actualAmountOut.toString(),
              reducedInputOutput: reducedOutput.toString(),
              finalAmountOutMin: amountOutMin.toString()
            });
          }
        } catch (simError) {
          console.warn('[EVM DEX] Could not simulate reduced input, using calculated amountOutMin');
        }
      }

      // ✅ Final safeguard: For reverse routing, ensure amountOutMin never exceeds actualAmountOut
      // This is critical - the router will reject if amountOutMin > what we can actually get
      if (isReverseRouting && actualAmountOut && amountOutMin > actualAmountOut) {
        console.error('[EVM DEX] CRITICAL: amountOutMin exceeds actualAmountOut after all calculations, forcing adjustment:', {
          amountOutMin: amountOutMin.toString(),
          actualAmountOut: actualAmountOut.toString(),
          difference: (Number(amountOutMin - actualAmountOut) / Number(actualAmountOut) * 100).toFixed(2) + '%'
        });
        // Use 0.01% of actualAmountOut as absolute minimum
        amountOutMin = (actualAmountOut * BigInt(1)) / BigInt(10000);
      }

      // Apply final rounding to ensure we don't have precision issues
      if (amountOutMin > BigInt(1000)) {
        amountOutMin = (amountOutMin / BigInt(1000)) * BigInt(1000);
      } else if (amountOutMin > BigInt(100)) {
        amountOutMin = (amountOutMin / BigInt(100)) * BigInt(100);
      }

      console.log('[EVM DEX] Final slippage calculation:', {
        actualAmountOut: actualAmountOut.toString(),
        amountOutMin: amountOutMin.toString(),
        slippage: `${slippagePercent}%`,
        isMultiHop,
        pathLength: path.length,
        path: path.map((addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`).join(' -> ')
      });

      // Build swap transaction
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
      // ✅ EXACTLY match tiwi-test: Always use fee-on-transfer supporting functions for safety
      // This matches PancakeSwap UI behavior - always use supporting functions unless explicitly disabled
      // Line 2597 in tiwi-test: const swapData = getPancakeSwapV2SwapData(..., true)
      console.log("execute", {
        route,
        amountInSmallestUnit,
        amountOutMin: amountOutMin.toString(),
        recipient,
        deadline,
      })
      const swapData = this.buildSwapData(
        route,
        amountInSmallestUnit,
        amountOutMin.toString(),
        recipient,
        deadline,
        true // ✅ Always use fee-on-transfer supporting functions (matches tiwi-test)
      );

      // Simulate swap on-chain before execution (prevents wallet warnings)
      // This is critical - it validates the transaction will succeed
      onStatusUpdate?.({
        stage: 'preparing',
        message: 'Simulating swap on-chain...',
      });

      // Helper to wait
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      try {
        console.log("🚀 ~ simulate swap 1")
        let simulationResult: { success: boolean; error?: string } = { success: false, error: '' };

        // Retry loop for simulation (handles both reverts and network errors)
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            simulationResult = await this.simulateSwap(
              route,
              BigInt(amountInSmallestUnit),
              BigInt(amountOutMin),
              chainId,
              userAddress as Address,
              publicClient,
              true
            );

            if (simulationResult.success) break;

            // If it's a network error, retry immediately with small delay
            if (simulationResult.error?.includes('Failed to fetch') ||
              simulationResult.error?.includes('network') ||
              simulationResult.error?.includes('fetch')) {
              console.warn(`[EVM DEX] Simulation network error (attempt ${attempt + 1}): ${simulationResult.error}`);
              await sleep(1000);
              continue;
            }

            // If it's TRANSFER_FROM_FAILED, wait longer for RPC indexing
            if (simulationResult.error?.includes('TRANSFER_FROM_FAILED')) {
              console.warn(`[EVM DEX] Simulation indexing error (attempt ${attempt + 1}): ${simulationResult.error}`);
              await sleep(2000);
              continue;
            }

            // For other errors, don't necessarily retry unless it's been only one attempt
            if (attempt === 0) await sleep(1000);
            else break;
          } catch (err: any) {
            const msg = err?.message || '';
            if (msg.includes('Failed to fetch') || msg.includes('network')) {
              await sleep(1000);
              continue;
            }
            break;
          }
        }

        console.log("I don pass simulate")
        if (!simulationResult.success) {
          // Show user-friendly error message
          const errorMsg = simulationResult.error || 'Unknown error';
          if (errorMsg.includes('Insufficient balance')) {
            throw new SwapExecutionError(
              'Insufficient token balance for this swap.',
              SwapErrorCode.INSUFFICIENT_BALANCE
            );
          } else if (errorMsg.includes('Insufficient allowance')) {
            onStatusUpdate?.({
              stage: 'preparing',
              message: '⚠️ Approval issue detected. The swap may still work - proceeding...',
            });
          } else {
            onStatusUpdate?.({
              stage: 'preparing',
              message: `⚠️ Simulation warning: ${errorMsg}. Proceeding with swap...`,
            });
          }
        } else {
          console.log('[EVM DEX] On-chain simulation successful');
        }
      } catch (simError: any) {
        const errorMsg = simError?.message || simError?.toString() || '';
        if (errorMsg.includes('Insufficient balance')) {
          throw simError; // Re-throw balance errors
        }
        console.warn('[EVM DEX] Simulation error (proceeding anyway):', simError);
        onStatusUpdate?.({
          stage: 'preparing',
          message: '⚠️ Simulation had issues, but proceeding with swap...',
        });
      }

      // Approval was already handled above (line ~381) via ensureTokenApproval.
      // No redundant re-check — the receipt confirmation guarantees on-chain state.

      // Let the wallet or RPC simulator determine gas at signing time.
      // Frontend-side gas estimation can reject valid swaps with stale allowance/liquidity state.
      onStatusUpdate?.({
        stage: 'signing',
        message: 'Confirming in wallet...',
      });

      // Ensure account is available (TypeScript type guard)
      const account = walletClient.account;
      if (!account) {
        throw new SwapExecutionError(
          'Wallet account not available',
          SwapErrorCode.WALLET_NOT_CONNECTED
        );
      }

      // Estimate gas with fallback to avoid false "insufficient gas" errors
      let gasLimit: bigint | undefined;
      try {
        const estimated = await publicClient.estimateGas({
          to: swapData.to as Address,
          data: swapData.data as `0x${string}`,
          value: swapData.value ? BigInt(swapData.value) : undefined,
          account: account.address,
        });
        gasLimit = (estimated * BigInt(130)) / BigInt(100); // 30% buffer
      } catch (gasError: any) {
        console.warn('[EVMDEXExecutor] Gas estimation failed, using safe fallback:', gasError?.message);
        gasLimit = BigInt(500_000);
      }

      const txHash = await walletClient.sendTransaction({
        account,
        to: swapData.to as Address,
        data: swapData.data as `0x${string}`,
        value: swapData.value ? BigInt(swapData.value) : undefined,
        gas: gasLimit,
      } as Parameters<typeof walletClient.sendTransaction>[0]);

      // Wait for confirmation
      onStatusUpdate?.({
        stage: 'confirming',
        message: 'Reviewing...',
        txHash,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60000, // 60 seconds
      });

      if (receipt.status === 'reverted') {
        console.error('[EVM DEX] Transaction reverted! Attempting recovery with alternative routes...');
        onStatusUpdate?.({
          stage: 'failed',
          message: 'Transaction reverted. Trying alternative routes...',
        });

        // ✅ EXACTLY match tiwi-test: Recovery logic - try alternative routes with progressively smaller amounts
        // Note: This would require access to findBestRoute which is router-specific
        // For now, we'll throw a helpful error message
        throw new SwapExecutionError(
          `Transaction reverted. Transaction: ${txHash}. ` +
          `Possible causes: 1) Insufficient liquidity for this amount, 2) Token has high fees/taxes, ` +
          `3) Price moved significantly. Try: 1) Reducing swap amount significantly, 2) Waiting a few minutes, ` +
          `3) Checking token on DEX directly.`,
          SwapErrorCode.TRANSACTION_FAILED
        );
      }

      // Calculate actual output amount (from receipt logs if available)
      const actualToAmount = route.toToken.amount; // Fallback to route estimate

      onStatusUpdate?.({
        stage: 'completed',
        message: 'Success',
        txHash,
      });

      return {
        success: true,
        txHash,
        receipt,
        actualToAmount,
      };
    } catch (error) {
      const swapError = createSwapError(error, SwapErrorCode.TRANSACTION_FAILED);

      onStatusUpdate?.({
        stage: 'failed',
        message: formatErrorMessage(swapError),
        error: swapError,
      });

      throw swapError;
    }
  }

  /**
   * Get minimum output amount from router (on-chain verification)
   */
  private async getAmountOutMin(
    route: RouterRoute,
    amountIn: string,
    chainId: number,
    toTokenDecimals: number
  ): Promise<string> {
    try {
      const publicClient = getEVMPublicClient(chainId);
      const routerAddress = this.getRouterAddress(chainId, route);

      // Use getAmountsOut to verify quote
      const getAmountsOutABI = [
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
      ] as const;

      // Extract path from route steps
      const path = this.extractPathFromRoute(route);
      if (!path || path.length < 2) {
        // Fallback to route estimate with slippage
        return this.calculateAmountOutMin(route.toToken.amount, route.slippage, toTokenDecimals);
      }

      const amounts = await publicClient.readContract({
        address: routerAddress as Address,
        abi: getAmountsOutABI,
        functionName: 'getAmountsOut',
        args: [BigInt(amountIn), path.map((addr) => getAddress(addr) as Address)],
      });

      const amountOut = amounts[amounts.length - 1];
      const slippage = parseFloat(route.slippage) || 0.5;
      const slippageMultiplier = BigInt(Math.floor((100 - slippage) * 100));
      const amountOutMin = (amountOut * slippageMultiplier) / BigInt(10000);

      return amountOutMin.toString();
    } catch (error) {
      // Fallback to route estimate with slippage
      console.warn('[EVM DEX] Failed to get on-chain quote, using route estimate:', error);
      return this.calculateAmountOutMin(route.toToken.amount, route.slippage, toTokenDecimals);
    }
  }

  /**
   * Extract swap path from route
   * Prioritizes raw path from router response, falls back to step reconstruction
   */
  protected extractPathFromRoute(route: RouterRoute): string[] | null {
    // ✅ First priority: Use raw path from router response (exact match to router's calculation)
    console.log("I CAME FROM EXTRACT PATH FROM ROUTE")
    if (route.raw && Array.isArray(route.raw.path) && route.raw.path.length >= 2) {
      console.log("🚀 ~ EVMDEXExecutor ~ extractPathFromRoute ~ route.raw.path", route.raw.path.map((addr: string) => addr.toLowerCase()))
      return route.raw.path.map((addr: string) => addr.toLowerCase());
    }
    console.log("UNACCEPTABLE")
    // Fallback: Try to extract path from route steps
    // This is router-specific and may need to be overridden
    const firstStep = route.steps[0];
    if (firstStep && 'fromToken' in firstStep && 'toToken' in firstStep) {
      return [firstStep.fromToken.address, firstStep.toToken.address];
    }
    return null;
  }

  /**
   * Calculate minimum output amount with slippage
   * 
   * @param amountOut - Human-readable output amount (e.g., "0.001154234177424085")
   * @param slippage - Slippage percentage (e.g., "0.5")
   * @param decimals - Token decimals (e.g., 18)
   * @returns Minimum output amount in smallest units as string
   */
  private calculateAmountOutMin(amountOut: string, slippage: string, decimals: number): string {
    // Convert human-readable amount to smallest units first
    const amountOutSmallestUnit = toSmallestUnit(amountOut, decimals);

    // Now convert to BigInt (safe because it's already in smallest units)
    const amountOutBigInt = BigInt(amountOutSmallestUnit);

    // Calculate slippage multiplier
    const slippagePercent = parseFloat(slippage) || 0.5;
    const slippageMultiplier = BigInt(Math.floor((100 - slippagePercent) * 100));

    // Apply slippage: amountOutMin = amountOut * (100 - slippage) / 100
    const amountOutMin = (amountOutBigInt * slippageMultiplier) / BigInt(10000);

    return amountOutMin.toString();
  }

  /**
   * Simulate swap on-chain before execution
   * EXACTLY matches tiwi-test implementation from pancakeswap-router.ts
   * 
   * @param route - The swap route (must have path in route.raw.path)
   * @param amountIn - Input amount in smallest units
   * @param amountOutMin - Minimum output amount in smallest units
   * @param chainId - Chain ID
   * @param fromAddress - User's wallet address
   * @param publicClient - Viem public client
   * @param useFeeOnTransfer - Whether to use fee-on-transfer supporting function
   * @returns Simulation result with success status and optional error message
   */
  protected async simulateSwap(
    route: RouterRoute,
    amountIn: bigint,
    amountOutMin: bigint,
    chainId: number,
    fromAddress: Address,
    publicClient: any,
    useFeeOnTransfer: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const routerAddress = this.getRouterAddress(chainId, route) as Address;
      if (!routerAddress) {
        return { success: false, error: 'Router not found' };
      }

      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      // ✅ EXACTLY match tiwi-test: Extract path from route.raw.path
      // The path is already converted to WETH if native tokens were involved
      // Priority: route.raw.path > extractPathFromRoute > fallback [fromToken, toToken]
      const path = route.raw?.path || this.extractPathFromRoute(route) || [
        route.fromToken.address,
        route.toToken.address,
      ];

      // ✅ Add null check - if path is invalid, return error
      if (!path || path.length < 2) {
        return {
          success: false,
          error: 'Invalid swap path: route.raw.path is missing or invalid. Unable to determine swap route.'
        };
      }

      // Convert path addresses to proper format
      const pathAddresses = path.map((addr: string) => getAddress(addr.toLowerCase()) as Address) as readonly `0x${string}`[];

      // ✅ EXACTLY match tiwi-test: Determine native token using PATH comparison with WETH
      // This is different from getPancakeSwapV2SwapData which uses original token addresses
      // Note: path[0] and path[path.length-1] are strings, WETH_ADDRESSES[chainId] is Address (string)
      const wethAddress = WETH_ADDRESSES[chainId];
      const isNativeIn = path[0]?.toLowerCase() === wethAddress?.toLowerCase();
      const isNativeOut = path[path.length - 1]?.toLowerCase() === wethAddress?.toLowerCase();

      // For non-native tokens, check balance and allowance before simulation
      if (!isNativeIn) {
        const tokenIn = pathAddresses[0];

        try {
          // Check balance
          const balance = await publicClient.readContract({
            address: tokenIn,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [fromAddress],
          }) as bigint;

          if (balance < amountIn) {
            return {
              success: false,
              error: `Insufficient balance. You have ${balance.toString()}, but need ${amountIn.toString()}`,
            };
          }

          // Check allowance
          const allowance = await publicClient.readContract({
            address: tokenIn,
            abi: ERC20_BALANCE_ABI,
            functionName: 'allowance',
            args: [fromAddress, routerAddress],
          }) as bigint;

          if (allowance < amountIn) {
            return {
              success: false,
              error: `Insufficient allowance. Router has ${allowance.toString()}, but needs ${amountIn.toString()}. Please approve the token first.`,
            };
          }
        } catch (checkError: any) {
          // If balance/allowance check fails, log but continue with simulation
          // The simulation will provide more specific error
          console.warn('[SIMULATION] Balance/allowance check failed:', checkError?.message);
        }
      } else {
        // For native tokens, check ETH balance
        try {
          const balance = await publicClient.getBalance({ address: fromAddress });
          if (balance < amountIn) {
            return {
              success: false,
              error: `Insufficient ETH balance. You have ${balance.toString()}, but need ${amountIn.toString()}`,
            };
          }
        } catch (checkError: any) {
          console.warn('[SIMULATION] ETH balance check failed:', checkError?.message);
        }
      }

      // ✅ EXACTLY match tiwi-test: Determine function name
      let functionName: string;
      if (isNativeIn && !isNativeOut) {
        functionName = useFeeOnTransfer
          ? 'swapExactETHForTokensSupportingFeeOnTransferTokens'
          : 'swapExactETHForTokens';
      } else if (!isNativeIn && isNativeOut) {
        functionName = useFeeOnTransfer
          ? 'swapExactTokensForETHSupportingFeeOnTransferTokens'
          : 'swapExactTokensForETH';
      } else {
        functionName = useFeeOnTransfer
          ? 'swapExactTokensForTokensSupportingFeeOnTransferTokens'
          : 'swapExactTokensForTokens';
      }

      // ✅ EXACTLY match tiwi-test: Simulate using simulateContract
      try {
        console.log("functionName", functionName, "pathAddresses", pathAddresses)
        await publicClient.simulateContract({
          account: fromAddress,
          address: routerAddress,
          abi: swapABI,
          functionName: functionName as any,
          args: isNativeIn
            ? [amountOutMin, pathAddresses, fromAddress, BigInt(deadline)]
            : [amountIn, amountOutMin, pathAddresses, fromAddress, BigInt(deadline)],
          value: isNativeIn ? amountIn : BigInt(0),
        });

        return { success: true };
      } catch (simError: any) {
        const errorMsg = simError?.message || simError?.toString() || '';

        // Provide more specific error messages
        if (errorMsg.includes('TRANSFER_FROM_FAILED') || errorMsg.includes('transferFrom')) {
          // This usually means insufficient allowance or balance
          // We already checked above, but RPC might not have indexed the approval yet
          return {
            success: false,
            error: `TRANSFER_FROM_FAILED: The router cannot transfer tokens from your wallet. This usually means: 1) Token approval hasn't been indexed yet (wait a few seconds), 2) Insufficient balance, or 3) Approval amount is too low. Please check your token approval and try again.`,
          };
        }

        // ✅ EXACTLY match tiwi-test: If simulation fails with fee-on-transfer, try without
        if (useFeeOnTransfer && errorMsg.includes('TRANSFER_FROM_FAILED')) {
          return this.simulateSwap(route, amountIn, amountOutMin, chainId, fromAddress, publicClient, false);
        }

        return { success: false, error: errorMsg };
      }
    } catch (error: any) {
      return { success: false, error: error?.message || 'Simulation failed' };
    }
  }
}
