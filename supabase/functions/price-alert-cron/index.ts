// Supabase Edge Function: price-alert-cron
//
// Runs on a cron schedule (every ~5 minutes). For every row in
// user_watched_tokens, fetches the current USD price with a 3-tier
// fallback chain (TIWI backend → DexScreener → CoinGecko), computes the
// delta vs the stored baseline_price, and dispatches an Expo push
// notification when the delta crosses the user's configured threshold
// and cooldown.
//
// Schema: supabase/price_alerts_schema.sql
// Deploy: supabase/functions/price-alert-cron/README.md

// @ts-ignore — Deno standard lib is resolved at runtime by Supabase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-ignore — Deno global is injected at runtime.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// @ts-ignore
const TIWI_BACKEND_URL = Deno.env.get('TIWI_BACKEND_URL') ?? 'https://app.tiwiprotocol.xyz';
// @ts-ignore
const COINGECKO_KEY = Deno.env.get('COINGECKO_KEY') ?? '';

const DEFAULT_THRESHOLD = 3;     // percent
const DEFAULT_COOLDOWN_MIN = 60; // minutes

// CoinGecko platform IDs keyed by EVM chain ID. Extend as needed.
const CG_PLATFORMS: Record<number, string> = {
    1: 'ethereum',
    56: 'binance-smart-chain',
    137: 'polygon-pos',
    42161: 'arbitrum-one',
    8453: 'base',
    10: 'optimistic-ethereum',
    43114: 'avalanche',
    250: 'fantom',
    42220: 'celo',
    100: 'xdai',
};

// Native-token → CoinGecko coin ID. Used when the row represents a gas
// token that has no ERC20 contract address.
const CG_NATIVE: Record<number, string> = {
    1: 'ethereum',
    56: 'binancecoin',
    137: 'matic-network',
    42161: 'ethereum',   // ARB native is ETH
    8453: 'ethereum',    // Base native is ETH
    10: 'ethereum',      // OP native is ETH
    43114: 'avalanche-2',
    250: 'fantom',
    42220: 'celo',
    100: 'xdai',
    7565164: 'solana',
    1100: 'the-open-network', // TON
    728126428: 'tron',
};

const NATIVE_ADDRESSES = new Set([
    'native',
    '',
    '0x0000000000000000000000000000000000000000',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

function isNativeAddress(addr: string): boolean {
    return NATIVE_ADDRESSES.has((addr || '').toLowerCase());
}

// ─── PRICE FETCHERS ───────────────────────────────────────────────────────

async function priceFromTiwi(chainId: number, address: string): Promise<number | null> {
    try {
        const addr = isNativeAddress(address)
            ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
            : address;
        const res = await fetch(
            `${TIWI_BACKEND_URL}/api/v1/token-info/${chainId}/${addr}`,
            { headers: { 'Accept': 'application/json' } },
        );
        if (!res.ok) return null;
        const json = await res.json();
        const p =
            json?.priceUSD ??
            json?.priceUsd ??
            json?.pool?.priceUsd ??
            json?.pool?.priceUSD ??
            json?.data?.priceUSD ??
            json?.data?.priceUsd ??
            null;
        const n = typeof p === 'string' ? parseFloat(p) : p;
        return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
        return null;
    }
}

async function priceFromDexScreener(address: string): Promise<number | null> {
    try {
        if (isNativeAddress(address)) return null; // not addressable
        const res = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${address}`,
            { headers: { 'Accept': 'application/json' } },
        );
        if (!res.ok) return null;
        const json = await res.json();
        const pairs: any[] = Array.isArray(json?.pairs) ? json.pairs : [];
        if (pairs.length === 0) return null;
        // Highest-liquidity pair wins.
        pairs.sort((a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0));
        const p = parseFloat(pairs[0]?.priceUsd ?? '0');
        return Number.isFinite(p) && p > 0 ? p : null;
    } catch {
        return null;
    }
}

async function priceFromCoinGecko(chainId: number, address: string): Promise<number | null> {
    try {
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (COINGECKO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_KEY;

        if (isNativeAddress(address)) {
            const coinId = CG_NATIVE[chainId];
            if (!coinId) return null;
            const res = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
                { headers },
            );
            if (!res.ok) return null;
            const json = await res.json();
            const p = json?.[coinId]?.usd;
            return Number.isFinite(p) && p > 0 ? p : null;
        }

        const platform = CG_PLATFORMS[chainId];
        if (!platform) return null;
        const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${address}&vs_currencies=usd`,
            { headers },
        );
        if (!res.ok) return null;
        const json = await res.json();
        const entry = json?.[address.toLowerCase()];
        const p = entry?.usd;
        return Number.isFinite(p) && p > 0 ? p : null;
    } catch {
        return null;
    }
}

// Three-tier fallback: TIWI → DexScreener → CoinGecko.
async function fetchPrice(chainId: number, address: string): Promise<number | null> {
    const a = await priceFromTiwi(chainId, address);
    if (a != null) return a;
    const b = await priceFromDexScreener(address);
    if (b != null) return b;
    return await priceFromCoinGecko(chainId, address);
}

// ─── EXPO PUSH ────────────────────────────────────────────────────────────

async function sendExpoPush(messages: any[]): Promise<void> {
    // Expo push API accepts up to 100 messages per request.
    const CHUNK = 100;
    for (let i = 0; i < messages.length; i += CHUNK) {
        const chunk = messages.slice(i, i + CHUNK);
        try {
            const res = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                },
                body: JSON.stringify(chunk),
            });
            if (!res.ok) {
                console.warn('[price-alert-cron] Expo push HTTP', res.status, await res.text());
            }
        } catch (e) {
            console.warn('[price-alert-cron] Expo push failed:', e);
        }
    }
}

function formatPrice(price: number): string {
    if (price < 0.01) return `$${price.toExponential(2)}`;
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────

// @ts-ignore — Deno.serve is the Supabase Edge Function entrypoint.
Deno.serve(async (_req: Request) => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Load every watched-token row.
    const { data: watched, error: wErr } = await supabase
        .from('user_watched_tokens')
        .select('id, user_wallet, chain_id, token_address, symbol, baseline_price, baseline_ts, last_alerted_at');
    if (wErr) {
        return new Response(JSON.stringify({ error: wErr.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    if (!watched || watched.length === 0) {
        return new Response(JSON.stringify({ ok: true, checked: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 2. Load per-user settings.
    const userWallets = Array.from(new Set(watched.map((w: any) => w.user_wallet)));
    const { data: settings } = await supabase
        .from('price_alert_settings')
        .select('user_wallet, enabled, threshold_percent, cooldown_minutes')
        .in('user_wallet', userWallets);

    const settingsByWallet = new Map<string, any>();
    (settings ?? []).forEach((s: any) => settingsByWallet.set(s.user_wallet, s));

    // 3. Deduplicate tokens and fetch prices concurrently — we only hit the
    //    upstream APIs once per unique (chain_id, token_address).
    const priceKey = (chainId: number, address: string) =>
        `${chainId}:${String(address).toLowerCase()}`;

    const uniqueTokens = new Map<string, { chainId: number; address: string }>();
    watched.forEach((w: any) => {
        const k = priceKey(w.chain_id, w.token_address);
        if (!uniqueTokens.has(k)) {
            uniqueTokens.set(k, { chainId: w.chain_id, address: w.token_address });
        }
    });

    const priceResults = new Map<string, number>();
    await Promise.all(
        Array.from(uniqueTokens.entries()).map(async ([k, { chainId, address }]) => {
            const p = await fetchPrice(chainId, address);
            if (p != null) priceResults.set(k, p);
        }),
    );

    // 4. Decide which rows need an alert and which just need a baseline seed.
    const now = Date.now();
    const pushMessages: any[] = [];
    const alertedRowUpdates: Array<{
        id: string;
        baseline_price: number;
        baseline_ts: string;
        last_alerted_at: string;
    }> = [];
    const baselineOnlyUpdates: Array<{ id: string; baseline_price: number; baseline_ts: string }> = [];
    const alertsByWallet: Record<string, Array<{ row: any; price: number; deltaPct: number }>> = {};

    for (const row of watched as any[]) {
        const s = settingsByWallet.get(row.user_wallet);
        const enabled = s ? !!s.enabled : true;
        if (!enabled) continue;

        const threshold = Number(s?.threshold_percent) || DEFAULT_THRESHOLD;
        const cooldownMs = (Number(s?.cooldown_minutes) || DEFAULT_COOLDOWN_MIN) * 60 * 1000;

        const price = priceResults.get(priceKey(row.chain_id, row.token_address));
        if (price == null) continue;

        // No baseline yet → record one silently and move on.
        if (!row.baseline_price || Number(row.baseline_price) <= 0) {
            baselineOnlyUpdates.push({
                id: row.id,
                baseline_price: price,
                baseline_ts: new Date(now).toISOString(),
            });
            continue;
        }

        const baseline = Number(row.baseline_price);
        const deltaPct = ((price - baseline) / baseline) * 100;
        if (Math.abs(deltaPct) < threshold) continue;

        const lastAlertMs = row.last_alerted_at ? Date.parse(row.last_alerted_at) : 0;
        if (now - lastAlertMs < cooldownMs) continue;

        (alertsByWallet[row.user_wallet] ??= []).push({ row, price, deltaPct });
        alertedRowUpdates.push({
            id: row.id,
            baseline_price: price,
            baseline_ts: new Date(now).toISOString(),
            last_alerted_at: new Date(now).toISOString(),
        });
    }

    // 5. Resolve push tokens for wallets that have any alert.
    const walletsWithAlerts = Object.keys(alertsByWallet);
    if (walletsWithAlerts.length > 0) {
        const { data: pushTokens } = await supabase
            .from('user_push_tokens')
            .select('user_wallet, push_token')
            .eq('is_active', true)
            .in('user_wallet', walletsWithAlerts);

        const tokensByWallet = new Map<string, string[]>();
        (pushTokens ?? []).forEach((pt: any) => {
            const list = tokensByWallet.get(pt.user_wallet) ?? [];
            list.push(pt.push_token);
            tokensByWallet.set(pt.user_wallet, list);
        });

        for (const [wallet, alerts] of Object.entries(alertsByWallet)) {
            const tokens = tokensByWallet.get(wallet) ?? [];
            if (tokens.length === 0) continue;

            for (const alert of alerts) {
                const { row, price, deltaPct } = alert;
                const direction = deltaPct >= 0 ? 'up' : 'down';
                const absPct = Math.abs(deltaPct).toFixed(2);
                const formattedPrice = formatPrice(price);

                for (const t of tokens) {
                    pushMessages.push({
                        to: t,
                        sound: 'default',
                        title: `${row.symbol} Price Update`,
                        body: `${row.symbol} is ${direction} ${absPct}% — now at ${formattedPrice}`,
                        data: {
                            type: 'price_alert',
                            symbol: row.symbol,
                            changePercent: deltaPct,
                            currentPrice: price,
                        },
                        channelId: 'default',
                        priority: 'high',
                    });
                }
            }
        }
    }

    // 6. Dispatch pushes.
    if (pushMessages.length > 0) {
        await sendExpoPush(pushMessages);
    }

    // 7. Persist baselines + alert timestamps.
    for (const u of alertedRowUpdates) {
        await supabase
            .from('user_watched_tokens')
            .update({
                baseline_price: u.baseline_price,
                baseline_ts: u.baseline_ts,
                last_alerted_at: u.last_alerted_at,
            })
            .eq('id', u.id);
    }
    for (const u of baselineOnlyUpdates) {
        await supabase
            .from('user_watched_tokens')
            .update({
                baseline_price: u.baseline_price,
                baseline_ts: u.baseline_ts,
            })
            .eq('id', u.id);
    }

    return new Response(
        JSON.stringify({
            ok: true,
            checked: watched.length,
            uniqueTokens: uniqueTokens.size,
            priced: priceResults.size,
            alerts: pushMessages.length,
            baselinesSeeded: baselineOnlyUpdates.length,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
});
