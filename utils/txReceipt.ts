/**
 * Confirms a tx actually succeeded on-chain. Submitting a transaction only
 * broadcasts it — reverts (OOG, failed approve→transfer, contract require
 * failure, etc.) come back as `receipt.status === 'reverted'`. Activity
 * loggers MUST gate on this before recording "Sent Successfully" or similar,
 * otherwise the UI reports actions that never happened.
 *
 * Uses the app's configured RPC for the chain. Returns `null` if the RPC
 * isn't configured or the receipt fetch times out — caller should treat
 * `null` as "unknown" and, for safety, decline to log as successful.
 */

import { getRpcUrl, RPC_TRANSPORT_OPTIONS } from '@/constants/rpc';
import { getChainById } from '@/services/signer/SignerUtils';
import { createPublicClient, http } from 'viem';

const clients = new Map<number, ReturnType<typeof createPublicClient>>();

function clientFor(chainId: number) {
    const cached = clients.get(chainId);
    if (cached) return cached;
    const rpc = getRpcUrl(chainId);
    if (!rpc) return null;
    const client = createPublicClient({
        chain: getChainById(chainId) as any,
        transport: http(rpc, RPC_TRANSPORT_OPTIONS),
    });
    clients.set(chainId, client);
    return client;
}

export async function waitForReceiptSuccess(params: {
    hash: string;
    chainId: number;
    /** Max wait before we give up. Defaults to 60s. */
    timeoutMs?: number;
}): Promise<boolean | null> {
    const { hash, chainId, timeoutMs = 60_000 } = params;
    if (!hash || !chainId) return null;
    const client = clientFor(chainId);
    if (!client) return null;
    try {
        const receipt = await client.waitForTransactionReceipt({
            hash: hash as `0x${string}`,
            timeout: timeoutMs,
            confirmations: 1,
        });
        return receipt.status === 'success';
    } catch (e) {
        console.warn('[txReceipt] waitForReceiptSuccess failed', hash, e);
        return null;
    }
}
