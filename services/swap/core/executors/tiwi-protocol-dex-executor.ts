/**
 * TiwiProtocolDEX Executor
 *
 * Single-signature swap executor using the TiwiProtocolDEX contract.
 *
 * Flow:
 *   First swap with token X:
 *     1. approve(X → TiwiProtocolDEX)   — Sign 1
 *     2. TiwiProtocolDEX.swap(...)       — Sign 2
 *
 *   All subsequent swaps with token X:
 *     1. TiwiProtocolDEX.swap(...)       — Sign 1 (ONLY!)
 *
 *   Gasless mode:
 *     First time: approve (Sign 1) + EIP-712 sign (Sign 2, FREE)
 *     After:      EIP-712 sign (Sign 1, FREE — zero gas!)
 *
 * Tax is collected from fromToken (0.25%). No separate gas token approval.
 */

import {
  encodeFunctionData,
  parseUnits,
  getAddress,
  keccak256,
  toBytes,
  hexToBytes,
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
import { getStandardApprovalAmount } from '../utils/approval-amounts';

// ============================================================================
// Constants
// ============================================================================

const BSC_CHAIN_ID = 56;

const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// TiwiProtocolDEX contract — deployed on BSC mainnet 2026-03-31
const TIWI_DEX_CONTRACT = (process.env.EXPO_PUBLIC_TIWI_DEX_CONTRACT ||
  '0xee5f20b22eD5788680711B529E92994AE9d1872A') as Address;

// PancakeSwap V2 Router (whitelisted in contract, NOT the multicall)
const PANCAKESWAP_V2_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

// BLACKLISTED: PancakeSwap Multicall V3 — known malicious contract
const BLACKLISTED_CONTRACTS = new Set([
  '0xac1ce734566f390a94b4571ce386795b52a5a288', // PancakeSwap Multicall V3
  '0x556b9306565093c855aea9ae92a594704c2cd59e', // PancakeSwap Multicall V2
]);

// TWC token address on BSC (for fallback swap path detection)
const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';

const NATIVE_PLACEHOLDER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const NATIVE_TOKEN_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
];

function isNativeToken(address: string): boolean {
  if (!address) return true;
  return NATIVE_TOKEN_ADDRESSES.some(n => n.toLowerCase() === address.toLowerCase());
}

function normalizeForPath(address: string): string {
  return isNativeToken(address) ? WBNB_ADDRESS : address;
}

// ============================================================================
// ABIs
// ============================================================================

const TIWI_DEX_ABI = [
  {
    name: 'swap',
    type: 'function',
    inputs: [
      { name: 'fromToken', type: 'address' },
      { name: 'toToken', type: 'address' },
      { name: 'fromAmount', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'router', type: 'address' },
      { name: 'routerCalldata', type: 'bytes' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'swapNative',
    type: 'function',
    inputs: [
      { name: 'toToken', type: 'address' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'router', type: 'address' },
      { name: 'routerCalldata', type: 'bytes' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'getNonce',
    type: 'function',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'calculateTax',
    type: 'function',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

const ROUTER_ABI = [
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

const PANCAKE_SWAP_ABI = [
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'swapExactTokensForETH',
    type: 'function',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'swapExactETHForTokens',
    type: 'function',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
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
// EIP-712 for Gasless
// ============================================================================

function getEIP712Domain() {
  return {
    name: 'TiwiProtocolDEX',
    version: '1',
    chainId: BSC_CHAIN_ID,
    verifyingContract: TIWI_DEX_CONTRACT,
  };
}

const SWAP_TYPES = {
  Swap: [
    { name: 'user', type: 'address' },
    { name: 'fromToken', type: 'address' },
    { name: 'toToken', type: 'address' },
    { name: 'fromAmount', type: 'uint256' },
    { name: 'minAmountOut', type: 'uint256' },
    { name: 'recipient', type: 'address' },
    { name: 'router', type: 'address' },
    { name: 'routerCalldataHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

// ============================================================================
// Executor
// ============================================================================

export class TiwiProtocolDEXExecutor implements SwapRouterExecutor {
  private publicClient: PublicClient;

  // ── Background viability cache ──
  // Checked during quote fetching so canHandle() can skip instantly at swap time
  private static contractViable: boolean | null = null; // null = not checked
  private static lastViabilityCheck: number = 0;
  private static readonly VIABILITY_TTL = 5 * 60 * 1000; // 5 minutes
  private static viabilityCheckInFlight = false;

  constructor() {
    this.publicClient = getCachedPublicClient(BSC_CHAIN_ID);
  }

  /**
   * Background viability check — call during quote fetching (fire-and-forget).
   * Tests if the TiwiDEX contract can execute a swap at all.
   * Result is cached for 5 minutes.
   */
  static async checkViability(): Promise<boolean> {
    const now = Date.now();

    // Return cached result if fresh
    if (TiwiProtocolDEXExecutor.contractViable !== null &&
        now - TiwiProtocolDEXExecutor.lastViabilityCheck < TiwiProtocolDEXExecutor.VIABILITY_TTL) {
      return TiwiProtocolDEXExecutor.contractViable;
    }

    // Prevent concurrent checks
    if (TiwiProtocolDEXExecutor.viabilityCheckInFlight) {
      return TiwiProtocolDEXExecutor.contractViable ?? false;
    }

    TiwiProtocolDEXExecutor.viabilityCheckInFlight = true;

    try {
      const client = getCachedPublicClient(BSC_CHAIN_ID);
      // Quick check: call calculateTax — if contract is functional, this works
      await Promise.race([
        client.readContract({
          address: TIWI_DEX_CONTRACT,
          abi: TIWI_DEX_ABI,
          functionName: 'calculateTax',
          args: [BigInt('1000000000')], // 1 GWEI test amount
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
      ]);

      // If we get here, contract responds. Now test if router is whitelisted
      // by checking if a swap would revert
      const testPath = [TWC_ADDRESS, WBNB_ADDRESS];
      try {
        await Promise.race([
          client.readContract({
            address: PANCAKESWAP_V2_ROUTER as `0x${string}`,
            abi: ROUTER_ABI,
            functionName: 'getAmountsOut',
            args: [BigInt('1000000000'), testPath as readonly `0x${string}`[]],
          }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
        ]);
      } catch {
        // getAmountsOut failed = no liquidity or path issue, but contract itself may work
      }

      TiwiProtocolDEXExecutor.contractViable = true;
      console.log('[TiwiDEX] Viability check: ✅ contract responsive');
    } catch {
      TiwiProtocolDEXExecutor.contractViable = false;
      console.log('[TiwiDEX] Viability check: ❌ contract not viable, will skip');
    } finally {
      TiwiProtocolDEXExecutor.lastViabilityCheck = now;
      TiwiProtocolDEXExecutor.viabilityCheckInFlight = false;
    }

    return TiwiProtocolDEXExecutor.contractViable;
  }

  /**
   * Handle same-chain BSC swaps when TiwiProtocolDEX is deployed
   */
  canHandle(route: RouterRoute): boolean {
    if (TIWI_DEX_CONTRACT === '0x0000000000000000000000000000000000000000') {
      return false;
    }

    // ── Instant skip if background check already determined contract is non-viable ──
    if (TiwiProtocolDEXExecutor.contractViable === false &&
        Date.now() - TiwiProtocolDEXExecutor.lastViabilityCheck < TiwiProtocolDEXExecutor.VIABILITY_TTL) {
      console.log('[TiwiDEX] Skipping — contract non-viable (cached)');
      return false;
    }

    const fromBsc = route.fromToken.chainId === BSC_CHAIN_ID;
    const toBsc = route.toToken.chainId === BSC_CHAIN_ID;
    if (!fromBsc || !toBsc) {
      return false;
    }

    if (isNativeToken(route.fromToken.address)) {
      return true;
    }

    const { selectedGasTokenType } = useSwapStore.getState();
    if (selectedGasTokenType !== GasTokenType.BNB) {
      return false;
    }

    return true;
  }

  async getSpenderAddress(_route: RouterRoute): Promise<string | null> {
    return TIWI_DEX_CONTRACT;
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const {
      route, fromToken, toToken, fromAmount,
      userAddress, recipientAddress, walletClient, onStatusUpdate,
    } = params;

    // Get wallet client — use provided one or fetch from connected wallet
    let activeWalletClient = walletClient;
    if (!activeWalletClient) {
      try {
        const { getEVMWalletClient } = await import('../utils/wallet-helpers');
        activeWalletClient = await getEVMWalletClient(fromToken.chainId || BSC_CHAIN_ID);
      } catch (e: any) {
        throw new Error('Wallet required — please connect a BSC wallet');
      }
    }

    const chainId = fromToken.chainId || BSC_CHAIN_ID;
    const { ensureCorrectChain } = await import('../utils/wallet-helpers');
    await ensureCorrectChain(chainId);

    // SECURITY: Validate no blacklisted contracts are involved
    const routeContracts = [
      route.raw?.steps?.[0]?.items?.[0]?.data?.to,
      route.raw?.steps?.[0]?.items?.[0]?.data?.approvalAddress,
    ].filter(Boolean).map((a: string) => a.toLowerCase());

    for (const addr of routeContracts) {
      if (BLACKLISTED_CONTRACTS.has(addr)) {
        throw new Error(
          `Blocked: Contract ${addr} is blacklisted (PancakeSwap Multicall). ` +
          `This contract has been flagged as potentially malicious.`
        );
      }
    }

    const recipient = (recipientAddress || userAddress) as Address;
    const isNativeInput = isNativeToken(fromToken.address);
    const isNativeOutput = isNativeToken(toToken.address);
    const fromAmountWei = parseUnits(fromAmount, fromToken.decimals || 18);

    onStatusUpdate?.({ stage: 'preparing', message: 'Preparing swap...' });

    // Pre-check if approval is needed for the UX grouping
    const needsApproval = !isNativeInput && await this.checkNeedsApproval(
      userAddress as Address,
      getAddress(fromToken.address) as Address,
      fromAmountWei,
    );

    try {
      // 1. Build router calldata
      const { routerCalldata, expectedOutput } = await this.buildRouterCalldata(
        fromToken, toToken, fromAmountWei, recipient, isNativeOutput
      );

      const minAmountOut = (expectedOutput * BigInt(95)) / BigInt(100);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

      // 2. Build the contract call data
      let txData: Hex;
      let txValue: bigint = BigInt(0);

      if (isNativeInput) {
        txData = encodeFunctionData({
          abi: TIWI_DEX_ABI,
          functionName: 'swapNative',
          args: [
            normalizeForPath(toToken.address) as Address,
            minAmountOut, recipient,
            PANCAKESWAP_V2_ROUTER as Address,
            routerCalldata, deadline,
          ],
        });
        txValue = fromAmountWei;
      } else {
        const normalizedFrom = getAddress(fromToken.address) as Address;

        // Approve exact amount (not unlimited)
        await this.ensureApproval(
          activeWalletClient, userAddress as Address, normalizedFrom,
          fromAmountWei, onStatusUpdate
        );

        const toTokenAddr = isNativeOutput
          ? NATIVE_PLACEHOLDER as Address
          : normalizeForPath(toToken.address) as Address;

        txData = encodeFunctionData({
          abi: TIWI_DEX_ABI,
          functionName: 'swap',
          args: [
            normalizedFrom, toTokenAddr, fromAmountWei, minAmountOut,
            recipient, PANCAKESWAP_V2_ROUTER as Address,
            routerCalldata, deadline,
          ],
        });
      }

      // 3. Estimate gas with fallback — don't let estimation failures block valid swaps
      onStatusUpdate?.({
        stage: 'confirming',
        message: needsApproval ? 'Transaction 2 of 2 — Confirm Swap' : 'Approve Swap',
      });

      // Gas estimation — if it reverts, the contract WILL fail on-chain.
      // Do NOT send a tx that will revert (wastes user gas).
      let gasLimit: bigint;
      try {
        const estimated = await this.publicClient.estimateGas({
          to: TIWI_DEX_CONTRACT,
          data: txData,
          value: txValue,
          account: userAddress as Address,
        });
        gasLimit = (estimated * BigInt(130)) / BigInt(100); // 30% buffer
      } catch (gasError: any) {
        // Gas estimation failed = contract will revert = don't send tx
        // Throw so the fallback chain picks up a working executor
        const msg = gasError?.message?.toLowerCase() || '';
        console.error('[TiwiDEX] Gas estimation REVERTED — contract will fail, skipping:', msg);
        throw new Error(
          msg.includes('revert') || msg.includes('overflow')
            ? 'execution reverted'  // triggers shouldTryFallback → true
            : `Gas estimation failed: ${gasError?.message || 'unknown'}`
        );
      }

      const hash = await activeWalletClient.sendTransaction({
        to: TIWI_DEX_CONTRACT,
        data: txData,
        value: txValue,
        account: userAddress as Address,
        chain: bsc,
        gas: gasLimit,
      });

      // CRITICAL: Check receipt status — a reverted tx still returns a hash
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });

      if (receipt.status === 'reverted') {
        throw new Error('execution reverted'); // triggers fallback
      }

      onStatusUpdate?.({ stage: 'completed', message: 'Swap complete!', txHash: hash });
      return { success: true, txHash: hash, actualToAmount: route.toToken.amount };

    } catch (error: any) {
      console.error('[TiwiDEX] Swap failed:', error);
      const { formatErrorMessage } = await import('../utils/error-handler');
      onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(error), error });
      throw error;
    }
  }

  // ---------- Internal ----------

  private async buildRouterCalldata(
    fromToken: any,
    toToken: any,
    fromAmountWei: bigint,
    recipient: Address,
    isNativeOutput: boolean,
  ): Promise<{ routerCalldata: Hex; expectedOutput: bigint }> {
    const normalizedFrom = normalizeForPath(fromToken.address);
    const normalizedTo = normalizeForPath(toToken.address);

    // Calculate swap amount after tax (contract deducts 0.25%)
    // Use on-chain calculation if available, otherwise compute locally
    let swapAmount: bigint;
    try {
      const taxAmount = await Promise.race([
        this.publicClient.readContract({
          address: TIWI_DEX_CONTRACT,
          abi: TIWI_DEX_ABI,
          functionName: 'calculateTax',
          args: [fromAmountWei],
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Tax calc timeout')), 2000)),
      ]) as bigint;
      swapAmount = fromAmountWei - taxAmount;
    } catch {
      // Fallback: calculate 0.25% tax locally
      console.warn('[TiwiDEX] On-chain tax calculation unavailable, using local 0.25%');
      const taxAmount = (fromAmountWei * BigInt(25)) / BigInt(10000);
      swapAmount = fromAmountWei - taxAmount;
    }

    // Find best path with multiple fallback routes
    // Priority: Direct → via WBNB → via USDT → via BUSD (for TWC especially)
    const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955';
    const BUSD_BSC = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';

    let path: string[] = [];
    let expectedOutput: bigint = BigInt(0);

    const candidatePaths: string[][] = [];

    // 1. Direct path
    candidatePaths.push([normalizedFrom, normalizedTo]);

    // 2. Via WBNB (if not already one of the tokens)
    if (normalizedFrom.toLowerCase() !== WBNB_ADDRESS.toLowerCase() &&
        normalizedTo.toLowerCase() !== WBNB_ADDRESS.toLowerCase()) {
      candidatePaths.push([normalizedFrom, WBNB_ADDRESS, normalizedTo]);
    }

    // 3. TWC-specific fallback: via USDT/BUSD (higher liquidity pairs)
    const isTWCSwap = normalizedFrom.toLowerCase() === TWC_ADDRESS.toLowerCase() ||
                      normalizedTo.toLowerCase() === TWC_ADDRESS.toLowerCase();
    if (isTWCSwap) {
      // TWC → USDT → target or source → USDT → TWC
      if (normalizedFrom.toLowerCase() !== USDT_BSC.toLowerCase() &&
          normalizedTo.toLowerCase() !== USDT_BSC.toLowerCase()) {
        candidatePaths.push([normalizedFrom, USDT_BSC, normalizedTo]);
      }
      // TWC → WBNB → USDT → target (3-hop for edge cases)
      if (normalizedTo.toLowerCase() !== WBNB_ADDRESS.toLowerCase() &&
          normalizedTo.toLowerCase() !== USDT_BSC.toLowerCase()) {
        candidatePaths.push([normalizedFrom, WBNB_ADDRESS, USDT_BSC, normalizedTo]);
      }
    }

    // 4. Generic via USDT fallback
    if (!isTWCSwap && normalizedFrom.toLowerCase() !== USDT_BSC.toLowerCase() &&
        normalizedTo.toLowerCase() !== USDT_BSC.toLowerCase()) {
      candidatePaths.push([normalizedFrom, USDT_BSC, normalizedTo]);
    }

    // Try ALL paths in PARALLEL for maximum speed
    const pathResults = await Promise.allSettled(
      candidatePaths.map(async (candidate) => {
        const amounts = await Promise.race([
          this.publicClient.readContract({
            address: PANCAKESWAP_V2_ROUTER as Address,
            abi: ROUTER_ABI,
            functionName: 'getAmountsOut',
            args: [swapAmount, candidate as readonly `0x${string}`[]],
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ]) as bigint[];
        return { path: candidate, output: amounts[amounts.length - 1] };
      })
    );

    // Pick the path with the best output
    let bestOutput = BigInt(0);
    let bestPath: string[] | null = null;

    for (const result of pathResults) {
      if (result.status === 'fulfilled' && result.value.output > bestOutput) {
        bestOutput = result.value.output;
        bestPath = result.value.path;
      }
    }

    if (!bestPath || bestOutput === BigInt(0)) {
      throw new Error('No valid swap path found on PancakeSwap V2');
    }

    path = bestPath;
    expectedOutput = bestOutput;
    console.log(`[TiwiDEX] Best path: ${path.join(' → ')} (output: ${expectedOutput})`);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const minOut = (expectedOutput * BigInt(95)) / BigInt(100);
    const pathAddresses = path.map(a => getAddress(a)) as readonly `0x${string}`[];

    // NOTE: Router calldata sends output to THIS contract temporarily,
    // then contract verifies and the router sends directly to recipient.
    // Actually — PancakeSwap sends directly to `to` address in the calldata.
    // So `to` = recipient here.
    let routerCalldata: Hex;
    if (isNativeOutput) {
      routerCalldata = encodeFunctionData({
        abi: PANCAKE_SWAP_ABI,
        functionName: 'swapExactTokensForETH',
        args: [swapAmount, minOut, pathAddresses, recipient, deadline],
      });
    } else {
      routerCalldata = encodeFunctionData({
        abi: PANCAKE_SWAP_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [swapAmount, minOut, pathAddresses, recipient, deadline],
      });
    }

    return { routerCalldata, expectedOutput };
  }

  /** Quick read-only check if approval is needed (for UX messaging) */
  private async checkNeedsApproval(
    owner: Address, token: Address, requiredAmount: bigint,
  ): Promise<boolean> {
    try {
      const allowance = await this.publicClient.readContract({
        address: token, abi: ERC20_ABI, functionName: 'allowance',
        args: [owner, TIWI_DEX_CONTRACT],
      }) as bigint;
      return allowance < requiredAmount;
    } catch {
      return true; // Assume approval needed if check fails
    }
  }

  /**
   * Ensure user has approved TiwiProtocolDEX. Approves max/infinite so a (token, spender)
   * pair is only ever signed ONCE — later swaps of the same token reuse the allowance.
   * The allowance is only permission; each swap still moves exactly its own amountIn.
   */
  private async ensureApproval(
    walletClient: any,
    owner: Address,
    token: Address,
    requiredAmount: bigint,
    onStatusUpdate?: (status: any) => void,
  ): Promise<void> {
    const allowance = await this.publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner, TIWI_DEX_CONTRACT],
    }) as bigint;

    if (allowance >= requiredAmount) {
      return; // Already has sufficient allowance
    }

    onStatusUpdate?.({ stage: 'approving', message: 'Transaction 1 of 2 — Approving token...' });

    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [TIWI_DEX_CONTRACT, getStandardApprovalAmount()],
    });

    const hash = await walletClient.sendTransaction({
      to: token,
      data,
      account: owner,
      chain: bsc,
    });

    await this.publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });

    // Quick verify — receipt already confirmed the tx, just one fast check
    for (let i = 0; i < 2; i++) {
      const newAllowance = await this.publicClient.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner, TIWI_DEX_CONTRACT],
      }) as bigint;
      if (newAllowance >= requiredAmount) {
        return;
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }
}
