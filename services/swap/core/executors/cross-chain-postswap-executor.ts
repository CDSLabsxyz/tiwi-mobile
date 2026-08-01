/**
 * Cross-Chain Post-Swap Executor — the destination-side mirror of `CrossChainPreSwapExecutor`.
 *
 * Aggregators quote cross-chain swaps INTO a fee-on-transfer token (TWC) happily, but they can't
 * settle them: the destination swap is a plain router call that reverts on the transfer tax. The
 * bridge then refunds in whatever currency was actually deposited — and for a Solana source that
 * deposit is USDC, because the aggregator's origin transaction swaps SOL → USDC before depositing.
 * Net effect: the user asks for SOL → TWC and ends up holding USDC on Solana.
 *
 * So we split it, each leg a proven path:
 *
 *   Leg 1: swap  fromToken(src) -> stable(dest)   (LiFi/Relay/Rubic — a normal, supported crossing)
 *   Leg 2: swap  stable(dest)   -> taxedToken     (our FoT-safe BSC executors, same chain)
 *
 * Leg 2 can only run once the bridge lands, which takes minutes — so leg 1 is persisted the moment
 * it confirms (see `pending-second-leg`). If the wait times out or the app dies, the stable is
 * sitting safely in the user's destination wallet and the swap can be finished later.
 *
 * Non-taxed destinations never reach this executor — they route straight through the aggregators.
 */
import { getAddress, type Address } from 'viem';
import type { SwapRouterExecutor, SwapExecutionParams, SwapExecutionResult, SwapExecutionStatus } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { fetchRoute } from '@/services/swap/core/platform/route-api';
import { getEVMPublicClient } from '../utils/wallet-helpers';
import { isEVMChain } from '../utils/chain-helpers';
import { getEvmAddress } from '@/services/swap/core/platform/wallet-context';
import {
  isFeeOnTransfer,
  getChainStable,
  MIN_CROSS_CHAIN_USD,
  formatUnitsSafe,
} from '@/services/swap/core/config/fee-on-transfer';
import {
  savePendingSecondLeg,
  clearPendingSecondLeg,
  listPendingSecondLegs,
  type PendingSecondLeg,
} from '@/services/swap/core/platform/pending-second-leg';

const ERC20_BALANCE_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

/** How long to actively wait for the bridge to land before handing off to the resume path. */
const ARRIVAL_TIMEOUT_MS = 12 * 60 * 1000;
const ARRIVAL_POLL_MS = 8_000;

const isEvmAddress = (a?: string): boolean => !!a && /^0x[a-fA-F0-9]{40}$/.test(a);

function readStableBalance(chainId: number, stable: string, owner: string): Promise<bigint> {
  return getEVMPublicClient(chainId).readContract({
    address: getAddress(stable) as Address,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [getAddress(owner) as Address],
  }) as Promise<bigint>;
}

export class CrossChainPostSwapExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    const fromChain = route.fromToken.chainId;
    const toChain = route.toToken.chainId;
    if (fromChain === toChain) return false;                            // cross-chain only
    if (!isFeeOnTransfer(toChain, route.toToken.address)) return false; // taxed destination only
    if (!isEVMChain(toChain)) return false;                             // leg 2 is a local EVM swap
    if (!getChainStable(toChain)) return false;                         // need a bridgeable stable there
    return true;
  }

  async getSpenderAddress(): Promise<string | null> {
    return null; // legs handle their own approvals
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const {
      route, fromToken, toToken, fromAmount, userAddress, recipientAddress,
      walletClient, onStatusUpdate, slippage, skipTax,
    } = params;
    const sourceChain = route.fromToken.chainId;
    const destChain = route.toToken.chainId;
    const stable = getChainStable(destChain)!;
    const allTxHashes: string[] = [];

    // NOTE: everything below runs inside this try, and failures RESOLVE as `{ success: false }`
    // rather than throwing. That is load-bearing: `SwapExecutor.execute` falls through to the
    // next candidate on a throw, and the next candidate for this route is the very aggregator
    // executor we're intercepting — so a throw here would re-run the swap the broken way.
    try {
      const { swapExecutor } = await import('../index');

      // Leg 2 is signed ON the destination chain, so the intermediate stable must land on an
      // address WE hold the key for — a user-set recipient can be a third party we can't sign
      // as. For a non-EVM source `userAddress` is not an 0x address, so fall back to the
      // wallet's own EVM address. The final token still goes to `finalRecipient`, which leg 2
      // delivers to directly (the FoT-safe router call takes an explicit `to`) — no extra hop.
      const destAddress = [getEvmAddress(), userAddress].find(isEvmAddress);
      if (!destAddress) {
        const msg = `This swap needs an EVM wallet on the destination network to complete the ${toToken.symbol || 'final'} step. Please add or unlock one and try again.`;
        onStatusUpdate?.({ stage: 'failed', message: msg, error: new Error(msg) });
        return { success: false, txHash: '', error: new Error(msg) };
      }
      const finalRecipient = isEvmAddress(recipientAddress) ? recipientAddress! : destAddress;

      // Pre-flight: reject dust BEFORE any transaction. Bridge minimums + relayer fees make a
      // sub-~$3 crossing refund, and a refund is exactly the outcome we're here to avoid.
      const inputUSD = parseFloat((route.fromToken as any).amountUSD || '0');
      if (inputUSD > 0 && inputUSD < MIN_CROSS_CHAIN_USD) {
        const msg = `Amount too small for a cross-chain swap (~$${inputUSD.toFixed(2)}). Cross-chain bridges need at least ~$${MIN_CROSS_CHAIN_USD} — try a larger amount.`;
        onStatusUpdate?.({ stage: 'failed', message: msg, error: new Error(msg) });
        return { success: false, txHash: '', error: new Error(msg) };
      }

      console.log('[CrossChainPostSwap] intercepting', {
        from: `${sourceChain}:${route.fromToken.address}`,
        to: `${destChain}:${route.toToken.address}`,
        via: `${stable.symbol}@${destChain}`,
        destAddress, finalRecipient, fromAmount,
      });

      let stableBefore: bigint;
      try {
        stableBefore = await readStableBalance(destChain, stable.address, destAddress);
      } catch (e: any) {
        // Distinguish "can't read the destination chain" from a routing/bridge failure —
        // otherwise both surface as the same opaque mapped message.
        console.error('[CrossChainPostSwap] destination balance read failed:', e);
        throw new Error(`Couldn't reach the destination network to prepare your ${toToken.symbol} swap. Please try again.`);
      }

      // ───────── Leg 1: fromToken(src) → stable(dest), via the aggregators ─────────
      onStatusUpdate?.({ stage: 'preparing', message: `Step 1/3: Bridging ${fromToken.symbol || 'token'} → ${stable.symbol}...` });

      const leg1Resp = await fetchRoute({
        fromToken: { chainId: sourceChain, address: route.fromToken.address, symbol: fromToken.symbol, decimals: fromToken.decimals },
        toToken: { chainId: destChain, address: stable.address, symbol: stable.symbol, decimals: stable.decimals },
        fromAmount,
        slippage,
        fromAddress: userAddress,
        recipient: destAddress, // the stable must land on the wallet that runs leg 2
      } as any);

      // Take the best route we can actually settle. `canExecute` matters here because the
      // route service happily returns e.g. an EVM-only hub route for a non-EVM source.
      const leg1Candidates = [leg1Resp?.route, ...(leg1Resp?.alternatives || [])].filter(Boolean) as RouterRoute[];
      const leg1Route = leg1Candidates.find((r) => swapExecutor.canExecute(r));
      console.log('[CrossChainPostSwap] leg 1 candidates:',
        leg1Candidates.map((r) => `${r.router}${swapExecutor.canExecute(r) ? '' : '(unexecutable)'}`).join(', ') || 'none',
        '→ picked', leg1Route?.router ?? 'none');
      if (!leg1Route) {
        throw new Error(`No cross-chain route for ${fromToken.symbol} → ${stable.symbol} on ${destChain}`);
      }

      const leg1 = await swapExecutor.execute({
        route: leg1Route,
        fromToken,
        toToken: { chainId: destChain, address: stable.address, symbol: stable.symbol, decimals: stable.decimals } as any,
        fromAmount,
        userAddress,
        recipientAddress: destAddress,
        walletClient,          // source-chain signer — leg 1 signs on the source chain
        slippage,
        // The single Tiwi fee is charged here, exactly as it would be on a normal one-leg
        // cross-chain swap — unless an outer leg already charged it (a taxed→taxed pair nests
        // this executor inside the pre-swap one). Leg 2 always skips, so it's charged once.
        skipTax: skipTax === true,
        onStatusUpdate: (s) => onStatusUpdate?.({ ...s, message: `Step 1/3: ${s.message}` }),
      });
      if (!leg1.success) {
        return { success: false, txHash: leg1.txHash || '', txHashes: allTxHashes, error: leg1.error || new Error('Leg 1 (bridge) failed') };
      }
      if (leg1.txHash) allTxHashes.push(leg1.txHash);

      // Persist BEFORE waiting. From here on the user's funds are in flight to the destination,
      // and this record is the only thing that can finish the swap if the app goes away.
      const pending: PendingSecondLeg = {
        id: `${destChain}:${toToken.address.toLowerCase()}:${leg1.txHash || Date.now()}`,
        createdAt: Date.now(),
        destChainId: destChain,
        destAddress,
        finalRecipient,
        stable,
        stableBefore: stableBefore.toString(),
        toToken: {
          chainId: destChain,
          address: toToken.address,
          symbol: toToken.symbol || '',
          decimals: toToken.decimals || 18,
        },
        bridgeTxHash: leg1.txHash,
        slippage,
      };
      await savePendingSecondLeg(pending);

      // ───────── Wait for the bridge to land ─────────
      const arrived = await this.waitForArrival(pending, onStatusUpdate);
      if (arrived === null) {
        const msg =
          `Your ${fromToken.symbol} is on its way to ${stable.symbol} on the destination network, but it hasn't landed yet. ` +
          `Nothing is lost — reopen Swap once it arrives and we'll finish the ${toToken.symbol} step for you.`;
        onStatusUpdate?.({ stage: 'failed', message: msg, error: new Error(msg) });
        return { success: false, txHash: leg1.txHash || '', txHashes: allTxHashes, error: new Error(msg) };
      }

      // ───────── Leg 2: stable(dest) → taxed token, same chain ─────────
      const leg2 = await runSecondLeg(pending, arrived, (s) =>
        onStatusUpdate?.({ ...s, message: `Step 3/3: ${s.message}` }),
      );
      if (leg2.txHash) allTxHashes.push(leg2.txHash);
      if (!leg2.success) {
        // Leg 1 landed: the user holds the stable on the destination chain — no funds lost, and
        // the pending record is deliberately left in place so this can be retried.
        return {
          success: false,
          txHash: leg2.txHash || '',
          txHashes: allTxHashes,
          error: leg2.error || new Error(`Your ${stable.symbol} arrived safely — the final ${toToken.symbol} swap can be retried from the Swap screen.`),
        };
      }

      await clearPendingSecondLeg(pending.id);
      onStatusUpdate?.({ stage: 'completed', message: 'Swap complete', txHash: leg2.txHash });
      return { success: true, txHash: leg2.txHash, txHashes: allTxHashes, actualToAmount: leg2.actualToAmount };
    } catch (error: any) {
      // Log the RAW error: the UI runs it through `formatErrorMessage`, which collapses
      // anything mentioning network/rpc/fetch into a bare "Connection error" and would
      // otherwise hide which leg actually failed.
      console.error('[CrossChainPostSwap] raw failure:', error?.message, error);
      onStatusUpdate?.({ stage: 'failed', message: error?.message || 'Cross-chain swap failed', error });
      return {
        success: false,
        txHash: allTxHashes[allTxHashes.length - 1] || '',
        txHashes: allTxHashes,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Poll the destination chain until the bridged stable shows up. Returns the human-readable
   * amount received, or null if it hasn't landed within `ARRIVAL_TIMEOUT_MS`.
   */
  private async waitForArrival(
    pending: PendingSecondLeg,
    onStatusUpdate?: (s: SwapExecutionStatus) => void,
  ): Promise<string | null> {
    const before = BigInt(pending.stableBefore);
    const deadline = Date.now() + ARRIVAL_TIMEOUT_MS;
    const startedAt = Date.now();

    while (Date.now() < deadline) {
      try {
        const now = await readStableBalance(pending.destChainId, pending.stable.address, pending.destAddress);
        const delta = now - before;
        if (delta > BigInt(0)) {
          return formatUnitsSafe(delta, pending.stable.decimals);
        }
      } catch (e) {
        // A flaky RPC read must not abort a swap that's mid-flight — just try again.
        console.warn('[CrossChainPostSwap] Balance poll failed, retrying:', e);
      }

      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');
      onStatusUpdate?.({
        stage: 'confirming',
        message: `Step 2/3: Waiting for ${pending.stable.symbol} to arrive (${mm}:${ss})...`,
        txHash: pending.bridgeTxHash,
      });

      await new Promise((r) => setTimeout(r, ARRIVAL_POLL_MS));
    }
    return null;
  }
}

/**
 * Run the taxed second leg: stable → taxed token, on the destination chain.
 *
 * `walletClient` is deliberately left unset — the caller's client is bound to the SOURCE chain
 * (and for a Solana source isn't even an EVM client). Every BSC executor self-fetches a client
 * for `fromToken.chainId` when none is passed, which is exactly the destination chain here.
 */
export async function runSecondLeg(
  pending: PendingSecondLeg,
  stableAmountHuman: string,
  onStatusUpdate?: (s: SwapExecutionStatus) => void,
): Promise<SwapExecutionResult> {
  const { swapExecutor } = await import('../index');
  const { stable, toToken, destChainId, destAddress, slippage } = pending;
  // Records written before `finalRecipient` existed default to self-delivery.
  const finalRecipient = pending.finalRecipient || destAddress;

  onStatusUpdate?.({ stage: 'preparing', message: `Swapping ${stable.symbol} → ${toToken.symbol || 'token'}...` });

  const resp = await fetchRoute({
    fromToken: { chainId: destChainId, address: stable.address, symbol: stable.symbol, decimals: stable.decimals },
    toToken: { chainId: destChainId, address: toToken.address, symbol: toToken.symbol, decimals: toToken.decimals },
    fromAmount: stableAmountHuman,
    slippage,
    fromAddress: destAddress,
    recipient: finalRecipient,
  } as any);

  if (!resp?.route) {
    return {
      success: false,
      txHash: '',
      error: new Error(`No route for ${stable.symbol} → ${toToken.symbol} on chain ${destChainId}`),
    };
  }

  return swapExecutor.execute({
    route: resp.route,
    fromToken: { chainId: destChainId, address: stable.address, symbol: stable.symbol, decimals: stable.decimals } as any,
    toToken: { chainId: destChainId, address: toToken.address, symbol: toToken.symbol, decimals: toToken.decimals } as any,
    fromAmount: stableAmountHuman,
    userAddress: destAddress,
    recipientAddress: finalRecipient,
    slippage,
    // The Tiwi fee was already charged on leg 1 — charging again would double-bill.
    skipTax: true,
    onStatusUpdate,
  });
}

export interface ReadySecondLeg {
  record: PendingSecondLeg;
  /** Human-readable stable amount waiting to be swapped. */
  amount: string;
}

/**
 * Pending second legs whose stable has actually landed. Used by the UI to offer "finish that
 * swap" instead of silently popping a signature prompt on app open.
 */
export async function listReadySecondLegs(): Promise<ReadySecondLeg[]> {
  const records = await listPendingSecondLegs();
  const ready: ReadySecondLeg[] = [];

  for (const record of records) {
    try {
      const now = await readStableBalance(record.destChainId, record.stable.address, record.destAddress);
      const delta = now - BigInt(record.stableBefore);
      // Never try to swap more than the wallet currently holds — the user may have spent some
      // of it in the meantime, which would make leg 2 revert on transferFrom.
      const usable = delta > now ? now : delta;
      if (usable > BigInt(0)) {
        ready.push({ record, amount: formatUnitsSafe(usable, record.stable.decimals) });
      }
    } catch (e) {
      console.warn('[CrossChainPostSwap] Could not check pending leg', record.id, e);
    }
  }
  return ready;
}

/** Finish a ready second leg and drop its record on success. */
export async function completeSecondLeg(
  ready: ReadySecondLeg,
  onStatusUpdate?: (s: SwapExecutionStatus) => void,
): Promise<SwapExecutionResult> {
  const result = await runSecondLeg(ready.record, ready.amount, onStatusUpdate);
  if (result.success) {
    await clearPendingSecondLeg(ready.record.id);
  }
  return result;
}
