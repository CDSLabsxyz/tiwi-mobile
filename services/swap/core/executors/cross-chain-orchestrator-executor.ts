/**
 * Cross-Chain Orchestrator Executor (Phase 5 — one-sign escrow cross-chain, EVM↔EVM)
 *
 * For cross-chain swaps between chains where TIWI runs its own escrow corridor
 * (TiwiCrossChainOrchestrator on the source + TiwiCrossChainVault on the dest), this does
 * the whole source side in ONE call: approve tokenIn → orchestrator, then swapAndBridge()
 * which swaps tokenIn → source stable via TiwiMultiSwap, secures it in the vault, and emits
 * CrossChainSwapInitiated. The backend relayer watches that event and fulfills on the dest
 * chain, delivering destToken to the recipient. `minDestAmount` protects the user on-chain.
 *
 * Scope: EVM→EVM only (destRecipient/destToken are `address`). Non-EVM cross-VM stays on the
 * Phase 6 aggregator path. Inert unless BOTH chains are configured escrow chains.
 *
 * ⚠️ Requires funded dest vault liquidity + an authorized, running relayer + audit before
 * real value flows. Until then this executor should not be preferred over aggregator routes.
 */
import { encodeFunctionData, getAddress, parseUnits, type Address, type Hex } from 'viem';
import type { SwapRouterExecutor, SwapExecutionParams, SwapExecutionResult } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { getEVMWalletClient, getEVMPublicClient, ensureCorrectChain } from '../utils/wallet-helpers';
import { ensureTokenApproval } from '../services/approval-handler';
import { getEscrowChain, isEscrowSource, isEscrowDest, ORCHESTRATOR_ABI, ESCROW_GAS_LIMIT } from '@/services/swap/core/contracts/cross-chain-escrow';

const ZERO = '0x0000000000000000000000000000000000000000';
const NATIVE_ADDRESSES = [ZERO, '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'];
const isNative = (a?: string): boolean => !a || NATIVE_ADDRESSES.includes(a.toLowerCase());

const V2_ROUTER_ABI = [{
  name: 'getAmountsOut', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'path', type: 'address[]' }],
  outputs: [{ name: 'amounts', type: 'uint256[]' }],
}] as const;

type Step = { dexType: number; router: Address; tokenIn: Address; tokenOut: Address; fee: number };

// Apply slippage % (e.g. 0.5) to an expected output → minimum. Clamped [0.05%, 50%].
function applySlippage(expected: bigint, slippagePercent: number | undefined): bigint {
  let pct = slippagePercent ?? 0.5;
  if (!isFinite(pct) || pct <= 0) pct = 0.5;
  if (pct > 50) pct = 50;
  const bps = BigInt(Math.round(pct * 100));
  return (expected * (BigInt(10000) - bps)) / BigInt(10000);
}

// Safety gate: the escrow path secures funds in a vault that the relayer must later deliver
// from. With unfunded vaults / no running relayer, that would strand user funds. So this
// executor stays INERT until explicitly enabled after funding + relayer + audit.
const ESCROW_ENABLED = process.env.EXPO_PUBLIC_ESCROW_ENABLED === 'true';

export class CrossChainOrchestratorExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    if (!ESCROW_ENABLED) return false;                       // inert until go-live flag is set
    // Only execute routes explicitly produced for the TIWI escrow bridge — never hijack an
    // aggregator route (lifi/relay/rubic) that happens to span the same two chains.
    if (route.router !== 'tiwi-bridge') return false;
    const fromChain = route.fromToken.chainId;
    const toChain = route.toToken.chainId;
    if (fromChain === toChain) return false;                 // cross-chain only
    if (!isEscrowSource(fromChain) || !isEscrowDest(toChain)) return false; // both must be escrow chains
    if (isNative(route.fromToken.address)) return false;     // native input needs transferFrom — unsupported
    if (isNative(route.toToken.address)) return false;       // dest must be an ERC20 the vault can deliver
    const src = getEscrowChain(fromChain);
    if (!src) return false;
    // tokenIn must differ from the source stable (orchestrator swaps tokenIn → stable).
    if (route.fromToken.address.toLowerCase() === src.stable.address.toLowerCase()) return false;
    return true;
  }

  async getSpenderAddress(route: RouterRoute): Promise<string | null> {
    return getEscrowChain(route.fromToken.chainId)?.orchestrator ?? null;
  }

  /** Build the source tokenIn → stable V2 path (direct, else via wrapped native) + expected out. */
  private async buildSourceSwap(
    chainId: number,
    tokenIn: Address,
    stable: Address,
    wrappedNative: Address,
    v2Router: Address,
    amountIn: bigint,
  ): Promise<{ steps: Step[]; expectedStableOut: bigint } | null> {
    const pub = getEVMPublicClient(chainId);
    const candidates: Address[][] = [
      [tokenIn, stable],
      [tokenIn, wrappedNative, stable],
    ];
    let best: { path: Address[]; out: bigint } | null = null;
    for (const path of candidates) {
      if (path[0].toLowerCase() === path[1]?.toLowerCase()) continue;
      try {
        const amounts = (await pub.readContract({
          address: v2Router, abi: V2_ROUTER_ABI, functionName: 'getAmountsOut', args: [amountIn, path],
        })) as readonly bigint[];
        const out = amounts[amounts.length - 1];
        if (out > BigInt(0) && (!best || out > best.out)) best = { path, out };
      } catch { /* path has no pool — try next */ }
    }
    if (!best) return null;
    const steps: Step[] = [];
    for (let i = 0; i < best.path.length - 1; i++) {
      steps.push({ dexType: 0, router: v2Router, tokenIn: best.path[i], tokenOut: best.path[i + 1], fee: 0 });
    }
    return { steps, expectedStableOut: best.out };
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, toToken, fromAmount, userAddress, recipientAddress, walletClient, onStatusUpdate, slippage } = params;
    const fromChain = route.fromToken.chainId;
    const toChain = route.toToken.chainId;

    const src = getEscrowChain(fromChain);
    if (!src?.orchestrator) {
      return { success: false, txHash: '', error: new Error(`No escrow orchestrator on chain ${fromChain}`) };
    }

    try {
      onStatusUpdate?.({ stage: 'preparing', message: 'Preparing cross-chain swap...' });

      const wallet = walletClient || (await getEVMWalletClient(fromChain));
      await ensureCorrectChain(fromChain);
      const publicClient = getEVMPublicClient(fromChain);

      const tokenIn = getAddress(fromToken.address);
      const amountIn = parseUnits(fromAmount, fromToken.decimals || 18);
      const slippagePct = slippage ?? (route.slippage ? parseFloat(route.slippage) : undefined) ?? 0.5;

      // 1) Build the source tokenIn → stable swap path on-chain.
      const built = await this.buildSourceSwap(
        fromChain, tokenIn, src.stable.address, src.wrappedNative, src.v2Router, amountIn,
      );
      if (!built) {
        return { success: false, txHash: '', error: new Error(`No ${src.stable.symbol} path found for ${fromToken.symbol} on ${src.name}`) };
      }
      const minStableOut = applySlippage(built.expectedStableOut, slippagePct);

      // 2) minDestAmount protects the user: the relayer must deliver >= this on the dest chain.
      const expectedDest = parseUnits(route.toToken.amount || '0', toToken.decimals || 18);
      const minDestAmount = applySlippage(expectedDest, slippagePct);

      // EVM→EVM: the same 0x address is valid on the destination chain.
      const destRecipient = getAddress(recipientAddress || userAddress);
      const destToken = getAddress(toToken.address);

      // 3) Approve tokenIn → orchestrator.
      onStatusUpdate?.({ stage: 'approving', message: 'Checking token approval...' });
      await ensureTokenApproval(
        tokenIn, userAddress, src.orchestrator, amountIn.toString(), fromChain,
        (m: string) => onStatusUpdate?.({ stage: 'approving', message: m }), wallet,
      );

      // 4) One call: swapAndBridge. Explicit gas — nested calls under-estimate and revert.
      onStatusUpdate?.({ stage: 'signing', message: 'Confirming the cross-chain swap in your wallet...' });
      const data = encodeFunctionData({
        abi: ORCHESTRATOR_ABI,
        functionName: 'swapAndBridge',
        args: [
          tokenIn, amountIn, minStableOut, built.steps as any,
          BigInt(toChain), destRecipient, destToken, minDestAmount,
        ],
      }) as Hex;

      const txHash = await wallet.sendTransaction({
        account: wallet.account ?? (getAddress(userAddress) as Address),
        chain: wallet.chain,
        to: getAddress(src.orchestrator),
        data,
        gas: ESCROW_GAS_LIMIT,
      } as any);

      onStatusUpdate?.({ stage: 'confirming', message: 'Securing funds on source chain...', txHash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
      if (receipt.status !== 'success') {
        return { success: false, txHash, error: new Error('swapAndBridge reverted') };
      }

      onStatusUpdate?.({
        stage: 'confirming',
        message: `Bridging to ${toToken.symbol} — the relayer will deliver on the destination chain shortly.`,
        txHash,
      });
      return { success: true, txHash, txHashes: [txHash], receipt };
    } catch (error: any) {
      onStatusUpdate?.({ stage: 'failed', message: error?.message || 'Cross-chain swap failed', error });
      return { success: false, txHash: '', error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
