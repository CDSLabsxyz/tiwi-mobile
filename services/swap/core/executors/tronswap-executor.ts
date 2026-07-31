/**
 * TronSwap Executor
 * 
 * Executes swaps using TronSwap (SunSwap V2) on TRON.
 */

import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';
import { RouterRoute } from '@/services/swap/core/router-types';

// SunSwap V2 Router
const TRONSWAP_ROUTER_ADDRESS = 'TKzxdSv2FZKQrEqkKVgp5DcwEXBEKMg2Ax';

/**
 * True when an address represents native TRX (not a TRC20). The app can carry
 * native TRX as any of several placeholders depending on the code path, so we
 * check them all case-insensitively. WTRX is intentionally NOT native — it's a
 * TRC20 and must go through the token approve path.
 */
function isNativeTrx(address?: string): boolean {
  if (!address) return true;
  const a = address.toLowerCase();
  return (
    a === '0x0000000000000000000000000000000000000000' ||
    a === 'native' ||
    a === 't9yd14nj9j7xab4dbgeix9h8unkkhxuwwb' // TronWeb native-TRX placeholder
  );
}

/** A swap call described for read-only Energy estimation. */
interface EnergyPlan {
  functionSelector: string;
  parameters: Array<{ type: string; value: unknown }>;
  /** Native TRX sent with the call, in sun (0 for token→token). */
  callValueSun: number;
}

/**
 * Best-effort pre-flight Energy check.
 *
 * TRON charges "Energy" for contract calls. With no staked Energy the network
 * BURNS TRX to pay for it, and a failed "Out of Energy" tx STILL consumes the
 * burned TRX — so a doomed swap costs the user real money (we saw a wallet lose
 * ~9.6 TRX this way). We estimate the Energy via a read-only triggerConstantContract,
 * compare it against the wallet's staked Energy + burnable TRX, and abort with a
 * clear message BEFORE broadcasting when it can't be afforded.
 *
 * This is intentionally best-effort: any estimation problem (RPC hiccup, a
 * token swap that reverts read-only because it isn't approved yet) is swallowed
 * so we NEVER block a swap that might otherwise succeed.
 */
async function assertCanAffordEnergy(
  tronWeb: any,
  ownerAddress: string,
  plan: EnergyPlan,
): Promise<void> {
  let energyNeeded = 0;
  let availableEnergy = 0;
  let energyFeeSun = 100; // chain default: 100 sun per Energy
  let balanceSun = 0;
  try {
    const est = await tronWeb.transactionBuilder.triggerConstantContract(
      TRONSWAP_ROUTER_ADDRESS,
      plan.functionSelector,
      { callValue: plan.callValueSun },
      plan.parameters,
      ownerAddress,
    );
    // If the read-only call itself reverts, the estimate isn't trustworthy — skip.
    if (!est?.result?.result) return;
    energyNeeded = Number(est.energy_used || 0);
    if (!energyNeeded) return;

    const resources = await tronWeb.trx.getAccountResources(ownerAddress);
    availableEnergy = Math.max(
      0,
      Number(resources?.EnergyLimit || 0) - Number(resources?.EnergyUsed || 0),
    );

    const chainParams = await tronWeb.trx.getChainParameters();
    const fee = Array.isArray(chainParams)
      ? chainParams.find((p: any) => p?.key === 'getEnergyFee')
      : null;
    if (fee?.value) energyFeeSun = Number(fee.value);

    balanceSun = Number(await tronWeb.trx.getBalance(ownerAddress));
  } catch {
    return; // estimation unavailable → don't block
  }

  // 20% headroom — real execution runs a little above the constant-call estimate.
  const energyToBuy = Math.max(0, Math.ceil(energyNeeded * 1.2) - availableEnergy);
  const burnSun = energyToBuy * energyFeeSun;
  // The native-TRX amount is locked in the same tx, so it counts against balance.
  const requiredSun = burnSun + plan.callValueSun;
  if (balanceSun >= requiredSun) return; // affordable

  // The message must avoid words formatErrorMessage flattens ("insufficient",
  // "not enough balance", "gas", "route"…) and stay < 180 chars so it shows
  // verbatim. "Energy"/"needs" are safe.
  const trx = (sun: number) => (sun / 1e6).toFixed(2);
  throw new SwapExecutionError(
    `This swap needs about ${trx(burnSun)} TRX of TRON Energy, but this wallet holds ${trx(balanceSun)} TRX. ` +
      `Top up TRX or stake TRX for Energy, then try again.`,
    SwapErrorCode.INSUFFICIENT_BALANCE,
    'tronswap',
  );
}

/**
 * TronSwap Executor Implementation
 */
export class TronSwapExecutor implements SwapRouterExecutor {

    canHandle(route: RouterRoute): boolean {
        return route.router === 'tronswap';
    }

    async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, userAddress, onStatusUpdate, walletClient } = params;

        try {
            // Prefer an injected TronWeb signer (internal/local wallet, built by
            // createInternalTronSigner); fall back to a TronLink-style
            // window.tronWeb for external browser-extension wallets.
            const injectedTronWeb = walletClient?.tronWeb;
            const tronWeb = injectedTronWeb
                || (typeof window !== 'undefined' ? (window as any).tronWeb : undefined);

            if (!tronWeb) {
                throw new SwapExecutionError(
                    'TRON wallet not connected. Connect TronLink or unlock your internal wallet.',
                    SwapErrorCode.WALLET_NOT_CONNECTED,
                    'tronswap'
                );
            }

            // Validate address
            if (!userAddress) {
                throw new SwapExecutionError('User address required', SwapErrorCode.WALLET_NOT_CONNECTED, 'tronswap');
            }

            onStatusUpdate?.({ stage: 'preparing', message: 'Preparing TronSwap transaction...' });

            const {
                path,
                amountIn,
                amountOutMin,
                deadline
            } = route.raw;

            // Determine method based on tokens (TRX involved?)
            // IMPORTANT: the deployed SunSwap V2 router keeps the UniswapV2 *ETH*
            // naming — it exposes swapExactETHForTokens / swapExactTokensForETH,
            // NOT ...TRX... variants. Calling a ...TRX... name yields `undefined`
            // and the swap throws (previously surfaced as a misleading "No route
            // found"). "ETH" here means native TRX. Verified against the on-chain ABI.
            // Available: swapExactETHForTokens, swapExactTokensForETH, swapExactTokensForTokens.

            // Helper logic for token execution
            let txId = '';

            const routerContract = await tronWeb.contract().at(TRONSWAP_ROUTER_ADDRESS);

            const fromNative = isNativeTrx(route.fromToken.address);
            const toNative = isNativeTrx(route.toToken.address);

            // Pre-flight: make sure the wallet can actually pay the Energy for this
            // swap before broadcasting (a failed "Out of Energy" tx still burns TRX).
            const energyPlan: EnergyPlan = fromNative
                ? {
                    functionSelector: 'swapExactETHForTokens(uint256,address[],address,uint256)',
                    parameters: [
                        { type: 'uint256', value: amountOutMin },
                        { type: 'address[]', value: path },
                        { type: 'address', value: userAddress },
                        { type: 'uint256', value: deadline },
                    ],
                    callValueSun: Number(amountIn),
                }
                : {
                    functionSelector: toNative
                        ? 'swapExactTokensForETH(uint256,uint256,address[],address,uint256)'
                        : 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
                    parameters: [
                        { type: 'uint256', value: amountIn },
                        { type: 'uint256', value: amountOutMin },
                        { type: 'address[]', value: path },
                        { type: 'address', value: userAddress },
                        { type: 'uint256', value: deadline },
                    ],
                    callValueSun: 0,
                };
            onStatusUpdate?.({ stage: 'preparing', message: 'Checking TRON Energy…' });
            await assertCanAffordEnergy(tronWeb, userAddress, energyPlan);

            // If input is native TRX (mapped to WTRX in path but passed as call value):
            if (fromNative) {
                // swapExactETHForTokens(amountOutMin, path, to, deadline) — "ETH" = native TRX
                txId = await routerContract.swapExactETHForTokens(
                    amountOutMin,
                    path,
                    userAddress,
                    deadline
                ).send({
                    callValue: amountIn,
                    shouldPollResponse: false
                });
            } else if (toNative) {
                // swapExactTokensForETH(amountIn, amountOutMin, path, to, deadline) — "ETH" = native TRX

                // First approve
                const tokenAddress = path[0];
                const tokenContract = await tronWeb.contract().at(tokenAddress);

                // Attempt approve (might be redundant if already approved, usually check allowance first)
                try {
                    // Check allowance first to be polite
                    // const allowance = await tokenContract.allowance(userAddress, TRONSWAP_ROUTER_ADDRESS).call();
                    // if (allowance < amountIn) await tokenContract.approve(TRONSWAP_ROUTER_ADDRESS, amountIn).send();
                    // Just approve for now as it's safer for MVP
                    await tokenContract.approve(TRONSWAP_ROUTER_ADDRESS, amountIn).send();
                } catch (e) {
                    console.warn('Approval failed or skipped', e);
                }

                txId = await routerContract.swapExactTokensForETH(
                    amountIn,
                    amountOutMin,
                    path,
                    userAddress,
                    deadline
                ).send({
                    shouldPollResponse: false
                });
            } else {
                // Token to Token
                const tokenAddress = path[0];
                const tokenContract = await tronWeb.contract().at(tokenAddress);
                try {
                    await tokenContract.approve(TRONSWAP_ROUTER_ADDRESS, amountIn).send();
                } catch (e) {
                    console.warn('Approval failed or skipped', e);
                }

                txId = await routerContract.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    path,
                    userAddress,
                    deadline
                ).send({
                    shouldPollResponse: false
                });
            }

            return {
                success: true,
                txHash: txId
            };

        } catch (error: any) {
            console.error('[TronSwapExecutor] Execution failed:', error);
            const swapError = new SwapExecutionError(
                error.message || 'Swap failed',
                SwapErrorCode.TRANSACTION_FAILED,
                'tronswap',
                error
            );
            throw swapError;
        }
    }
}
