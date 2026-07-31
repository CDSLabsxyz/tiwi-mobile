/**
 * Convert Skip's Cosmos messages into `@injectivelabs/sdk-ts` message instances.
 *
 * Skip's `cosmos_tx.msgs` come as `{ msg_type_url, msg }` where `msg` is either a
 * JSON string or an object. Injective can't be signed through cosmjs (eth_secp256k1
 * pubkey/account), so its swaps are built with the Injective SDK's own message
 * classes and broadcast via the SDK — see `skip-executor.ts` `executeInjective`.
 *
 * Supported today (covers Skip's Injective routes):
 *   - `/cosmwasm.wasm.v1.MsgExecuteContract` — same-chain wasm DEX swaps (Helix/…)
 *   - `/ibc.applications.transfer.v1.MsgTransfer` — cross-chain IBC out of Injective
 */

import { base64ToBytes } from '@/services/swap/core/utils/base64-bytes';

type AnyRecord = Record<string, any>;

const MSG_EXECUTE_CONTRACT = '/cosmwasm.wasm.v1.MsgExecuteContract';
const MSG_TRANSFER = '/ibc.applications.transfer.v1.MsgTransfer';

function parseMsg(m: AnyRecord): AnyRecord {
  const raw = typeof m.msg === 'string' ? m.msg : JSON.stringify(m.msg ?? {});
  return JSON.parse(raw);
}

/**
 * Decode a CosmWasm exec payload (base64-JSON string, JSON string, or object) → object.
 * Uses browser-safe base64 (the SDK's `fromBase64` is a JSON helper, not a byte codec).
 */
function decodeWasmExecMsg(msg: unknown): object {
  if (msg && typeof msg === 'object') return msg as object;
  if (typeof msg === 'string') {
    // Try base64 → UTF-8 JSON first (Skip's common encoding), then plain JSON.
    try {
      const json = new TextDecoder().decode(base64ToBytes(msg));
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* not base64-JSON; fall through */
    }
    try {
      return JSON.parse(msg);
    } catch {
      /* fall through to error */
    }
  }
  throw new Error('Could not decode CosmWasm execute message from Skip route.');
}

function normalizeFunds(funds: unknown): Array<{ denom: string; amount: string }> {
  if (!Array.isArray(funds)) return [];
  return funds
    .filter((c) => c && typeof c === 'object' && (c as AnyRecord).denom && (c as AnyRecord).amount)
    .map((c) => ({ denom: String((c as AnyRecord).denom), amount: String((c as AnyRecord).amount) }));
}

/**
 * Build Injective SDK messages from Skip's Cosmos msgs. Imports the SDK once.
 * Throws on an unsupported message type so callers surface an honest error.
 */
export async function buildInjectiveMsgs(skipMsgs: AnyRecord[]): Promise<unknown[]> {
  if (!Array.isArray(skipMsgs) || skipMsgs.length === 0) {
    throw new Error('Skip returned no Injective messages for this route.');
  }

  const { MsgExecuteContract, MsgTransfer } = await import('@injectivelabs/sdk-ts');

  return skipMsgs.map((m) => {
    const typeUrl: string = m.msg_type_url;
    const parsed = parseMsg(m);

    if (typeUrl === MSG_EXECUTE_CONTRACT) {
      return MsgExecuteContract.fromJSON({
        sender: parsed.sender,
        contractAddress: parsed.contract,
        msg: decodeWasmExecMsg(parsed.msg),
        funds: normalizeFunds(parsed.funds),
      });
    }

    if (typeUrl === MSG_TRANSFER) {
      // timeout_timestamp is uint64 nanoseconds. Number() loses sub-256ns
      // precision at that magnitude, which is immaterial for a packet timeout
      // that sits minutes in the future — but keep the note here in case a
      // future msg type needs exact 64-bit handling.
      const rawStr = typeof m.msg === 'string' ? m.msg : JSON.stringify(m.msg ?? {});
      const tsMatch = rawStr.match(/"timeout_timestamp"\s*:\s*"?(\d+)"?/);
      const height = parsed.timeout_height;
      return MsgTransfer.fromJSON({
        amount: { denom: parsed.token?.denom, amount: parsed.token?.amount },
        sender: parsed.sender,
        receiver: parsed.receiver,
        port: parsed.source_port,
        channelId: parsed.source_channel,
        timeout: tsMatch ? Number(BigInt(tsMatch[1])) : undefined,
        height:
          height && (height.revision_number != null || height.revision_height != null)
            ? {
                revisionNumber: Number(height.revision_number ?? 0),
                revisionHeight: Number(height.revision_height ?? 0),
              }
            : undefined,
        memo: parsed.memo ?? '',
      });
    }

    throw new Error(
      `Skip returned an unsupported Injective message type (${typeUrl}). Try a different pair.`,
    );
  });
}
