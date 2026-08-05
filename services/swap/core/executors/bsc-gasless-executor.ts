/**
 * BSC Gasless Executor
 *
 * TRUE GASLESS swaps on BSC - users sign, relayer pays gas.
 *
 * Flow:
 * 1. User signs swap request (EIP-712) - costs NOTHING
 * 2. Signed request is sent to backend relayer API
 * 3. Backend submits transaction using relayer's BNB
 * 4. User pays fee in tokens (TWC/WBNB/other)
 *
 * Tax rates:
 * - TWC: 0.20%
 * - BNB: 0.25%
 * - Other BSC tokens: 0.30%
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
  GasTokenType,
  getTaxRate,
  BASIS_POINTS,
} from '@/services/swap/core/config/tax-config';
import { useSwapStore } from '@/services/swap/core/platform/swap-store';
import { apiUrl } from '@/services/swap/core/platform/api-base';

// ============================================================================
// Constants
// ============================================================================

const BSC_CHAIN_ID = 56;

// WBNB address
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// TWC token address
const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';

// V2.1 Relayer contract address (supports native BNB output)
const RELAYER_V2_CONTRACT = (process.env.EXPO_PUBLIC_BSC_RELAYER_V2_CONTRACT ||
  '0xfCa2E4468bb376F5b74834F75D76714390b4540A') as Address;

// PancakeSwap V2 Router
const PANCAKESWAP_V2_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

// PancakeSwap V3 SwapRouter (exactInputSingle) — already in the relayer allowlist
const PANCAKESWAP_V3_ROUTER = '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4';

// TiwiMultiSwap (Path R atomic multi-DEX/V3 executor). 0x0 => not deployed/disabled.
const TIWI_MULTISWAP_CONTRACT = (process.env.EXPO_PUBLIC_TIWI_MULTISWAP_CONTRACT ||
  '0x0000000000000000000000000000000000000000') as Address;

// Map a route step's dexId/protocol to the on-chain (router, isV3) for BSC.
function resolveBscDex(dexId?: string, protocol?: string): { router: string; isV3: boolean } | null {
  const id = `${dexId || ''} ${protocol || ''}`.toLowerCase();
  if (id.includes('pancake') && id.includes('v3')) return { router: PANCAKESWAP_V3_ROUTER, isV3: true };
  if (id.includes('pancake')) return { router: PANCAKESWAP_V2_ROUTER, isV3: false };
  return null; // unknown DEX on BSC — cannot execute via TiwiMultiSwap
}

// TiwiMultiSwap.executeMultiSwap(amountIn, minAmountOut, recipient, Step[])
const MULTISWAP_ABI = [
  {
    name: 'executeMultiSwap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      {
        name: 'steps', type: 'tuple[]', components: [
          { name: 'dexType', type: 'uint8' }, // 0 = V2, 1 = V3
          { name: 'router', type: 'address' },
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

// Relayer view: is a router allowlisted? Used to gate the TiwiMultiSwap path.
const RELAYER_ALLOWLIST_ABI = [
  { name: 'isRouterAllowed', type: 'function', stateMutability: 'view', inputs: [{ name: 'router', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const;

// Native BNB placeholder (used in contract for native BNB output)
const NATIVE_BNB_PLACEHOLDER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

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

// For output token: keep native BNB as placeholder for contract to verify ETH balance
function normalizeOutputTokenAddress(address: string): string {
  if (isNativeToken(address)) {
    return NATIVE_BNB_PLACEHOLDER; // Contract will check native ETH balance
  }
  return address;
}

// Apply a slippage tolerance (percent, e.g. 0.5 = 0.5%) to an expected output to get
// minAmountOut. Clamped to [0.05%, 50%]; defaults to 0.5% on bad/zero input.
// Replaces the previous hardcoded 5% floor so the user's actual tolerance is honored.
function applySlippage(expectedOutput: bigint, slippagePercent: number | undefined): bigint {
  let pct = slippagePercent ?? 0.5;
  if (!isFinite(pct) || pct <= 0) pct = 0.5;
  if (pct > 50) pct = 50;
  const bps = BigInt(Math.round(pct * 100)); // 0.5% -> 50 bps
  return (expectedOutput * (BigInt(10000) - bps)) / BigInt(10000);
}

// ============================================================================
// EIP-712 Types
// ============================================================================

// EIP712 domain is built dynamically with the contract address
function getEIP712Domain() {
  return {
    name: 'TiwiSwapRelayer',
    version: '2',
    chainId: BSC_CHAIN_ID,
    verifyingContract: RELAYER_V2_CONTRACT,
  };
}

const SWAP_REQUEST_TYPES = {
  SwapRequest: [
    { name: 'user', type: 'address' },
    { name: 'fromToken', type: 'address' },
    { name: 'toToken', type: 'address' },
    { name: 'fromAmount', type: 'uint256' },
    { name: 'minAmountOut', type: 'uint256' },
    { name: 'recipient', type: 'address' },
    { name: 'router', type: 'address' },
    { name: 'routerCalldataHash', type: 'bytes32' },
    { name: 'gasToken', type: 'address' },
    { name: 'taxAmount', type: 'uint256' },
    { name: 'maxGasFee', type: 'uint256' },
    { name: 'gasTokenType', type: 'uint8' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

// ============================================================================
// PancakeSwap ABI
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

// ============================================================================
// BSC Gasless Executor
// ============================================================================

export class BscGaslessExecutor implements SwapRouterExecutor {
  private publicClient: PublicClient;

  constructor() {
    this.publicClient = getCachedPublicClient(BSC_CHAIN_ID);
  }

  /**
   * Check if this executor can handle the given route
   * Only handles same-chain BSC swaps (not cross-chain)
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

    // Check if V2 relayer contract is configured
    if (RELAYER_V2_CONTRACT === '0x0000000000000000000000000000000000000000') {
      console.log('[BscGaslessExecutor] V2 relayer contract not configured');
      return false;
    }

    // IMPORTANT: Gasless executor CANNOT handle native BNB input
    // Native BNB cannot be transferred via transferFrom (it's not an ERC20)
    // User needs to use BscNativeSwapExecutor for native BNB swaps
    if (isNativeToken(route.fromToken.address)) {
      console.log('[BscGaslessExecutor] Skipping native BNB input - use BscNativeSwapExecutor');
      return false;
    }

    // When user selects BNB as gas token, skip gasless relayer
    // Use BscDirectSwapExecutor instead - user pays own gas, just apply 0.25% tax
    const { selectedGasTokenType } = useSwapStore.getState();
    if (selectedGasTokenType === GasTokenType.BNB) {
      console.log('[BscGaslessExecutor] BNB selected as gas token - skipping relayer, use BscDirectSwapExecutor');
      return false;
    }

    console.log('[BscGaslessExecutor] Can handle BSC same-chain route (gasless with TWC/other token)');
    return true;
  }

  /**
   * Get the spender address for token approval
   */
  async getSpenderAddress(route: RouterRoute): Promise<string | null> {
    return RELAYER_V2_CONTRACT;
  }

  /**
   * Execute a gasless swap
   */
  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, toToken, fromAmount, userAddress, recipientAddress, walletClient, onStatusUpdate, slippage } = params;

    // User's slippage tolerance (percent). Prefer the explicit override, then the
    // route's applied slippage, else a tight 0.5% default — NOT a loose hardcoded 5%.
    const slippagePct = slippage ?? (route?.slippage ? parseFloat(route.slippage) : undefined) ?? 0.5;

    let activeWallet = walletClient;
    if (!activeWallet) {
      const { getEVMWalletClient } = await import('../utils/wallet-helpers');
      activeWallet = await getEVMWalletClient(fromToken?.chainId || params?.fromToken?.chainId || 56);
    }

    const chainId = fromToken.chainId || BSC_CHAIN_ID;

    // Ensure wallet is on the correct chain
    const { ensureCorrectChain } = await import('../utils/wallet-helpers');
    await ensureCorrectChain(chainId);

    // Get gas token selection from store
    const { selectedGasTokenType, selectedGasToken } = useSwapStore.getState();

    console.log('[BscGaslessExecutor] Starting gasless swap:', {
      from: fromToken.symbol,
      to: toToken.symbol,
      amount: fromAmount,
      gasTokenType: selectedGasTokenType,
    });

    onStatusUpdate?.({
      stage: 'preparing',
      message: 'Preparing...',
    });

    try {
      // 1. Build router calldata — honor the finder's discovered intermediary path
      //    (e.g. TWC -> USDC -> USDT) so the executed swap matches the quoted route.
      let swapData: { routerAddress: string; routerCalldata: Hex; path: string[]; expectedOutput: bigint; outputIsNativeBNB: boolean } | null = null;

      // Prefer TiwiMultiSwap for V3 / multi-DEX routes — but only once it's allowlisted
      // on the relayer (gate). Until then this is skipped and we use the V2 path.
      if (this.routeNeedsMultiSwap(route) && (await this.isMultiSwapAllowlisted())) {
        const steps = this.extractMultiSwapSteps(route);
        if (steps) {
          swapData = this.buildMultiSwapCalldata(route, fromToken, toToken, fromAmount, recipientAddress || userAddress, steps, slippagePct);
          if (swapData) console.log('[BscGaslessExecutor] Routing via TiwiMultiSwap (V3/multi-DEX):', steps);
        }
      }

      // Fallback: same-DEX V2 path via the relayer, honoring the finder's intermediary
      // path (e.g. TWC -> USDC -> USDT) so the executed swap matches the quoted route.
      if (!swapData) {
        const routePath = this.extractRoutePath(route);
        swapData = await this.buildSwapCalldata(
          fromToken,
          toToken,
          fromAmount,
          recipientAddress || userAddress,
          routePath,
          slippagePct
        );
      }

      const { routerAddress, routerCalldata, path, expectedOutput, outputIsNativeBNB } = swapData;

      // 2. Calculate gas payment details
      const fromAmountWei = parseUnits(fromAmount, fromToken.decimals || 18);
      const { gasToken, taxAmount, maxGasFee, gasTokenType } = this.calculateGasPayment(
        fromAmountWei,
        fromToken.decimals || 18,
        selectedGasTokenType,
        selectedGasToken
      );

      // 2.5. CRITICAL: Check user balances BEFORE proceeding
      // This prevents the "Gas estimation failed" error when user doesn't have enough tokens
      const normalizedFromToken = normalizeTokenAddress(fromToken.address) as Address;
      const totalGasPayment = taxAmount + maxGasFee;

      onStatusUpdate?.({
        stage: 'preparing',
        message: 'Checking...',
      });

      // Check FROM token balance
      const fromBalance = await this.publicClient.readContract({
        address: normalizedFromToken,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress as Address],
      }) as bigint;

      if (fromBalance < fromAmountWei) {
        const fromSymbol = fromToken.symbol || 'token';
        throw new Error(`Insufficient ${fromSymbol} balance. You have ${(Number(fromBalance) / 10 ** (fromToken.decimals || 18)).toFixed(4)} but need ${fromAmount}`);
      }

      // Check GAS token balance (if different from FROM token)
      if (gasToken.toLowerCase() !== normalizedFromToken.toLowerCase()) {
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

          // Determine decimals for gas token
          let gasDecimals = 18;
          if (gasToken.toLowerCase() === TWC_ADDRESS.toLowerCase()) gasDecimals = 9;

          throw new Error(
            `Insufficient ${gasSymbol} balance for gas payment. ` +
            `You have ${(Number(gasBalance) / 10 ** gasDecimals).toFixed(4)} but need ~${(Number(totalGasPayment) / 10 ** gasDecimals).toFixed(4)}. ` +
            `Try selecting TWC as gas token instead.`
          );
        }
      }

      console.log('[BscGaslessExecutor] Balance check passed:', {
        fromToken: fromToken.symbol,
        fromBalance: fromBalance.toString(),
        fromAmountWei: fromAmountWei.toString(),
        gasToken: gasToken,
        totalGasPayment: totalGasPayment.toString(),
      });

      // 3. Ensure token approvals for relayer contract
      onStatusUpdate?.({
        stage: 'approving',
        message: 'Approving...',
      });

      await this.ensureApprovals(
        activeWallet,
        userAddress as Address,
        RELAYER_V2_CONTRACT,
        normalizedFromToken,
        fromAmountWei,
        gasToken,
        totalGasPayment,
        onStatusUpdate
      );

      // 4. Get user's nonce
      const nonce = await this.getUserNonce(userAddress as Address);

      // 5. Build the swap request
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes
      // Relayer-enforced minOut — uses the user's actual slippage tolerance.
      const minAmountOut = applySlippage(expectedOutput, slippagePct);

      // For native BNB output, use the placeholder address so contract checks ETH balance
      const toTokenForContract = outputIsNativeBNB
        ? NATIVE_BNB_PLACEHOLDER
        : normalizeTokenAddress(toToken.address);

      const swapRequest = {
        user: userAddress as Address,
        fromToken: normalizeTokenAddress(fromToken.address) as Address,
        toToken: toTokenForContract as Address,
        fromAmount: fromAmountWei,
        minAmountOut,
        recipient: (recipientAddress || userAddress) as Address,
        router: routerAddress as Address,
        routerCalldata: routerCalldata as Hex,
        gasToken,
        taxAmount,   // exact fee user signs — computed with decimal adjustment
        maxGasFee,
        gasTokenType,
        nonce,
        deadline,
      };

      console.log('[BscGaslessExecutor] Swap request:', {
        ...swapRequest,
        fromAmount: swapRequest.fromAmount.toString(),
        minAmountOut: swapRequest.minAmountOut.toString(),
        maxGasFee: swapRequest.maxGasFee.toString(),
        nonce: swapRequest.nonce.toString(),
        deadline: swapRequest.deadline.toString(),
      });

      // 6. Request user signature (THIS IS FREE - no gas!)
      onStatusUpdate?.({
        stage: 'signing',
        message: 'Confirming in wallet...',
      });

      const signature = await this.signSwapRequest(activeWallet, userAddress as Address, swapRequest, routerCalldata);

      console.log('[BscGaslessExecutor] User signed the request');

      // 7. Submit to backend relayer
      onStatusUpdate?.({
        stage: 'confirming',
        message: 'Reviewing...',
      });

      const result = await this.submitToRelayer(swapRequest, signature, routerCalldata);

      if (!result.success) {
        throw new Error(result.error || 'Relayer submission failed');
      }

      onStatusUpdate?.({
        stage: 'completed',
        message: 'Success',
        txHash: result.txHash,
      });

      return {
        success: true,
        txHash: result.txHash!,
        actualToAmount: route.toToken.amount,
      };
    } catch (error: any) {
      console.error('[BscGaslessExecutor] Swap failed:', error);

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
   * Build PancakeSwap calldata for the swap
   */
  /**
   * Extract the contiguous token path from a universal/multi-hop route's steps,
   * e.g. [TWC, USDC, USDT]. Only returns multi-hop paths (>= 1 intermediary) made
   * of pure `swap` steps — direct (2-token) paths are already covered, and any
   * bridge/wrap step or non-contiguous chain returns null (handled elsewhere).
   * Correctness is still gated by getAmountsOut on the V2 router below.
   */
  private extractRoutePath(route: any): string[] | null {
    const steps = route?.steps;
    if (!steps || !Array.isArray(steps) || steps.length < 2) return null;
    const first = steps[0]?.fromToken?.address;
    if (!first) return null;
    const path: string[] = [first];
    for (const s of steps) {
      if (s?.type !== 'swap') return null;
      const from = s?.fromToken?.address;
      const to = s?.toToken?.address;
      if (!from || !to) return null;
      if (from.toLowerCase() !== path[path.length - 1].toLowerCase()) return null; // not contiguous
      path.push(to);
    }
    return path.length >= 3 ? path : null;
  }

  /**
   * True if the route needs the TiwiMultiSwap executor: any V3 hop, or hops that
   * span more than one DEX. The relayer's single PancakeSwap V2 call can't do those.
   */
  private routeNeedsMultiSwap(route: any): boolean {
    const steps = route?.steps;
    if (!steps || !Array.isArray(steps) || steps.length === 0) return false;
    const dexes = new Set<string>();
    let hasV3 = false;
    for (const s of steps) {
      if (s?.type !== 'swap') return false; // bridges/wraps not handled here
      if (s?.feeTier != null) hasV3 = true;
      const r = resolveBscDex(s?.dexId, s?.protocol);
      if (!r) return false; // unknown DEX → cannot build steps
      dexes.add(r.router.toLowerCase());
    }
    return hasV3 || dexes.size > 1;
  }

  /** Build the TiwiMultiSwap Step[] from route.steps. null if any hop is unresolved. */
  private extractMultiSwapSteps(
    route: any
  ): Array<{ dexType: number; router: Address; tokenIn: Address; tokenOut: Address; fee: number }> | null {
    const steps = route?.steps;
    if (!steps || !Array.isArray(steps) || steps.length === 0) return null;
    const out: Array<{ dexType: number; router: Address; tokenIn: Address; tokenOut: Address; fee: number }> = [];
    for (const s of steps) {
      if (s?.type !== 'swap') return null;
      const r = resolveBscDex(s?.dexId, s?.protocol);
      if (!r) return null;
      const tokenIn = normalizeTokenAddress(s?.fromToken?.address);
      const tokenOut = normalizeTokenAddress(s?.toToken?.address);
      if (!tokenIn || !tokenOut) return null;
      out.push({
        dexType: r.isV3 ? 1 : 0,
        router: getAddress(r.router),
        tokenIn: getAddress(tokenIn),
        tokenOut: getAddress(tokenOut),
        fee: r.isV3 ? (s?.feeTier ?? 0) : 0,
      });
    }
    for (let i = 1; i < out.length; i++) {
      if (out[i].tokenIn.toLowerCase() !== out[i - 1].tokenOut.toLowerCase()) return null;
    }
    if (out.some(st => st.dexType === 1 && st.fee === 0)) return null; // V3 hop missing fee tier
    return out;
  }

  private _multiSwapAllowlisted: boolean | null = null;
  /**
   * Cached check that TiwiMultiSwap is allowlisted on the relayer. Until the relayer
   * owner flips this on, we fall back to the V2 path (so this stays inert pre-gate).
   */
  private async isMultiSwapAllowlisted(): Promise<boolean> {
    if (TIWI_MULTISWAP_CONTRACT === '0x0000000000000000000000000000000000000000') return false;
    if (this._multiSwapAllowlisted !== null) return this._multiSwapAllowlisted;
    try {
      const allowed = await this.publicClient.readContract({
        address: RELAYER_V2_CONTRACT,
        abi: RELAYER_ALLOWLIST_ABI,
        functionName: 'isRouterAllowed',
        args: [TIWI_MULTISWAP_CONTRACT],
      }) as boolean;
      this._multiSwapAllowlisted = allowed;
      return allowed;
    } catch {
      return false;
    }
  }

  /**
   * Build executeMultiSwap calldata targeting TiwiMultiSwap for a V3/multi-DEX route.
   * Native BNB output isn't supported here (returns null → caller uses the V2 path).
   */
  private buildMultiSwapCalldata(
    route: any,
    fromToken: any,
    toToken: any,
    fromAmount: string,
    recipient: string,
    steps: Array<{ dexType: number; router: Address; tokenIn: Address; tokenOut: Address; fee: number }>,
    slippagePct?: number
  ): { routerAddress: string; routerCalldata: Hex; path: string[]; expectedOutput: bigint; outputIsNativeBNB: boolean } | null {
    if (isNativeToken(toToken.address)) return null;
    const fromAmountWei = parseUnits(fromAmount, fromToken.decimals || 18);
    const expectedOutput = parseUnits(route?.toToken?.amount || '0', toToken.decimals || 18);
    if (expectedOutput <= BigInt(0)) return null;
    const minAmountOut = applySlippage(expectedOutput, slippagePct);
    const routerCalldata = encodeFunctionData({
      abi: MULTISWAP_ABI,
      functionName: 'executeMultiSwap',
      args: [fromAmountWei, minAmountOut, getAddress(recipient), steps as any],
    });
    return {
      routerAddress: TIWI_MULTISWAP_CONTRACT,
      routerCalldata,
      path: steps.map(s => s.tokenIn as string).concat(steps[steps.length - 1].tokenOut as string),
      expectedOutput,
      outputIsNativeBNB: false,
    };
  }

  private async buildSwapCalldata(
    fromToken: any,
    toToken: any,
    fromAmount: string,
    recipient: string,
    preferredPath?: string[] | null,
    slippagePct?: number
  ): Promise<{
    routerAddress: string;
    routerCalldata: Hex;
    path: string[];
    expectedOutput: bigint;
    outputIsNativeBNB: boolean;
  }> {
    const normalizedFrom = normalizeTokenAddress(fromToken.address);
    // For path calculation, always use WBNB for native BNB
    const normalizedToForPath = normalizeTokenAddress(toToken.address);
    // Check if output should be native BNB (not WBNB)
    const outputIsNativeBNB = isNativeToken(toToken.address);
    const fromAmountWei = parseUnits(fromAmount, fromToken.decimals || 18);

    console.log('[BscGaslessExecutor] Building swap calldata:', {
      from: fromToken.address,
      to: toToken.address,
      outputIsNativeBNB,
      preferredPath,
    });

    // Quote a candidate path on the PancakeSwap V2 router; returns output or null.
    const quotePath = async (candidate: string[]): Promise<bigint | null> => {
      try {
        const amounts = await this.publicClient.readContract({
          address: PANCAKESWAP_V2_ROUTER as Address,
          abi: ROUTER_QUERY_ABI,
          functionName: 'getAmountsOut',
          args: [fromAmountWei, candidate as readonly `0x${string}`[]],
        }) as bigint[];
        const out = amounts[amounts.length - 1];
        return out > BigInt(0) ? out : null;
      } catch {
        return null;
      }
    };

    // Candidate paths in priority order: finder's path, then direct, then via WBNB.
    // For native BNB output the final hop must target WBNB (router unwraps to BNB).
    const candidates: string[][] = [];
    if (preferredPath && preferredPath.length >= 3) {
      const norm = preferredPath.map(a => normalizeTokenAddress(a));
      if (outputIsNativeBNB) norm[norm.length - 1] = WBNB_ADDRESS;
      candidates.push(norm);
    }
    candidates.push([normalizedFrom, normalizedToForPath]); // direct
    if (normalizedFrom.toLowerCase() !== WBNB_ADDRESS.toLowerCase() &&
      normalizedToForPath.toLowerCase() !== WBNB_ADDRESS.toLowerCase()) {
      candidates.push([normalizedFrom, WBNB_ADDRESS, normalizedToForPath]); // via WBNB
    }

    let path: string[] | undefined;
    let expectedOutput: bigint | undefined;
    for (const candidate of candidates) {
      const out = await quotePath(candidate);
      if (out !== null) {
        path = candidate;
        expectedOutput = out;
        console.log(`[BscGaslessExecutor] Using ${candidate.length === 2 ? 'direct' : candidate.length - 1 + '-hop'} path:`, candidate);
        break;
      }
    }
    if (!path || expectedOutput === undefined) {
      throw new Error('No valid swap path found');
    }

    // Build calldata
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const minAmountOut = applySlippage(expectedOutput, slippagePct);
    const pathAddresses = path.map(addr => getAddress(addr)) as readonly `0x${string}`[];

    // Use swapExactTokensForETH if output should be native BNB
    // This function unwraps WBNB to native BNB and sends to recipient
    let routerCalldata: Hex;
    if (outputIsNativeBNB) {
      console.log('[BscGaslessExecutor] Using swapExactTokensForETH for native BNB output');
      routerCalldata = encodeFunctionData({
        abi: PANCAKESWAP_ABI,
        functionName: 'swapExactTokensForETH',
        args: [fromAmountWei, minAmountOut, pathAddresses, recipient as Address, deadline],
      });
    } else {
      routerCalldata = encodeFunctionData({
        abi: PANCAKESWAP_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [fromAmountWei, minAmountOut, pathAddresses, recipient as Address, deadline],
      });
    }

    return {
      routerAddress: PANCAKESWAP_V2_ROUTER,
      routerCalldata,
      path,
      expectedOutput,
      outputIsNativeBNB,
    };
  }

  /**
   * Calculate gas payment details
   */
  private calculateGasPayment(
    fromAmountWei: bigint,
    fromTokenDecimals: number,
    gasTokenType: GasTokenType,
    selectedGasToken: any
  ): {
    gasToken: Address;
    taxAmount: bigint;
    maxGasFee: bigint;
    gasTokenType: number;
  } {
    // Get tax rate
    const taxRateBps = getTaxRate(BSC_CHAIN_ID, gasTokenType);

    // Determine gas token
    let gasToken: Address;
    let gasTokenDecimals: number;

    if (gasTokenType === GasTokenType.TWC) {
      gasToken = TWC_ADDRESS as Address;
      gasTokenDecimals = 9;
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

    // Calculate tax (as percentage of fromAmount)
    // For simplicity, we assume similar value (in production, use price oracle)
    let taxAmount: bigint;
    if (gasTokenDecimals === fromTokenDecimals) {
      taxAmount = (fromAmountWei * BigInt(taxRateBps)) / BigInt(BASIS_POINTS);
    } else if (gasTokenDecimals > fromTokenDecimals) {
      const scaleFactor = BigInt(10 ** (gasTokenDecimals - fromTokenDecimals));
      taxAmount = (fromAmountWei * BigInt(taxRateBps) * scaleFactor) / BigInt(BASIS_POINTS);
    } else {
      const scaleFactor = BigInt(10 ** (fromTokenDecimals - gasTokenDecimals));
      taxAmount = (fromAmountWei * BigInt(taxRateBps)) / (BigInt(BASIS_POINTS) * scaleFactor);
    }

    if (taxAmount <= BigInt(0)) {
      taxAmount = BigInt(1);
    }

    // Max gas fee (generous estimate - relayer will charge actual)
    let maxGasFee: bigint;
    if (gasTokenType === GasTokenType.BNB) {
      maxGasFee = parseUnits('0.005', 18); // 0.005 BNB max
    } else if (gasTokenType === GasTokenType.TWC) {
      maxGasFee = parseUnits('5000000', 9); // 5M TWC max
    } else {
      maxGasFee = parseUnits('10', gasTokenDecimals);
    }

    return {
      gasToken,
      taxAmount,
      maxGasFee,
      gasTokenType: gasTokenType as number,
    };
  }

  /**
   * Get user's nonce from the relayer contract
   */
  private async getUserNonce(user: Address): Promise<bigint> {
    try {
      const response = await fetch(apiUrl(`/api/v1/gasless-swap?user=${user}`));
      const data = await response.json();
      if (data.success) {
        return BigInt(data.nonce);
      }
      return BigInt(0);
    } catch (error) {
      console.warn('[BscGaslessExecutor] Failed to get nonce, using 0:', error);
      return BigInt(0);
    }
  }

  /**
   * Sign the swap request using EIP-712
   */
  private async signSwapRequest(
    walletClient: any,
    user: Address,
    request: any,
    routerCalldata: Hex
  ): Promise<{ v: number; r: Hex; s: Hex }> {
    // Hash the routerCalldata for the typed data
    const { keccak256, toBytes } = await import('viem');
    const routerCalldataHash = keccak256(toBytes(routerCalldata));

    const typedData = {
      domain: getEIP712Domain(),
      types: SWAP_REQUEST_TYPES,
      primaryType: 'SwapRequest' as const,
      message: {
        user: request.user,
        fromToken: request.fromToken,
        toToken: request.toToken,
        fromAmount: request.fromAmount,
        minAmountOut: request.minAmountOut,
        recipient: request.recipient,
        router: request.router,
        routerCalldataHash,
        gasToken: request.gasToken,
        taxAmount: request.taxAmount,
        maxGasFee: request.maxGasFee,
        gasTokenType: request.gasTokenType,
        nonce: request.nonce,
        deadline: request.deadline,
      },
    };

    // Request signature from wallet
    const signature = await walletClient.signTypedData({
      account: user,
      ...typedData,
    });

    // Parse signature into v, r, s components
    const { hexToBytes } = await import('viem');
    const sigBytes = hexToBytes(signature);

    const r = `0x${Buffer.from(sigBytes.slice(0, 32)).toString('hex')}` as Hex;
    const s = `0x${Buffer.from(sigBytes.slice(32, 64)).toString('hex')}` as Hex;
    const v = sigBytes[64];

    return { v, r, s };
  }

  /**
   * Submit signed request to backend relayer
   */
  private async submitToRelayer(
    request: any,
    signature: { v: number; r: Hex; s: Hex },
    routerCalldata: Hex
  ): Promise<{ success: boolean; txHash?: Hex; error?: string }> {
    const response = await fetch(apiUrl('/api/v1/gasless-swap'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: request.user,
        fromToken: request.fromToken,
        toToken: request.toToken,
        fromAmount: request.fromAmount.toString(),
        minAmountOut: request.minAmountOut.toString(),
        recipient: request.recipient,
        router: request.router,
        routerCalldata,
        gasToken: request.gasToken,
        taxAmount: request.taxAmount.toString(),
        maxGasFee: request.maxGasFee.toString(),
        gasTokenType: request.gasTokenType,
        nonce: request.nonce.toString(),
        deadline: request.deadline.toString(),
        signature,
      }),
    });

    const data = await response.json();
    return {
      success: data.success,
      txHash: data.txHash as Hex,
      error: data.error,
    };
  }

  /**
   * Ensure token approvals
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
    const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    // Check and approve FROM token
    const fromAllowance = await this.publicClient.readContract({
      address: fromToken,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner, spender],
    }) as bigint;

    if (fromAllowance < fromAmount) {
      onStatusUpdate?.({
        stage: 'approving',
        message: 'Approving...',
      });

      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, maxApproval],
      });

      const hash = await walletClient.sendTransaction({
        to: fromToken,
        data: approveData,
        account: owner,
        chain: bsc,
      });

      await this.publicClient.waitForTransactionReceipt({ hash, timeout: 60000 });
    }

    // Check and approve gas token (if different)
    if (gasToken.toLowerCase() !== fromToken.toLowerCase()) {
      const gasAllowance = await this.publicClient.readContract({
        address: gasToken,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner, spender],
      }) as bigint;

      if (gasAllowance < gasAmount) {
        onStatusUpdate?.({
          stage: 'approving',
          message: 'Approving...',
        });

        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [spender, maxApproval],
        });

        const hash = await walletClient.sendTransaction({
          to: gasToken,
          data: approveData,
          account: owner,
          chain: bsc,
        });

        await this.publicClient.waitForTransactionReceipt({ hash, timeout: 60000 });
      }
    }
  }
}
