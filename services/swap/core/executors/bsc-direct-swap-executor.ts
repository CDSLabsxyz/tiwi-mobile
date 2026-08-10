/**
 * BSC Direct Swap Executor
 *
 * Handles BSC swaps when user selects BNB as gas token.
 * Skips the relayer - user pays their own gas in native BNB.
 *
 * Flow (SINGLE TRANSACTION using Multicall3):
 * 1. Calculate 0.25% tax on fromAmount (tax is ON TOP, not deducted)
 * 2. User needs: swapAmount + taxAmount in wallet
 * 3. Execute via Multicall3: [tax transfer + swap] in ONE transaction
 * 4. User pays gas in native BNB
 *
 * This is used when:
 * - User selects BNB as gas token on BSC
 * - Relayer is skipped because user pays their own gas
 */

import {
  encodeFunctionData,
  parseUnits,
  getAddress,
  formatUnits,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { bsc } from 'viem/chains';
import { getCachedPublicClient } from '@/services/swap/core/platform/viem-clients';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { GasTokenType } from '@/services/swap/core/config/tax-config';
import { useSwapStore } from '@/services/swap/core/platform/swap-store';
import { shouldSkipSeparateTax } from '../utils/evm-tax-helper';

// ============================================================================
// Constants
// ============================================================================

const BSC_CHAIN_ID = 56;

// Tax rate: 0.25% = 25 basis points (same as BNB gas token rate)
const TAX_RATE_BPS = 25;
const BASIS_POINTS = 10000;

// Revenue wallet for tax collection
const REVENUE_WALLET = '0x2452fc6b401fab80d9fda6050b2de0dd42b233bc' as Address;

// WBNB address (used in swap path)
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// PancakeSwap V2 Router
const PANCAKESWAP_V2_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address;

// Multicall3 contract (deployed on BSC)
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address;

// Native token addresses
const NATIVE_TOKEN_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
];

function isNativeToken(address: string): boolean {
  if (!address) return true;
  return NATIVE_TOKEN_ADDRESSES.some(
    native => native.toLowerCase() === address.toLowerCase()
  );
}

function normalizeTokenAddress(address: string): string {
  if (isNativeToken(address)) {
    return WBNB_ADDRESS;
  }
  return address;
}

// ============================================================================
// ABIs
// ============================================================================

const PANCAKESWAP_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const ROUTER_QUERY_ABI = [
  {
    name: 'getAmountsOut',
    type: 'function',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
  },
] as const;

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ============================================================================
// BSC Direct Swap Executor
// ============================================================================

export class BscDirectSwapExecutor implements SwapRouterExecutor {
  private publicClient: PublicClient;

  constructor() {
    this.publicClient = getCachedPublicClient(BSC_CHAIN_ID);
  }

  /**
   * Check if this executor can handle the given route
   * Only handles BSC Token → Token SAME-CHAIN swaps when BNB is selected as gas token
   */
  canHandle(route: RouterRoute): boolean {
    const fromChainId = route.fromToken.chainId;
    const toChainId = route.toToken.chainId;

    // Only handle same-chain BSC swaps (not cross-chain)
    const isFromBsc = fromChainId === BSC_CHAIN_ID;
    const isToBsc = toChainId === BSC_CHAIN_ID;

    if (!isFromBsc || !isToBsc) {
      return false;
    }

    // Don't handle native BNB input (that's BscNativeSwapExecutor's job)
    if (isNativeToken(route.fromToken.address)) {
      return false;
    }

    // Check if BNB is selected as gas token
    const { selectedGasTokenType } = useSwapStore.getState();
    if (selectedGasTokenType !== GasTokenType.BNB) {
      return false;
    }

    console.log('[BscDirectSwapExecutor] Can handle BSC same-chain swap with BNB gas token (no relayer)');
    return true;
  }

  /**
   * Get the spender address for token approval
   */
  async getSpenderAddress(route: RouterRoute): Promise<string | null> {
    return PANCAKESWAP_V2_ROUTER;
  }

  /**
   * Execute a direct swap with tax collection (no relayer)
   * Tax is ON TOP of swap amount - user swaps exact fromAmount
   * Total taken from wallet = fromAmount + taxAmount
   */
  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, toToken, fromAmount, userAddress, recipientAddress, walletClient, onStatusUpdate } = params;

    // Self-fetch wallet client if none passed (enables fallback chain)
    let activeWallet = walletClient;
    if (!activeWallet) {
      const { getEVMWalletClient } = await import('../utils/wallet-helpers');
      activeWallet = await getEVMWalletClient(fromToken.chainId || BSC_CHAIN_ID);
    }

    const chainId = fromToken.chainId || BSC_CHAIN_ID;

    // Ensure wallet is on the correct chain
    const { ensureCorrectChain } = await import('../utils/wallet-helpers');
    await ensureCorrectChain(chainId);

    console.log('[BscDirectSwapExecutor] Starting direct swap with tax ON TOP:', {
      from: fromToken.symbol,
      to: toToken.symbol,
      swapAmount: fromAmount,
    });

    onStatusUpdate?.({
      stage: 'preparing',
      message: 'Preparing...',
    });

    try {
      // Native BNB has no ERC20 interface — every step below (balanceOf, allowance,
      // transfer, swapExactTokensFor*) would be called against the zero address.
      // BscNativeSwapExecutor owns this case; getting here means the route was
      // labelled with WBNB while the user is actually spending BNB.
      if (isNativeToken(fromToken.address)) {
        throw new Error(
          'Native BNB cannot be swapped through the direct (ERC20) path — expected the native BNB executor.'
        );
      }

      const fromDecimals = fromToken.decimals || 18;
      const inputAmountWei = parseUnits(fromAmount, fromDecimals);

      // 1. Check user's fromToken balance
      const fromTokenAddress = fromToken.address as Address;
      const userBalance = await this.publicClient.readContract({
        address: fromTokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress as Address],
      }) as bigint;

      // Skip Tiwi tax on this leg when the fee is charged elsewhere (e.g. multi-leg swaps
      // collect it once, inline, on the other leg) or folded inline by the route.
      const skipTax = shouldSkipSeparateTax(params);

      // 2. Calculate tax (0.25%) — deduct FROM input so user never needs more than they have
      // If user enters their full balance, tax comes out of it: swap = input - tax
      const taxAmount = skipTax ? BigInt(0) : (inputAmountWei * BigInt(TAX_RATE_BPS)) / BigInt(BASIS_POINTS);
      let swapAmountWei: bigint;

      if (userBalance >= inputAmountWei + taxAmount) {
        // User has enough for input + tax on top
        swapAmountWei = inputAmountWei;
      } else if (userBalance >= inputAmountWei) {
        // User has the input amount but not enough extra for tax — deduct tax from swap
        swapAmountWei = inputAmountWei - taxAmount;
      } else {
        throw new Error(`Insufficient ${fromToken.symbol} balance`);
      }

      // Recalculate tax based on actual swap amount (for the deducted case)
      const actualTax = skipTax ? BigInt(0) : (swapAmountWei * BigInt(TAX_RATE_BPS)) / BigInt(BASIS_POINTS);

      console.log('[BscDirectSwapExecutor] Tax calculation:', {
        inputAmount: formatUnits(inputAmountWei, fromDecimals),
        swapAmount: formatUnits(swapAmountWei, fromDecimals),
        taxAmount: formatUnits(actualTax, fromDecimals),
        userBalance: formatUnits(userBalance, fromDecimals),
        taxRate: `${TAX_RATE_BPS / 100}%`,
      });

      // 3. Build swap path
      const normalizedFrom = normalizeTokenAddress(fromToken.address);
      const normalizedTo = normalizeTokenAddress(toToken.address);
      const outputIsNativeBNB = isNativeToken(toToken.address);

      let path: string[];
      let expectedOutput: bigint;

      // Try direct path first, then through WBNB
      try {
        path = [normalizedFrom, normalizedTo];
        const amounts = await this.publicClient.readContract({
          address: PANCAKESWAP_V2_ROUTER,
          abi: ROUTER_QUERY_ABI,
          functionName: 'getAmountsOut',
          args: [swapAmountWei, path as readonly `0x${string}`[]], // Use FULL swap amount
        }) as bigint[];
        expectedOutput = amounts[amounts.length - 1];
      } catch {
        if (normalizedFrom.toLowerCase() !== WBNB_ADDRESS.toLowerCase() &&
          normalizedTo.toLowerCase() !== WBNB_ADDRESS.toLowerCase()) {
          path = [normalizedFrom, WBNB_ADDRESS, normalizedTo];
          const amounts = await this.publicClient.readContract({
            address: PANCAKESWAP_V2_ROUTER,
            abi: ROUTER_QUERY_ABI,
            functionName: 'getAmountsOut',
            args: [swapAmountWei, path as readonly `0x${string}`[]],
          }) as bigint[];
          expectedOutput = amounts[amounts.length - 1];
        } else {
          throw new Error(`No liquidity found for ${fromToken.symbol} → ${toToken.symbol}`);
        }
      }

      const minAmountOut = (expectedOutput * BigInt(95)) / BigInt(100); // 5% slippage

      console.log('[BscDirectSwapExecutor] Swap details:', {
        path: path.join(' → '),
        swapAmount: formatUnits(swapAmountWei, fromDecimals),
        expectedOutput: formatUnits(expectedOutput, toToken.decimals || 18),
        minAmountOut: formatUnits(minAmountOut, toToken.decimals || 18),
      });

      // 4. Check and handle approval for PancakeSwap router
      const currentAllowance = await this.publicClient.readContract({
        address: fromTokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [userAddress as Address, PANCAKESWAP_V2_ROUTER],
      }) as bigint;

      if (currentAllowance < swapAmountWei) {
        onStatusUpdate?.({
          stage: 'approving',
          message: 'Approving...',
        });

        const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [PANCAKESWAP_V2_ROUTER, maxApproval],
        });

        const approveTxHash = await activeWallet.sendTransaction({
          to: fromTokenAddress,
          data: approveData,
          chain: bsc,
        });

        await this.publicClient.waitForTransactionReceipt({
          hash: approveTxHash,
          timeout: 30000,
        });

        console.log('[BscDirectSwapExecutor] Approval done:', approveTxHash);
      }

      // 5. Execute tax transfer + swap in SINGLE TRANSACTION
      // We do this by sending tax first, then swap immediately after
      // This is 2 txs but user only sees one confirmation flow
      onStatusUpdate?.({
        stage: 'signing',
        message: 'Confirming in wallet...',
      });

      // 5a. Tax transfer (use actualTax which accounts for balance-deducted scenarios).
      // Skipped entirely when the fee is charged on another leg / inline — removes a signature.
      if (!skipTax) {
        const taxTransferData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [REVENUE_WALLET, actualTax],
        });

        const taxTxHash = await activeWallet.sendTransaction({
          to: fromTokenAddress,
          data: taxTransferData,
          chain: bsc,
        });

        console.log('[BscDirectSwapExecutor] Tax sent:', taxTxHash);

        // Wait for tax tx confirmation
        await this.publicClient.waitForTransactionReceipt({
          hash: taxTxHash,
          timeout: 30000,
        });
      } else {
        console.log('[BscDirectSwapExecutor] Skipping tax (charged on another leg or inline)');
      }

      // 5b. Execute swap with FULL swap amount (not reduced by tax)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes
      const recipient = (recipientAddress || userAddress) as Address;
      const pathAddresses = path.map(addr => getAddress(addr)) as readonly `0x${string}`[];

      // Use swapExactTokensForETH if output is native BNB
      const functionName = outputIsNativeBNB
        ? 'swapExactTokensForETHSupportingFeeOnTransferTokens'
        : 'swapExactTokensForTokensSupportingFeeOnTransferTokens';

      const swapData = encodeFunctionData({
        abi: PANCAKESWAP_ABI,
        functionName: functionName as any,
        args: [swapAmountWei, minAmountOut, pathAddresses, recipient, deadline], // FULL swap amount
      });

      const swapTxHash = await activeWallet.sendTransaction({
        to: PANCAKESWAP_V2_ROUTER,
        data: swapData,
        chain: bsc,
      });

      console.log('[BscDirectSwapExecutor] Swap tx sent:', swapTxHash);

      onStatusUpdate?.({
        stage: 'confirming',
        message: 'Reviewing...',
        txHash: swapTxHash,
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: swapTxHash,
        timeout: 60000,
      });

      if (receipt.status === 'reverted') {
        throw new Error('Swap transaction reverted');
      }

      onStatusUpdate?.({
        stage: 'completed',
        message: 'Success',
        txHash: swapTxHash,
      });

      return {
        success: true,
        txHash: swapTxHash,
        actualToAmount: route.toToken.amount,
      };
    } catch (error: any) {
      console.error('[BscDirectSwapExecutor] Swap failed:', error);

      const { formatErrorMessage } = await import('../utils/error-handler');
      onStatusUpdate?.({
        stage: 'failed',
        message: formatErrorMessage(error),
        error,
      });

      throw error;
    }
  }
}
