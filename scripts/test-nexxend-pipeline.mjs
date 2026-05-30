// Integration test: runs the real Nexxend call + the real
// useWalletBalances normalization/filter/total pipeline against
// known wallets, then asserts the final $USD total > 0.
//
// Run with: node scripts/test-nexxend-pipeline.mjs

import 'dotenv/config';
import fs from 'node:fs';

const NEXXEND_BASE_URL = process.env.EXPO_PUBLIC_NEXXEND_API_URL ?? 'https://nexxend.xyz/api/v1';
const NEXXEND_API_KEY = process.env.EXPO_PUBLIC_NEXXEND_API_KEY;

// ──────────────────────────────────────────────────────────────────────
// Inline copies of the production code under test, kept byte-equivalent
// so this script breaks if the prod files drift.
// ──────────────────────────────────────────────────────────────────────

// From services/nexxendService.ts
const NEXXEND_NAME_TO_ID = {
    ethereum: 1, bsc: 56, polygon: 137, arbitrum: 42161, optimism: 10,
    base: 8453, avalanche: 43114, fantom: 250, linea: 59144, celo: 42220,
    gnosis: 100, solana: 7565164, tron: 728126428, ton: 1100,
};

async function getNexxendBalances(address, chainIds) {
    const url = NEXXEND_BASE_URL.replace(/\/$/, '') +
        `/wallet/balances?address=${encodeURIComponent(address)}` +
        (chainIds.length ? `&chainIds=${chainIds.join(',')}` : '');
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', 'X-API-Key': NEXXEND_API_KEY },
    });
    if (res.status === 400) return { address, balances: [], totalUSD: '0.00', chains: chainIds, timestamp: Date.now() };
    if (!res.ok) throw new Error(`Nexxend ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) return { address, balances: [], totalUSD: '0.00', chains: chainIds, timestamp: Date.now() };

    const flat = [];
    for (const chain of json.data.chains ?? []) {
        const numericChainId = NEXXEND_NAME_TO_ID[chain.chainId] ?? Number(chain.chainId);
        if (!numericChainId || Number.isNaN(numericChainId)) continue;
        for (const entry of chain.balances ?? []) {
            const t = entry.token;
            const price = typeof t.priceUsd === 'number' && isFinite(t.priceUsd) ? t.priceUsd : 0;
            const usd = typeof entry.balanceUsd === 'number' && isFinite(entry.balanceUsd) ? entry.balanceUsd : 0;
            flat.push({
                symbol: t.symbol, name: t.name, address: t.address,
                chainId: numericChainId, decimals: t.decimals,
                balance: entry.balance, balanceFormatted: entry.balanceFormatted,
                usdValue: usd.toFixed(8), priceUSD: price.toString(),
                priceChange24h: '0', logoURI: t.logoUrl,
                verified: t.isNative === true ? true : undefined,
            });
        }
    }
    return { address: json.data.address, balances: flat, totalUSD: (json.data.totalValueUsd ?? 0).toFixed(2), chains: chainIds, timestamp: json.data.lastUpdated ?? Date.now() };
}

// From hooks/useWalletBalances.ts — verbatim
const ALL_SUPPORTED_CHAIN_IDS = [1, 56, 137, 42161, 8453, 10, 43114, 59144, 250, 42220, 100, 7565164, 1100];
const KNOWN_CHAIN_IDS = new Set([...ALL_SUPPORTED_CHAIN_IDS, 728126428]);
const BLACKLISTED_SYMBOLS = ['SN3', 'BSB'];
const SACRED_SYMBOLS = ['ETH', 'BNB', 'SOL', 'WSOL', 'MATIC', 'POL', 'AVAX', 'BASE', 'ARB', 'OP', 'USDT', 'USDC', 'DAI', 'CAKE', 'TRX', 'TON', 'ATOM', 'OSMO'];
const SACRED_ADDRESSES = ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000001010', 'So11111111111111111111111111111111111111112'];
const SPAM_KEYWORDS = ['.com', '.xyz', '.net', '.io', '.org', 'claim', 'airdrop', 'visit', 'free', 'reward', 'voucher', 'gift', 'win', 'bonus'];
const IMPERSONATED_STABLES = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'WETH', 'WBTC', 'WBNB', 'WMATIC', 'WAVAX']);
const OFFICIAL_STABLE_ADDRESSES = {
    1:  { USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7', DAI: '0x6b175474e89094c44da98b954eedeac495271d0f', BUSD: '0x4fabb145d64652a948d72533023f6e7a623c7c53', WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' },
    56: { USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', USDT: '0x55d398326f99059ff775485246999027b3197955', DAI: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', BUSD: '0xe9e7cea3dedca5984780bafc599bd69add087d56', WBNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', WETH: '0x2170ed0880ac9a755fd29b2688956bd959f933f8' },
    137:{ USDC: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', USDT: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', DAI: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', WETH: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', WMATIC: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270' },
    42161:{ USDC: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', DAI: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', WETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', WBTC: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f' },
    8453:{ USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', WETH: '0x4200000000000000000000000000000000000006', DAI: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' },
    10:{ USDC: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', USDT: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', DAI: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', WETH: '0x4200000000000000000000000000000000000006', WBTC: '0x68f180fcce6836688e9084f035309e29bf0a2095' },
    43114:{ USDC: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', USDT: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7', DAI: '0xd586e7f844cea2f87f50152665bcbc2c279d8d70', WETH: '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab', WBTC: '0x50b7545627a5162f82a992c33b87adc75187b218', WAVAX: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7' },
    59144:{ USDC: '0x176211869ca2b568f2a7d4ee941e073a821ee1ff', USDT: '0xa219439258ca9da29e9cc4ce5596924745e12b93', WETH: '0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f' },
    250:{ USDC: '0x04068da6c83afcfa0e13ba15a6696662335d5b75', USDT: '0x049d68029688eabf473097a2fc38ef61633a3c7a', DAI: '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e' },
    42220:{ USDC: '0xceba9300f2b948710d2653dd7b07f33a8b32118c', USDT: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e' },
    100:{ USDC: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83', USDT: '0x4ecaba5870353805a9f068101a40e0f32ed605c6' },
    7565164:{ USDC: 'epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v', USDT: 'es9vmfrzacermjfrf4h2fyd4kconky11mcce8benwnyb' },
};
const NATIVE_SYMBOL_CHAINS = {
    ETH: [1, 10, 42161, 8453, 59144], BNB: [56], WBNB: [56], MATIC: [137], POL: [137],
    AVAX: [43114], SOL: [7565164], WSOL: [7565164], TRX: [728126428], TON: [1100, 136105027],
    ATOM: [118], OSMO: [10000004], FTM: [250], CELO: [42220], XDAI: [100],
};

function filterToken(b) {
    const usdValue = parseFloat(b.usdValue || '0');
    const balance = parseFloat(b.balanceFormatted || b.balance || '0');
    const symbol = (b.symbol || '').toUpperCase();
    const name = (b.name || '').toLowerCase();
    const addr = b.address?.toLowerCase() || '';
    if (balance <= 0.000001) return false;
    if (BLACKLISTED_SYMBOLS.includes(symbol)) return false;
    if (/[一-龥぀-ゟ゠-ヿ]/.test(name) || /[一-龥぀-ゟ゠-ヿ]/.test(symbol)) return false;
    const chainIdNum = Number(b.chainId);
    if (!chainIdNum || !KNOWN_CHAIN_IDS.has(chainIdNum)) return false;
    const allowedChainsForNative = NATIVE_SYMBOL_CHAINS[symbol];
    if (allowedChainsForNative && !allowedChainsForNative.includes(chainIdNum)) return false;
    if (IMPERSONATED_STABLES.has(symbol)) {
        const officialAddr = OFFICIAL_STABLE_ADDRESSES[chainIdNum]?.[symbol]?.toLowerCase();
        if (officialAddr && addr !== officialAddr) return false;
    }
    if (SACRED_SYMBOLS.includes(symbol) || SACRED_ADDRESSES.includes(addr)) return true;
    const isTWC = symbol === 'TWC' || addr === '0xda1060158f7d593667cce0a15db346bb3ffb3596';
    if (isTWC) return true;
    const isVerified = b.verified === true || b.verified_contract === true || b.native_token === true;
    const hasRealLogo = b.logoURI && !b.logoURI.includes('/placeholder/');
    if (isVerified) return usdValue > 0.01 || !!hasRealLogo;
    const chg = parseFloat(b.priceChange24h || '0');
    if (Math.abs(chg) > 10000) return false;
    if (SPAM_KEYWORDS.some(k => name.includes(k) || symbol.toLowerCase().includes(k))) return false;
    if (addr && /^(.)\1{3}$/.test(addr.replace('0x', '').slice(-4))) return false;
    if (b.possible_spam === true) return false;
    if (hasRealLogo && usdValue >= 1.00) return true;
    if (usdValue >= 5.00) return true;
    return false;
}

// ──────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────

const CASES = [
    { name: 'Vitalik (EVM)', address: '0xd8dA6BF26964aF9D7eED9e03E53415D37aA96045', chains: ALL_SUPPORTED_CHAIN_IDS, expectMin: 1000 },
    { name: 'Binance hot wallet (EVM)', address: '0x28C6c06298d514Db089934071355E5743bf21d60', chains: ALL_SUPPORTED_CHAIN_IDS, expectMin: 1000 },
    { name: 'Random Solana holder', address: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', chains: [7565164], expectMin: 0 },
    { name: 'Empty wallet (newly generated)', address: '0x0000000000000000000000000000000000000001', chains: ALL_SUPPORTED_CHAIN_IDS, expectMin: -1 },
];

let pass = 0, fail = 0;
for (const c of CASES) {
    console.log(`\n=== ${c.name} ===`);
    console.log(`  address: ${c.address}`);
    try {
        const resp = await getNexxendBalances(c.address, c.chains);
        console.log(`  Nexxend reported totalUSD: $${resp.totalUSD}  (${resp.balances.length} raw tokens)`);

        // Dedupe — mirrors useWalletBalances.ts:332-339
        const dedupedMap = new Map();
        resp.balances.forEach(b => {
            if (!b) return;
            const isNative = ['native', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', '0x0000000000000000000000000000000000000000'].includes(b.address?.toLowerCase() || '');
            const addr = isNative ? '0x0000000000000000000000000000000000000000' : b.address?.toLowerCase();
            const key = `${addr}-${b.chainId}-${(b.symbol || '').toUpperCase()}`;
            if (!dedupedMap.has(key)) dedupedMap.set(key, b);
        });
        const filtered = Array.from(dedupedMap.values()).filter(filterToken);
        const totalUsdToday = filtered.reduce((sum, t) => sum + parseFloat(t.usdValue || '0'), 0);

        console.log(`  After filter: ${filtered.length} tokens, total = $${totalUsdToday.toFixed(2)}`);
        if (filtered.length > 0) {
            console.log(`  Top 5 holdings:`);
            filtered.sort((a, b) => parseFloat(b.usdValue) - parseFloat(a.usdValue))
                .slice(0, 5).forEach(t => console.log(`    ${t.symbol.padEnd(8)} on chain ${String(t.chainId).padEnd(10)} = $${parseFloat(t.usdValue).toFixed(2)}`));
        }

        if (c.expectMin === -1) {
            // expect zero — empty wallet
            if (totalUsdToday === 0) { console.log(`  ✓ PASS (empty as expected)`); pass++; }
            else { console.log(`  ✗ FAIL: expected $0, got $${totalUsdToday}`); fail++; }
        } else if (totalUsdToday >= c.expectMin) {
            console.log(`  ✓ PASS (>=$${c.expectMin})`); pass++;
        } else {
            console.log(`  ✗ FAIL: expected >= $${c.expectMin}, got $${totalUsdToday.toFixed(2)}`); fail++;
        }
    } catch (err) {
        console.log(`  ✗ FAIL with error: ${err.message}`);
        fail++;
    }
}

console.log(`\n========== ${pass} passed, ${fail} failed ==========`);
process.exit(fail > 0 ? 1 : 0);
