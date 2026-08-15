/**
 * Extra-chain native balance reader (mobile, on-device).
 *
 * The server portfolio route only knows 6 address keys, so the newly-derived
 * chains (Sui, Aptos, Injective, Bitcoin, Cosmos-family) have no balances. This
 * reads their NATIVE balance directly from public RPC/REST endpoints and prices
 * them via CoinGecko simple/price - fully on-device, no backend. Returns rows in
 * the same shape as /api/v1/wallet/balances so useWalletBalances can merge them.
 *
 * Native only. Every reader is isolated (failures degrade to "no row"), so one
 * dead endpoint never blanks the others.
 */

import { COSMOS_CHAIN_CONFIG } from '@/constants/cosmosChains';
import type { WalletGroup } from '@/store/walletStore';

const NATIVE_SENTINEL = '0x0000000000000000000000000000000000000000';

interface NativeSpec {
    chainId: number;
    addressKey: keyof WalletGroup['addresses'];
    symbol: string;
    name: string;
    decimals: number;
    coingeckoId?: string; // for USD pricing
}

// Non-cosmos natives (cosmos-family derived from COSMOS_CHAIN_CONFIG below).
const NATIVE_SPECS: NativeSpec[] = [
    { chainId: 101, addressKey: 'SUI', symbol: 'SUI', name: 'Sui', decimals: 9, coingeckoId: 'sui' },
    { chainId: 637, addressKey: 'APTOS', symbol: 'APT', name: 'Aptos', decimals: 8, coingeckoId: 'aptos' },
    { chainId: 8000001, addressKey: 'INJECTIVE', symbol: 'INJ', name: 'Injective', decimals: 18, coingeckoId: 'injective-protocol' },
    { chainId: 8332, addressKey: 'BITCOIN', symbol: 'BTC', name: 'Bitcoin', decimals: 8, coingeckoId: 'bitcoin' },
];

// CoinGecko id per cosmos native denom (for pricing; missing = shown at $0).
const COSMOS_COINGECKO_ID: Record<number, string> = {
    118: 'cosmos', 249339: 'osmosis', 8000003: 'juno-network', 8000004: 'stride',
    8000005: 'dydx-chain', 8000006: 'kujira', 8000007: 'secret', 8000008: 'celestia',
    8000009: 'archway', 8000011: 'neutron-3', 8000012: 'nibiru',
};
const COSMOS_SYMBOL: Record<number, { symbol: string; name: string }> = {
    118: { symbol: 'ATOM', name: 'Cosmos Hub' }, 249339: { symbol: 'OSMO', name: 'Osmosis' },
    8000003: { symbol: 'JUNO', name: 'Juno' }, 8000004: { symbol: 'STRD', name: 'Stride' },
    8000005: { symbol: 'DYDX', name: 'dYdX' }, 8000006: { symbol: 'KUJI', name: 'Kujira' },
    8000007: { symbol: 'SCRT', name: 'Secret' }, 8000008: { symbol: 'TIA', name: 'Celestia' },
    8000009: { symbol: 'ARCH', name: 'Archway' }, 8000010: { symbol: 'SAGA', name: 'Saga' },
    8000011: { symbol: 'NTRN', name: 'Neutron' }, 8000012: { symbol: 'NIBI', name: 'Nibiru' },
};

function toFormatted(raw: string | number | bigint, decimals: number): string {
    try {
        const v = BigInt(typeof raw === 'string' ? raw.split('.')[0] : Math.floor(Number(raw)).toString());
        const d = BigInt(10) ** BigInt(decimals);
        const whole = v / d;
        const frac = (v % d).toString().padStart(decimals, '0').replace(/0+$/, '');
        return frac ? `${whole}.${frac}` : whole.toString();
    } catch { return '0'; }
}

async function fetchPrices(ids: string[]): Promise<Record<string, number>> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return {};
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${unique.join(',')}&vs_currencies=usd&include_24hr_change=true`);
        if (!res.ok) return {};
        return await res.json();
    } catch { return {}; }
}

async function suiBalance(addr: string): Promise<string> {
    const { SuiClient, getFullnodeUrl } = await import('@mysten/sui/client');
    const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
    const bal = await client.getBalance({ owner: addr });
    return bal.totalBalance; // MIST
}

async function aptosBalance(addr: string): Promise<string> {
    const { Aptos, AptosConfig, Network } = await import('@aptos-labs/ts-sdk');
    const aptos = new Aptos(new AptosConfig({ network: Network.MAINNET }));
    const octas = await aptos.getAccountAPTAmount({ accountAddress: addr });
    return String(octas);
}

async function injectiveBalance(addr: string): Promise<string> {
    const res = await fetch(`https://sentry.lcd.injective.network/cosmos/bank/v1beta1/balances/${addr}`);
    if (!res.ok) return '0';
    const data = await res.json();
    const inj = (data.balances || []).find((b: any) => b.denom === 'inj');
    return inj?.amount || '0';
}

async function bitcoinBalance(addr: string): Promise<string> {
    const res = await fetch(`https://mempool.space/api/address/${addr}`);
    if (!res.ok) return '0';
    const data = await res.json();
    const funded = Number(data.chain_stats?.funded_txo_sum || 0);
    const spent = Number(data.chain_stats?.spent_txo_sum || 0);
    return String(Math.max(0, funded - spent)); // sats
}

async function cosmosBalance(registryName: string, denom: string, addr: string): Promise<string> {
    const res = await fetch(`https://rest.cosmos.directory/${registryName}/cosmos/bank/v1beta1/balances/${addr}`);
    if (!res.ok) return '0';
    const data = await res.json();
    const found = (data.balances || []).find((b: any) => b.denom === denom);
    return found?.amount || '0';
}

/** Read native balances for the extra chains and return priced WalletBalance rows. */
export async function fetchExtraNativeBalances(group: WalletGroup): Promise<any[]> {
    const jobs: Promise<any | null>[] = [];
    const priceIds: string[] = [];

    // Non-cosmos natives.
    for (const spec of NATIVE_SPECS) {
        const addr = group.addresses[spec.addressKey];
        if (!addr) continue;
        if (spec.coingeckoId) priceIds.push(spec.coingeckoId);
        jobs.push((async () => {
            try {
                let raw = '0';
                if (spec.chainId === 101) raw = await suiBalance(addr);
                else if (spec.chainId === 637) raw = await aptosBalance(addr);
                else if (spec.chainId === 8000001) raw = await injectiveBalance(addr);
                else if (spec.chainId === 8332) raw = await bitcoinBalance(addr);
                if (raw === '0' || !raw) return null;
                return { spec, raw };
            } catch (e) { console.warn(`[extraBalances] ${spec.symbol} read failed`, e); return null; }
        })());
    }

    // Cosmos-family natives.
    for (const [chainIdStr, config] of Object.entries(COSMOS_CHAIN_CONFIG)) {
        const chainId = Number(chainIdStr);
        const addr = group.addresses[config.addressKey];
        if (!addr) continue;
        const cgId = COSMOS_COINGECKO_ID[chainId];
        if (cgId) priceIds.push(cgId);
        const meta = COSMOS_SYMBOL[chainId] || { symbol: config.nativeDenom, name: config.registryName };
        jobs.push((async () => {
            try {
                const raw = await cosmosBalance(config.registryName, config.nativeDenom, addr);
                if (raw === '0' || !raw) return null;
                return {
                    spec: { chainId, addressKey: config.addressKey, symbol: meta.symbol, name: meta.name, decimals: config.decimals, coingeckoId: cgId } as NativeSpec,
                    raw,
                };
            } catch (e) { console.warn(`[extraBalances] ${meta.symbol} read failed`, e); return null; }
        })());
    }

    const [results, prices] = await Promise.all([Promise.all(jobs), fetchPrices(priceIds)]);

    return results.filter(Boolean).map(({ spec, raw }: any) => {
        const formatted = toFormatted(raw, spec.decimals);
        const priceData = spec.coingeckoId ? prices[spec.coingeckoId] : undefined;
        const priceUSD = priceData?.usd ? String(priceData.usd) : '0';
        const change = priceData?.usd_24h_change != null ? String(priceData.usd_24h_change) : '0';
        const usdValue = (parseFloat(formatted) * parseFloat(priceUSD)).toFixed(6);
        return {
            address: NATIVE_SENTINEL,
            symbol: spec.symbol,
            name: spec.name,
            decimals: spec.decimals,
            balance: String(raw),
            balanceFormatted: formatted,
            chainId: spec.chainId,
            usdValue,
            priceUSD,
            priceChange24h: change,
            verified: true,
            native_token: true,
        };
    });
}
