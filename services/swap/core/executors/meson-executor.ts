/**
 * Meson Executor — the non-CCTP stablecoin bridge rail (one signature, gasless fill).
 *
 * Flow (verified live 2026-07-14):
 *   1. Approve the source stablecoin → Meson contract (one-time; the relayer transferFroms via it).
 *   2. POST /api/v1/swap {from, to, amount, fromAddress, recipient} → { encoded, fee, signingRequest }.
 *   3. User signs (personal_sign) `encoded + fromAddress` — the Meson initiator signature.
 *   4. POST /api/v1/swap/{encoded} { fromAddress, recipient, signature } → Meson posts on the source
 *      (pulling via the allowance) and fills the destination. The user does NOTHING on the dest.
 *   5. Poll GET /api/v1/swap/{encoded} for the source deposit tx / final status.
 *
 * So the user signs once (plus a one-time approval). Destination may be any Meson chain incl.
 * Tron/Solana — the user only signs on the EVM source. INERT unless NEXT_PUBLIC_MESON_ENABLED.
 */
import { getAddress, parseUnits, type Address, type Hex } from 'viem';
import type { SwapRouterExecutor, SwapExecutionParams, SwapExecutionResult } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { getEVMWalletClient, ensureCorrectChain } from '../utils/wallet-helpers';
import { ensureTokenApproval } from '../services/approval-handler';
import { MESON_RELAYER_API, MESON_CONTRACT, isMesonSource } from '@/services/swap/core/config/meson-config';

const MESON_ENABLED = process.env.EXPO_PUBLIC_MESON_ENABLED === 'true';

async function mesonFetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${MESON_RELAYER_API}${path}`, init);
  const json = await res.json().catch(() => ({}));
  return json;
}

export class MesonExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    if (!MESON_ENABLED) return false;
    if (route.router !== 'meson') return false;
    if (route.fromToken.chainId === route.toToken.chainId) return false;
    if (!isMesonSource(route.fromToken.chainId)) return false; // v1: EVM source
    return true;
  }

  async getSpenderAddress(): Promise<string | null> {
    return MESON_CONTRACT;
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, userAddress, recipientAddress, walletClient, onStatusUpdate } = params;
    const fromChain = route.fromToken.chainId;
    const raw: any = route.raw || {};
    const from = raw.from as string;
    const to = raw.to as string;
    const amountHuman = raw.amountHuman as string;
    const recipient = recipientAddress || userAddress;

    if (!from || !to || !amountHuman) {
      return { success: false, txHash: '', error: new Error('Meson route missing swap params') };
    }

    try {
      const wallet = walletClient || (await getEVMWalletClient(fromChain));
      await ensureCorrectChain(fromChain);
      const user = getAddress(userAddress) as Address;
      const tokenIn = getAddress(fromToken.address) as Address;
      const amountUnits = parseUnits(amountHuman, fromToken.decimals || 6);

      // 1) Approve the source stable → Meson contract (one-time; relayer pulls via allowance).
      onStatusUpdate?.({ stage: 'approving', message: `Approving ${fromToken.symbol || 'token'} for Meson...` });
      await ensureTokenApproval(
        tokenIn, userAddress, MESON_CONTRACT, amountUnits.toString(), fromChain,
        (m: string) => onStatusUpdate?.({ stage: 'approving', message: m }), wallet,
      );

      // 2) Fresh quote (now that allowance exists, Meson returns the full swap data).
      onStatusUpdate?.({ stage: 'preparing', message: 'Preparing Meson bridge...' });
      const quote = await mesonFetch('/swap', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from, to, amount: amountHuman, fromAddress: user, recipient }),
      });
      if (quote?.error) {
        throw new Error(`Meson quote failed: ${quote.error.message || 'unknown'}`);
      }
      const result = quote.result || quote;
      const encoded: string = result.encoded;
      if (!encoded) throw new Error('Meson returned no encoded swap');

      // 3) Sign the Meson initiator signature = personal_sign(encoded + fromAddress).
      onStatusUpdate?.({ stage: 'signing', message: 'Signing to authorize the bridge...' });
      const signData = (encoded + user.slice(2).toLowerCase()) as Hex;
      const signature = await wallet.signMessage({
        account: wallet.account ?? user,
        message: { raw: signData },
      });

      // 4) Submit — Meson posts on source (via allowance) and fills the destination.
      onStatusUpdate?.({ stage: 'submitting', message: 'Submitting to Meson relayer...' });
      const submit = await mesonFetch(`/swap/${encoded}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fromAddress: user, recipient, signature }),
      });
      if (submit?.error) {
        throw new Error(`Meson submit failed: ${submit.error.message || 'unknown'}`);
      }

      // 5) Poll briefly for the source deposit tx (delivery is async; don't block on the dest).
      let srcTx = '';
      for (let i = 0; i < 6; i++) {
        const st = await mesonFetch(`/swap/${encoded}`);
        const s = st.result || st;
        srcTx = s?.srcHash || s?.depositHash || s?.postingHash || srcTx;
        const status = String(s?.status || '').toUpperCase();
        if (srcTx || /POSTED|BONDED|LOCKED|RELEASED|EXECUTED|DONE/.test(status)) break;
        await new Promise((r) => setTimeout(r, 3000));
      }

      onStatusUpdate?.({
        stage: 'completed',
        message: `Bridging ${fromToken.symbol} via Meson — funds arrive on the destination in ~1–2 minutes.`,
        txHash: srcTx || undefined,
      });
      return { success: true, txHash: srcTx || encoded, txHashes: srcTx ? [srcTx] : [], receipt: undefined };
    } catch (error: any) {
      onStatusUpdate?.({ stage: 'failed', message: error?.message || 'Meson bridge failed', error });
      return { success: false, txHash: '', error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
