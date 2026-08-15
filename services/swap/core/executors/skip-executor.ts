/**
 * Skip Executor - Cosmos / IBC swaps.
 *
 * The Skip router (lib/backend/routers/adapters/skip-adapter.ts) can QUOTE any
 * Cosmos-SDK pair (dYdX, Neutron, Osmosis, Celestia, …), but a quote is not
 * executable on its own. This executor turns a Skip quote into a signed,
 * broadcast Cosmos transaction:
 *
 *   1. Derive one user address per chain the route touches (all standard
 *      secp256k1 Cosmos chains share the account - we re-encode the signer's
 *      source address to each chain's bech32 prefix; see cosmos-chains.ts).
 *   2. Ask Skip's /v2/fungible/msgs (via our server proxy) for the actual
 *      Cosmos messages, given the route's operations + that address list.
 *   3. Sign & broadcast the source-chain transaction with the internal wallet's
 *      OfflineDirectSigner (or an external Keplr/Leap signer). IBC relayers /
 *      Skip's smart-relay deliver the destination leg.
 *
 * Scope: single-transaction Cosmos routes (`txs_required: 1`), which covers all
 * cross-chain IBC swaps - the source leg is one MsgTransfer whose PFM/IBC-hooks
 * memo carries any downstream swap. Multi-transaction routes and EVM/SVM legs
 * throw an honest, specific error rather than silently failing.
 *
 * Injective (eth_secp256k1 / Ethermint) has a DEDICATED path (`executeInjective`)
 * that uses `@injectivelabs/sdk-ts` instead of cosmjs, and DOES support same-chain
 * wasm (MsgExecuteContract) DEX swaps in addition to IBC - for both internal and
 * external (Keplr/Leap) wallets. See injective-msg.ts / injective-broadcast.ts.
 */

import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError } from '../utils/error-handler';
import { getCosmosWallet } from '../utils/wallet-helpers';
import { getCosmosChain, reEncodeBech32 } from '@/services/swap/core/utils/cosmos-chains';
import { buildInjectiveMsgs } from './injective-msg';
import { broadcastInjectiveInternal, broadcastInjectiveExternal } from './injective-broadcast';
import { apiOrigin, apiUrl } from '@/services/swap/core/platform/api-base';

/** Internal-wallet Injective signer material handed in via params.walletClient. */
interface InternalInjectiveWalletClient {
  injective: true;
  injectivePrivateKey: string;
  injectiveAddress: string;
}

function isInternalInjectiveWalletClient(wc: any): wc is InternalInjectiveWalletClient {
  return !!wc && typeof wc === 'object' && wc.injective === true && 'injectivePrivateKey' in wc;
}

/** Injective's canonical chainId (eth_secp256k1 - handled outside cosmjs). */
const INJECTIVE_CHAIN_ID = 8000001;

// Skip/IBC chain-id (string) → our canonical numeric chainId. Mirrors
// CANONICAL_TO_SKIP_CHAIN_ID in skip-adapter.ts (kept local to avoid importing a
// server module into client code - keep the two in sync).
const IBC_CHAIN_ID_TO_CANONICAL: Record<string, number> = {
  'cosmoshub-4': 118,
  'osmosis-1': 249339,
  'injective-1': 8000001,
  'thorchain-mainnet-v1': 8000002,
  'juno-1': 8000003,
  'stride-1': 8000004,
  'dydx-mainnet-1': 8000005,
  'kaiyo-1': 8000006,
  'secret-4': 8000007,
  celestia: 8000008,
  'archway-1': 8000009,
  'ssc-1': 8000010,
  'neutron-1': 8000011,
  'cataclysm-1': 8000012,
};

// Per-chain RPC endpoints + gas price for broadcasting. Values mirror
// COSMOS_MULTISEND_CONFIG (lib/wallet/utils/multi-send-cosmos.ts) - keep in sync.
const COSMOS_EXEC_CONFIG: Record<number, { registryName: string; gasPrice: string; extraRpcs?: string[] }> = {
  118: { registryName: 'cosmoshub', gasPrice: '0.025uatom', extraRpcs: ['https://cosmos-rpc.publicnode.com:443'] },
  249339: { registryName: 'osmosis', gasPrice: '0.025uosmo', extraRpcs: ['https://osmosis-rpc.publicnode.com:443'] },
  8000003: { registryName: 'juno', gasPrice: '0.075ujuno' },
  8000004: { registryName: 'stride', gasPrice: '0.025ustrd' },
  8000005: { registryName: 'dydx', gasPrice: '25000000000adydx' },
  8000006: { registryName: 'kujira', gasPrice: '0.0034ukuji' },
  8000007: { registryName: 'secretnetwork', gasPrice: '0.25uscrt' },
  8000008: { registryName: 'celestia', gasPrice: '0.02utia' },
  8000009: { registryName: 'archway', gasPrice: '1000000000000aarch' },
  8000010: { registryName: 'saga', gasPrice: '0.025usaga' },
  8000011: { registryName: 'neutron', gasPrice: '0.025untrn' },
  8000012: { registryName: 'nibiru', gasPrice: '0.025unibi' },
};

function rpcUrlsFor(chainId: number): string[] {
  const cfg = COSMOS_EXEC_CONFIG[chainId];
  if (!cfg) return [];
  // Broadcast through our SAME-ORIGIN backend proxy first. Public Cosmos RPCs -
  // Secret especially - don't send CORS headers, so a browser POST is blocked
  // ("No 'Access-Control-Allow-Origin'"), and rpc.cosmos.directory frequently
  // 502s. The proxy forwards server-side (no CORS) to a healthy node. The direct
  // RPCs stay as a fallback for non-browser callers / CORS-friendly chains.
  const origin = apiOrigin();
  return [
    `${origin}/api/v1/cosmos-rpc/${chainId}`,
    `https://rpc.cosmos.directory/${cfg.registryName}`,
    ...(cfg.extraRpcs ?? []),
  ];
}

/** Internal-wallet Cosmos signer shape handed in via params.walletClient. */
interface InternalCosmosWalletClient {
  cosmosSigner: import('@cosmjs/proto-signing').OfflineDirectSigner;
  cosmosAddress: string;
  cosmosChainId: number;
  // The wallet's Injective (`inj1…`) recipient, derived from its EVM key. Present
  // when the route may hop through / land on Injective (eth_secp256k1), which
  // can't be re-encoded from the cosmos source address. Only a recipient - the
  // source-chain signature is still the standard-secp cosmos one above.
  injectiveAddress?: string;
}

function isInternalCosmosWalletClient(wc: any): wc is InternalCosmosWalletClient {
  return !!wc && typeof wc === 'object' && 'cosmosSigner' in wc && 'cosmosAddress' in wc;
}

export class SkipExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    return route.router === 'skip';
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, onStatusUpdate } = params;
    const raw = route.raw;

    try {
      if (!raw || !Array.isArray(raw.operations) || raw.operations.length === 0) {
        throw new SwapExecutionError(
          'Skip route is missing execution data. Please refresh the quote.',
          SwapErrorCode.INVALID_ROUTE,
          'skip',
        );
      }

      const sourceChainId = route.fromToken.chainId;

      // Injective uses eth_secp256k1 (Ethermint) - cosmjs can't build/sign its
      // txs, so it has a dedicated SDK-based path (internal or external wallet).
      if (sourceChainId === INJECTIVE_CHAIN_ID) {
        return await this.executeInjective(params, raw);
      }

      if (!getCosmosChain(sourceChainId)) {
        throw new SwapExecutionError(
          'This Cosmos chain can’t be signed in-app yet.',
          SwapErrorCode.UNSUPPORTED_ROUTER,
          'skip',
        );
      }

      onStatusUpdate?.({ stage: 'preparing', message: 'Preparing Cosmos swap...' });

      // 1. Resolve a signer + the source-chain address (internal or external).
      const { signer, sourceAddress } = await this.resolveSigner(params, sourceChainId);

      // 2. Ask Skip (via our server proxy) for the Cosmos messages. The proxy
      //    derives the per-hop address list from `sourceAddress` (re-encoding to
      //    each chain's bech32 prefix) so routes can hop through any standard
      //    secp256k1 Cosmos chain, not just our local registry.
      // Injective (and other eth_secp256k1 chains) can appear as a hop/destination
      // in a Cosmos-sourced route. Their recipient address can't be re-encoded
      // from the cosmos source address, so pass the wallet's inj1… (derived from
      // its EVM key) for the server to use on that hop. Internal wallet supplies
      // it on the client; an external Keplr/Leap exposes it via getKey.
      onStatusUpdate?.({ stage: 'preparing', message: 'Building transaction...' });
      const ethSecpAddresses = await this.resolveEthSecpAddresses(params);
      const cosmosTx = await this.fetchCosmosTx(raw, sourceAddress, params.slippage ?? parseFloat(route.slippage || '1'), ethSecpAddresses);

      if (cosmosTx.signer_address && !this.sameAccount(cosmosTx.signer_address, sourceAddress)) {
        throw new SwapExecutionError(
          'Skip expects a different signer than the connected wallet. Aborting for safety.',
          SwapErrorCode.INVALID_ROUTE,
          'skip',
        );
      }

      // 4. Encode messages and broadcast on the source chain.
      const encodeObjects = cosmosTx.msgs.map((m: any) => this.toEncodeObject(m));

      onStatusUpdate?.({ stage: 'signing', message: 'Waiting for signature...' });
      const client = await this.connectClient(sourceChainId, signer);
      let result;
      try {
        onStatusUpdate?.({ stage: 'submitting', message: 'Broadcasting...' });
        result = await client.signAndBroadcast(sourceAddress, encodeObjects, 'auto');
      } finally {
        client.disconnect();
      }

      if (result.code !== 0) {
        throw new SwapExecutionError(
          `Cosmos transaction failed (code ${result.code}): ${result.rawLog || 'unknown error'}`,
          SwapErrorCode.TRANSACTION_FAILED,
          'skip',
        );
      }

      onStatusUpdate?.({
        stage: 'completed',
        message: 'Swap submitted. Delivery in progress via IBC.',
        txHash: result.transactionHash,
      });

      return {
        success: true,
        txHash: result.transactionHash,
        txHashes: [result.transactionHash],
        actualToAmount: route.toToken.amount,
      };
    } catch (error: any) {
      // Preserve honest, specific messages; only wrap unknown errors.
      if (error instanceof SwapExecutionError) throw error;
      throw createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'skip');
    }
  }

  /**
   * Injective execution path. Injective is eth_secp256k1 (Ethermint), so it
   * can't use cosmjs's SigningStargateClient (wrong pubkey/account types). We
   * fetch the Skip Cosmos msgs, convert them to `@injectivelabs/sdk-ts` messages
   * (MsgExecuteContract for same-chain wasm DEX swaps, MsgTransfer for IBC), and
   * broadcast via the SDK - with the internal wallet's private key or an external
   * Keplr/Leap signer.
   */
  private async executeInjective(
    params: SwapExecutionParams,
    raw: any,
  ): Promise<SwapExecutionResult> {
    const { route, onStatusUpdate } = params;
    try {
      onStatusUpdate?.({ stage: 'preparing', message: 'Preparing Injective swap...' });

      const wc = params.walletClient;
      const internal = isInternalInjectiveWalletClient(wc);

      // Resolve the inj1… source address (internal signer material or external wallet).
      let sourceAddress: string;
      let provider: any = null;
      if (internal) {
        sourceAddress = (wc as InternalInjectiveWalletClient).injectiveAddress;
      } else {
        provider = await getCosmosWallet();
        await provider.enable('injective-1');
        const key = await provider.getKey('injective-1');
        sourceAddress = key?.bech32Address;
      }
      if (!sourceAddress) {
        throw new SwapExecutionError(
          'No Injective account found in the connected wallet.',
          SwapErrorCode.WALLET_NOT_CONNECTED,
          'skip',
        );
      }

      onStatusUpdate?.({ stage: 'preparing', message: 'Building transaction...' });
      const cosmosTx = await this.fetchCosmosTx(
        raw,
        sourceAddress,
        params.slippage ?? parseFloat(route.slippage || '1'),
      );

      if (cosmosTx.signer_address && !this.sameAccount(cosmosTx.signer_address, sourceAddress)) {
        throw new SwapExecutionError(
          'Skip expects a different signer than the connected wallet. Aborting for safety.',
          SwapErrorCode.INVALID_ROUTE,
          'skip',
        );
      }

      const msgs = await buildInjectiveMsgs(cosmosTx.msgs);

      onStatusUpdate?.({ stage: 'signing', message: 'Waiting for signature...' });
      let txHash: string;
      if (internal) {
        onStatusUpdate?.({ stage: 'submitting', message: 'Broadcasting...' });
        txHash = await broadcastInjectiveInternal(
          (wc as InternalInjectiveWalletClient).injectivePrivateKey,
          msgs,
        );
      } else {
        txHash = await broadcastInjectiveExternal(provider, sourceAddress, msgs);
      }

      onStatusUpdate?.({
        stage: 'completed',
        message: 'Swap submitted on Injective.',
        txHash,
      });

      return {
        success: true,
        txHash,
        txHashes: [txHash],
        actualToAmount: route.toToken.amount,
      };
    } catch (error: any) {
      if (error instanceof SwapExecutionError) throw error;
      throw createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'skip');
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private sameAccount(a?: string, b?: string): boolean {
    if (!a || !b) return false;
    if (a.toLowerCase() === b.toLowerCase()) return true;
    const ca = reEncodeBech32(a, 'cosmos');
    const cb = reEncodeBech32(b, 'cosmos');
    return !!ca && !!cb && ca === cb;
  }

  /** Internal wallet client, else external Keplr/Leap offline signer. */
  private async resolveSigner(
    params: SwapExecutionParams,
    sourceChainId: number,
  ): Promise<{ signer: import('@cosmjs/proto-signing').OfflineDirectSigner; sourceAddress: string }> {
    const wc = params.walletClient;
    if (isInternalCosmosWalletClient(wc)) {
      return { signer: wc.cosmosSigner, sourceAddress: wc.cosmosAddress };
    }

    // External wallet (Keplr / Leap).
    const ibcChainId = Object.keys(IBC_CHAIN_ID_TO_CANONICAL).find(
      (k) => IBC_CHAIN_ID_TO_CANONICAL[k] === sourceChainId,
    );
    if (!ibcChainId) {
      throw new SwapExecutionError('Unsupported Cosmos source chain.', SwapErrorCode.UNSUPPORTED_ROUTER, 'skip');
    }
    const wallet = await getCosmosWallet();
    await wallet.enable(ibcChainId);
    const offlineSigner = wallet.getOfflineSigner
      ? wallet.getOfflineSigner(ibcChainId)
      : (window as any).getOfflineSigner(ibcChainId);
    const accounts = await offlineSigner.getAccounts();
    const sourceAddress = accounts[0]?.address;
    if (!sourceAddress) {
      throw new SwapExecutionError('No Cosmos account in the connected wallet.', SwapErrorCode.WALLET_NOT_CONNECTED, 'skip');
    }
    return { signer: offlineSigner, sourceAddress };
  }

  /** POST our server proxy → Skip msgs; return the single cosmos_tx or throw honestly. */
  /**
   * Best-effort recipient addresses for eth_secp256k1 hop chains (Injective, …),
   * keyed by bech32 prefix. Derived from the wallet's EVM key - the internal
   * wallet passes `injectiveAddress` on the client; an external Keplr/Leap
   * exposes it via getKey('injective-1'). Never throws - an unavailable address
   * just means the server refuses that hop (unchanged behaviour).
   */
  private async resolveEthSecpAddresses(params: SwapExecutionParams): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    const wc: any = params.walletClient;
    if (isInternalCosmosWalletClient(wc) && wc.injectiveAddress?.startsWith('inj1')) {
      out.inj = wc.injectiveAddress;
      return out;
    }
    // External Cosmos wallet (Keplr/Leap): read the inj1 account if the wallet
    // has Injective enabled. Best-effort - ignore if unavailable.
    try {
      const provider = await getCosmosWallet();
      await provider.enable('injective-1');
      const key = await provider.getKey('injective-1');
      if (key?.bech32Address?.startsWith('inj1')) out.inj = key.bech32Address;
    } catch {
      /* wallet doesn't expose Injective - leave it out, server will refuse the hop */
    }
    return out;
  }

  private async fetchCosmosTx(
    raw: any,
    sourceAddress: string,
    slippage: number,
    ethSecpAddresses?: Record<string, string>,
  ): Promise<{ chain_id: string; signer_address?: string; msgs: any[] }> {
    const resp = await fetch(apiUrl('/api/v1/route/skip-msgs'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: raw, sourceAddress, slippage, ethSecpAddresses }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new SwapExecutionError(
        data?.error || 'Skip could not build this transaction.',
        SwapErrorCode.EXECUTION_FAILED,
        'skip',
      );
    }

    // Current Skip format: txs[].cosmos_tx. Legacy: top-level msgs[].
    const txs: any[] = Array.isArray(data.txs) ? data.txs : [];
    if (txs.length > 1) {
      throw new SwapExecutionError(
        'This route needs multiple transactions, which isn’t supported in-app yet. Try a different pair.',
        SwapErrorCode.UNSUPPORTED_ROUTER,
        'skip',
      );
    }
    if (txs.length === 1) {
      const tx = txs[0];
      if (tx.evm_tx || tx.svm_tx) {
        throw new SwapExecutionError(
          'This route requires a non-Cosmos signature, which isn’t supported in-app yet.',
          SwapErrorCode.UNSUPPORTED_ROUTER,
          'skip',
        );
      }
      if (tx.cosmos_tx?.msgs?.length) return tx.cosmos_tx;
    }
    // Legacy shape.
    if (Array.isArray(data.msgs) && data.msgs.length) {
      const msgs = data.msgs
        .map((m: any) => m.multi_chain_msg || m)
        .filter((m: any) => m?.msg_type_url);
      if (msgs.length) return { chain_id: msgs[0].chain_id, msgs };
    }

    throw new SwapExecutionError(
      'Skip returned no Cosmos transaction for this route.',
      SwapErrorCode.INVALID_ROUTE,
      'skip',
    );
  }

  /** Convert a Skip msg ({msg_type_url, msg}) into a cosmjs EncodeObject. */
  private toEncodeObject(m: any): { typeUrl: string; value: any } {
    const typeUrl: string = m.msg_type_url;
    const rawMsg: string = typeof m.msg === 'string' ? m.msg : JSON.stringify(m.msg);
    const parsed = JSON.parse(rawMsg);

    if (typeUrl === '/ibc.applications.transfer.v1.MsgTransfer') {
      // timeout_timestamp is a uint64 in nanoseconds that exceeds
      // Number.MAX_SAFE_INTEGER - JSON.parse would corrupt it, so pull it out of
      // the raw string and carry it as a bigint.
      const tsMatch = rawMsg.match(/"timeout_timestamp"\s*:\s*"?(\d+)"?/);
      const timeoutTimestamp = tsMatch ? BigInt(tsMatch[1]) : BigInt(0);

      const th = parsed.timeout_height;
      const timeoutHeight =
        th && (th.revision_number != null || th.revision_height != null)
          ? {
              revisionNumber: BigInt(th.revision_number ?? 0),
              revisionHeight: BigInt(th.revision_height ?? 0),
            }
          : undefined;

      return {
        typeUrl,
        value: {
          sourcePort: parsed.source_port,
          sourceChannel: parsed.source_channel,
          token: { denom: parsed.token?.denom, amount: parsed.token?.amount },
          sender: parsed.sender,
          receiver: parsed.receiver,
          timeoutHeight,
          timeoutTimestamp,
          memo: parsed.memo ?? '',
        },
      };
    }

    // Same-chain wasm DEX swaps (Astroport/Osmosis contracts) and other message
    // types need registries this build doesn't ship. Fail honestly instead of
    // masking as a generic error.
    throw new SwapExecutionError(
      `Skip returned an unsupported message type (${typeUrl}). Same-chain Cosmos DEX swaps aren’t executable in-app yet - try a cross-chain (IBC) route.`,
      SwapErrorCode.UNSUPPORTED_ROUTER,
      'skip',
    );
  }

  /** Connect a SigningStargateClient, trying each RPC in turn. */
  private async connectClient(
    chainId: number,
    signer: import('@cosmjs/proto-signing').OfflineDirectSigner,
  ): Promise<import('@cosmjs/stargate').SigningStargateClient> {
    const cfg = COSMOS_EXEC_CONFIG[chainId];
    if (!cfg) {
      throw new SwapExecutionError('No RPC configured for this Cosmos chain.', SwapErrorCode.NETWORK_ERROR, 'skip');
    }
    const { SigningStargateClient, GasPrice } = await import('@cosmjs/stargate');
    const gasPrice = GasPrice.fromString(cfg.gasPrice);

    let lastErr: unknown;
    for (const url of rpcUrlsFor(chainId)) {
      try {
        return await SigningStargateClient.connectWithSigner(url, signer, { gasPrice });
      } catch (e) {
        lastErr = e;
      }
    }
    throw createSwapError(lastErr, SwapErrorCode.NETWORK_ERROR, 'skip');
  }
}
