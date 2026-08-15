/**
 * Injective (Ethermint / eth_secp256k1) transaction broadcasters.
 *
 * cosmjs can't build a valid Injective tx (wrong pubkey/account types), so these
 * use `@injectivelabs/sdk-ts` directly:
 *   - INTERNAL wallet → `MsgBroadcasterWithPk` (private key derived from the seed,
 *     see `internal-injective-signer.ts`). Simulates gas, signs, and broadcasts.
 *   - EXTERNAL wallet → build the tx with the SDK, have Keplr/Leap sign it
 *     (they handle Injective's keccak256 + ethsecp256k1 natively), broadcast via REST.
 *
 * `msgs` are `@injectivelabs/sdk-ts` message instances from `buildInjectiveMsgs`.
 */

import { bytesToBase64, base64ToBytes } from '@/services/swap/core/utils/base64-bytes';

const INJECTIVE_CHAIN_KEY = 'injective-1';

/** Broadcast with an internal wallet's private key. Returns the tx hash. */
export async function broadcastInjectiveInternal(privateKeyHex: string, msgs: unknown[]): Promise<string> {
  const { MsgBroadcasterWithPk } = await import('@injectivelabs/sdk-ts');
  const { Network } = await import('@injectivelabs/networks');

  const broadcaster = new MsgBroadcasterWithPk({
    privateKey: privateKeyHex,
    network: Network.Mainnet,
    simulateTx: true, // estimate gas (equivalent to fee: 'auto')
  });

  const res = await broadcaster.broadcast({ msgs: msgs as never });
  if (res.code !== 0) {
    throw new Error(`Injective transaction failed (code ${res.code}): ${res.rawLog || 'unknown error'}`);
  }
  return res.txHash;
}

/** Minimal Keplr/Leap surface we rely on for Injective. */
interface InjectiveKeplrProvider {
  enable(chainId: string): Promise<void>;
  getKey(chainId: string): Promise<{ bech32Address: string; pubKey: Uint8Array }>;
  signDirect(
    chainId: string,
    signer: string,
    signDoc: { bodyBytes: Uint8Array; authInfoBytes: Uint8Array; chainId: string; accountNumber: unknown },
  ): Promise<{
    signed: { bodyBytes: Uint8Array; authInfoBytes: Uint8Array };
    signature: { signature: string };
  }>;
}

/**
 * Broadcast with an external Keplr/Leap wallet. Builds the tx with the SDK,
 * lets the wallet sign (Injective is a native chain for both), then broadcasts
 * over REST. Returns the tx hash.
 */
export async function broadcastInjectiveExternal(
  provider: InjectiveKeplrProvider,
  injectiveAddress: string,
  msgs: unknown[],
): Promise<string> {
  const { createTransaction, ChainRestAuthApi, TxRestApi } = await import('@injectivelabs/sdk-ts');
  const { Network, getNetworkEndpoints } = await import('@injectivelabs/networks');
  const Long = (await import('long')).default;
  const endpoints = getNetworkEndpoints(Network.Mainnet);

  const key = await provider.getKey(INJECTIVE_CHAIN_KEY);
  const pubKeyBase64 = bytesToBase64(key.pubKey);

  const accountRes = await new ChainRestAuthApi(endpoints.rest).fetchAccount(injectiveAddress);
  const base = accountRes.account.base_account;
  const accountNumber = parseInt(base.account_number, 10);
  const sequence = parseInt(base.sequence, 10);

  // External can't simulate with a pk, so use a generous fixed gas limit. A
  // same-chain wasm DEX swap is ~0.5–1.5M gas; the wallet UI shows the fee and
  // the user confirms. Injective mainnet min gas price is 160000000 inj - 5e8
  // is a safe multiple. Unused gas is not charged.
  const gasLimit = 3_000_000;
  const fee = {
    amount: [{ denom: 'inj', amount: (BigInt(gasLimit) * BigInt(500000000)).toString() }],
    gas: gasLimit.toString(),
  };

  const { txRaw } = createTransaction({
    message: msgs as never,
    memo: '',
    fee,
    pubKey: pubKeyBase64,
    sequence,
    accountNumber,
    chainId: INJECTIVE_CHAIN_KEY,
  });

  const signResponse = await provider.signDirect(INJECTIVE_CHAIN_KEY, injectiveAddress, {
    bodyBytes: txRaw.bodyBytes,
    authInfoBytes: txRaw.authInfoBytes,
    chainId: INJECTIVE_CHAIN_KEY,
    accountNumber: Long.fromNumber(accountNumber),
  });

  // Use the bytes the wallet actually signed (it may have adjusted the fee).
  txRaw.bodyBytes = signResponse.signed.bodyBytes;
  txRaw.authInfoBytes = signResponse.signed.authInfoBytes;
  txRaw.signatures = [base64ToBytes(signResponse.signature.signature)];

  const res = await new TxRestApi(endpoints.rest).broadcast(txRaw);
  if (res.code !== 0) {
    throw new Error(`Injective transaction failed (code ${res.code}): ${res.rawLog || 'unknown error'}`);
  }
  return res.txHash;
}
