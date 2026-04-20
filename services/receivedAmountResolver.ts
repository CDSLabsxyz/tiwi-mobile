/**
 * Resolves the actual amount + token for a user's transaction by reading
 * on-chain. Back-fills activity rows (Received / Sent / Swap) whose stored
 * amount is 0 or missing — typically txs the app didn't originate, or
 * swaps where the router/aggregator wrote the outbound leg and never
 * captured the received leg.
 *
 * Handles:
 *   - Native coin: `tx.value` with `tx.to === user` (received) or
 *     `tx.from === user` with a non-zero value (sent).
 *   - ERC-20: decode `Transfer(from, to, value)` logs. Sums all legs that
 *     match the user on the requested side ('received' / 'sent') and picks
 *     the token with the largest total — for a swap this naturally
 *     selects the output token on 'received' and the input token on 'sent'.
 *
 * Cached in-memory by (chainId, hash, user, direction) so repeated renders
 * and scroll-back are cheap.
 */

import { getRpcUrl, RPC_TRANSPORT_OPTIONS } from '@/constants/rpc';
import { getChainById } from '@/services/signer/SignerUtils';
import { createPublicClient, decodeEventLog, formatUnits, http, parseAbi, type Address } from 'viem';

const TRANSFER_EVENT = parseAbi([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

const ERC20_META = parseAbi([
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
]);

export interface ReceivedAmountResult {
    amount: string;      // human-readable decimal string, e.g. "151.01124582"
    tokenSymbol: string; // e.g. "TWC" or "BNB"
    /**
     * The on-chain side that actually carried value for this user:
     *   - 'received' — user is the `to` of the winning Transfer (or tx.to).
     *   - 'sent'     — user is the `from` of the winning Transfer (or tx.from).
     * Set regardless of what direction the caller asked for so consumers
     * can re-label mis-categorized rows (e.g. a send mislabeled as a Swap).
     */
    resolvedDirection: 'received' | 'sent';
}

export type TxDirection = 'received' | 'sent';

// Cache per hash+chain+user so the list stays cheap on scroll/re-render.
const cache = new Map<string, ReceivedAmountResult | null>();
const inflight = new Map<string, Promise<ReceivedAmountResult | null>>();

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

// Light token-metadata cache so multi-row lists hitting the same ERC20 only
// read symbol/decimals once per chain.
const tokenMetaCache = new Map<string, { symbol: string; decimals: number }>();

async function readTokenMeta(client: ReturnType<typeof createPublicClient>, address: Address, chainId: number) {
    const key = `${chainId}:${address.toLowerCase()}`;
    const cached = tokenMetaCache.get(key);
    if (cached) return cached;
    try {
        const [symbol, decimals] = await Promise.all([
            client.readContract({ address, abi: ERC20_META, functionName: 'symbol' }) as Promise<string>,
            client.readContract({ address, abi: ERC20_META, functionName: 'decimals' }) as Promise<number>,
        ]);
        const meta = { symbol, decimals: Number(decimals) };
        tokenMetaCache.set(key, meta);
        return meta;
    } catch (e) {
        console.warn('[receivedAmountResolver] token meta read failed', address, e);
        return null;
    }
}

function nativeSymbolFor(chainId: number): string {
    switch (chainId) {
        case 1: return 'ETH';
        case 10: return 'ETH';
        case 8453: return 'ETH';
        case 42161: return 'ETH';
        case 137: return 'POL';
        case 56: return 'BNB';
        case 43114: return 'AVAX';
        default: return 'ETH';
    }
}

export async function resolveReceivedAmount(params: {
    hash: string;
    chainId: number;
    userAddress: string;
    /**
     * Preferred direction. The resolver ALWAYS tries both sides — if the
     * preferred side has no matching Transfer/native-value, it falls back
     * to the other side and reports the real direction in `resolvedDirection`.
     * This self-healing behavior is what lets us re-label rows that loggers
     * mis-categorized (e.g. a pure Send that ended up stored as 'Swap').
     */
    direction?: TxDirection;
}): Promise<ReceivedAmountResult | null> {
    const { hash, chainId, userAddress, direction = 'received' } = params;
    if (!hash || !chainId || !userAddress) return null;
    const key = `${chainId}:${hash.toLowerCase()}:${userAddress.toLowerCase()}:${direction}`;
    if (cache.has(key)) return cache.get(key)!;
    if (inflight.has(key)) return inflight.get(key)!;

    const task = (async (): Promise<ReceivedAmountResult | null> => {
        const client = clientFor(chainId);
        if (!client) return null;
        try {
            const user = userAddress.toLowerCase();
            const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
            const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

            // Collect Transfer totals per (direction, token) so we can pick
            // the best side even when the preferred one has nothing.
            const sums: Record<'received' | 'sent', Map<string, bigint>> = {
                received: new Map(),
                sent: new Map(),
            };
            for (const log of receipt.logs) {
                if (log.topics?.[0]?.toLowerCase() !== transferTopic) continue;
                try {
                    const decoded = decodeEventLog({
                        abi: TRANSFER_EVENT,
                        data: log.data,
                        topics: log.topics as any,
                    });
                    const from = (decoded.args as any).from?.toLowerCase?.();
                    const to = (decoded.args as any).to?.toLowerCase?.();
                    const value = (decoded.args as any).value as bigint;
                    const tokenAddr = log.address.toLowerCase();
                    if (to === user) {
                        sums.received.set(tokenAddr, (sums.received.get(tokenAddr) ?? 0n) + value);
                    }
                    if (from === user) {
                        sums.sent.set(tokenAddr, (sums.sent.get(tokenAddr) ?? 0n) + value);
                    }
                } catch { /* non-Transfer event on a similar signature — skip */ }
            }

            const pickWinner = (bucket: Map<string, bigint>) => {
                let winner: { addr: string; total: bigint } | null = null;
                for (const [addr, total] of bucket.entries()) {
                    if (!winner || total > winner.total) winner = { addr, total };
                }
                return winner;
            };

            const tryBuild = async (side: 'received' | 'sent'): Promise<ReceivedAmountResult | null> => {
                const winner = pickWinner(sums[side]);
                if (winner) {
                    const meta = await readTokenMeta(client, winner.addr as Address, chainId);
                    if (meta) {
                        return {
                            amount: formatUnits(winner.total, meta.decimals),
                            tokenSymbol: meta.symbol,
                            resolvedDirection: side,
                        };
                    }
                }
                return null;
            };

            // Prefer the caller's requested side, fall back to the other.
            const primary = direction;
            const secondary: TxDirection = direction === 'received' ? 'sent' : 'received';
            const primaryResult = await tryBuild(primary);
            if (primaryResult) return primaryResult;
            const secondaryResult = await tryBuild(secondary);
            if (secondaryResult) return secondaryResult;

            // Native transfer fallback — check both sides.
            const tx = await client.getTransaction({ hash: hash as `0x${string}` });
            if (tx.value > 0n) {
                if (tx.to?.toLowerCase() === user) {
                    return {
                        amount: formatUnits(tx.value, 18),
                        tokenSymbol: nativeSymbolFor(chainId),
                        resolvedDirection: 'received',
                    };
                }
                if (tx.from?.toLowerCase() === user) {
                    return {
                        amount: formatUnits(tx.value, 18),
                        tokenSymbol: nativeSymbolFor(chainId),
                        resolvedDirection: 'sent',
                    };
                }
            }

            return null;
        } catch (e) {
            console.warn('[receivedAmountResolver] resolve failed', hash, e);
            return null;
        } finally {
            inflight.delete(key);
        }
    })();

    inflight.set(key, task);
    const result = await task;
    cache.set(key, result);
    return result;
}
