/**
 * Durable record of a cross-chain swap whose SECOND leg hasn't run yet.
 *
 * `CrossChainPostSwapExecutor` bridges to a stable on the destination chain and then swaps that
 * stable into the taxed token locally. The bridge is asynchronous (minutes), so the app can be
 * backgrounded, killed, or simply time out while waiting. Without a record the user is left
 * holding USDT on the destination chain with nothing pointing at the unfinished second hop —
 * which is the exact failure this whole executor exists to prevent.
 *
 * So the record is written the moment leg 1 confirms, and only cleared once leg 2 succeeds.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'tiwi.swap.pendingSecondLeg.v1';

/** Records older than this are dropped on read — the stable is still in the user's wallet. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PendingSecondLeg {
  /** Stable, derived id so a retry of the same bridge doesn't create a duplicate record. */
  id: string;
  createdAt: number;
  /** Chain the stable lands on and where the final swap runs. */
  destChainId: number;
  /** OUR address on the destination chain — holds the bridged stable and signs leg 2. */
  destAddress: string;
  /** Where the final token goes. Differs from `destAddress` only for a user-set recipient. */
  finalRecipient: string;
  stable: { address: string; symbol: string; decimals: number };
  /** Destination-chain stable balance BEFORE the bridge, as a decimal string of base units. */
  stableBefore: string;
  toToken: { chainId: number; address: string; symbol: string; decimals: number };
  bridgeTxHash?: string;
  slippage?: number;
}

async function readAll(): Promise<PendingSecondLeg[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter(
      (r: any) => r && typeof r.id === 'string' && now - (r.createdAt || 0) < MAX_AGE_MS,
    );
  } catch (e) {
    console.warn('[PendingSecondLeg] Failed to read store:', e);
    return [];
  }
}

async function writeAll(records: PendingSecondLeg[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    // Non-fatal: the swap itself is unaffected, only resumability is lost.
    console.warn('[PendingSecondLeg] Failed to write store:', e);
  }
}

export async function listPendingSecondLegs(): Promise<PendingSecondLeg[]> {
  return readAll();
}

/** Insert or replace by id. */
export async function savePendingSecondLeg(record: PendingSecondLeg): Promise<void> {
  const all = await readAll();
  const next = all.filter((r) => r.id !== record.id);
  next.push(record);
  await writeAll(next);
}

export async function clearPendingSecondLeg(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((r) => r.id !== id));
}
