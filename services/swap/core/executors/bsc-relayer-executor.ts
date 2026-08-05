/**
 * BSC Relayer Executor
 *
 * Executes swaps on BSC through the TiwiSwapRelayer contract for gasless swaps.
 * Users can pay gas fees in TWC, BNB, or other BSC tokens.
 *
 * Tax rates:
 * - TWC: 0.20%
 * - BNB: 0.25%
 * - Other BSC tokens: 0.30%
 *
 * Flow:
 * 1. User approves relayer to spend FROM token + gas token
 * 2. Relayer collects tax (to revenue wallet) and gas reimbursement (to relayer wallet)
 * 3. Relayer pulls FROM tokens from user
 * 4. Relayer approves router and executes swap
 * 5. Output tokens go directly to user
 */

import {
  encodeFunctionData,
  parseUnits,
  getAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { bsc } from 'viem/chains';
import { getCachedPublicClient } from '@/services/swap/core/platform/viem-clients';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import {
  BSC_RELAYER_CONFIG,
  GasTokenType,
  getTaxRate,
  BASIS_POINTS,
} from '@/services/swap/core/config/tax-config';
import { useSwapStore } from '@/services/swap/core/platform/swap-store';
import { toSmallestUnit } from '../utils/amount-converter';

// ============================================================================
// Constants
// ============================================================================

const BSC_CHAIN_ID = 56;
const BSC_TESTNET_CHAIN_ID = 97;

// WBNB address for BNB gas payments
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// Native token placeholder addresses (used by various protocols)
const NATIVE_TOKEN_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
];

/**
 * Check if an address represents native BNB
 */
function isNativeToken(address: string): boolean {
  if (!address) return true;
  return NATIVE_TOKEN_ADDRESSES.some(
    native => native.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Normalize token address - converts native BNB to WBNB for contract calls
 */
function normalizeTokenAddress(address: string): string {
  if (isNativeToken(address)) {
    return WBNB_ADDRESS;
  }
  return address;
}

// PancakeSwap V2 Router address on BSC
const PANCAKESWAP_V2_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

// PancakeSwap V2 Factory address on BSC
const PANCAKESWAP_V2_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';

// Factory ABI to check if pair exists
const FACTORY_ABI = [
  {
    name: 'getPair',
    type: 'function',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

// Router ABI to get amounts out
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
  {
    name: 'WETH',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'pure',
  },
] as const;

// Pair ABI to check reserves
const PAIR_ABI = [
  {
    name: 'getReserves',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'token0',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'token1',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

// Common BSC DEX/Aggregator router addresses that should be whitelisted
const COMMON_BSC_ROUTERS: Record<string, string> = {
  'pancakeswap_v2': '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  'pancakeswap_v3': '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
  'lifi_diamond': '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
  'sushiswap_v2': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
  'uniswap_v3': '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  'biswap': '0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8',
  'apeswap': '0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b7',
  'babyswap': '0x325E343f1dE602396E256B67eFd1F61C3A6B38Bd',
  'mdex': '0x7DAe51BD3E3376B8c7c4900E9107f12Be3AF1bA8',
};

// PancakeSwap Router ABI (minimal for swap functions)
const PANCAKESWAP_ABI = [
  // Standard swap functions (more compatible)
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
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
    name: 'swapExactTokensForETH',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Fee-on-transfer supporting functions
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

// TiwiSwapRelayer ABI (minimal)
const RELAYER_ABI = [
  {
    name: 'isRouterAllowed',
    type: 'function',
    inputs: [{ name: 'router', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'executeSwapWithRelay',
    type: 'function',
    inputs: [
      {
        name: 'swap',
        type: 'tuple',
        components: [
          { name: 'fromToken', type: 'address' },
          { name: 'toToken', type: 'address' },
          { name: 'fromAmount', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'router', type: 'address' },
          { name: 'routerCalldata', type: 'bytes' },
        ],
      },
      {
        name: 'gasPayment',
        type: 'tuple',
        components: [
          { name: 'gasToken', type: 'address' },
          { name: 'taxAmount', type: 'uint256' },
          { name: 'gasReimbursement', type: 'uint256' },
          { name: 'gasTokenType', type: 'uint8' },
        ],
      },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const;

// ERC20 ABI for approvals and balances
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
  {
    name: 'symbol',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const;

// TWC token address for gas token symbol lookup
const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';

// ============================================================================
// Types
// ============================================================================

interface SwapRequest {
  fromToken: Address;
  toToken: Address;
  fromAmount: bigint;
  recipient: Address;
  router: Address;
  routerCalldata: Hex;
}

interface GasPayment {
  gasToken: Address;
  taxAmount: bigint;
  gasReimbursement: bigint;
  gasTokenType: number;
}

// ============================================================================
// BSC Relayer Executor
// ============================================================================

export class BscRelayerExecutor implements SwapRouterExecutor {
  private publicClient: PublicClient;

  constructor() {
    this.publicClient = getCachedPublicClient(BSC_CHAIN_ID);
  }

  /**
   * Check if this executor can handle the given route
   * Handles ALL same-chain BSC swaps to ensure tax is collected on every BSC transaction
   */
  canHandle(route: RouterRoute): boolean {
    const fromChainId = route.fromToken.chainId;
    const toChainId = route.toToken.chainId;

    // Only handle same-chain BSC swaps (not cross-chain)
    const isFromBsc = fromChainId === BSC_CHAIN_ID || fromChainId === BSC_TESTNET_CHAIN_ID;
    const isToBsc = toChainId === BSC_CHAIN_ID || toChainId === BSC_TESTNET_CHAIN_ID;

    if (!isFromBsc || !isToBsc) {
      return false;
    }

    // Check if relayer contract is configured
    const relayerAddress = this.getRelayerAddress(fromChainId);
    if (!relayerAddress) {
      console.log('[BscRelayerExecutor] No relayer address configured');
      return false;
    }

    // IMPORTANT: Relayer executor CANNOT handle native BNB input
    // Native BNB cannot be transferred via transferFrom (it's not an ERC20)
    // User needs to use BscNativeSwapExecutor for native BNB swaps
    if (isNativeToken(route.fromToken.address)) {
      console.log('[BscRelayerExecutor] Skipping native BNB input - use BscNativeSwapExecutor');
      return false;
    }

    // Handle ALL same-chain BSC routes to ensure tax collection
    // The buildRouterCalldata method handles different route types:
    // - Pre-built LiFi transaction data
    // - Pre-built tx data from aggregators
    // - Routes with paths (PancakeSwap)
    // - Fallback to simple from->to path
    console.log('[BscRelayerExecutor] Handling BSC same-chain route:', {
      router: route.router,
      hasPrebuiltTx: !!route.raw?.transactionRequest?.data || !!route.raw?.tx?.data,
      hasPath: !!route.raw?.path,
    });

    return true;
  }

  /**
   * Get the spender address for token approval
   */
  async getSpenderAddress(route: RouterRoute): Promise<string | null> {
    const chainId = route.fromToken.chainId;
    return this.getRelayerAddress(chainId);
  }

  /**
   * Execute a swap through the BSC relayer
   */
  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, toToken, fromAmount, userAddress, recipientAddress, walletClient, onStatusUpdate } = params;

    const chainId = fromToken.chainId || BSC_CHAIN_ID;

    // Ensure wallet is on the correct chain
    const { ensureCorrectChain } = await import('../utils/wallet-helpers');
    await ensureCorrectChain(chainId);

    const relayerAddress = this.getRelayerAddress(chainId);

    if (!relayerAddress) {
      throw new Error('BSC Relayer not configured for this network');
    }

    let activeWallet = walletClient;
    if (!activeWallet) {
      const { getEVMWalletClient } = await import('../utils/wallet-helpers');
      activeWallet = await getEVMWalletClient(fromToken?.chainId || params?.fromToken?.chainId || 56);
    }

    // Get gas token selection from store
    const { selectedGasTokenType, selectedGasToken } = useSwapStore.getState();

    console.log('[BscRelayerExecutor] Starting swap execution:', {
      router: route.router,
      hasPath: !!route.raw?.path,
      path: route.raw?.path,
      fromToken: fromToken.symbol,
      toToken: toToken.symbol,
      gasTokenType: selectedGasTokenType,
    });

    onStatusUpdate?.({
      stage: 'preparing',
      message: 'Preparing BSC relayer swap...',
    });

    try {
      // 1. Get the underlying router address and calldata from the route
      const { routerAddress, routerCalldata } = await this.buildRouterCalldata(route, params);
      console.log('[BscRelayerExecutor] Built router calldata for:', routerAddress);

      // 2. Calculate tax and gas amounts
      const fromAmountWei = parseUnits(fromAmount, fromToken.decimals || 18);
      const fromTokenDecimals = fromToken.decimals || 18;
      const { gasToken, gasTokenDecimals, taxAmount, gasReimbursement, gasTokenType } = await this.calculateGasPayment(
        fromAmountWei,
        fromTokenDecimals,
        selectedGasTokenType,
        selectedGasToken,
        chainId
      );

      // 2.5. CRITICAL: Check user balances BEFORE proceeding
      const normalizedFromTokenForApproval = normalizeTokenAddress(fromToken.address) as Address;
      const totalGasPayment = taxAmount + gasReimbursement;

      onStatusUpdate?.({
        stage: 'preparing',
        message: 'Checking token balances...',
      });

      // Check FROM token balance
      const fromBalance = await this.publicClient.readContract({
        address: normalizedFromTokenForApproval,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress as Address],
      }) as bigint;

      if (fromBalance < fromAmountWei) {
        const fromSymbol = fromToken.symbol || 'token';
        throw new Error(`Insufficient ${fromSymbol} balance. You have ${(Number(fromBalance) / 10 ** fromTokenDecimals).toFixed(4)} but need ${fromAmount}`);
      }

      // Check GAS token balance (if different from FROM token)
      if (gasToken.toLowerCase() !== normalizedFromTokenForApproval.toLowerCase()) {
        const gasBalance = await this.publicClient.readContract({
          address: gasToken,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [userAddress as Address],
        }) as bigint;

        if (gasBalance < totalGasPayment) {
          // Get gas token symbol
          let gasSymbol = 'gas token';
          try {
            gasSymbol = await this.publicClient.readContract({
              address: gasToken,
              abi: ERC20_ABI,
              functionName: 'symbol',
              args: [],
            }) as string;
          } catch {
            if (gasToken.toLowerCase() === WBNB_ADDRESS.toLowerCase()) gasSymbol = 'WBNB';
            else if (gasToken.toLowerCase() === TWC_ADDRESS.toLowerCase()) gasSymbol = 'TWC';
          }

          throw new Error(
            `Insufficient ${gasSymbol} balance for gas payment. ` +
            `You have ${(Number(gasBalance) / 10 ** gasTokenDecimals).toFixed(4)} but need ~${(Number(totalGasPayment) / 10 ** gasTokenDecimals).toFixed(4)}. ` +
            `Try selecting TWC as gas token instead.`
          );
        }
      }

      console.log('[BscRelayerExecutor] Balance check passed:', {
        fromToken: fromToken.symbol,
        fromBalance: fromBalance.toString(),
        fromAmountWei: fromAmountWei.toString(),
        gasToken: gasToken,
        totalGasPayment: totalGasPayment.toString(),
      });

      // 3. Check and request approvals
      onStatusUpdate?.({
        stage: 'approving',
        message: 'Approving...',
      });

      await this.ensureApprovals(
        activeWallet,
        userAddress as Address,
        relayerAddress as Address,
        normalizedFromTokenForApproval,
        fromAmountWei,
        gasToken,
        totalGasPayment,
        onStatusUpdate
      );

      // 4. Build the relayer transaction
      onStatusUpdate?.({
        stage: 'signing',
        message: 'Signing the swap transaction...',
      });

      // Normalize token addresses (convert native BNB to WBNB)
      const normalizedFromToken = normalizeTokenAddress(fromToken.address);
      const normalizedToToken = normalizeTokenAddress(toToken.address);

      console.log('[BscRelayerExecutor] Normalized addresses:', {
        fromToken: `${fromToken.address} -> ${normalizedFromToken}`,
        toToken: `${toToken.address} -> ${normalizedToToken}`,
      });

      const swap: SwapRequest = {
        fromToken: normalizedFromToken as Address,
        toToken: normalizedToToken as Address,
        fromAmount: fromAmountWei,
        recipient: (recipientAddress || userAddress) as Address,
        router: routerAddress as Address,
        routerCalldata: routerCalldata as Hex,
      };

      const gasPayment: GasPayment = {
        gasToken,
        taxAmount,
        gasReimbursement,
        gasTokenType,
      };

      console.log('[BscRelayerExecutor] Full swap request:', {
        swap: {
          fromToken: swap.fromToken,
          toToken: swap.toToken,
          fromAmount: swap.fromAmount.toString(),
          recipient: swap.recipient,
          router: swap.router,
          routerCalldataLength: swap.routerCalldata.length,
        },
        gasPayment: {
          gasToken: gasPayment.gasToken,
          taxAmount: gasPayment.taxAmount.toString(),
          gasReimbursement: gasPayment.gasReimbursement.toString(),
          gasTokenType: gasPayment.gasTokenType,
        },
        relayerAddress,
      });

      const data = encodeFunctionData({
        abi: RELAYER_ABI,
        functionName: 'executeSwapWithRelay',
        args: [swap, gasPayment],
      });

      // 5. Send the transaction
      const hash = await activeWallet.sendTransaction({
        to: relayerAddress as Address,
        data,
        value: BigInt(0),
        chain: bsc,
      });

      onStatusUpdate?.({
        stage: 'confirming',
        message: 'Reviewing...',
        txHash: hash,
      });

      // 6. Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        timeout: 60000,
      });

      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted');
      }

      onStatusUpdate?.({
        stage: 'completed',
        message: 'Success',
        txHash: hash,
      });

      return {
        success: true,
        txHash: hash,
        actualToAmount: route.toToken.amount,
      };
    } catch (error: any) {
      console.error('[BscRelayerExecutor] Swap failed:', error);

      const { formatErrorMessage } = await import('../utils/error-handler');
      onStatusUpdate?.({
        stage: 'failed',
        message: formatErrorMessage(error),
        error,
      });

      throw error;
    }
  }

  /**
   * Get relayer contract address for a chain
   */
  private getRelayerAddress(chainId: number): string | null {
    if (chainId === BSC_CHAIN_ID) {
      return BSC_RELAYER_CONFIG.mainnet.relayerContract || null;
    }
    if (chainId === BSC_TESTNET_CHAIN_ID) {
      return BSC_RELAYER_CONFIG.testnet.relayerContract || null;
    }
    return null;
  }

  /**
   * Check if a router is whitelisted in the relayer contract
   */
  private async isRouterWhitelisted(routerAddress: string, relayerAddress: string): Promise<boolean> {
    try {
      const isAllowed = await this.publicClient.readContract({
        address: relayerAddress as Address,
        abi: RELAYER_ABI,
        functionName: 'isRouterAllowed',
        args: [routerAddress as Address],
      });
      return isAllowed as boolean;
    } catch (error) {
      console.warn('[BscRelayerExecutor] Failed to check router whitelist:', error);
      return false;
    }
  }

  /**
   * Check if a pair exists on PancakeSwap V2
   */
  private async getPairAddress(tokenA: string, tokenB: string): Promise<string | null> {
    try {
      const pairAddress = await this.publicClient.readContract({
        address: PANCAKESWAP_V2_FACTORY as Address,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [tokenA as Address, tokenB as Address],
      });

      const pair = pairAddress as string;
      if (pair === '0x0000000000000000000000000000000000000000') {
        return null;
      }
      return pair;
    } catch (error) {
      console.warn('[BscRelayerExecutor] Failed to get pair:', error);
      return null;
    }
  }

  /**
   * Check if a pair has liquidity
   */
  private async checkPairLiquidity(pairAddress: string): Promise<{ reserve0: bigint; reserve1: bigint } | null> {
    try {
      const reserves = await this.publicClient.readContract({
        address: pairAddress as Address,
        abi: PAIR_ABI,
        functionName: 'getReserves',
      });

      const [reserve0, reserve1] = reserves as [bigint, bigint, number];

      if (reserve0 === BigInt(0) || reserve1 === BigInt(0)) {
        return null;
      }

      return { reserve0, reserve1 };
    } catch (error) {
      console.warn('[BscRelayerExecutor] Failed to check pair liquidity:', error);
      return null;
    }
  }

  /**
   * Verify a swap path has liquidity using getAmountsOut
   * Returns expected output amounts if path is valid, null otherwise
   */
  private async verifyPathWithRouter(
    amountIn: bigint,
    path: string[]
  ): Promise<bigint[] | null> {
    try {
      const amounts = await this.publicClient.readContract({
        address: PANCAKESWAP_V2_ROUTER as Address,
        abi: ROUTER_QUERY_ABI,
        functionName: 'getAmountsOut',
        args: [amountIn, path as readonly `0x${string}`[]],
      });

      return amounts as bigint[];
    } catch (error: any) {
      console.warn('[BscRelayerExecutor] getAmountsOut failed for path:', path, error.message);
      return null;
    }
  }

  /**
   * Find a valid swap path with liquidity
   * Tries different path combinations to find one that works
   */
  private async findValidPath(
    fromToken: string,
    toToken: string,
    amountIn: bigint
  ): Promise<{ path: string[]; expectedOutput: bigint } | null> {
    const fromAddr = normalizeTokenAddress(fromToken);
    const toAddr = normalizeTokenAddress(toToken);

    console.log('[BscRelayerExecutor] Finding valid path:', {
      fromToken: fromAddr,
      toToken: toAddr,
      amountIn: amountIn.toString(),
    });

    // Path candidates to try (in order of preference)
    const pathCandidates: string[][] = [];

    // 1. Direct path (if not the same token)
    if (fromAddr.toLowerCase() !== toAddr.toLowerCase()) {
      pathCandidates.push([fromAddr, toAddr]);
    }

    // 2. Through WBNB (if neither token is WBNB)
    const wbnbLower = WBNB_ADDRESS.toLowerCase();
    if (fromAddr.toLowerCase() !== wbnbLower && toAddr.toLowerCase() !== wbnbLower) {
      pathCandidates.push([fromAddr, WBNB_ADDRESS, toAddr]);
    }

    // 3. Common stable coins as intermediates
    const BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
    const USDT = '0x55d398326f99059fF775485246999027B3197955';
    const USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

    // Only add stablecoin paths if tokens aren't already stablecoins
    const stablecoins = [BUSD.toLowerCase(), USDT.toLowerCase(), USDC.toLowerCase()];
    const fromIsStable = stablecoins.includes(fromAddr.toLowerCase());
    const toIsStable = stablecoins.includes(toAddr.toLowerCase());

    if (!fromIsStable && !toIsStable) {
      // Through BUSD
      pathCandidates.push([fromAddr, BUSD, toAddr]);
      // Through USDT
      pathCandidates.push([fromAddr, USDT, toAddr]);
      // Through WBNB then stablecoin
      if (fromAddr.toLowerCase() !== wbnbLower) {
        pathCandidates.push([fromAddr, WBNB_ADDRESS, BUSD, toAddr]);
      }
    }

    // Try each path
    for (const candidatePath of pathCandidates) {
      console.log('[BscRelayerExecutor] Trying path:', candidatePath.join(' -> '));

      // First check if all pairs in the path exist
      let allPairsExist = true;
      for (let i = 0; i < candidatePath.length - 1; i++) {
        const pairAddress = await this.getPairAddress(candidatePath[i], candidatePath[i + 1]);
        if (!pairAddress) {
          console.log(`[BscRelayerExecutor] No pair exists for ${candidatePath[i]} -> ${candidatePath[i + 1]}`);
          allPairsExist = false;
          break;
        }

        // Check liquidity
        const liquidity = await this.checkPairLiquidity(pairAddress);
        if (!liquidity) {
          console.log(`[BscRelayerExecutor] No liquidity in pair ${pairAddress}`);
          allPairsExist = false;
          break;
        }

        console.log(`[BscRelayerExecutor] Pair ${pairAddress} has liquidity:`, {
          reserve0: liquidity.reserve0.toString(),
          reserve1: liquidity.reserve1.toString(),
        });
      }

      if (!allPairsExist) {
        continue;
      }

      // Verify path with router's getAmountsOut
      const amounts = await this.verifyPathWithRouter(amountIn, candidatePath);
      if (amounts && amounts.length > 0) {
        const expectedOutput = amounts[amounts.length - 1];
        console.log('[BscRelayerExecutor] Valid path found:', {
          path: candidatePath.join(' -> '),
          expectedOutput: expectedOutput.toString(),
        });
        return { path: candidatePath, expectedOutput };
      }
    }

    console.error('[BscRelayerExecutor] No valid path found for swap');
    return null;
  }

  /**
   * Build router calldata from the route
   * This builds the actual DEX router call that the relayer will execute
   *
   * The relayer works with ANY route - it just collects tax and forwards the transaction.
   * Priority:
   * 1. Use pre-built transaction data from aggregators (LiFi, Rubic, etc.)
   * 2. Fall back to building PancakeSwap calldata if no pre-built data
   *
   * How it works with pre-built calldata:
   * - Relayer pulls FROM tokens from user to itself
   * - Relayer approves the target router
   * - Relayer calls router with pre-built calldata
   * - Router pulls tokens from relayer (msg.sender in router's context)
   * - Router sends output to recipient (encoded in calldata)
   */
  private async buildRouterCalldata(
    route: RouterRoute,
    params: SwapExecutionParams
  ): Promise<{ routerAddress: string; routerCalldata: string }> {
    const { fromToken, toToken, fromAmount, recipientAddress, userAddress } = params;
    const recipient = recipientAddress || userAddress;
    const chainId = fromToken.chainId || BSC_CHAIN_ID;

    console.log('[BscRelayerExecutor] Building calldata for BSC swap:', {
      router: route.router,
      from: fromToken.symbol,
      to: toToken.symbol,
    });

    // NOTE: Pre-built aggregator calldata (LiFi, Rubic, etc.) doesn't work with relayer pattern
    // because the calldata is designed for direct user calls with hardcoded addresses.
    // Instead, we always build PancakeSwap calldata using the path/quote from the aggregator.
    // This ensures reliable execution through the relayer.
    console.log('[BscRelayerExecutor] Building PancakeSwap calldata for relayer execution');

    // Normalize token addresses for path building (native BNB -> WBNB)
    const normalizedFromAddr = normalizeTokenAddress(fromToken.address);
    const normalizedToAddr = normalizeTokenAddress(toToken.address);

    // Calculate fromAmount in wei
    const fromAmountWei = parseUnits(fromAmount, fromToken.decimals || 18);

    // Find a valid path with liquidity verification
    console.log('[BscRelayerExecutor] Verifying swap path with liquidity checks...');
    const validPath = await this.findValidPath(normalizedFromAddr, normalizedToAddr, fromAmountWei);

    let path: string[];
    let amountOutMin: bigint;

    if (validPath) {
      // Use the verified path
      path = validPath.path;
      // Use 95% of expected output as minimum (5% slippage)
      amountOutMin = (validPath.expectedOutput * BigInt(95)) / BigInt(100);

      console.log('[BscRelayerExecutor] Using verified path:', {
        path: path.join(' -> '),
        expectedOutput: validPath.expectedOutput.toString(),
        amountOutMin: amountOutMin.toString(),
      });
    } else {
      // Fallback: Try to use the path from the route if path verification failed
      // This could happen if the token isn't on PancakeSwap but might be on another DEX
      console.warn('[BscRelayerExecutor] Path verification failed, falling back to route path');

      // Try to extract path from various sources
      if (route.raw?.path && Array.isArray(route.raw.path) && route.raw.path.length >= 2) {
        path = route.raw.path.map((addr: string) => normalizeTokenAddress(addr));
        console.log('[BscRelayerExecutor] Using path from route.raw.path (unverified)');
      } else if (route.raw?.includedSteps && Array.isArray(route.raw.includedSteps)) {
        const extractedPath = this.extractPathFromIncludedSteps(route.raw.includedSteps, normalizedFromAddr, normalizedToAddr);
        if (extractedPath.length >= 2) {
          path = extractedPath.map(addr => normalizeTokenAddress(addr));
          console.log('[BscRelayerExecutor] Using path from includedSteps (unverified)');
        } else {
          throw new Error(`No valid swap path found. The token pair may not have liquidity on PancakeSwap V2. From: ${fromToken.symbol} To: ${toToken.symbol}`);
        }
      } else if (route.steps && route.steps.length > 0) {
        const extractedPath = this.extractPathFromSteps(route, normalizedFromAddr, normalizedToAddr);
        if (extractedPath.length >= 2) {
          path = extractedPath.map(addr => normalizeTokenAddress(addr));
          console.log('[BscRelayerExecutor] Using path from steps (unverified)');
        } else {
          throw new Error(`No valid swap path found. The token pair may not have liquidity on PancakeSwap V2. From: ${fromToken.symbol} To: ${toToken.symbol}`);
        }
      } else {
        throw new Error(`No valid swap path found. The token pair may not have liquidity on PancakeSwap V2. From: ${fromToken.symbol} To: ${toToken.symbol}`);
      }

      // For unverified paths, use 1 as amountOutMin (user accepts any output)
      amountOutMin = BigInt(1);
      console.warn('[BscRelayerExecutor] Using amountOutMin=1 for unverified path');
    }

    console.log('[BscRelayerExecutor] Building PancakeSwap calldata:', {
      pathLength: path.length,
      path: path.map((p, i) => `${i}: ${p}`),
      fromToken: fromToken.symbol,
      toToken: toToken.symbol,
      amountOutMin: amountOutMin.toString(),
    });

    // Deadline: 20 minutes from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    // Always use PancakeSwap V2 Router since we're building PancakeSwap-specific calldata
    const routerAddress = PANCAKESWAP_V2_ROUTER;

    // Convert path to proper format
    const pathAddresses = path.map((addr: string) => getAddress(addr)) as readonly `0x${string}`[];

    // Determine if native token is involved
    const tokenInLower = path[0].toLowerCase();
    const tokenOutLower = path[path.length - 1].toLowerCase();
    const isNativeInput = tokenInLower === WBNB_ADDRESS.toLowerCase();
    const isNativeOutput = tokenOutLower === WBNB_ADDRESS.toLowerCase();

    // Build the appropriate swap function call
    // Use swapExactTokensForTokens for ALL swaps (including to WBNB)
    // This keeps it simple and avoids native BNB transfer complexities
    // User will receive WBNB which they can unwrap later if needed
    const functionName = 'swapExactTokensForTokens';
    const args = [fromAmountWei, amountOutMin, pathAddresses, recipient as Address, deadline] as const;

    console.log('[BscRelayerExecutor] Using swapExactTokensForTokens for all swaps:', {
      isNativeOutput,
      note: 'Swapping to WBNB instead of native BNB for simplicity',
    });

    const routerCalldata = encodeFunctionData({
      abi: PANCAKESWAP_ABI,
      functionName: functionName as any,
      args,
    });

    console.log('[BscRelayerExecutor] Built router calldata:', {
      routerAddress,
      functionName,
      fromAmount: fromAmountWei.toString(),
      amountOutMin: amountOutMin.toString(),
      path: path.join(' -> '),
      pathAddresses: pathAddresses.join(' -> '),
      recipient,
      deadline: deadline.toString(),
    });

    return {
      routerAddress,
      routerCalldata,
    };
  }

  /**
   * Extract swap path from route steps
   */
  private extractPathFromSteps(route: RouterRoute, fromAddress: string, toAddress: string): string[] {
    const path: string[] = [fromAddress];

    // Try to extract intermediate tokens from steps
    if (route.steps) {
      for (const step of route.steps) {
        if ('toToken' in step && step.toToken?.address) {
          const addr = step.toToken.address;
          if (!path.includes(addr)) {
            path.push(addr);
          }
        }
      }
    }

    // Ensure toAddress is at the end
    if (!path.includes(toAddress)) {
      path.push(toAddress);
    }

    return path;
  }

  /**
   * Extract swap path from LiFi includedSteps format
   */
  private extractPathFromIncludedSteps(includedSteps: any[], fromAddress: string, toAddress: string): string[] {
    const path: string[] = [fromAddress];

    for (const step of includedSteps) {
      // LiFi includedSteps have action.fromToken and action.toToken
      if (step.action?.toToken?.address) {
        const addr = step.action.toToken.address;
        if (!path.includes(addr.toLowerCase()) && !path.includes(addr)) {
          path.push(addr);
        }
      }
    }

    // Ensure toAddress is at the end
    const toAddrLower = toAddress.toLowerCase();
    if (!path.some(p => p.toLowerCase() === toAddrLower)) {
      path.push(toAddress);
    }

    return path;
  }

  /**
   * Calculate gas payment details
   *
   * Tax is calculated as a percentage of the FROM amount value.
   * The tax and gas reimbursement are paid in the selected gas token.
   *
   * Note: For proper production use, this should call a backend API
   * to get accurate price conversions. This implementation uses
   * simplified calculations.
   */
  private async calculateGasPayment(
    fromAmountWei: bigint,
    fromTokenDecimals: number,
    gasTokenType: GasTokenType,
    selectedGasToken: any,
    chainId: number
  ): Promise<{
    gasToken: Address;
    gasTokenDecimals: number;
    taxAmount: bigint;
    gasReimbursement: bigint;
    gasTokenType: number;
  }> {
    // Get tax rate based on gas token type
    const taxRateBps = getTaxRate(chainId, gasTokenType);

    // Determine gas token address and decimals
    let gasToken: Address;
    let gasTokenDecimals: number;

    if (gasTokenType === GasTokenType.TWC) {
      gasToken = BSC_RELAYER_CONFIG.mainnet.twcToken as Address;
      gasTokenDecimals = 9; // TWC has 9 decimals
    } else if (gasTokenType === GasTokenType.BNB) {
      gasToken = WBNB_ADDRESS as Address;
      gasTokenDecimals = 18;
    } else if (selectedGasToken?.address) {
      gasToken = selectedGasToken.address as Address;
      gasTokenDecimals = selectedGasToken.decimals || 18;
    } else {
      gasToken = WBNB_ADDRESS as Address;
      gasTokenDecimals = 18;
    }

    // Calculate tax amount
    // Tax = (fromAmount * taxRate) / BASIS_POINTS
    // Since tax is collected in gas token, we need to convert
    // For simplicity, we calculate as if fromToken = gasToken (same value)
    // In production, this should use price oracles
    let taxAmount: bigint;

    if (gasTokenDecimals === fromTokenDecimals) {
      // Same decimals - direct calculation
      taxAmount = (fromAmountWei * BigInt(taxRateBps)) / BigInt(BASIS_POINTS);
    } else if (gasTokenDecimals > fromTokenDecimals) {
      // Gas token has more decimals - scale up
      const scaleFactor = BigInt(10 ** (gasTokenDecimals - fromTokenDecimals));
      taxAmount = (fromAmountWei * BigInt(taxRateBps) * scaleFactor) / BigInt(BASIS_POINTS);
    } else {
      // Gas token has fewer decimals - scale down
      const scaleFactor = BigInt(10 ** (fromTokenDecimals - gasTokenDecimals));
      taxAmount = (fromAmountWei * BigInt(taxRateBps)) / (BigInt(BASIS_POINTS) * scaleFactor);
    }

    // Ensure minimum tax of 1 unit
    if (taxAmount <= BigInt(0)) {
      taxAmount = BigInt(1);
    }

    // Gas reimbursement (estimated gas cost in the gas token)
    // Estimate ~300,000 gas at 3 gwei = 0.0009 BNB
    // For TWC or other tokens, this should be converted based on price
    // For now, use a fixed small amount in the gas token
    let gasReimbursement: bigint;

    if (gasTokenType === GasTokenType.BNB) {
      gasReimbursement = parseUnits('0.001', 18); // 0.001 BNB
    } else if (gasTokenType === GasTokenType.TWC) {
      // Estimate TWC equivalent (assuming TWC is ~$0.0001 and BNB is ~$600)
      // 0.001 BNB = $0.60 = 6,000,000 TWC at $0.0001/TWC
      // This is a rough estimate - production should use real prices
      gasReimbursement = parseUnits('1000000', 9); // 1M TWC
    } else {
      // For other tokens, use a small amount (will be converted by backend)
      gasReimbursement = parseUnits('1', gasTokenDecimals);
    }

    console.log('[BscRelayerExecutor] Gas payment calculated:', {
      gasToken,
      gasTokenDecimals,
      taxRateBps,
      taxAmount: taxAmount.toString(),
      gasReimbursement: gasReimbursement.toString(),
      gasTokenType,
    });

    return {
      gasToken,
      gasTokenDecimals,
      taxAmount,
      gasReimbursement,
      gasTokenType: gasTokenType as number,
    };
  }

  /**
   * Ensure token approvals are in place
   */
  private async ensureApprovals(
    walletClient: any,
    owner: Address,
    spender: Address,
    fromToken: Address,
    fromAmount: bigint,
    gasToken: Address,
    gasAmount: bigint,
    onStatusUpdate?: (status: any) => void
  ): Promise<void> {
    // Use max approval for convenience
    const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    // 1. Check and approve FROM token
    const fromAllowance = (await this.publicClient.readContract({
      address: fromToken,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner, spender],
    })) as bigint;

    if (fromAllowance < fromAmount) {
      onStatusUpdate?.({
        stage: 'approving',
        message: 'Approving swap token for relayer...',
      });

      // Encode approval call
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, maxApproval],
      });

      const approveHash = await walletClient.sendTransaction({
        to: fromToken,
        data: approveData,
        account: owner,
        chain: bsc,
      });

      await this.publicClient.waitForTransactionReceipt({
        hash: approveHash,
        timeout: 60000,
      });

      console.log('[BscRelayerExecutor] FROM token approved:', approveHash);
    }

    // 2. Check and approve gas token (if different from FROM token)
    if (gasToken.toLowerCase() !== fromToken.toLowerCase()) {
      const gasAllowance = (await this.publicClient.readContract({
        address: gasToken,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner, spender],
      })) as bigint;

      if (gasAllowance < gasAmount) {
        onStatusUpdate?.({
          stage: 'approving',
          message: 'Approving gas token for relayer...',
        });

        // Encode approval call
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [spender, maxApproval],
        });

        const approveHash = await walletClient.sendTransaction({
          to: gasToken,
          data: approveData,
          account: owner,
          chain: bsc,
        });

        await this.publicClient.waitForTransactionReceipt({
          hash: approveHash,
          timeout: 60000,
        });

        console.log('[BscRelayerExecutor] Gas token approved:', approveHash);
      }
    }
  }
}
