/**
 * Token spam / scam / honeypot filter.
 *
 * Direct port of `isSpamToken` in
 * tiwi-user-app/components/swap/token-selector-modal.tsx. The web selector is
 * the reference implementation for what a token picker may show, so keep the
 * two in sync - if a rule changes there, change it here too.
 *
 * Why this exists: `/api/v1/tokens` is a raw index, not a curated list. A
 * plain `chains=56&limit=50` browse returns "01", "100¥", "1ART", "赵长娥"
 * and fifteen different tokens all calling themselves "BSC" - and it marks
 * several of them `verified: true` while leaving BNB/USDT/USDC unverified.
 * `verified` alone is therefore useless as a gate.
 */

export interface SpamSignals {
    marketCap?: number;
    liquidity?: number;
    volume24h?: number;
    verified?: boolean;
    isHoneypot?: boolean;
}

/** Contract addresses that must never be filtered, whatever the heuristics say. */
const WHITELISTED_TOKENS = new Set([
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT Ethereum
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC Ethereum
    '0x55d398326f99059ff775485246999027b3197955', // USDT BSC
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC BSC
    '0xda1060158f7d593667cce0a15db346bb3ffb3596', // TWC BSC
    '0x0000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000001010',
    'so11111111111111111111111111111111111111112', // SOL
    'epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v', // USDC Solana
]);

const WHITELISTED_SYMBOLS = new Set([
    'eth', 'btc', 'bnb', 'usdt', 'usdc', 'busd', 'dai', 'twc', 'sol', 'matic', 'pol',
    'avax', 'ftm', 'arb', 'op', 'base', 'link', 'uni', 'aave', 'crv', 'cake',
    'ton', 'trx', 'atom', 'not', 'dogs', 'hmstr', 'sui', 'sei', 'apt', 'near',
    'doge', 'shib', 'pepe', 'wbtc', 'weth', 'dot', 'ada', 'xrp', 'ltc',
    'jup', 'ray', 'bonk', 'wif', 'pyth', 'render', 'inj', 'floki', 'pendle',
]);

const SPAM_PATTERNS = [
    'airdrop', 'free', 'claim', 'reward', 'bonus', 'gift',
    'visit', 'http', 'www.', '.com', '.net', '.org', '.pump',
    'pump.fun', 'test', 'dev', 'scam', 'hack', 'exploit',
    'honeypot', 'rug', 'rugpull',
    '领取', '空投', '免费',
];

const SOLANA_CHAIN_ID = 7565164;

/** Returns true when the token should be HIDDEN. */
export function isSpamToken(
    name: string,
    symbol: string,
    address?: string,
    chainId?: number,
    extra?: SpamSignals,
): boolean {
    name = name || '';
    symbol = symbol || '';

    // ── 1. Whitelist of known legitimate tokens (never filter) ──
    if (address && WHITELISTED_TOKENS.has(address.toLowerCase())) return false;

    // SOL symbol on non-Solana chains = fake token
    if (symbol.toLowerCase() === 'sol' && chainId && chainId !== SOLANA_CHAIN_ID) return true;
    // SOL on Solana must be the real native mint
    if (symbol.toLowerCase() === 'sol' && chainId === SOLANA_CHAIN_ID && address &&
        address !== 'So11111111111111111111111111111111111111112' &&
        address !== '0x0000000000000000000000000000000000000000') return true;
    // USDT on Solana is almost always a scam (the real Solana stablecoin is USDC)
    if (symbol.toLowerCase() === 'usdt' && chainId === SOLANA_CHAIN_ID && address &&
        address !== 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') return true;

    if (WHITELISTED_SYMBOLS.has(symbol.toLowerCase())) return false;

    // ── 2. Honeypot detection ──
    if (extra?.isHoneypot === true) return true;

    // ── 3. Market cap floor ──
    if (extra?.marketCap !== undefined && extra.marketCap > 0 && extra.marketCap < 10_000) return true;

    // ── 4. Fake liquidity detection ──
    if (extra?.marketCap && extra?.liquidity !== undefined) {
        const ratio = extra.liquidity / extra.marketCap;
        if (extra.marketCap > 100_000 && ratio < 0.001) return true;
    }
    if (extra?.liquidity !== undefined && extra.liquidity < 500 &&
        (extra?.volume24h === undefined || extra.volume24h < 100)) return true;

    const nameLower = name.toLowerCase();
    const symbolLower = symbol.toLowerCase();

    // ── 5. Name/symbol spam patterns ──
    if (nameLower.includes('meme') || symbolLower.includes('meme')) return true;

    const chineseChars = (name.match(/[\u4e00-\u9fff]/g) || []).length;
    if (name.length > 0 && chineseChars / name.length > 0.5) return true;

    for (const pattern of SPAM_PATTERNS) {
        if (nameLower.includes(pattern) || symbolLower.includes(pattern)) return true;
    }

    // ── 6. Suspicious symbol patterns ──
    const impersonationPatterns = /^(usdt|usdc|eth|bnb|sol)\d+$/i;
    if (impersonationPatterns.test(symbol)) return true;

    // Symbols that are just numbers or a single char - this is what catches
    // the "01" / "1" style index junk.
    if (/^\d+$/.test(symbol) || symbol.length <= 1) return true;

    if (symbol.length > 12) return true;

    return false;
}
