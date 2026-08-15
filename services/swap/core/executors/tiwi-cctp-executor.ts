/**
 * TIWI CCTP Executor - source side of the CCTP any-to-any rail (relayer-driven, one signature).
 *
 * For a cross-chain 'tiwi-cctp' route it does the WHOLE source side, then hands off to the relayer:
 *   Leg 1 (only if source token isn't already USDC): swap source token → USDC on the source chain
 *          via the existing swap engine, and read the actual USDC received (balance delta).
 *   Burn:  approve USDC → TokenMessengerV2, then depositForBurn(USDC → dest domain) with the
 *          mintRecipient set to OUR RELAYER. Circle burns the USDC here and will mint it to the
 *          relayer on the destination.
 *   Record: POST the transfer to /api/v1/relayer/cctp/record so the relayer polls the attestation,
 *          calls receiveMessage on the destination, swaps USDC → dest token, and delivers to the
 *          user. The user signs NOTHING on the destination chain.
 *
 * Finality (Fast vs Standard), the maxFee, and the dest token/minOut all come from the quote's
 * `raw.cctp` (computed server-side in route-service via the Circle fee API).
 *
 * INERT unless NEXT_PUBLIC_CCTP_ENABLED === 'true' (needs a funded, running relayer). Until then
 * canHandle returns false, so the useSwapQuote executable-alt guard falls back to an aggregator.
 */
import { getAddress, parseUnits, type Address, type Hex } from 'viem';
import type { SwapRouterExecutor, SwapExecutionParams, SwapExecutionResult } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { getEVMWalletClient, getEVMPublicClient, ensureCorrectChain } from '../utils/wallet-helpers';
import {
  getCctpChain, isCctpChain, encodeRecipientBytes32,
} from '@/services/swap/core/contracts/cctp';
import { cctpSourceAdapterFor } from './cctp';
import { resolveCctpMintRecipient } from './cctp/mint-recipient';
import { apiUrl } from '@/services/swap/core/platform/api-base';

const ZERO = '0x0000000000000000000000000000000000000000';
const NATIVE_ADDRESSES = [ZERO, '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'native'];
const isNative = (a?: string): boolean => !a || NATIVE_ADDRESSES.includes(a.toLowerCase());

const CCTP_ENABLED = process.env.EXPO_PUBLIC_CCTP_ENABLED === 'true';

const ERC20_BALANCE_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

function applySlippage(expected: bigint, slippagePercent: number | undefined): bigint {
  let pct = slippagePercent ?? 0.5;
  if (!isFinite(pct) || pct <= 0) pct = 0.5;
  if (pct > 50) pct = 50;
  const bps = BigInt(Math.round(pct * 100));
  return (expected * (BigInt(10000) - bps)) / BigInt(10000);
}

export class TiwiCctpExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    if (!CCTP_ENABLED) return false;                     // inert until the relayer is live
    if (route.router !== 'tiwi-cctp') return false;      // only our CCTP routes
    const fromChain = route.fromToken.chainId;
    const toChain = route.toToken.chainId;
    if (fromChain === toChain) return false;             // cross-chain only
    if (!isCctpChain(fromChain) || !isCctpChain(toChain)) return false;
    const destVm = getCctpChain(toChain)?.vm;            // relayer identity is per destination VM
    if (!destVm || !resolveCctpMintRecipient(destVm)) return false; // no dest relayer → can't deliver
    return true;
  }

  async getSpenderAddress(route: RouterRoute): Promise<string | null> {
    // Approval target is the source TokenMessengerV2 (for the USDC burn). Leg-1 handles its own.
    return getCctpChain(route.fromToken.chainId)?.tokenMessenger ?? null;
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, toToken, fromAmount, userAddress, recipientAddress, walletClient, onStatusUpdate, slippage } = params;
    const fromChain = route.fromToken.chainId;
    const toChain = route.toToken.chainId;
    const src = getCctpChain(fromChain);
    const dst = getCctpChain(toChain);
    const finality = (route.raw as any)?.cctp?.finality;

    if (!src || !dst) return { success: false, txHash: '', error: new Error('Not a CCTP chain pair') };
    // The relayer's mintRecipient is resolved in the DESTINATION chain's address form (EVM address,
    // or the relayer's USDC ATA for a Solana dest - CCTP mints into a token account there).
    const mintRecipient = resolveCctpMintRecipient(dst.vm);
    if (!mintRecipient) return { success: false, txHash: '', error: new Error('CCTP relayer not configured for destination chain') };
    if (!finality) return { success: false, txHash: '', error: new Error('CCTP route missing finality selection') };

    // Solana SOURCE (Solana→EVM): the entire source side (Jupiter swap → USDC + deposit_for_burn)
    // runs on Solana with the user's Solana wallet - a different signer/tx model than EVM. Delegated
    // to a dedicated path; the EVM source flow below is structurally untouched. Imports stay lazy so
    // the live EVM→Solana path never loads Solana deps unless a Solana-source swap runs.
    if (src.vm === 'svm') {
      return this.executeSvmSource(params, { src, dst, mintRecipient, finality });
    }

    const allTxHashes: string[] = [];
    try {
      const wallet = walletClient || (await getEVMWalletClient(fromChain));
      await ensureCorrectChain(fromChain);
      const publicClient = getEVMPublicClient(fromChain);
      const usdcAddr = getAddress(src.usdc) as Address;
      const user = getAddress(userAddress) as Address;

      // ───────── Leg 1: source token → USDC (skip if already USDC) ─────────
      let usdcAmount: bigint;
      if (isNative(fromToken.address) || getAddress(fromToken.address) !== usdcAddr) {
        onStatusUpdate?.({ stage: 'preparing', message: `Step 1/2: Swapping ${fromToken.symbol || 'token'} → USDC...` });
        const { swapExecutor } = await import('../index');
        const { fetchRoute } = await import('@/services/swap/core/platform/route-api');

        const before = (await publicClient.readContract({
          address: usdcAddr, abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', args: [user],
        })) as bigint;

        const leg1Resp = await fetchRoute({
          fromToken: { chainId: fromChain, address: fromToken.address, symbol: fromToken.symbol, decimals: fromToken.decimals },
          toToken: { chainId: fromChain, address: src.usdc, symbol: 'USDC', decimals: 6 },
          fromAmount, slippage, fromAddress: userAddress, recipient: userAddress,
        } as any);
        if (!leg1Resp?.route) throw new Error(`No route for ${fromToken.symbol} → USDC on source chain`);

        const leg1 = await swapExecutor.execute({
          route: leg1Resp.route, fromToken,
          toToken: { chainId: fromChain, address: src.usdc, symbol: 'USDC', decimals: 6 } as any,
          fromAmount, userAddress, recipientAddress: userAddress, walletClient, slippage,
          onStatusUpdate: (s) => onStatusUpdate?.({ ...s, message: `Step 1/2: ${s.message}` }),
        });
        if (!leg1.success) return { success: false, txHash: leg1.txHash || '', txHashes: allTxHashes, error: leg1.error || new Error('Source swap to USDC failed') };
        if (leg1.txHash) allTxHashes.push(leg1.txHash);

        const after = (await publicClient.readContract({
          address: usdcAddr, abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', args: [user],
        })) as bigint;
        usdcAmount = after - before;
        if (usdcAmount <= BigInt(0)) return { success: false, txHash: leg1.txHash || '', txHashes: allTxHashes, error: new Error('Source swap produced no USDC') };
      } else {
        usdcAmount = parseUnits(fromAmount, 6);
      }

      // ───────── Approve + burn via the source VM adapter ─────────
      // mintRecipient is the relayer's address on the DESTINATION chain, encoded for the dest VM.
      const sourceAdapter = cctpSourceAdapterFor(src.vm);
      const mintRecipientBytes32 = encodeRecipientBytes32(dst.vm, mintRecipient) as Hex;
      const { srcTxHash: burnTx, receipt } = await sourceAdapter.burn({
        fromChainId: fromChain,
        userAddress,
        usdcAmount,
        destDomain: dst.domain,
        mintRecipientBytes32,
        maxFee: BigInt(finality.maxFeeUnits || '0'),
        minFinality: Number(finality.finalityThreshold || 2000),
        walletClient: wallet,
        onStatusUpdate,
      });
      allTxHashes.push(burnTx);

      // ───────── Hand off to the relayer ─────────
      const recipient = getAddress(recipientAddress || userAddress);
      const expectedOut = parseUnits(route.toToken.amount || '0', toToken.decimals || 6);
      const minOut = applySlippage(expectedOut, slippage ?? (route.slippage ? parseFloat(route.slippage) : undefined));
      try {
        await fetch(apiUrl('/api/v1/relayer/cctp/record'), {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            srcChainId: fromChain, srcTxHash: burnTx, destChainId: toChain,
            recipient, destToken: toToken.address, destTokenDecimals: toToken.decimals,
            minOut: minOut.toString(), amountUsdc: usdcAmount.toString(),
            finalityMode: finality.mode,
          }),
        });
      } catch (e) {
        // Non-fatal: the burn succeeded and is recoverable from the tx hash; log for support.
        console.error('[TiwiCctpExecutor] Failed to record CCTP transfer (burn already sent):', e);
      }

      const eta = finality.mode === 'fast' ? '~1 minute' : '~15 minutes';
      onStatusUpdate?.({
        stage: 'completed',
        message: `Bridging USDC to ${toToken.symbol} via Circle CCTP - the relayer will deliver on ${toChain} in ${eta}.`,
        txHash: burnTx,
      });
      return { success: true, txHash: burnTx, txHashes: allTxHashes, receipt };
    } catch (error: any) {
      onStatusUpdate?.({ stage: 'failed', message: error?.message || 'CCTP transfer failed', error });
      return { success: false, txHash: allTxHashes[allTxHashes.length - 1] || '', txHashes: allTxHashes, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * Solana SOURCE side (Solana→EVM): Jupiter swap → USDC on Solana, then deposit_for_burn, signed by
   * the user's browser Solana wallet. The relayer mints on the EVM destination (existing evm dest
   * adapter). depositForBurn mechanics are proven on-chain; the browser-wallet SIGNING path is
   * verified only in-app (not headless) - test with a real Solana wallet before wide use.
   */
  private async executeSvmSource(
    params: SwapExecutionParams,
    ctx: { src: any; dst: any; mintRecipient: string; finality: any },
  ): Promise<SwapExecutionResult> {
    const { route, fromToken, toToken, fromAmount, userAddress, recipientAddress, onStatusUpdate } = params;
    const { src, dst, mintRecipient, finality } = ctx;
    const fromChain = route.fromToken.chainId;
    const toChain = route.toToken.chainId;
    try {
      const { getSolanaWallet, getSolanaConnection } = await import('../utils/wallet-helpers');
      const { svmSwapToUsdcWithWallet, svmDepositForBurnWithWallet } = await import('./cctp/svm-source-adapter');
      const { PublicKey } = await import('@solana/web3.js');
      const wallet = await getSolanaWallet();
      const connection = await getSolanaConnection();
      if (!wallet?.publicKey) throw new Error('Please connect your Solana wallet first');

      const usdcMint = new PublicKey(src.usdc);
      // Native SOL arrives with an EVM-style zero / native marker address, not a base58 mint. Map it
      // to the wSOL mint so the Jupiter swap (wrapAndUnwrapSol) wraps native SOL → USDC.
      const NATIVE_SOL = new Set(['', 'native', '0x0000000000000000000000000000000000000000', '11111111111111111111111111111111', 'so11111111111111111111111111111111111111112']);
      const isNativeSol = NATIVE_SOL.has(String(fromToken.address).toLowerCase());
      const fromMint = new PublicKey(isNativeSol ? 'So11111111111111111111111111111111111111112' : fromToken.address);

      // Leg 1: source token → USDC on Solana (skip if already USDC).
      onStatusUpdate?.({ stage: 'preparing', message: `Step 1/2: Swapping ${fromToken.symbol || 'token'} → USDC...` });
      const amountIn = parseUnits(fromAmount, isNativeSol ? 9 : (fromToken.decimals || 6));
      const usdcAmount = await svmSwapToUsdcWithWallet(connection, wallet, fromMint, amountIn, usdcMint);
      if (usdcAmount <= BigInt(0)) return { success: false, txHash: '', error: new Error('Source swap produced no USDC') };

      // Burn: deposit_for_burn to the EVM destination domain; relayer mints on dest.
      onStatusUpdate?.({ stage: 'signing', message: 'Step 2/2: Confirming the cross-chain burn in your wallet...' });
      const mintRecipientBytes32 = encodeRecipientBytes32(dst.vm, mintRecipient);
      const { srcTxHash } = await svmDepositForBurnWithWallet(connection, wallet, {
        amount: usdcAmount,
        destinationDomain: dst.domain,
        mintRecipientBytes32,
        maxFee: BigInt(finality.maxFeeUnits || '0'),
        minFinality: Number(finality.finalityThreshold || 2000),
      }, usdcMint);

      // Hand off to the relayer (it mints + delivers on the EVM destination).
      try {
        await fetch(apiUrl('/api/v1/relayer/cctp/record'), {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            srcChainId: fromChain, srcTxHash, destChainId: toChain,
            recipient: recipientAddress || userAddress, destToken: toToken.address, destTokenDecimals: toToken.decimals,
            minOut: '0', amountUsdc: usdcAmount.toString(), finalityMode: finality.mode,
          }),
        });
      } catch (e) {
        console.error('[TiwiCctpExecutor] Failed to record Solana-source CCTP transfer (burn already sent):', e);
      }

      const eta = finality.mode === 'fast' ? '~1 minute' : '~15 minutes';
      onStatusUpdate?.({ stage: 'completed', message: `Bridging USDC to ${toToken.symbol} via Circle CCTP - the relayer will deliver on ${toChain} in ${eta}.`, txHash: srcTxHash });
      return { success: true, txHash: srcTxHash };
    } catch (error: any) {
      onStatusUpdate?.({ stage: 'failed', message: error?.message || 'Solana-source CCTP transfer failed', error });
      return { success: false, txHash: '', error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
