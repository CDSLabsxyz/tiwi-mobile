/**
 * OpenOcean Executor (standalone)
 *
 * Executes OpenOcean aggregator routes (Sei / chainId 1329). The backend
 * OpenOceanAdapter builds the executable tx SERVER-SIDE and stores it in
 * `route.raw.tx` ({to,data,value}), so this executor never calls OpenOcean
 * (no browser CORS). It just:
 *   1. ensures the wallet is on the right chain,
 *   2. approves the OpenOcean spender for ERC-20 inputs (native inputs skip),
 *   3. collects the Tiwi protocol tax (same as other EVM executors),
 *   4. sends the pre-built swap tx.
 *
 * NOTE: this does NOT extend EVMDEXExecutor — that base is hard-wired for
 * Uniswap/Pancake V2 path swaps (it requires route.raw.path + getAmountsOut),
 * which an aggregator's pre-encoded calldata doesn't have.
 */

import { encodeFunctionData, erc20Abi, type Address, type Hex, type Hash } from 'viem';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { ensureCorrectChain, getEVMPublicClient } from '../utils/wallet-helpers';
import { collectEvmTax } from '../utils/evm-tax-helper';
import { getStandardApprovalAmount, resolveSpendAmountWei } from '../utils/approval-amounts';

const OPENOCEAN_EXCHANGE = '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64';
const ZERO = '0x0000000000000000000000000000000000000000';
const EEE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function isNativeAddr(address: string): boolean {
  const a = (address || '').toLowerCase();
  return !a || a === 'native' || a === ZERO || a === EEE;
}

export class OpenOceanExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    return route.router === 'openocean';
  }

  async getSpenderAddress(route: RouterRoute): Promise<string | null> {
    if (route.router !== 'openocean') return null;
    return route.raw?.routerAddress || route.raw?.tx?.to || OPENOCEAN_EXCHANGE;
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, userAddress, onStatusUpdate, walletClient } = params;

    if (route.router !== 'openocean') {
      throw new SwapExecutionError('Invalid route provided', SwapErrorCode.INVALID_ROUTE, 'openocean');
    }
    const tx = route.raw?.tx;
    if (!tx?.to || !tx?.data) {
      throw new SwapExecutionError(
        'OpenOcean route is missing executable tx data — reconnect the wallet and retry.',
        SwapErrorCode.INVALID_ROUTE,
        'openocean',
      );
    }
    if (!walletClient) {
      throw new SwapExecutionError('Wallet client is required for execution', SwapErrorCode.WALLET_NOT_CONNECTED, 'openocean');
    }
    if (!userAddress) {
      throw new SwapExecutionError('User address is required', SwapErrorCode.WALLET_NOT_CONNECTED, 'openocean');
    }

    const chainId = route.fromToken.chainId;

    onStatusUpdate?.({ stage: 'preparing', message: 'Preparing swap...' });
    await ensureCorrectChain(chainId);

    // ── Approval (ERC-20 inputs only) ──
    const fromAddr = route.fromToken.address;
    if (!isNativeAddr(fromAddr)) {
      const spender = (route.raw?.routerAddress || tx.to) as Address;
      const token = fromAddr as Address;
      // amountIn is always the user-entered amount — never the wallet balance/allowance.
      const neededWei = resolveSpendAmountWei(route.fromToken.amount || '0', route.fromToken.decimals || 18);

      let allowance = BigInt(0);
      try {
        const publicClient = getEVMPublicClient(chainId);
        allowance = (await publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [userAddress as Address, spender],
        })) as bigint;
      } catch {
        // If the allowance read fails, fall through and attempt an approval —
        // the swap tx would revert anyway without one.
      }

      if (allowance < neededWei) {
        onStatusUpdate?.({ stage: 'approving', message: 'Approving token...' });
        // Approve max/infinite so this (token, spender) pair is only ever signed once.
        // The swap still moves exactly `neededWei` (bounded by the pre-built swap calldata).
        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender, getStandardApprovalAmount()],
        });
        const approveHash = await walletClient.sendTransaction({
          to: token,
          data: approveData,
          value: BigInt(0),
        } as any);
        onStatusUpdate?.({ stage: 'approving', message: 'Confirming approval...', txHash: approveHash });
        try {
          const publicClient = getEVMPublicClient(chainId);
          await publicClient.waitForTransactionReceipt({ hash: approveHash as Hash, timeout: 120000 });
        } catch {
          // Non-fatal: proceed; the swap send will surface a real revert if the
          // approval genuinely didn't land.
        }
      }
    }

    // ── Tiwi protocol tax (mirrors other EVM executors) ──
    try {
      const { taxCollected, taxAmount } = await collectEvmTax(params, 'OpenOceanExecutor', onStatusUpdate);
      if (taxCollected) console.log(`[OpenOceanExecutor] Tax of ${taxAmount} collected`);
    } catch (e) {
      console.warn('[OpenOceanExecutor] tax collection skipped:', e instanceof Error ? e.message : e);
    }

    // ── Send the pre-built swap tx ──
    onStatusUpdate?.({ stage: 'signing', message: 'Confirming swap in your wallet...' });
    const hash = await walletClient.sendTransaction({
      to: tx.to as Address,
      data: tx.data as Hex,
      value: tx.value ? BigInt(tx.value) : BigInt(0),
    } as any);

    onStatusUpdate?.({ stage: 'confirming', message: 'Processing swap...', txHash: hash });

    return {
      success: true,
      txHash: hash,
      txHashes: [hash],
    };
  }
}
