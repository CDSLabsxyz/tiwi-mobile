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
  BSC_RELAYER_V2_CONFIG,
  REVENUE_WALLETS,
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

// Gas units a BEP20 `approve` costs. Used only to decide whether a wallet can
// already pay for its own approval; deliberately generous so we sponsor a
// borderline wallet rather than letting it fail at the prompt.
const APPROVE_GAS_ESTIMATE = 60_000;

// Protocol tax destination — the same revenue wallet every other path uses.
const REVENUE_WALLET = REVENUE_WALLETS.evm as Address;

// Where the up-front service fee goes — the same wallet that fronts the drip
// and pays for the relayed swap, so its BNB outlay and token income net out.
const RELAYER_FEE_WALLET = BSC_RELAYER_V2_CONFIG.mainnet.relayerWallet as Address;

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

// ============================================================================
// PancakeSwap ABI
// ============================================================================

const SWAP_INPUTS = [
  { name: 'amountIn', type: 'uint256' },
  { name: 'amountOutMin', type: 'uint256' },
  { name: 'path', type: 'address[]' },
  { name: 'to', type: 'address' },
  { name: 'deadline', type: 'uint256' },
] as const;

// Only the fee-on-transfer variants. They behave identically for a normal token
// and are the only ones that work for a token that taxes its own transfers —
// the plain versions revert with "Pancake: K" because the pair receives less
// than amountIn and the constant-product check fails. TWC is such a token.
const PANCAKESWAP_ABI = [
  {
    name: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
    type: 'function',
    inputs: SWAP_INPUTS,
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
    type: 'function',
    inputs: SWAP_INPUTS,
    outputs: [],
    stateMutability: 'nonpayable',
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
  {
    // A push, used for the up-front sponsorship service fee. Unlike
    // approve+transferFrom it needs no pre-existing allowance, which is what
    // lets it be the first token movement out of a cold wallet.
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

// ============================================================================
// BSC Gasless Executor
// ============================================================================

/**
 * Outcome of pricing the cold-start sponsorship.
 *
 * Deliberately three-valued. Collapsing "not needed" and "couldn't be
 * arranged" into a single null made every sponsorship failure look identical to
 * success-by-omission: the flow fell through to an approval prompt with the
 * real reason only in the console.
 */
type Sponsorship =
  | { kind: 'not-needed' }
  | { kind: 'ready'; amountWei: bigint; amountToken: string; quoteAmountWei: string }
  | { kind: 'unavailable'; reason: string };


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
    // Tokens are approved to the DEX router — this path no longer routes
    // through a relayer contract, so nothing else is ever a spender.
    return PANCAKESWAP_V2_ROUTER;
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
      // 1. (No calldata built here.) BscDirectSwapExecutor builds the swap
      //    itself in step 4 — building a second copy here was both wasted RPC
      //    work and the source of the "Pancake: K" mismatch.

      // 2. Calculate gas payment details
      const fromAmountWei = parseUnits(fromAmount, fromToken.decimals || 18);
      const { gasToken, taxRateBps } = this.calculateGasPayment(
        fromAmountWei,
        fromToken.decimals || 18,
        selectedGasTokenType,
        selectedGasToken
      );

      // The relayer path charges its OWN rate — 0.20% with TWC as the gas token,
      // 0.30% otherwise — not the normal path's flat 0.25%. It's collected here
      // (step 3.5) and the normal executor is told to skip its own, so the user
      // is taxed exactly once.
      const taxAmountWei = (fromAmountWei * BigInt(taxRateBps)) / BigInt(BASIS_POINTS);

      // 2.5. CRITICAL: Check user balances BEFORE proceeding
      // This prevents the "Gas estimation failed" error when user doesn't have enough tokens
      const normalizedFromToken = normalizeTokenAddress(fromToken.address) as Address;
      // The relayer contract used to take a gas reimbursement inside
      // executeGaslessSwap. A direct swap doesn't, so nothing is required here
      // on that account — the tax below and the $0.50 service fee are the only
      // charges, and both are checked explicitly.
      const totalGasPayment = BigInt(0);

      onStatusUpdate?.({
        stage: 'preparing',
        message: 'Checking...',
      });

      // The sponsorship service fee is charged in the GAS token, which is very
      // often the same token being swapped. Reserve it here, BEFORE the balance
      // check, or the check passes against a balance the fee is about to spend
      // and the swap reverts later inside the relayed transaction.
      const sponsorship = await this.quoteSponsorship(chainId, gasToken);
      const serviceFeeWei = sponsorship.kind === 'ready' ? sponsorship.amountWei : BigInt(0);

      // Check FROM token balance
      const fromBalance = await this.publicClient.readContract({
        address: normalizedFromToken,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress as Address],
      }) as bigint;

      // Everything this swap takes out of the FROM token. When the gas token IS
      // the from-token (the usual "pay gas in TWC while swapping TWC" case) the
      // tax and the service fee come out of the same balance, so checking the
      // swap amount alone passes and then the swap reverts mid-flow — after the
      // user has already paid the fee and approved.
      const fromDecimals = fromToken.decimals || 18;
      const gasIsFromToken = gasToken.toLowerCase() === normalizedFromToken.toLowerCase();
      const fromTokenRequired = gasIsFromToken
        ? fromAmountWei + taxAmountWei + serviceFeeWei
        : fromAmountWei + taxAmountWei;

      if (fromBalance < fromTokenRequired) {
        const fromSymbol = fromToken.symbol || 'token';
        const n = (v: bigint) => Number(v) / 10 ** fromDecimals;
        throw new Error(
          `Insufficient ${fromSymbol} balance. You have ${n(fromBalance).toFixed(4)} but this swap needs ` +
            `${n(fromTokenRequired).toFixed(4)} (${n(fromAmountWei).toFixed(4)} to swap` +
            ` + ${n(taxAmountWei).toFixed(4)} fee` +
            (gasIsFromToken && serviceFeeWei > BigInt(0)
              ? ` + ${n(serviceFeeWei).toFixed(4)} gasless service fee`
              : '') +
            `). Lower the amount and try again.`,
        );
      }

      // Check GAS token balance (if different from FROM token)
      if (gasToken.toLowerCase() !== normalizedFromToken.toLowerCase()) {
        const gasBalance = await this.publicClient.readContract({
          address: gasToken,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [userAddress as Address],
        }) as bigint;

        if (gasBalance < totalGasPayment + serviceFeeWei) {
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

      // 3. Relayer releases $0.10 of BNB to the user, then collects $0.50 of
      //    the selected token. After this the wallet can pay its own gas.
      await this.ensureSponsoredGas(
        activeWallet,
        userAddress as Address,
        chainId,
        gasToken,
        sponsorship,
        onStatusUpdate,
      );


      // 3.5. Protocol tax for the relayer path, taken after the $0.50 and
      //      before the swap. Paid with the BNB released in step 3.
      if (taxAmountWei > BigInt(0)) {
        onStatusUpdate?.({ stage: 'signing', message: 'Confirm the fee...' });

        const taxHash = await activeWallet.sendTransaction({
          to: normalizedFromToken,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [REVENUE_WALLET, taxAmountWei],
          }),
          account: userAddress as Address,
          chain: bsc,
        });
        const taxReceipt = await this.publicClient.waitForTransactionReceipt({
          hash: taxHash,
          timeout: 90_000,
        });
        if (taxReceipt.status !== 'success') {
          throw new Error('The fee transfer reverted on-chain.');
        }
        console.log(`[BscGaslessExecutor] tax paid (${taxRateBps / 100}%):`, taxHash);
      }

      // 4. From here it IS a normal swap. Hand off to BscDirectSwapExecutor
      //    rather than re-implementing approve + swap here — that duplicate is
      //    what produced "Pancake: K", since this file built calldata with
      //    `swapExactTokensForETH` while the normal executor correctly uses the
      //    SupportingFeeOnTransferTokens variants that a self-taxing token like
      //    TWC requires.
      //
      //    skipTax: the relayer rate was charged above, so its flat 0.25% must
      //    not fire as well or the user is taxed twice.
      const { BscDirectSwapExecutor } = await import('./bsc-direct-swap-executor');
      return await new BscDirectSwapExecutor().execute({ ...params, skipTax: true });

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
    // The allowlist lived on the relayer contract, which this path no longer
    // uses: a direct swap calls the router itself, so nothing gates it.
    return TIWI_MULTISWAP_CONTRACT !== '0x0000000000000000000000000000000000000000';
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

    // Always the fee-on-transfer variants. They behave identically for a normal
    // token, and they are the ONLY ones that work for a token that taxes its own
    // transfers — the plain versions revert with "Pancake: K" because the pair
    // receives less than amountIn and the constant-product check fails. TWC is
    // such a token, which is exactly how this surfaced.
    // This function unwraps WBNB to native BNB and sends to recipient
    let routerCalldata: Hex;
    if (outputIsNativeBNB) {
      console.log('[BscGaslessExecutor] Using swapExactTokensForETHSupportingFeeOnTransferTokens for native BNB output');
      routerCalldata = encodeFunctionData({
        abi: PANCAKESWAP_ABI,
        functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
        args: [fromAmountWei, minAmountOut, pathAddresses, recipient as Address, deadline],
      });
    } else {
      routerCalldata = encodeFunctionData({
        abi: PANCAKESWAP_ABI,
        functionName: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
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
    /** Protocol tax rate in basis points for the chosen gas token. */
    taxRateBps: number;
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
      taxRateBps,
      maxGasFee,
      gasTokenType: gasTokenType as number,
    };
  }

  /**
   * Decide whether this swap needs sponsorship, and price it — WITHOUT moving
   * any funds.
   *
   * Split from the execution below so the fee can be reserved in the pre-flight
   * balance check. Quoting and spending must agree on one number: the fee is
   * charged in the gas token, which is usually the same token being swapped, so
   * a fee discovered after the balance check silently eats into the swap amount.
   *
   * Returns null when no sponsorship applies — either every allowance is
   * already set (the user signs no transaction, so there is no gas to cover and
   * a drip would be $0.10 against $0), or the opt-out is enabled and they can
   * already pay.
   */
  private async quoteSponsorship(chainId: number, gasToken: Address): Promise<Sponsorship> {
    try {
      // Unconditional. Choosing the relayer means the user's own BNB is never
      // what pays for the swap, so the release/receive pair runs every time —
      // it is not gated on the wallet's BNB balance, nor on whether an approval
      // happens to be outstanding.
      const res = await fetch(apiUrl(`/api/v1/relayer/gas-drip?gasTokenAddress=${gasToken}&chainId=${chainId}`));
      const quote = await res.json().catch(() => ({}));
      if (!res.ok || !quote?.amountWei) {
        // Sponsorship IS needed here but we couldn't price it. Report that
        // rather than returning "nothing to do" — the caller decides whether a
        // user who can self-fund proceeds, and a user who can't gets told why.
        return {
          kind: 'unavailable',
          reason: quote?.error || `service-fee quote failed (HTTP ${res.status})`,
        };
      }
      return {
        kind: 'ready',
        amountWei: BigInt(quote.amountWei),
        amountToken: String(quote.amountToken ?? ''),
        quoteAmountWei: String(quote.amountWei),
      };
    } catch (e: any) {
      return { kind: 'unavailable', reason: e?.message || String(e) };
    }
  }

  /**
   * Cold-start gas sponsorship — the part that moves funds.
   *
   * Everything else in this flow is already gasless for the user: the tax, the
   * gas reimbursement, the token pull and the swap all happen inside the single
   * transaction the relayer submits and pays for. The one exception is the
   * ERC20 `approve` — it writes `allowance[msg.sender][spender]`, so the user
   * must be `msg.sender`, and `msg.sender` pays.
   *
   * Sequence:
   *   1. Ask the relayer to send BNB, so the user's own BNB is never what pays
   *      for a relayer swap. Fires whenever an approval is required, not only
   *      when the user is short — see quoteSponsorship().
   *   2. Collect the service fee, in the gas token, as a plain `transfer` — a
   *      push needs no allowance, so it works on a cold wallet right after the
   *      drip. The amount is the one already reserved by the balance check.
   *   3. Report it to the server, which verifies it on-chain and settles the
   *      drip. An unsettled drip blocks this wallet from drawing another.
   *
   * A failure here is never fatal: we log and fall through to the approval,
   * which may still succeed on the user's own balance.
   */
  private async ensureSponsoredGas(
    walletClient: any,
    userAddress: Address,
    chainId: number,
    gasToken: Address,
    sponsorship: Sponsorship,
    onStatusUpdate?: (status: any) => void,
  ): Promise<void> {
    if (sponsorship.kind === 'not-needed') return;

    try {
      if (sponsorship.kind === 'unavailable') {
        throw new Error(sponsorship.reason);
      }

      onStatusUpdate?.({ stage: 'approving', message: 'Setting up gasless swap...' });

      const dripRes = await fetch(apiUrl('/api/v1/relayer/gas-drip'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userWallet: userAddress, chainId, gasTokenAddress: gasToken }),
      });
      const drip = await dripRes.json().catch(() => ({}));

      if (!dripRes.ok) {
        // The server refuses for good reasons (outstanding drip, daily cap,
        // budget). Its message tells the user what to do — surface it, but keep
        // going: if they do hold BNB the approval still works.
        throw new Error(drip?.error || 'Gas sponsorship is unavailable right now.');
      }

      // Defensive: the server always sends on success, but if it ever reports
      // no release then there is nothing to charge a fee for either.
      if (!drip.txHash) return;
      console.log('[BscGaslessExecutor] gas sponsored:', drip.txHash);

      onStatusUpdate?.({
        stage: 'approving',
        message: `Confirm the ${Number(sponsorship.amountToken).toFixed(4)} service fee...`,
      });

      // A push (`transfer`) rather than approve+transferFrom: no allowance
      // needed, which is what lets it be the first token movement out of a
      // cold wallet.
      const feeData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [RELAYER_FEE_WALLET, sponsorship.amountWei],
      });
      const feeHash = await walletClient.sendTransaction({
        to: gasToken,
        data: feeData,
        account: userAddress,
        chain: bsc,
      });
      const feeReceipt = await this.publicClient.waitForTransactionReceipt({
        hash: feeHash,
        timeout: 90_000,
      });
      if (feeReceipt.status !== 'success') {
        throw new Error('The service-fee transfer reverted on-chain.');
      }

      const settleRes = await fetch(apiUrl('/api/v1/relayer/gas-drip'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'settle',
          userWallet: userAddress,
          txHash: feeHash,
          gasTokenAddress: gasToken,
          expectedAmountWei: sponsorship.quoteAmountWei,
        }),
      });
      if (!settleRes.ok) {
        const err = await settleRes.json().catch(() => ({}));
        console.warn('[BscGaslessExecutor] service fee not settled server-side:', err?.error);
      }

      console.log('[BscGaslessExecutor] service fee paid:', feeHash);
    } catch (e: any) {
      const detail = e?.message || String(e);
      console.warn('[BscGaslessExecutor] gas sponsorship did not complete:', detail);

      // Whether this is fatal depends entirely on whether the user can pay for
      // the approval themselves. Silently continuing was the wrong default: for
      // a wallet with no BNB it produced an approval prompt that could never be
      // paid, with the real reason buried in the console.
      const [balance, gasPrice] = await Promise.all([
        this.publicClient.getBalance({ address: userAddress }),
        this.publicClient.getGasPrice(),
      ]).catch(() => [BigInt(0), BigInt(0)] as [bigint, bigint]);

      const canSelfFund = gasPrice > BigInt(0)
        && balance >= gasPrice * BigInt(APPROVE_GAS_ESTIMATE) * BigInt(2);

      if (!canSelfFund) {
        throw new Error(
          `Gasless setup failed and this wallet has no BNB to approve with, so the swap was stopped ` +
            `before costing you anything. Reason: ${detail}`,
        );
      }

      onStatusUpdate?.({ stage: 'approving', message: 'Continuing without sponsored gas...' });
    }
  }


}
