/**
 * TIWI Pool Executor
 *
 * Executes a swap directly against a TIWI Liquidity Hub pool (a deployed
 * `TiwiLiquidityPair` - Uniswap-V2-style constant-product AMM). This settles the
 * "swap through this pool" flow launched from a pool page's Swap button and
 * routed by the backend TiwiPoolAdapter (router === 'tiwi-pool').
 *
 * The pair's swap entry point differs from a Uniswap V2 router (no path array,
 * takes `tokenIn` instead), so this is a standalone executor rather than an
 * EVMDEXExecutor subclass:
 *
 *   approve(tokenIn → pair)                                    - Sign 1 (first time only)
 *   pair.swapExactTokensForTokens(tokenIn, amountIn, minOut, to, deadline) - Sign 2
 *
 * ERC20 <-> ERC20, same-chain, any EVM chain the pool lives on. The pool takes
 * its own LP fee (feeBps) inside the swap; no separate platform tax is charged
 * here.
 */

import { getAddress, encodeFunctionData, type Address } from 'viem';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';
import { getEVMWalletClient, getEVMPublicClient, ensureCorrectChain } from '../utils/wallet-helpers';
import { ensureTokenApproval } from '../services/approval-handler';
import { toSmallestUnit } from '../utils/amount-converter';

// Minimal TiwiLiquidityPair ABI (only what the executor needs).
const TIWI_PAIR_ABI = [
  {
    name: 'getReserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
  },
  { name: 'token0', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'token1', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    name: 'getAmountOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'reserveIn', type: 'uint256' },
      { name: 'reserveOut', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

// Wrapped-native (WETH/WBNB/…) ABI for native in/out support.
const WETH_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'wad', type: 'uint256' }], outputs: [] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

export class TiwiPoolExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    return route.router === 'tiwi-pool';
  }

  /** The pair contract IS the approval spender (it pulls tokenIn via transferFrom). */
  async getSpenderAddress(route: RouterRoute): Promise<string | null> {
    return route.raw?.pairAddress || null;
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, toToken, fromAmount, userAddress, recipientAddress, onStatusUpdate } = params;

    try {
      const chainId = fromToken.chainId;
      if (!chainId) {
        throw new SwapExecutionError('Missing chain for TIWI pool swap', SwapErrorCode.INVALID_ROUTE, route.router);
      }

      const pairRaw = route.raw?.pairAddress as string | undefined;
      if (!pairRaw) {
        throw new SwapExecutionError('Missing pool address on route', SwapErrorCode.INVALID_ROUTE, route.router);
      }
      const pair = getAddress(pairRaw) as Address;

      // Native in/out is handled by wrapping/unwrapping around the pair swap. The pair
      // itself only ever swaps the WRAPPED-native ERC20 (WETH/WBNB), whose address the
      // adapter put in route.raw.tokenIn / route.raw.wethAddress.
      const nativeIn = !!route.raw?.nativeIn;
      const nativeOut = !!route.raw?.nativeOut;
      const wethRaw = route.raw?.wethAddress as string | undefined;
      if ((nativeIn || nativeOut) && !wethRaw) {
        throw new SwapExecutionError('Missing wrapped-native address for native swap', SwapErrorCode.INVALID_ROUTE, route.router);
      }
      const weth = wethRaw ? (getAddress(wethRaw) as Address) : undefined;

      // On-chain ERC20 the pair pulls as input (WETH when native-in, else fromToken).
      const tokenIn = getAddress((route.raw?.tokenIn as string) || fromToken.address) as Address;
      // Where the pair sends output: for native-out, the signer receives WETH here and
      // we unwrap it to native afterwards; otherwise straight to the recipient.
      const recipient = getAddress(recipientAddress || userAddress) as Address;
      const swapTo = nativeOut ? (getAddress(userAddress) as Address) : recipient;

      onStatusUpdate?.({ stage: 'preparing', message: 'Preparing...' });
      await ensureCorrectChain(chainId);

      const walletClient = await getEVMWalletClient(chainId);
      const publicClient = getEVMPublicClient(chainId);

      const account = walletClient.account;
      if (!account) {
        throw new SwapExecutionError('Wallet account not available', SwapErrorCode.WALLET_NOT_CONNECTED, route.router);
      }

      // Amount in (smallest units). Prefer the route's fromToken.amount (what was quoted).
      const humanAmountIn = route.fromToken?.amount || fromAmount;
      const amountInSmallest = toSmallestUnit(humanAmountIn, fromToken.decimals!);
      const amountIn = BigInt(amountInSmallest);
      if (amountIn <= BigInt(0)) {
        throw new SwapExecutionError('Invalid swap amount', SwapErrorCode.INVALID_ROUTE, route.router);
      }

      // ── Native input: wrap native → WETH first (extra signature), then the pair
      //    pulls WETH like any ERC20. ──
      if (nativeIn && weth) {
        onStatusUpdate?.({ stage: 'signing', message: `Wrapping ${fromToken.symbol || 'native'}...` });
        const wrapTx = await walletClient.sendTransaction({
          account,
          to: weth,
          data: encodeFunctionData({ abi: WETH_ABI, functionName: 'deposit', args: [] }),
          value: amountIn,
        } as Parameters<typeof walletClient.sendTransaction>[0]);
        onStatusUpdate?.({ stage: 'confirming', message: 'Confirming wrap...', txHash: wrapTx });
        const wrapReceipt = await publicClient.waitForTransactionReceipt({ hash: wrapTx, timeout: 60000 });
        if (wrapReceipt.status === 'reverted') {
          throw new SwapExecutionError('Failed to wrap native token', SwapErrorCode.TRANSACTION_FAILED, route.router);
        }
      }

      // Approve the pair to pull tokenIn (the wrapped-native address when native-in).
      await ensureTokenApproval(
        tokenIn,
        userAddress,
        pair,
        amountInSmallest,
        chainId,
        (message) => onStatusUpdate?.({ stage: 'approving', message }),
      );

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 min

      // Determine the TRUE deliverable output by SIMULATING the real swap. This runs
      // the actual transferFrom - so for fee-on-transfer / taxed tokens (e.g. TWC) the
      // pool sees the post-tax amount and returns the real output. Using getAmountOut
      // on the full amountIn instead would over-estimate and make amountOutMin too high
      // → the pair reverts with INSUFFICIENT_OUTPUT. Retry a couple times to ride out
      // RPC lag in indexing the approval we just sent.
      onStatusUpdate?.({ stage: 'preparing', message: 'Getting latest quote...' });

      let expectedOut: bigint = BigInt(0);
      let simulated = false;
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const sim = await publicClient.simulateContract({
            account: getAddress(userAddress) as Address,
            address: pair,
            abi: TIWI_PAIR_ABI,
            functionName: 'swapExactTokensForTokens',
            args: [tokenIn, amountIn, BigInt(1), swapTo, deadline], // minOut=1 → returns the real output
          });
          expectedOut = sim.result as bigint;
          simulated = true;
          break;
        } catch (simErr: any) {
          const msg = simErr?.shortMessage || simErr?.message || '';
          // Approval may not be indexed yet - wait and retry.
          if (attempt < 2 && /allowance|TRANSFER_FROM_FAILED|insufficient/i.test(msg)) {
            await sleep(1500);
            continue;
          }
          console.warn('[TiwiPoolExecutor] Swap simulation failed, using reserve estimate:', msg);
          // Last-resort reserve estimate (accurate only for NON-taxed tokens).
          try {
            const [reserves, token0] = await Promise.all([
              publicClient.readContract({ address: pair, abi: TIWI_PAIR_ABI, functionName: 'getReserves' }) as Promise<readonly [bigint, bigint, number]>,
              publicClient.readContract({ address: pair, abi: TIWI_PAIR_ABI, functionName: 'token0' }) as Promise<Address>,
            ]);
            const zeroForOne = tokenIn.toLowerCase() === token0.toLowerCase();
            const reserveIn = zeroForOne ? BigInt(reserves[0]) : BigInt(reserves[1]);
            const reserveOut = zeroForOne ? BigInt(reserves[1]) : BigInt(reserves[0]);
            expectedOut = await publicClient.readContract({
              address: pair, abi: TIWI_PAIR_ABI, functionName: 'getAmountOut', args: [amountIn, reserveIn, reserveOut],
            }) as bigint;
          } catch {
            expectedOut = route.raw?.amountOut ? BigInt(route.raw.amountOut) : BigInt(0);
          }
          break;
        }
      }

      if (expectedOut <= BigInt(0)) {
        throw new SwapExecutionError(
          'Pool has insufficient liquidity for this swap.',
          SwapErrorCode.INVALID_ROUTE,
          route.router,
        );
      }

      // amountOutMin from slippage. When `simulated`, expectedOut is the true (post-tax)
      // output so a normal slippage buffer is safe. When we fell back to the reserve
      // estimate, widen the cushion so a taxed token still clears.
      const slippagePercent = params.slippage ?? (parseFloat(route.slippage || '0.5') || 0.5);
      let bpsNum = Math.max(0, Math.min(5000, Math.round(slippagePercent * 100)));
      if (!simulated) bpsNum = Math.max(bpsNum, 1500); // ≥15% cushion when un-simulated (unknown tax)
      const bps = BigInt(bpsNum);
      let amountOutMin = (expectedOut * (BigInt(10000) - bps)) / BigInt(10000);
      if (amountOutMin < BigInt(1)) amountOutMin = BigInt(1);

      const data = encodeFunctionData({
        abi: TIWI_PAIR_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [tokenIn, amountIn, amountOutMin, swapTo, deadline],
      });

      // For native-out we unwrap exactly the WETH the swap delivered - snapshot the
      // signer's WETH balance before the swap to measure the delta afterwards.
      let wethBefore = BigInt(0);
      if (nativeOut && weth) {
        try {
          wethBefore = await publicClient.readContract({
            address: weth, abi: WETH_ABI, functionName: 'balanceOf', args: [getAddress(userAddress) as Address],
          }) as bigint;
        } catch { /* best-effort; falls back to expectedOut below */ }
      }

      onStatusUpdate?.({ stage: 'signing', message: 'Confirming in wallet...' });

      // Gas estimate with a safe fallback.
      let gasLimit: bigint | undefined;
      try {
        const estimated = await publicClient.estimateGas({
          to: pair,
          data: data as `0x${string}`,
          account: account.address,
        });
        gasLimit = (estimated * BigInt(130)) / BigInt(100); // 30% buffer
      } catch (gasErr: any) {
        console.warn('[TiwiPoolExecutor] Gas estimation failed, using fallback:', gasErr?.message);
        gasLimit = BigInt(400_000);
      }

      const txHash = await walletClient.sendTransaction({
        account,
        to: pair,
        data: data as `0x${string}`,
        gas: gasLimit,
      } as Parameters<typeof walletClient.sendTransaction>[0]);

      onStatusUpdate?.({ stage: 'confirming', message: 'Reviewing...', txHash });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60000 });

      if (receipt.status === 'reverted') {
        throw new SwapExecutionError(
          `Transaction reverted (${txHash}). The pool price may have moved or liquidity is too thin - try again or reduce the amount.`,
          SwapErrorCode.TRANSACTION_FAILED,
          route.router,
        );
      }

      // ── Native output: unwrap the WETH the pair just delivered → native (extra
      //    signature). The swap sent WETH to the signer; withdraw the received delta. ──
      if (nativeOut && weth) {
        onStatusUpdate?.({ stage: 'signing', message: `Unwrapping to ${toToken.symbol || 'native'}...` });
        let unwrapAmount: bigint;
        try {
          const wethAfter = await publicClient.readContract({
            address: weth, abi: WETH_ABI, functionName: 'balanceOf', args: [getAddress(userAddress) as Address],
          }) as bigint;
          const delta = wethAfter - wethBefore;
          unwrapAmount = delta > BigInt(0) ? delta : expectedOut;
        } catch {
          unwrapAmount = expectedOut;
        }
        if (unwrapAmount > BigInt(0)) {
          const unwrapTx = await walletClient.sendTransaction({
            account,
            to: weth,
            data: encodeFunctionData({ abi: WETH_ABI, functionName: 'withdraw', args: [unwrapAmount] }),
          } as Parameters<typeof walletClient.sendTransaction>[0]);
          onStatusUpdate?.({ stage: 'confirming', message: 'Confirming unwrap...', txHash: unwrapTx });
          const unwrapReceipt = await publicClient.waitForTransactionReceipt({ hash: unwrapTx, timeout: 60000 });
          if (unwrapReceipt.status === 'reverted') {
            // Swap already succeeded; the user holds WETH. Surface a clear message
            // rather than failing the whole swap.
            console.warn('[TiwiPoolExecutor] Unwrap reverted - user holds wrapped native');
          }
        }
      }

      onStatusUpdate?.({ stage: 'completed', message: 'Success', txHash });

      return {
        success: true,
        txHash,
        receipt,
        actualToAmount: route.toToken?.amount,
      };
    } catch (error) {
      const swapError = createSwapError(error, SwapErrorCode.TRANSACTION_FAILED);
      onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(swapError), error: swapError });
      throw swapError;
    }
  }
}
