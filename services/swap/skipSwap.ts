/**
 * Skip direct-to-API swap helpers (mobile).
 *
 * The web app proxies Skip through /api/v1/route/{skip-msgs,cosmos-rpc}, but
 * those routes are NOT deployed to production - and React Native has no CORS -
 * so mobile calls Skip's public API (api.skip.build) DIRECTLY:
 *   1. POST /v2/fungible/route  → route (quote)
 *   2. POST /v2/fungible/msgs   → cosmos msgs to sign
 * then signs on the SOURCE chain with the wallet's cosmjs/injective key.
 *
 * Ported from web lib/backend/routers/adapters/skip-adapter.ts +
 * app/api/v1/route/skip-msgs/route.ts + skip-executor.ts. Scope: single-tx
 * Cosmos routes with a cosmos SOURCE (cosmos→cosmos / cosmos→injective). Same-
 * chain wasm-DEX msgs and injective-SOURCE routes fail honestly (as on web).
 */

import { COSMOS_CHAIN_CONFIG } from '@/constants/cosmosChains';
import { reEncodeBech32 } from '@/services/walletDerivationExtra';

const SKIP_BASE = 'https://api.skip.build/v2';
const SKIP_CLIENT_ID = process.env.EXPO_PUBLIC_SKIP_CLIENT_ID || 'tiwi-protocol';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Canonical chainId → Skip's Cosmos SDK chain-id string. */
export const CANONICAL_TO_SKIP_CHAIN_ID: Record<number, string> = {
    118: 'cosmoshub-4',
    249339: 'osmosis-1',
    8000001: 'injective-1',
    8000002: 'thorchain-mainnet-v1',
    8000003: 'juno-1',
    8000004: 'stride-1',
    8000005: 'dydx-mainnet-1',
    8000006: 'kaiyo-1',
    8000007: 'secret-4',
    8000008: 'celestia',
    8000009: 'archway-1',
    8000010: 'ssc-1',
    8000011: 'neutron-1',
    8000012: 'cataclysm-1',
};

/** Cosmos chains whose accounts derive from an Ethereum key - can't re-encode. */
const ETH_SECP256K1_PREFIXES = new Set(['inj', 'evmos', 'dym', 'zeta', 'realio', 'haqq', 'planq', 'gravity']);

export function isSkipChain(chainId: number | string | undefined): boolean {
    return Number(chainId) in CANONICAL_TO_SKIP_CHAIN_ID;
}

/** Map a wallet token address to the Skip denom for its chain. */
export function toSkipDenom(address: string, canonicalChainId: number): string {
    const raw = (address || '').trim();
    const lower = raw.toLowerCase();
    if (lower === '' || lower === 'native' || lower === ZERO_ADDRESS) {
        // Native placeholder → chain base denom.
        if (Number(canonicalChainId) === 8000001) return 'inj';
        const denom = COSMOS_CHAIN_CONFIG[Number(canonicalChainId)]?.nativeDenom;
        if (denom) return denom;
    }
    if (lower.startsWith('0xibc/') || lower.startsWith('0xfactory/')) return raw.slice(2);
    return raw;
}

// ── Skip chain-id → bech32 prefix (for the per-hop address list) ──────────────
let prefixCache: { at: number; map: Record<string, string> } | null = null;
const PREFIX_TTL_MS = 60 * 60 * 1000;

async function getChainPrefixMap(nowMs: number): Promise<Record<string, string>> {
    if (prefixCache && nowMs - prefixCache.at < PREFIX_TTL_MS) return prefixCache.map;
    const resp = await fetch(`${SKIP_BASE}/info/chains?include_evm=false`, {
        headers: { 'x-client-id': SKIP_CLIENT_ID },
    });
    if (!resp.ok) {
        if (prefixCache) return prefixCache.map;
        throw new Error(`Skip chain info unavailable (${resp.status})`);
    }
    const data = await resp.json();
    const map: Record<string, string> = {};
    for (const c of data.chains || []) {
        if (c.chain_id && c.bech32_prefix) map[c.chain_id] = c.bech32_prefix;
    }
    prefixCache = { at: nowMs, map };
    return map;
}

export interface SkipRoute {
    amount_in: string;
    amount_out?: string;
    source_asset_denom: string;
    source_asset_chain_id: string;
    dest_asset_denom: string;
    dest_asset_chain_id: string;
    operations: any[];
    chain_ids?: string[];
    required_chain_addresses?: string[];
    swap_price_impact_percent?: string;
    estimated_fees?: { usd_amount?: string }[];
    [k: string]: any;
}

/** POST /v2/fungible/route - the quote. Returns null if Skip has no route. */
export async function fetchSkipRoute(params: {
    fromChainId: number; toChainId: number;
    fromToken: string; toToken: string; amountIn: string;
}): Promise<SkipRoute | null> {
    const fromChain = CANONICAL_TO_SKIP_CHAIN_ID[Number(params.fromChainId)];
    const toChain = CANONICAL_TO_SKIP_CHAIN_ID[Number(params.toChainId)];
    if (!fromChain || !toChain) return null;

    const resp = await fetch(`${SKIP_BASE}/fungible/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-client-id': SKIP_CLIENT_ID },
        body: JSON.stringify({
            amount_in: params.amountIn,
            source_asset_denom: toSkipDenom(params.fromToken, Number(params.fromChainId)),
            source_asset_chain_id: fromChain,
            dest_asset_denom: toSkipDenom(params.toToken, Number(params.toChainId)),
            dest_asset_chain_id: toChain,
            cumulative_affiliate_fee_bps: '0',
            allow_unsafe: false,
            allow_multi_tx: false,
            smart_relay: true,
            smart_swap_options: { split_routes: true, evm_swaps: false },
        }),
    });
    if (!resp.ok) return null;
    const route = await resp.json();
    return route?.amount_out ? (route as SkipRoute) : null;
}

/** Build the per-hop address list: source address re-encoded to each chain prefix. */
export async function buildSkipAddressList(
    route: SkipRoute, sourceAddress: string, nowMs: number, ethSecpAddresses?: Record<string, string>,
): Promise<string[]> {
    const requiredChains =
        (Array.isArray(route.required_chain_addresses) && route.required_chain_addresses.length
            ? route.required_chain_addresses
            : route.chain_ids) || [];
    const sourceIbcId = route.source_asset_chain_id;
    const prefixMap = await getChainPrefixMap(nowMs);

    return requiredChains.map((ibcId) => {
        if (ibcId === sourceIbcId) return sourceAddress;
        const prefix = prefixMap[ibcId];
        if (!prefix) throw new Error(`Unknown chain ${ibcId} in route - can't derive your address for it.`);
        if (ETH_SECP256K1_PREFIXES.has(prefix)) {
            const supplied = ethSecpAddresses?.[prefix];
            if (supplied && supplied.startsWith(`${prefix}1`)) return supplied;
            throw new Error(`This route passes through ${ibcId}, which isn't supported for in-app signing yet.`);
        }
        const addr = reEncodeBech32(sourceAddress, prefix);
        if (!addr) throw new Error(`Could not derive your address on ${ibcId}.`);
        return addr;
    });
}

/** POST /v2/fungible/msgs - returns the single cosmos_tx or throws. */
export async function fetchSkipCosmosTx(
    route: SkipRoute, addressList: string[], slippage: number,
): Promise<{ chain_id: string; msgs: any[] }> {
    const resp = await fetch(`${SKIP_BASE}/fungible/msgs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-client-id': SKIP_CLIENT_ID },
        body: JSON.stringify({
            source_asset_denom: route.source_asset_denom,
            source_asset_chain_id: route.source_asset_chain_id,
            dest_asset_denom: route.dest_asset_denom,
            dest_asset_chain_id: route.dest_asset_chain_id,
            amount_in: route.amount_in,
            amount_out: route.amount_out,
            address_list: addressList,
            operations: route.operations,
            slippage_tolerance_percent: String(slippage ?? 1),
        }),
    });
    const text = await resp.text();
    if (!resp.ok) throw new Error(`Skip could not build a transaction (${resp.status})`);
    const data = JSON.parse(text);

    const txs: any[] = Array.isArray(data.txs) ? data.txs : [];
    if (txs.length > 1) throw new Error('This route needs multiple transactions, which isn\'t supported in-app yet.');
    if (txs.length === 1) {
        const tx = txs[0];
        if (tx.evm_tx || tx.svm_tx) throw new Error('This route requires a non-Cosmos signature, not supported in-app yet.');
        if (tx.cosmos_tx?.msgs?.length) return tx.cosmos_tx;
    }
    if (Array.isArray(data.msgs) && data.msgs.length) {
        const msgs = data.msgs.map((m: any) => m.multi_chain_msg || m).filter((m: any) => m?.msg_type_url);
        if (msgs.length) return { chain_id: msgs[0].chain_id, msgs };
    }
    throw new Error('Skip returned no Cosmos transaction for this route.');
}

/** Convert a Skip msg ({msg_type_url, msg}) → cosmjs EncodeObject (MsgTransfer only). */
export function toEncodeObject(m: any): { typeUrl: string; value: any } {
    const typeUrl: string = m.msg_type_url;
    const rawMsg: string = typeof m.msg === 'string' ? m.msg : JSON.stringify(m.msg);
    const parsed = JSON.parse(rawMsg);

    if (typeUrl === '/ibc.applications.transfer.v1.MsgTransfer') {
        // timeout_timestamp is a uint64 (ns) that exceeds MAX_SAFE_INTEGER - pull
        // it from the raw string as a bigint (JSON.parse would corrupt it).
        const tsMatch = rawMsg.match(/"timeout_timestamp"\s*:\s*"?(\d+)"?/);
        const timeoutTimestamp = tsMatch ? BigInt(tsMatch[1]) : BigInt(0);
        const th = parsed.timeout_height;
        const timeoutHeight =
            th && (th.revision_number != null || th.revision_height != null)
                ? { revisionNumber: BigInt(th.revision_number ?? 0), revisionHeight: BigInt(th.revision_height ?? 0) }
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
    throw new Error(`Skip returned an unsupported message type (${typeUrl}). Same-chain Cosmos DEX swaps aren't executable in-app yet - try a cross-chain (IBC) route.`);
}
