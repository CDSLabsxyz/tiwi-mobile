/**
 * TiwiMultiSwap Executor (Path R, Phase 3b — client-side)
 *
 * Executes universal / multi-hop routes (V2, V3, or mixed DEXes) on ANY EVM chain
 * where TiwiMultiSwap is deployed, by calling its atomic executeMultiSwap() directly.
 * The user signs the approval + the call and pays their own gas (no relayer needed).
 *
 * This is what makes the Phase-2 universal routes executable beyond BSC. It is gated
 * per-chain on a deployed TiwiMultiSwap address, so it stays inert on chains where the
 * contract isn't deployed yet (falls through to other executors).
 *
 * Step data (router/feeTier/dexId) comes from route.steps, populated by the backend
 * route-converter from the dex-registry — so no DEX addresses are hardcoded here.
 */
import { getAddress, encodeFunctionData, parseUnits, type Address, type Hex } from 'viem';
import type { SwapRouterExecutor, SwapExecutionParams, SwapExecutionResult } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { getEVMWalletClient, getEVMPublicClient, ensureCorrectChain } from '../utils/wallet-helpers';
import { ensureTokenApproval } from '../services/approval-handler';

/**
 * Per-chain TiwiMultiSwap deployments. BSC is live; add other chains' addresses as
 * they're deployed (or wire them via env). Until an address is present, this executor
 * is inert on that chain.
 */
const TIWI_MULTISWAP_BY_CHAIN: Record<number, string> = {
  56: (process.env.EXPO_PUBLIC_TIWI_MULTISWAP_CONTRACT || '0x13291f816bf45A2ef2Ed81D24C37629C8423C4D3'), // BSC
  42161: '0x3296b3B07031Ef8cfCFab581271a8c50eD4EAd11', // Arbitrum (UniV2 + Sushi + UniV3 allowlisted; on-chain V3 swap verified)
  // 8453: '0x...', 137: '0x...', 10: '0x...', 1: '0x...', etc. (deploy then add)
};

const ZERO = '0x0000000000000000000000000000000000000000';
const NATIVE_ADDRESSES = [ZERO, '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'];
const isNative = (a?: string): boolean => !a || NATIVE_ADDRESSES.includes(a.toLowerCase());

function getMultiSwapAddress(chainId: number): string | null {
  const a = TIWI_MULTISWAP_BY_CHAIN[chainId];
  return a && a !== ZERO ? a : null;
}

// Apply slippage % (e.g. 0.5) to expected output → minOut. Clamped [0.05%, 50%].
function applySlippage(expectedOutput: bigint, slippagePercent: number | undefined): bigint {
  let pct = slippagePercent ?? 0.5;
  if (!isFinite(pct) || pct <= 0) pct = 0.5;
  if (pct > 50) pct = 50;
  const bps = BigInt(Math.round(pct * 100));
  return (expectedOutput * (BigInt(10000) - bps)) / BigInt(10000);
}

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

type MSStep = { dexType: number; router: Address; tokenIn: Address; tokenOut: Address; fee: number };

export class TiwiMultiSwapExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    const fromChain = route.fromToken.chainId;
    const toChain = route.toToken.chainId;
    if (fromChain !== toChain) return false;            // same-chain only
    if (!getMultiSwapAddress(fromChain)) return false;  // not deployed on this chain
    if (isNative(route.fromToken.address)) return false; // native input needs transferFrom — unsupported
    // Universal / multi-hop routes only (single-DEX-direct is handled by the dedicated executors)
    const r = route.router || '';
    const isUniversal = r.startsWith('universal') || r === 'multi-hop' || (route.steps?.length || 0) > 1;
    if (!isUniversal) return false;
    return this.buildSteps(route) !== null;
  }

  async getSpenderAddress(route: RouterRoute): Promise<string | null> {
    return getMultiSwapAddress(route.fromToken.chainId);
  }

  /** Build the on-chain Step[] from route.steps. null if any hop is unresolved. */
  private buildSteps(route: RouterRoute): MSStep[] | null {
    const steps = route.steps;
    if (!steps || !Array.isArray(steps) || steps.length === 0) return null;
    const out: MSStep[] = [];
    for (const s of steps) {
      if (s.type !== 'swap') return null;             // bridges/wraps not handled here
      const router = (s as any).routerAddress as string | undefined;
      const tokenIn = s.fromToken?.address;
      const tokenOut = s.toToken?.address;
      const feeTier = (s as any).feeTier as number | undefined;
      if (!router || !tokenIn || !tokenOut) return null;
      if (isNative(tokenIn) || isNative(tokenOut)) return null; // token→token only
      const isV3 = feeTier != null;
      out.push({
        dexType: isV3 ? 1 : 0,
        router: getAddress(router),
        tokenIn: getAddress(tokenIn),
        tokenOut: getAddress(tokenOut),
        fee: isV3 ? feeTier! : 0,
      });
    }
    for (let i = 1; i < out.length; i++) {
      if (out[i].tokenIn.toLowerCase() !== out[i - 1].tokenOut.toLowerCase()) return null; // path break
    }
    if (out.some(s => s.dexType === 1 && s.fee === 0)) return null; // V3 hop missing fee tier
    return out;
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, toToken, fromAmount, userAddress, recipientAddress, walletClient, onStatusUpdate, slippage } = params;
    const chainId = route.fromToken.chainId; // RouterRoute chainId is always defined

    const multiSwap = getMultiSwapAddress(chainId);
    if (!multiSwap) {
      return { success: false, txHash: '', error: new Error(`TiwiMultiSwap not deployed on chain ${chainId}`) };
    }
    const steps = this.buildSteps(route);
    if (!steps) {
      return { success: false, txHash: '', error: new Error('Route is not executable via TiwiMultiSwap') };
    }

    try {
      onStatusUpdate?.({ stage: 'preparing', message: 'Preparing multi-hop swap...' });

      const wallet = walletClient || (await getEVMWalletClient(chainId));
      await ensureCorrectChain(chainId);
      const publicClient = getEVMPublicClient(chainId);

      const fromAmountWei = parseUnits(fromAmount, fromToken.decimals || 18);
      const expectedOut = parseUnits(route.toToken.amount || '0', toToken.decimals || 18);
      const slippagePct = slippage ?? (route.slippage ? parseFloat(route.slippage) : undefined) ?? 0.5;
      const minOut = applySlippage(expectedOut, slippagePct);
      const recipient = getAddress(recipientAddress || userAddress);

      // 1) Approve fromToken → TiwiMultiSwap (exact amount)
      onStatusUpdate?.({ stage: 'approving', message: 'Checking token approval...' });
      await ensureTokenApproval(
        fromToken.address,
        userAddress,
        multiSwap,
        fromAmountWei.toString(),
        chainId,
        (m: string) => onStatusUpdate?.({ stage: 'approving', message: m }),
        wallet
      );

      // 2) Build + send executeMultiSwap (user signs, pays gas)
      onStatusUpdate?.({ stage: 'signing', message: 'Confirming the swap in your wallet...' });
      const data = encodeFunctionData({
        abi: MULTISWAP_ABI,
        functionName: 'executeMultiSwap',
        args: [fromAmountWei, minOut, recipient, steps as any],
      }) as Hex;

      const txHash = await wallet.sendTransaction({
        account: wallet.account ?? (getAddress(userAddress) as Address),
        chain: wallet.chain,
        to: getAddress(multiSwap),
        data,
      } as any);

      onStatusUpdate?.({ stage: 'confirming', message: 'Confirming transaction...', txHash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 90_000 });
      if (receipt.status !== 'success') {
        return { success: false, txHash, error: new Error('Swap transaction reverted') };
      }

      onStatusUpdate?.({ stage: 'completed', message: 'Swap complete', txHash });
      return { success: true, txHash, txHashes: [txHash], receipt };
    } catch (error: any) {
      onStatusUpdate?.({ stage: 'failed', message: error?.message || 'Swap failed', error });
      return { success: false, txHash: '', error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
