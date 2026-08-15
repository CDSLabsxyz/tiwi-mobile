/**
 * BSC Native Swap Executor
 *
 * Handles native BNB → Token swaps on BSC with tax collection.
 *
 * This executor is needed because:
 * - Native BNB cannot be transferred via transferFrom (it's not an ERC20)
 * - The gasless/relayer executors require ERC20 tokens
 * - Native BNB swaps must use msg.value with PancakeSwap's swapExactETHForTokens
 *
 * Flow (Tax is ON TOP, not deducted from swap):
 * 1. Calculate 0.25% tax on BNB input amount
 * 2. User needs: swapAmount + taxAmount in wallet
 * 3. Send tax to revenue wallet
 * 4. Swap FULL BNB amount via PancakeSwap
 * 5. User receives output tokens
 *
 * Tax rate: 0.25% (same as BNB gas token rate)
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

// ============================================================================
// Constants
// ============================================================================

const BSC_CHAIN_ID = 56;

// Tax rate: 0.25% = 25 basis points
const TAX_RATE_BPS = 25;
const BASIS_POINTS = 10000;

// Revenue wallet for tax collection
const REVENUE_WALLET = '0x2452fc6b401fab80d9fda6050b2de0dd42b233bc' as Address;

// WBNB address (used in swap path)
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// PancakeSwap V2 Router
const PANCAKESWAP_V2_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address;

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

// ============================================================================
// PancakeSwap ABI
// ============================================================================

const PANCAKESWAP_ABI = [
  {
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactETHForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

// Router ABI for getAmountsOut
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

// ============================================================================
// BSC Native Swap Executor
// ============================================================================

export class BscNativeSwapExecutor implements SwapRouterExecutor {
  private publicClient: PublicClient;

  constructor() {
    this.publicClient = getCachedPublicClient(BSC_CHAIN_ID);
  }

  /**
   * Check if this executor can handle the given route
   * Only handles same-chain BSC native BNB → Token swaps
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

    // Only handle native BNB input
    if (!isNativeToken(route.fromToken.address)) {
      return false;
    }

    // Don't handle BNB → BNB (no swap needed)
    if (isNativeToken(route.toToken.address)) {
      console.log('[BscNativeSwapExecutor] Skipping BNB → BNB');
      return false;
    }

    console.log('[BscNativeSwapExecutor] Can handle native BNB → Token same-chain swap');
    return true;
  }

  /**
   * Get the spender address for token approval
   * Native BNB does not need approval
   */
  async getSpenderAddress(route: RouterRoute): Promise<string | null> {
    return null;
  }

  /**
   * Execute a native BNB swap with tax collection
   * Tax is ON TOP of swap amount - user swaps exact fromAmount
   * Total taken from wallet = fromAmount + taxAmount
   */
  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, toToken, fromAmount, userAddress, recipientAddress, walletClient, onStatusUpdate } = params;

    let activeWallet = walletClient;
    if (!activeWallet) {
      const { getEVMWalletClient } = await import('../utils/wallet-helpers');
      activeWallet = await getEVMWalletClient(fromToken?.chainId || params?.fromToken?.chainId || 56);
    }

    const chainId = fromToken.chainId || BSC_CHAIN_ID;

    // Ensure wallet is on the correct chain
    const { ensureCorrectChain } = await import('../utils/wallet-helpers');
    await ensureCorrectChain(chainId);

    console.log('[BscNativeSwapExecutor] Starting native BNB swap (tax ON TOP):', {
      from: fromToken.symbol,
      to: toToken.symbol,
      swapAmount: fromAmount,
    });

    onStatusUpdate?.({
      stage: 'preparing',
      message: 'Preparing...',
    });

    try {
      // 1. Calculate amounts - TAX IS ON TOP
      const swapAmountWei = parseUnits(fromAmount, 18); // BNB has 18 decimals - FULL swap amount

      // Tax = 0.25% of swap amount (charged ON TOP)
      const taxAmount = (swapAmountWei * BigInt(TAX_RATE_BPS)) / BigInt(BASIS_POINTS);

      // Total required from wallet = swap + tax
      const totalRequired = swapAmountWei + taxAmount;

      // Check user's BNB balance
      const userBalance = await this.publicClient.getBalance({
        address: userAddress as Address,
      });

      // Estimate gas cost dynamically (gasLimit × gasPrice) with a 20% buffer.
      // Fall back to 0.0003 BNB (~$0.19) if estimation fails - BSC gas is cheap.
      let gasBuffer: bigint;
      try {
        const [gasPrice, gasEstimate] = await Promise.all([
          this.publicClient.getGasPrice(),
          this.publicClient.estimateGas({
            account: userAddress as Address,
            to: REVENUE_WALLET, // conservative: simple transfer costs less than swap
            value: taxAmount,
          }),
        ]);
        // For two transactions (tax + swap), multiply by 4× estimated cost for the swap
        // and add 20% headroom.
        const taxGas = gasEstimate * gasPrice;       // ~21 000 gas units
        const swapGasEstimate = BigInt(250000);      // typical PancakeSwap swap
        const swapGas = swapGasEstimate * gasPrice;
        gasBuffer = ((taxGas + swapGas) * BigInt(120)) / BigInt(100); // +20%
      } catch {
        // Fallback: 0.0003 BNB covers both transactions at 3 gwei, 200k gas total
        gasBuffer = parseUnits('0.0003', 18);
      }

      const totalWithGas = totalRequired + gasBuffer;

      if (userBalance < totalWithGas) {
        const gasBufferHuman = formatUnits(gasBuffer, 18);
        throw new Error(
          `Insufficient BNB balance. ` +
          `You need ${formatUnits(totalRequired, 18)} BNB (${fromAmount} swap + ${formatUnits(taxAmount, 18)} tax) ` +
          `plus ~${parseFloat(gasBufferHuman).toFixed(5)} BNB for gas, ` +
          `but only have ${formatUnits(userBalance, 18)} BNB`
        );
      }

      console.log('[BscNativeSwapExecutor] Amounts calculated (ON TOP):', {
        swapBNB: formatUnits(swapAmountWei, 18),
        taxBNB: formatUnits(taxAmount, 18),
        totalFromWallet: formatUnits(totalRequired, 18),
        taxRate: `${TAX_RATE_BPS / 100}%`,
      });

      // 2. Build swap path
      const toTokenAddress = toToken.address.toLowerCase() === WBNB_ADDRESS.toLowerCase()
        ? WBNB_ADDRESS
        : toToken.address;

      const path = [WBNB_ADDRESS, toTokenAddress];

      // Get expected output for FULL swap amount
      let expectedOutput: bigint;
      try {
        const amounts = await this.publicClient.readContract({
          address: PANCAKESWAP_V2_ROUTER,
          abi: ROUTER_QUERY_ABI,
          functionName: 'getAmountsOut',
          args: [swapAmountWei, path as readonly `0x${string}`[]], // FULL swap amount
        }) as bigint[];
        expectedOutput = amounts[amounts.length - 1];
      } catch {
        throw new Error(`No liquidity found for BNB → ${toToken.symbol}`);
      }

      // 3. Calculate minAmountOut with 5% slippage
      const minAmountOut = (expectedOutput * BigInt(95)) / BigInt(100);

      console.log('[BscNativeSwapExecutor] Swap details:', {
        path: path.join(' → '),
        swapAmount: formatUnits(swapAmountWei, 18),
        expectedOutput: formatUnits(expectedOutput, toToken.decimals || 18),
        minAmountOut: formatUnits(minAmountOut, toToken.decimals || 18),
      });

      // 4. Send tax to revenue wallet
      onStatusUpdate?.({
        stage: 'signing',
        message: 'Confirming in wallet...',
      });

      const taxTxHash = await activeWallet.sendTransaction({
        to: REVENUE_WALLET,
        value: taxAmount,
        chain: bsc,
      });

      console.log('[BscNativeSwapExecutor] Tax sent:', taxTxHash);

      // Wait for tax tx to confirm
      await this.publicClient.waitForTransactionReceipt({
        hash: taxTxHash,
        timeout: 30000,
      });

      // 5. Execute swap via PancakeSwap with FULL swap amount
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes
      const recipient = (recipientAddress || userAddress) as Address;
      const pathAddresses = path.map(addr => getAddress(addr)) as readonly `0x${string}`[];

      const swapData = encodeFunctionData({
        abi: PANCAKESWAP_ABI,
        functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
        args: [minAmountOut, pathAddresses, recipient, deadline],
      });

      const swapTxHash = await activeWallet.sendTransaction({
        to: PANCAKESWAP_V2_ROUTER,
        data: swapData,
        value: swapAmountWei, // FULL BNB swap amount (tax already sent separately)
        chain: bsc,
      });

      console.log('[BscNativeSwapExecutor] Swap tx sent:', swapTxHash);

      onStatusUpdate?.({
        stage: 'confirming',
        message: 'Reviewing...',
        txHash: swapTxHash,
      });

      // 6. Wait for confirmation
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
      console.error('[BscNativeSwapExecutor] Swap failed:', error);

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
