/**
 * Cross-Chain Pre-Swap Executor (Phase 4a)
 *
 * Handles cross-chain swaps FROM a fee-on-transfer (taxed) token like TWC, which
 * aggregators (LiFi/Relay) can't bridge directly - their source swap reverts on the
 * transfer tax. We split it into two legs, each a proven path:
 *
 *   Leg 1: swap  TWC -> USDT   on the SOURCE chain   (our Path R executors, FoT-safe)
 *   Leg 2: swap  USDT(src) -> finalToken(dest)       (LiFi/Relay cross-chain swap)
 *
 * The aggregator owns asynchronous destination delivery in leg 2, so there is NO
 * synchronous dest-chain swap (which is why the old multi-step swap→bridge→swap flow
 * couldn't work - bridges take minutes to land).
 *
 * Non-taxed source tokens never hit this executor - they route directly through the
 * aggregator executors as before.
 */
import { getAddress, parseUnits, type Address } from 'viem';
import type { SwapRouterExecutor, SwapExecutionParams, SwapExecutionResult } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { fetchRoute } from '@/services/swap/core/platform/route-api';
import { getEVMPublicClient } from '../utils/wallet-helpers';
import { GasTokenType } from '@/services/swap/core/config/tax-config';
import { useSwapStore } from '@/services/swap/core/platform/swap-store';
import {
  isFeeOnTransfer,
  CHAIN_STABLE as SOURCE_STABLE,
  MIN_CROSS_CHAIN_USD,
  formatUnitsSafe,
} from '@/services/swap/core/config/fee-on-transfer';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const TIWI_DEX_DEPLOYED =
  (process.env.EXPO_PUBLIC_TIWI_DEX_CONTRACT || ZERO_ADDRESS).toLowerCase() !== ZERO_ADDRESS;

/**
 * Decide which leg of a cross-chain pre-swap collects the single Tiwi fee.
 *
 * Returns true → collect the fee on leg 2 (skip leg 1). This is correct ONLY when leg 1 would
 * otherwise charge the fee via a SEPARATE tax-transfer signature - the BscDirect path: BSC
 * source + BNB gas + the in-contract TiwiDEX not deployed. In every other case leg 1 folds the
 * fee inline in-contract (TiwiDEX / relayer) and keeps it, so leg 2 must skip to avoid
 * double-charging.
 *
 * The fee is charged exactly once either way; this only moves WHERE, to shed a signature.
 */
export function shouldTaxOnLeg2(opts: {
  sourceChain: number;
  gasTokenBnb: boolean;
  tiwiDexDeployed: boolean;
}): boolean {
  return opts.sourceChain === 56 && opts.gasTokenBnb && !opts.tiwiDexDeployed;
}

// The taxed-token registry and the per-chain handoff stable now live in
// `config/fee-on-transfer`, shared with `CrossChainPostSwapExecutor` (the destination-side
// mirror of this executor) so the two can never drift apart.

const ERC20_BALANCE_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

export class CrossChainPreSwapExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    const fromChain = route.fromToken.chainId;
    const toChain = route.toToken.chainId;
    if (fromChain === toChain) return false;                 // cross-chain only
    if (!isFeeOnTransfer(fromChain, route.fromToken.address)) return false; // taxed source only
    if (!SOURCE_STABLE[fromChain]) return false;             // need a bridgeable stable on source
    // Don't intercept if the destination IS the stable (nothing to pre-swap around)
    return true;
  }

  async getSpenderAddress(): Promise<string | null> {
    return null; // legs handle their own approvals
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, toToken, fromAmount, userAddress, recipientAddress, walletClient, onStatusUpdate, slippage } = params;
    const sourceChain = route.fromToken.chainId;
    const destChain = route.toToken.chainId;
    const stable = SOURCE_STABLE[sourceChain];
    const allTxHashes: string[] = [];

    try {
      // Lazy import to avoid a circular dependency (this executor lives inside swapExecutor).
      const { swapExecutor } = await import('../index');
      const publicClient = getEVMPublicClient(sourceChain);
      const stableAddr = getAddress(stable.address) as Address;

      // Pre-flight: reject dust cross-chain swaps BEFORE any transaction. Bridges have
      // minimums + relayer fees that make sub-~$3 bridges refund - don't waste the user's
      // gas/signatures on a swap that can't complete on the destination.
      const inputUSD = parseFloat((route.fromToken as any).amountUSD || '0');
      if (inputUSD > 0 && inputUSD < MIN_CROSS_CHAIN_USD) {
        const msg = `Amount too small for a cross-chain swap (~$${inputUSD.toFixed(2)}). Cross-chain bridges need at least ~$${MIN_CROSS_CHAIN_USD} - try a larger amount.`;
        onStatusUpdate?.({ stage: 'failed', message: msg, error: new Error(msg) });
        return { success: false, txHash: '', error: new Error(msg) };
      }

      // ── Tax placement: charge the 0.25% fee on EXACTLY ONE leg, on the leg that can do it
      // without a dedicated tax signature. ──
      //  • Leg 1 (BSC source swap) only does a SEPARATE tax transfer (its own signature) on the
      //    BscDirect path - BNB gas + the TiwiDEX contract not deployed. In that case skip leg-1
      //    tax and collect once on leg 2, where Relay folds it inline (no signature).
      //  • Otherwise leg 1 folds the fee inline in-contract (TiwiDEX / relayer), so leg 1 keeps
      //    the fee and leg 2 must skip it (avoids double-charging).
      const gasTokenType = useSwapStore.getState().selectedGasTokenType;
      const taxOnLeg2 = shouldTaxOnLeg2({
        sourceChain,
        gasTokenBnb: gasTokenType === GasTokenType.BNB,
        tiwiDexDeployed: TIWI_DEX_DEPLOYED,
      });

      // ─────────────── Leg 1: TWC → stable on the source chain ───────────────
      onStatusUpdate?.({ stage: 'preparing', message: `Step 1/2: Swapping ${fromToken.symbol || 'token'} → ${stable.symbol}...` });

      const stableBefore = await publicClient.readContract({
        address: stableAddr, abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', args: [getAddress(userAddress) as Address],
      }) as bigint;

      const leg1Resp = await fetchRoute({
        fromToken: { chainId: sourceChain, address: route.fromToken.address, symbol: fromToken.symbol, decimals: fromToken.decimals },
        toToken: { chainId: sourceChain, address: stable.address, symbol: stable.symbol, decimals: stable.decimals },
        fromAmount,
        slippage,
        fromAddress: userAddress,
        recipient: userAddress, // keep the stable on this wallet for leg 2
      } as any);

      if (!leg1Resp?.route) {
        throw new Error(`No route for ${fromToken.symbol} → ${stable.symbol} on source chain`);
      }

      const leg1 = await swapExecutor.execute({
        route: leg1Resp.route,
        fromToken,
        toToken: { chainId: sourceChain, address: stable.address, symbol: stable.symbol, decimals: stable.decimals } as any,
        fromAmount,
        userAddress,
        recipientAddress: userAddress,
        walletClient,
        slippage,
        // Skip leg-1 tax only when it would otherwise be a separate transfer (BscDirect); then
        // the fee is collected once on leg 2. Otherwise leg 1 folds it inline and keeps it.
        skipTax: taxOnLeg2,
        onStatusUpdate: (s) => onStatusUpdate?.({ ...s, message: `Step 1/2: ${s.message}` }),
      });
      if (!leg1.success) {
        return { success: false, txHash: leg1.txHash || '', txHashes: allTxHashes, error: leg1.error || new Error('Leg 1 (source swap) failed') };
      }
      if (leg1.txHash) allTxHashes.push(leg1.txHash);

      // Actual stable received (balance delta) - robust to fees/slippage.
      const stableAfter = await publicClient.readContract({
        address: stableAddr, abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', args: [getAddress(userAddress) as Address],
      }) as bigint;
      const stableReceived = stableAfter - stableBefore;
      if (stableReceived <= BigInt(0)) {
        return { success: false, txHash: leg1.txHash || '', txHashes: allTxHashes, error: new Error('Leg 1 produced no stablecoin') };
      }
      const stableAmountHuman = formatUnitsSafe(stableReceived, stable.decimals);

      // ───────── Leg 2: stable(src) → finalToken(dest) via LiFi/Relay ─────────
      onStatusUpdate?.({ stage: 'preparing', message: `Step 2/2: Bridging ${stable.symbol} → ${toToken.symbol || 'token'}...` });

      const leg2Resp = await fetchRoute({
        fromToken: { chainId: sourceChain, address: stable.address, symbol: stable.symbol, decimals: stable.decimals },
        toToken: { chainId: destChain, address: route.toToken.address, symbol: toToken.symbol, decimals: toToken.decimals },
        fromAmount: stableAmountHuman,
        slippage,
        fromAddress: userAddress,
        recipient: recipientAddress || userAddress,
      } as any);

      // Leg 2 must DELIVER the final token cross-chain (bridge + destination swap).
      // Across is a pure same-token bridge - it can't output ARB, only USDT - so we
      // prefer Relay/LiFi, which do the destination swap. Fall back only if neither exists.
      const leg2Candidates = [leg2Resp?.route, ...(leg2Resp?.alternatives || [])].filter(Boolean) as RouterRoute[];
      const leg2Route =
        leg2Candidates.find((r) => r.router === 'relay') ||   // preferred cross-chain swap executor
        leg2Candidates.find((r) => r.router === 'lifi') ||
        leg2Resp?.route;
      if (!leg2Route) {
        throw new Error(`No cross-chain swap route for ${stable.symbol} → ${toToken.symbol} (source funds are safe as ${stable.symbol})`);
      }

      const leg2 = await swapExecutor.execute({
        route: leg2Route,
        fromToken: { chainId: sourceChain, address: stable.address, symbol: stable.symbol, decimals: stable.decimals } as any,
        toToken,
        fromAmount: stableAmountHuman,
        userAddress,
        recipientAddress: recipientAddress || userAddress,
        walletClient,
        slippage,
        // Leg 2 collects the single Tiwi fee only when leg 1 didn't. When it does and Relay
        // inline fee is enabled, it's folded into this swap (no separate signature). Skipping
        // here when leg 1 already charged the fee prevents double-charging.
        skipTax: !taxOnLeg2,
        onStatusUpdate: (s) => onStatusUpdate?.({ ...s, message: `Step 2/2: ${s.message}` }),
      });
      if (leg2.txHash) allTxHashes.push(leg2.txHash);
      if (!leg2.success) {
        // Leg 1 succeeded: user holds the stable on the source chain - no funds lost.
        return { success: false, txHash: leg2.txHash || '', txHashes: allTxHashes, error: leg2.error || new Error(`Bridge failed; your ${stable.symbol} is safe on the source chain`) };
      }

      onStatusUpdate?.({ stage: 'completed', message: 'Cross-chain swap submitted', txHash: leg2.txHash });
      return { success: true, txHash: leg2.txHash, txHashes: allTxHashes, actualToAmount: leg2.actualToAmount };
    } catch (error: any) {
      onStatusUpdate?.({ stage: 'failed', message: error?.message || 'Cross-chain swap failed', error });
      return { success: false, txHash: allTxHashes[allTxHashes.length - 1] || '', txHashes: allTxHashes, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
