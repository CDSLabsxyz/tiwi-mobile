import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useTokens } from '@/hooks/useTokens';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { api } from '@/lib/mobile/api-client';
import { getDexScreenerLogo, getTokenLogo } from '@/services/tokenLogoService';
import { useCustomTokenStore } from '@/store/customTokenStore';
import { useWalletStore } from '@/store/walletStore';
import { getColorFromSeed } from '@/utils/formatting';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { arbitrum, avalanche, base, bsc, erc20Abi, formatUnits, mainnet, optimism, polygon } from 'viem';
import { createPublicClient, http } from 'viem';

const PasteIcon = require('@/assets/wallet/clipboard.svg');

// Free public RPC endpoints — no API key required
const TRUSTWALLET_SLUGS: Record<number, string> = {
    1: 'ethereum',
    56: 'smartchain',
    137: 'polygon',
    42161: 'arbitrum',
    8453: 'base',
    10: 'optimism',
    43114: 'avalanchec',
};

function getTrustWalletLogo(chainId?: number, address?: string): string | undefined {
    if (!chainId || !address) return undefined;
    const slug = TRUSTWALLET_SLUGS[chainId];
    if (!slug) return undefined;
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${slug}/assets/${address}/logo.png`;
}

const CHAIN_CONFIG: Record<number, { chain: any; rpcUrl?: string }> = {
    1: { chain: mainnet, rpcUrl: 'https://eth.llamarpc.com' },
    56: { chain: bsc, rpcUrl: 'https://bsc-dataseed.binance.org' },
    137: { chain: polygon, rpcUrl: 'https://polygon-rpc.com' },
    8453: { chain: base, rpcUrl: 'https://mainnet.base.org' },
    42161: { chain: arbitrum, rpcUrl: 'https://arb1.arbitrum.io/rpc' },
    10: { chain: optimism, rpcUrl: 'https://mainnet.optimism.io' },
    43114: { chain: avalanche, rpcUrl: 'https://api.avax.network/ext/bc/C/rpc' },
};

async function fetchSolanaBalance(mintAddr: string, walletAddr: string) {
    const rpcUrl = 'https://api.mainnet-beta.solana.com';
    const body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [walletAddr, { mint: mintAddr }, { encoding: 'jsonParsed' }],
    };
    const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await resp.json();
    const accounts = data?.result?.value || [];
    if (accounts.length === 0) return { balance: '0', balanceFormatted: '0', decimals: 9 };
    const info = accounts[0]?.account?.data?.parsed?.info;
    return {
        balance: info?.tokenAmount?.amount || '0',
        balanceFormatted: info?.tokenAmount?.uiAmountString || '0',
        decimals: info?.tokenAmount?.decimals ?? 9,
    };
}

async function fetchTronBalance(contractAddr: string, walletAddr: string) {
    const url = `https://api.trongrid.io/v1/accounts/${walletAddr}/tokens?limit=200`;
    const resp = await fetch(url);
    const data = await resp.json();
    const tokens = Array.isArray(data?.data) ? data.data : [];
    const match = tokens.find((t: any) =>
        (t.tokenId === contractAddr) ||
        (t.contractAddress?.toLowerCase() === contractAddr.toLowerCase())
    );
    if (!match) return { balance: '0', balanceFormatted: '0', decimals: 6, symbol: '', name: '' };
    const decimals = match.tokenDecimal || 6;
    const raw = BigInt(match.balance || '0');
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = raw / divisor;
    const frac = raw % divisor;
    const balanceFormatted = frac === 0n
        ? whole.toString()
        : `${whole}.${frac.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
    return {
        balance: match.balance || '0',
        balanceFormatted,
        decimals,
        symbol: match.tokenAbbr || '',
        name: match.tokenName || '',
    };
}

async function fetchTonBalance(jettonMasterAddr: string, walletAddr: string) {
    const url = `https://toncenter.com/api/v3/jetton/wallets?owner_address=${walletAddr}&jetton_address=${jettonMasterAddr}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const wallets = Array.isArray(data?.jetton_wallets) ? data.jetton_wallets : [];
    if (wallets.length === 0) return { balance: '0', balanceFormatted: '0', decimals: 9 };
    const w = wallets[0];
    const decimals = 9;
    const raw = BigInt(w.balance || '0');
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = raw / divisor;
    const frac = raw % divisor;
    const balanceFormatted = frac === 0n
        ? whole.toString()
        : `${whole}.${frac.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
    return { balance: w.balance || '0', balanceFormatted, decimals };
}

async function fetchCosmosBalance(denom: string, walletAddr: string) {
    const url = `https://cosmos-rest.publicnode.com/cosmos/bank/v1beta1/balances/${walletAddr}/by_denom?denom=${encodeURIComponent(denom)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const amount = data?.balance?.amount || '0';
    const decimals = 6;
    const raw = BigInt(amount);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = raw / divisor;
    const frac = raw % divisor;
    const balanceFormatted = frac === 0n
        ? whole.toString()
        : `${whole}.${frac.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
    return { balance: amount, balanceFormatted, decimals };
}

async function fetchOnChainBalance(chainId: number, contractAddr: string, walletAddr: string) {
    const config = CHAIN_CONFIG[chainId];
    if (!config) throw new Error('Unsupported chain');

    const client = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
    });

    const [balance, decimals, symbol, name] = await Promise.all([
        client.readContract({
            address: contractAddr as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [walletAddr as `0x${string}`],
        }),
        client.readContract({
            address: contractAddr as `0x${string}`,
            abi: erc20Abi,
            functionName: 'decimals',
        }).catch(() => 18),
        client.readContract({
            address: contractAddr as `0x${string}`,
            abi: erc20Abi,
            functionName: 'symbol',
        }).catch(() => 'UNKNOWN'),
        client.readContract({
            address: contractAddr as `0x${string}`,
            abi: erc20Abi,
            functionName: 'name',
        }).catch(() => 'Custom Token'),
    ]);

    const balanceFormatted = formatUnits(balance as bigint, decimals as number);
    return {
        balance: (balance as bigint).toString(),
        balanceFormatted,
        decimals: decimals as number,
        symbol: symbol as string,
        name: name as string,
    };
}

const CHAINS = [
    { id: 1, name: 'Ethereum', icon: require('@/assets/home/chains/ethereum.svg') },
    { id: 56, name: 'BNB Chain', icon: require('@/assets/home/chains/bsc.svg') },
    { id: 137, name: 'Polygon', icon: require('@/assets/home/chains/polygon.svg') },
    { id: 8453, name: 'Base', icon: require('@/assets/home/chains/base.png') },
    { id: 42161, name: 'Arbitrum', icon: require('@/assets/home/chains/ethereum.svg') },
    { id: 10, name: 'Optimism', icon: require('@/assets/home/chains/optimism.png') },
    { id: 43114, name: 'Avalanche', icon: require('@/assets/home/chains/avalanche.svg') },
    { id: 7565164, name: 'Solana', icon: require('@/assets/home/chains/solana.svg') },
    { id: 728126428, name: 'TRON', icon: require('@/assets/home/chains/tron.png') },
    { id: 1100, name: 'TON', icon: require('@/assets/home/chains/ton.jpg') },
    { id: 118, name: 'Cosmos', icon: require('@/assets/home/chains/cosmos.svg') },
];

// Synthesized native tokens — chain natives have no ERC-20 contract so they
// never appear in the token-list API. Each entry uses the 0x0 / chain-specific
// sentinel address so getDexScreenerLogo resolves the right logo via the
// NATIVE_TOKEN_ADDRESSES mapping in tokenLogoService.
const EVM_NATIVE_SENTINEL = '0x0000000000000000000000000000000000000000';
const NATIVE_TOKENS: any[] = [
    { chainId: 1, symbol: 'ETH', name: 'Ethereum', decimals: 18, address: EVM_NATIVE_SENTINEL, isNative: true, _primaryNative: true },
    { chainId: 56, symbol: 'BNB', name: 'BNB', decimals: 18, address: EVM_NATIVE_SENTINEL, isNative: true, _primaryNative: true },
    { chainId: 137, symbol: 'POL', name: 'Polygon', decimals: 18, address: EVM_NATIVE_SENTINEL, isNative: true, _primaryNative: true },
    { chainId: 43114, symbol: 'AVAX', name: 'Avalanche', decimals: 18, address: EVM_NATIVE_SENTINEL, isNative: true, _primaryNative: true },
    { chainId: 7565164, symbol: 'SOL', name: 'Solana', decimals: 9, address: 'So11111111111111111111111111111111111111112', isNative: true, _primaryNative: true },
    { chainId: 728126428, symbol: 'TRX', name: 'TRON', decimals: 6, address: 'native', isNative: true, _primaryNative: true },
    { chainId: 1100, symbol: 'TON', name: 'Toncoin', decimals: 9, address: 'native', isNative: true, _primaryNative: true },
    { chainId: 118, symbol: 'ATOM', name: 'Cosmos Hub', decimals: 6, address: 'uatom', isNative: true, _primaryNative: true },
    // Per-L2 ETH — only surfaced when that chain's filter is active
    { chainId: 8453, symbol: 'ETH', name: 'Ethereum (Base)', decimals: 18, address: EVM_NATIVE_SENTINEL, isNative: true },
    { chainId: 42161, symbol: 'ETH', name: 'Ethereum (Arbitrum)', decimals: 18, address: EVM_NATIVE_SENTINEL, isNative: true },
    { chainId: 10, symbol: 'ETH', name: 'Ethereum (Optimism)', decimals: 18, address: EVM_NATIVE_SENTINEL, isNative: true },
];

// Curated blue-chip + ecosystem tokens — prepended after natives so the
// default browse list always shows recognizable assets even when the
// tokens API's "hot" category is full of long-tail spam. Addresses are
// the canonical, widely-deployed contracts on each chain.
const FEATURED_TOKENS: any[] = [
    // Ethereum
    { chainId: 1, symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    { chainId: 1, symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { chainId: 1, symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
    { chainId: 1, symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8, address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
    { chainId: 1, symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    { chainId: 1, symbol: 'LINK', name: 'Chainlink', decimals: 18, address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
    { chainId: 1, symbol: 'UNI', name: 'Uniswap', decimals: 18, address: '0x1f9840a85d5aF5bf1D1762F925BdADdC4201F984' },
    { chainId: 1, symbol: 'AAVE', name: 'Aave', decimals: 18, address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' },
    { chainId: 1, symbol: 'SHIB', name: 'Shiba Inu', decimals: 18, address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE' },
    { chainId: 1, symbol: 'PEPE', name: 'Pepe', decimals: 18, address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933' },
    // BSC
    { chainId: 56, symbol: 'TWC', name: 'TIWI Coin', decimals: 9, address: '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596' },
    { chainId: 56, symbol: 'WKC', name: 'WikiCat Coin', decimals: 9, address: '0x6Ec90334d89dBdc89E08A133271be3d104128Edb' },
    { chainId: 56, symbol: 'USDT', name: 'Tether USD', decimals: 18, address: '0x55d398326f99059fF775485246999027B3197955' },
    { chainId: 56, symbol: 'USDC', name: 'USD Coin', decimals: 18, address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' },
    { chainId: 56, symbol: 'BUSD', name: 'Binance USD', decimals: 18, address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' },
    { chainId: 56, symbol: 'BTCB', name: 'Bitcoin BEP20', decimals: 18, address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c' },
    { chainId: 56, symbol: 'ETH', name: 'Ethereum Token', decimals: 18, address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' },
    { chainId: 56, symbol: 'WBNB', name: 'Wrapped BNB', decimals: 18, address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' },
    { chainId: 56, symbol: 'CAKE', name: 'PancakeSwap', decimals: 18, address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
    // Polygon
    { chainId: 137, symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
    { chainId: 137, symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
    { chainId: 137, symbol: 'WMATIC', name: 'Wrapped MATIC', decimals: 18, address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' },
    // Arbitrum
    { chainId: 42161, symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
    { chainId: 42161, symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
    { chainId: 42161, symbol: 'ARB', name: 'Arbitrum', decimals: 18, address: '0x912CE59144191C1204E64559FE8253a0e49E6548' },
    // Base
    { chainId: 8453, symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    // Optimism
    { chainId: 10, symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' },
    { chainId: 10, symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
    { chainId: 10, symbol: 'OP', name: 'Optimism', decimals: 18, address: '0x4200000000000000000000000000000000000042' },
    // Avalanche
    { chainId: 43114, symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7' },
    { chainId: 43114, symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' },
    // Solana
    { chainId: 7565164, symbol: 'USDC', name: 'USD Coin', decimals: 6, address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    { chainId: 7565164, symbol: 'USDT', name: 'Tether USD', decimals: 6, address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
];

export default function ManageTokensScreen() {
    const router = useRouter();
    const { top, bottom } = useSafeAreaInsets();

    const [selectedChain, setSelectedChain] = useState(56);
    const [contractAddress, setContractAddress] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [tokenInfo, setTokenInfo] = useState<any>(null);
    const [error, setError] = useState('');
    const [addModalVisible, setAddModalVisible] = useState(false);
    // Token queued for removal — the trash icon only sets this; the
    // actual delete happens after the user confirms in the modal.
    const [tokenToRemove, setTokenToRemove] = useState<{ address: string; chainId: number; symbol: string } | null>(null);

    const closeAddModal = () => {
        setAddModalVisible(false);
        setContractAddress('');
        setTokenInfo(null);
        setError('');
    };

    const { addToken, hasToken, toggleTokenHidden, removeToken, toggleWalletTokenHidden, isWalletTokenHidden } = useCustomTokenStore();
    const tokensByWallet = useCustomTokenStore(s => s.tokensByWallet);
    const hiddenWalletTokens = useCustomTokenStore(s => s.hiddenWalletTokens);
    const { walletGroups, activeGroupId, address } = useWalletStore();
    const walletKey = activeGroupId || address || 'default';
    const myTokens = useMemo(() => tokensByWallet[walletKey] || [], [tokensByWallet, walletKey]);
    const { data: balanceData } = useWalletBalances();
    const fetchedTokens = balanceData?.tokens || [];

    // Unified "Your Tokens" list: wallet-held tokens + user-added tokens,
    // deduped by (chainId,address). Custom entries override fetched ones so
    // the trash action stays available for anything the user added manually.
    type YourTokenRow = {
        key: string;
        address: string;
        chainId: number;
        symbol: string;
        name: string;
        logoURI?: string;
        isCustom: boolean;
        hidden: boolean;
        balanceFormatted?: string;
        usdValue?: string;
    };

    const yourTokens = useMemo<YourTokenRow[]>(() => {
        const map = new Map<string, YourTokenRow>();
        fetchedTokens.forEach((t: any) => {
            const chainId = Number(t.chainId);
            if (!t?.address) return;
            const k = `${chainId}-${t.address.toLowerCase()}`;
            map.set(k, {
                key: k,
                address: t.address,
                chainId,
                symbol: t.symbol || 'UNKNOWN',
                name: t.name || t.symbol || 'Token',
                logoURI: t.logoURI,
                isCustom: false,
                hidden: isWalletTokenHidden(walletKey, t.address, chainId),
                balanceFormatted: t.balanceFormatted,
                usdValue: t.usdValue,
            });
        });
        myTokens.forEach(ct => {
            const k = `${ct.chainId}-${ct.address.toLowerCase()}`;
            const existing = map.get(k);
            map.set(k, {
                key: k,
                address: ct.address,
                chainId: ct.chainId,
                symbol: ct.symbol,
                name: ct.name,
                logoURI: ct.logoURI,
                isCustom: true,
                hidden: !!ct.hidden,
                // Prefer live-fetched balance when available; fall back to
                // the value persisted on the custom-token record.
                balanceFormatted: existing?.balanceFormatted ?? ct.balanceFormatted,
                usdValue: existing?.usdValue ?? ct.usdValue,
            });
        });
        return Array.from(map.values());
    }, [fetchedTokens, myTokens, hiddenWalletTokens, walletKey, isWalletTokenHidden]);

    // Live token search — mirrors the Receive Asset page. When the user
    // types, we hit the tokens list endpoint server-side so any token
    // on a supported chain can be found, not just the top-N preloaded.
    const [browseQuery, setBrowseQuery] = useState('');
    const [chainFilter, setChainFilter] = useState<number | null>(null);

    // Chain filter applies to the whole page — Your Tokens and Browse both
    // narrow to the selected chain so the user sees a coherent per-chain view.
    const filteredYourTokens = useMemo(
        () => chainFilter ? yourTokens.filter(t => t.chainId === chainFilter) : yourTokens,
        [yourTokens, chainFilter]
    );

    // Fetch a wider pool than we render — spam/CJK/impostor filtering and
    // Your-Tokens dedupe can easily drop 30-50% of results, so pulling 150
    // upstream lets us still land at the 50-per-chain display target below.
    const { data: searchResponse, isLoading: isSearchingBrowse } = useTokens({
        chains: chainFilter ? [chainFilter] : undefined,
        query: browseQuery,
        limit: 150,
        enabled: browseQuery.trim().length > 0,
    });

    // No category filter — the API should return the full sorted token
    // set (by liquidity/popularity). The "hot" bucket was too narrow and
    // gated non-EVM chains to near-empty lists.
    const { data: defaultBrowseResponse, isLoading: isLoadingBrowseDefaults } = useTokens({
        chains: chainFilter ? [chainFilter] : undefined,
        limit: 150,
        enabled: browseQuery.trim().length === 0,
    });

    const browseLoading = isSearchingBrowse || isLoadingBrowseDefaults;

    const filteredBrowse = useMemo(() => {
        const apiTokens = browseQuery.trim()
            ? (searchResponse?.tokens || [])
            : (defaultBrowseResponse?.tokens || []);

        // Which native rows are eligible for the current view: when a chain
        // filter is active, only that chain's native; otherwise only the
        // "primary" natives (skips Base/Arb/Op ETH duplicates on the All tab).
        const eligibleNatives = NATIVE_TOKENS.filter(n => {
            if (chainFilter) return n.chainId === chainFilter;
            return n._primaryNative === true;
        });

        // Respect the search query: match on symbol or name so typing
        // "eth" / "solana" still highlights the synthetic native rows.
        const q = browseQuery.trim().toLowerCase();
        const matchingNatives = q
            ? eligibleNatives.filter(n =>
                (n.symbol || '').toLowerCase().includes(q) ||
                (n.name || '').toLowerCase().includes(q)
            )
            : eligibleNatives;

        // Curated blue-chips + TWC/WKC — filter by chain chip, then by query.
        const eligibleFeatured = FEATURED_TOKENS.filter(f =>
            chainFilter ? f.chainId === chainFilter : true
        );
        const matchingFeatured = q
            ? eligibleFeatured.filter(f =>
                (f.symbol || '').toLowerCase().includes(q) ||
                (f.name || '').toLowerCase().includes(q) ||
                (f.address || '').toLowerCase().includes(q)
            )
            : eligibleFeatured;

        const raw = [...matchingNatives, ...matchingFeatured, ...apiTokens];

        // Native symbol per chain — anything on these (symbol, chainId) pairs
        // is treated as the chain's native asset and floats to the top.
        const NATIVE_SYMBOL_BY_CHAIN: Record<number, string> = {
            1: 'ETH',
            56: 'BNB',
            137: 'POL',
            42161: 'ETH',
            8453: 'ETH',
            10: 'ETH',
            43114: 'AVAX',
            7565164: 'SOL',
            728126428: 'TRX',
            1100: 'TON',
            118: 'ATOM',
        };
        const NATIVE_ADDR_MARKERS = new Set([
            '0x0000000000000000000000000000000000000000',
            '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            'native',
        ]);
        const isNativeToken = (t: any) => {
            const sym = (t.symbol || '').toUpperCase();
            const addr = (t.address || '').toLowerCase();
            const expected = NATIVE_SYMBOL_BY_CHAIN[Number(t.chainId)];
            if (expected && sym === expected) return true;
            if (NATIVE_ADDR_MARKERS.has(addr)) return true;
            return false;
        };

        // "Active" = user currently holds a balance for this token
        const activeKeys = new Set(
            (balanceData?.tokens || [])
                .filter((wt: any) => parseFloat(wt.balanceFormatted || '0') > 0)
                .map((wt: any) => `${wt.chainId}-${(wt.address || '').toLowerCase()}`)
        );

        // Keys for every row already shown in the "Your Tokens" section —
        // browse list should never display those (they live up top already).
        const yourTokenKeys = new Set(yourTokens.map(y => y.key));
        // Secondary index by chainId+symbol — wallet-balance APIs use varying
        // native sentinels (0x0, 'native', 'uatom', wrapped address) so a
        // strict address match can miss natives that are already held.
        const yourTokenSymbolKeys = new Set(
            yourTokens.map(y => `${y.chainId}-${(y.symbol || '').toUpperCase()}`)
        );
        // Chain-agnostic symbol set — used only for PRIMARY natives shown
        // on the "All" tab. Prevents e.g. synthetic mainnet ETH appearing
        // in browse when the user already holds ETH on Base / Arb / Op.
        const yourTokenSymbols = new Set(
            yourTokens.map(y => (y.symbol || '').toUpperCase())
        );

        // CJK detector — catches Chinese/Japanese/Korean chars anywhere
        // in the symbol or name (spammy impersonation tokens often use these).
        const CJK_RE = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/;

        // Canonical chain for each chain-native symbol — on the "All" tab
        // a token with one of these symbols must live on its home chain
        // or it's either a bridged wrapper or an impersonator.
        const PRIMARY_NATIVE_SYMBOL_TO_CHAIN: Record<string, number> = {
            ETH: 1,
            BNB: 56,
            POL: 137,
            MATIC: 137,
            AVAX: 43114,
            SOL: 7565164,
            TRX: 728126428,
            TON: 1100,
            ATOM: 118,
        };

        const filtered = raw.filter((t: any) => {
            if (!t?.address) return false;

            // Hard chain guard — the API occasionally returns cross-chain
            // results (bridged POL on BSC, wrapped BNB on ETH, etc.) even
            // when chains=[X] is passed. Enforce it strictly here so the
            // BSC tab never shows POL and the ETH tab never shows BNB.
            if (chainFilter && Number(t.chainId) !== chainFilter) return false;

            // On "All", drop native-symbol impostors: POL only on Polygon,
            // BNB only on BSC, SOL only on Solana, etc. Keeps the list
            // clean of bridged wrappers and lookalike scam tokens.
            if (!chainFilter) {
                const canonical = PRIMARY_NATIVE_SYMBOL_TO_CHAIN[(t.symbol || '').toUpperCase()];
                if (canonical && Number(t.chainId) !== canonical) return false;
            }

            const name = (t.name || '').toLowerCase();
            const symbol = (t.symbol || '').toLowerCase();
            const address = (t.address || '').toLowerCase();

            // Exclude anything already surfaced in "Your Tokens" — match by
            // address, or (for natives) by symbol since the balance API's
            // native address format may differ from our synthetic sentinel.
            if (yourTokenKeys.has(`${t.chainId}-${address}`)) return false;
            if (t.isNative && yourTokenSymbolKeys.has(`${t.chainId}-${(t.symbol || '').toUpperCase()}`)) return false;
            // Primary natives only appear on the "All" tab (no chain filter),
            // so if the user holds the same symbol anywhere we hide it here
            // to avoid the "ETH in Your Tokens AND ETH in browse" duplication.
            if (t.isNative && t._primaryNative && !chainFilter && yourTokenSymbols.has((t.symbol || '').toUpperCase())) return false;

            if (address.endsWith('pump') || name.includes('pump.fun')) return false;
            if (CJK_RE.test(t.name || '') || CJK_RE.test(t.symbol || '')) return false;

            const spamKw = ['.com', '.xyz', 'claim', 'airdrop', 'visit', 'free', 'reward', 'voucher'];
            if (spamKw.some(k => name.includes(k) || symbol.includes(k))) return false;
            return true;
        });

        // Dedupe at two levels: first by (chainId, address) to collapse the
        // exact same contract returned twice, then by (chainId, symbol) so
        // the list never shows e.g. two USDT rows on the same chain.
        const byAddr = new Map<string, any>();
        filtered.forEach((t: any) => {
            const k = `${t.chainId}-${(t.address || '').toLowerCase()}`;
            if (!byAddr.has(k)) byAddr.set(k, t);
        });

        const bySymbol = new Map<string, any>();
        Array.from(byAddr.values()).forEach((t: any) => {
            const k = `${t.chainId}-${(t.symbol || '').toUpperCase()}`;
            const existing = bySymbol.get(k);
            if (!existing) {
                bySymbol.set(k, t);
                return;
            }
            // Prefer native > higher liquidity when same symbol appears twice.
            const existingNative = isNativeToken(existing);
            const candidateNative = isNativeToken(t);
            if (candidateNative && !existingNative) {
                bySymbol.set(k, t);
                return;
            }
            if (!candidateNative && existingNative) return;
            const existingLiq = parseFloat(existing.liquidity?.toString() || '0');
            const candidateLiq = parseFloat(t.liquidity?.toString() || '0');
            if (candidateLiq > existingLiq) bySymbol.set(k, t);
        });

        // Rank: native tokens (0) → active/owned tokens (1) → rest (2).
        // Within each rank, keep the API's original order (popularity/liquidity).
        const rankOf = (t: any) => {
            if (isNativeToken(t)) return 0;
            const k = `${t.chainId}-${(t.address || '').toLowerCase()}`;
            if (activeKeys.has(k)) return 1;
            return 2;
        };

        return Array.from(bySymbol.values())
            .map((t, i) => ({ t, rank: rankOf(t), i }))
            .sort((a, b) => a.rank - b.rank || a.i - b.i)
            .map(x => x.t)
            .slice(0, 50);
    }, [searchResponse, defaultBrowseResponse, browseQuery, balanceData, yourTokens]);

    // Tap a browse-list "+": open the add modal and run the same full
    // on-chain lookup the "Lookup Token" button does — fetches live
    // balance, decimals and price so the preview matches the manual flow.
    const handleBrowsePick = (t: any) => {
        if (!t?.address || !t?.chainId) return;
        setError('');
        setContractAddress(t.address);
        setSelectedChain(Number(t.chainId));
        setAddModalVisible(true);
        handleLookup(t.address, Number(t.chainId));
    };

    const isAlreadyInAssets = (addr: string, chainId: number): boolean => {
        return fetchedTokens.some((t: any) =>
            t.address?.toLowerCase() === addr.toLowerCase() && Number(t.chainId) === chainId
        );
    };

    // Accepts optional overrides so callers that already have the address
    // and chain (e.g. tapping a browse-list "+") can run the lookup without
    // waiting for a state flush from setContractAddress/setSelectedChain.
    const handleLookup = async (addrOverride?: string, chainOverride?: number) => {
        const addr = (addrOverride ?? contractAddress).trim();
        const preferredChain = chainOverride ?? selectedChain;
        if (!addr) {
            setError('Please enter a contract address');
            return;
        }

        setIsLoading(true);
        setError('');
        setTokenInfo(null);

        const group = walletGroups.find(g => g.id === activeGroupId);
        const evmAddr = group?.addresses?.EVM;
        const solAddr = group?.addresses?.SOLANA;
        const tronAddr = group?.addresses?.TRON;
        const tonAddr = group?.addresses?.TON;
        const cosmosAddr = group?.addresses?.COSMOS;

        const allChains = [1, 56, 137, 42161, 8453, 10, 43114, 59144, 250, 42220, 100, 7565164, 728126428, 1100, 118];
        const evmChains = Object.keys(CHAIN_CONFIG).map(Number);

        const [tokenInfoResults, searchResult, onChainResults, solBal, tronBal, tonBal, cosmosBal] = await Promise.all([
            Promise.all(allChains.map(async (cid) => {
                try {
                    const info = await api.tokenInfo.get(cid, addr);
                    if (info?.token && info?.pool?.priceUsd) return { chainId: cid, info };
                    return null;
                } catch { return null; }
            })),
            api.tokens.list({ query: addr, limit: 10 }).catch(() => ({ tokens: [] } as any)),
            evmAddr ? Promise.all(evmChains.map(async (cid) => {
                try {
                    const r = await fetchOnChainBalance(cid, addr, evmAddr);
                    return { chainId: cid, ...r };
                } catch { return null; }
            })) : Promise.resolve([] as any[]),
            solAddr ? fetchSolanaBalance(addr, solAddr).catch(() => null) : Promise.resolve(null),
            tronAddr ? fetchTronBalance(addr, tronAddr).catch(() => null) : Promise.resolve(null),
            tonAddr ? fetchTonBalance(addr, tonAddr).catch(() => null) : Promise.resolve(null),
            cosmosAddr ? fetchCosmosBalance(addr, cosmosAddr).catch(() => null) : Promise.resolve(null),
        ]);

        let tokenData: any = null;

        const tokenInfoMatch = tokenInfoResults.find(r => r?.chainId === preferredChain && r?.info?.pool?.priceUsd)
            || tokenInfoResults.find((r): r is NonNullable<typeof r> => r !== null);

        if (tokenInfoMatch) {
            const t = tokenInfoMatch.info.token;
            tokenData = {
                address: addr,
                chainId: tokenInfoMatch.chainId,
                symbol: t.symbol || 'UNKNOWN',
                name: t.name || 'Unknown Token',
                decimals: t.decimals || 18,
                logoURI: t.logo || '',
                price: tokenInfoMatch.info.pool?.priceUsd || null,
                balance: '0',
                balanceFormatted: '0',
                usdValue: '0',
            };
        }

        if (!tokenData) {
            const found = (searchResult as any)?.tokens?.find((t: any) =>
                t.address?.toLowerCase() === addr.toLowerCase()
            );
            if (found) {
                tokenData = {
                    address: found.address,
                    chainId: found.chainId,
                    symbol: found.symbol,
                    name: found.name,
                    decimals: found.decimals || 18,
                    logoURI: found.logoURI || '',
                    price: found.priceUSD || null,
                    balance: '0',
                    balanceFormatted: '0',
                    usdValue: '0',
                };
            }
        }

        type ChosenResult = NonNullable<typeof onChainResults[number]>;
        const withBalance = onChainResults
            .filter((r): r is ChosenResult => r !== null && parseFloat(r.balanceFormatted) > 0)
            .sort((a, b) => parseFloat(b.balanceFormatted) - parseFloat(a.balanceFormatted));

        let chosen: ChosenResult | undefined = withBalance[0];
        if (!chosen) {
            if (tokenData?.chainId) {
                const byApi = onChainResults.find(r => r?.chainId === tokenData.chainId);
                if (byApi) chosen = byApi;
            }
            if (!chosen) {
                const selected = onChainResults.find(r => r?.chainId === preferredChain);
                if (selected && selected.symbol !== 'UNKNOWN') chosen = selected;
            }
            if (!chosen) {
                const anyValid = onChainResults.find((r): r is ChosenResult =>
                    r !== null && r.symbol !== 'UNKNOWN' && r.symbol.length > 0);
                if (anyValid) chosen = anyValid;
            }
        }

        if (chosen) {
            const bal = parseFloat(chosen.balanceFormatted);
            if (!tokenData) {
                tokenData = {
                    address: addr,
                    chainId: chosen.chainId,
                    symbol: chosen.symbol,
                    name: chosen.name,
                    decimals: chosen.decimals,
                    logoURI: '',
                    price: null,
                    balance: chosen.balance,
                    balanceFormatted: bal.toString(),
                    usdValue: '0',
                };
            } else {
                tokenData.chainId = chosen.chainId;
                tokenData.balance = chosen.balance;
                tokenData.balanceFormatted = bal.toString();
                tokenData.decimals = chosen.decimals;
                if (tokenData.symbol === 'UNKNOWN' && chosen.symbol) tokenData.symbol = chosen.symbol;
                if (tokenData.name === 'Custom Token' && chosen.name) tokenData.name = chosen.name;
                if (tokenData.price) {
                    tokenData.usdValue = (bal * parseFloat(tokenData.price)).toFixed(2);
                }
            }
        }

        const applyNonEvmBalance = (r: any) => {
            if (!tokenData || !r) return;
            const bal = parseFloat(r.balanceFormatted);
            tokenData.balance = r.balance;
            tokenData.balanceFormatted = bal.toString();
            tokenData.decimals = r.decimals;
            if (r.symbol && tokenData.symbol === 'UNKNOWN') tokenData.symbol = r.symbol;
            if (r.name && tokenData.name === 'Custom Token') tokenData.name = r.name;
            if (tokenData.price) {
                tokenData.usdValue = (bal * parseFloat(tokenData.price)).toFixed(2);
            }
        };

        if (tokenData?.chainId === 7565164) applyNonEvmBalance(solBal);
        if (tokenData?.chainId === 728126428) applyNonEvmBalance(tronBal);
        if (tokenData?.chainId === 1100) applyNonEvmBalance(tonBal);
        if (tokenData?.chainId === 118) applyNonEvmBalance(cosmosBal);

        if (!tokenData) {
            setError('Token not found on any supported network. This token may be on an unsupported chain (e.g. zkSync Era, Scroll, Mantle). Support for more networks is coming soon.');
            setIsLoading(false);
            return;
        }

        if (!tokenData.logoURI || tokenData.logoURI === '') {
            tokenData.logoURI =
                getTokenLogo(tokenData.symbol, tokenData.chainId, tokenData.address) ||
                getDexScreenerLogo(tokenData.chainId, tokenData.address) ||
                getTrustWalletLogo(tokenData.chainId, tokenData.address) ||
                '';
        }

        setTokenInfo(tokenData);
        setIsLoading(false);
    };

    const handleAdd = () => {
        if (!tokenInfo) return;

        if (hasToken(walletKey, tokenInfo.address, tokenInfo.chainId)) {
            setError('This token is already added.');
            return;
        }

        addToken(walletKey, {
            address: tokenInfo.address,
            chainId: tokenInfo.chainId,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            decimals: tokenInfo.decimals,
            logoURI: tokenInfo.logoURI,
            priceUSD: tokenInfo.price || '0',
            balanceFormatted: tokenInfo.balanceFormatted || '0',
            usdValue: tokenInfo.usdValue || '0',
            addedAt: Date.now(),
        });

        // Close the contract-entry modal if it was open. The user stays
        // on the manage-tokens page and can add more or browse further.
        closeAddModal();
    };

    const alreadyAdded = tokenInfo ? hasToken(walletKey, tokenInfo.address, tokenInfo.chainId) : false;
    const alreadyInAssets = tokenInfo ? isAlreadyInAssets(tokenInfo.address, tokenInfo.chainId) : false;

    return (
        <View style={[styles.container, { paddingTop: top }]}>
            <CustomStatusBar />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBack} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.titleText} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Tokens</Text>
                <TouchableOpacity onPress={() => setAddModalVisible(true)} style={styles.headerBack} hitSlop={8}>
                    <Ionicons name="add" size={26} color={colors.primaryCTA} />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={styles.flex1}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: (bottom || 16) + 24 }]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.subtitle}>Search popular tokens, toggle ones you've added, or paste a contract address.</Text>

                    {/* Global chain filter — narrows both Your Tokens and Browse */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.browseChainBar}
                        contentContainerStyle={styles.browseChainContent}
                    >
                        <TouchableOpacity
                            onPress={() => setChainFilter(null)}
                            style={[styles.browseChainChip, !chainFilter && styles.browseChainChipActive]}
                        >
                            <Text style={[styles.browseChainText, !chainFilter && styles.browseChainTextActive]}>All</Text>
                        </TouchableOpacity>
                        {CHAINS.map((chain) => (
                            <TouchableOpacity
                                key={chain.id}
                                onPress={() => setChainFilter(chain.id)}
                                style={[styles.browseChainChip, chainFilter === chain.id && styles.browseChainChipActive]}
                            >
                                <Image source={chain.icon} style={styles.browseChainIcon} contentFit="contain" />
                                <Text style={[styles.browseChainText, chainFilter === chain.id && styles.browseChainTextActive]}>
                                    {chain.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Your Tokens — wallet holdings + added tokens with show/hide toggle */}
                    {filteredYourTokens.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Your Tokens</Text>
                            <View style={styles.myTokensList}>
                                {filteredYourTokens.map((t) => {
                                    const balNum = parseFloat(t.balanceFormatted || '0');
                                    const usdNum = parseFloat(t.usdValue || '0');
                                    const hasBalance = balNum > 0;
                                    const chainMeta = CHAINS.find(c => c.id === t.chainId);
                                    return (
                                        <View key={t.key} style={styles.myTokenRow}>
                                            <View style={styles.browseLogoWrapper}>
                                                {t.logoURI ? (
                                                    <Image source={{ uri: t.logoURI }} style={styles.myTokenLogo} contentFit="cover" />
                                                ) : (
                                                    <View style={[styles.myTokenLogo, styles.previewFallback]}>
                                                        <Text style={styles.previewFallbackText}>{(t.symbol || '?').charAt(0)}</Text>
                                                    </View>
                                                )}
                                                {chainMeta && (
                                                    <View style={styles.browseChainBadge}>
                                                        <Image source={chainMeta.icon} style={styles.browseChainBadgeIcon} contentFit="contain" />
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.myTokenMeta}>
                                                <Text style={styles.myTokenSymbol} numberOfLines={1}>{t.symbol}</Text>
                                                <Text style={styles.myTokenName} numberOfLines={1}>{t.name}</Text>
                                            </View>
                                            {hasBalance && (
                                                <View style={styles.myTokenBalance}>
                                                    <Text style={styles.myTokenBalanceAmount} numberOfLines={1}>
                                                        {balNum.toLocaleString(undefined, { maximumFractionDigits: 4 })} {t.symbol}
                                                    </Text>
                                                    {usdNum > 0 && (
                                                        <Text style={styles.myTokenBalanceUsd} numberOfLines={1}>
                                                            ${usdNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                        </Text>
                                                    )}
                                                </View>
                                            )}
                                            {t.isCustom && (
                                                <TouchableOpacity
                                                    onPress={() => setTokenToRemove({ address: t.address, chainId: t.chainId, symbol: t.symbol })}
                                                    hitSlop={8}
                                                    style={styles.myTokenRemove}
                                                >
                                                    <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                                                </TouchableOpacity>
                                            )}
                                            <Switch
                                                value={!t.hidden}
                                                onValueChange={() =>
                                                    t.isCustom
                                                        ? toggleTokenHidden(walletKey, t.address, t.chainId)
                                                        : toggleWalletTokenHidden(walletKey, t.address, t.chainId)
                                                }
                                                trackColor={{ false: colors.bgStroke, true: colors.primaryCTA }}
                                                thumbColor={t.hidden ? '#666' : '#000'}
                                            />
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Search & Browse tokens — live server-side search via tokens API */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Search Tokens</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="search" size={16} color={colors.mutedText} style={{ marginLeft: 12 }} />
                            <TextInput
                                value={browseQuery}
                                onChangeText={setBrowseQuery}
                                placeholder="Search any token by name, symbol or address"
                                placeholderTextColor={colors.mutedText}
                                style={styles.input}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {browseQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => setBrowseQuery('')}
                                    hitSlop={8}
                                    style={styles.pasteButton}
                                >
                                    <Ionicons name="close-circle" size={16} color={colors.mutedText} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {browseLoading ? (
                            <View style={styles.browseLoader}>
                                <ActivityIndicator size="small" color={colors.primaryCTA} />
                            </View>
                        ) : filteredBrowse.length === 0 ? (
                            <Text style={styles.browseEmpty}>
                                {browseQuery
                                    ? `No tokens matching "${browseQuery}". Try the contract address below.`
                                    : 'No tokens loaded.'}
                            </Text>
                        ) : (
                            <View style={styles.browseList}>
                                {filteredBrowse.map((t: any) => {
                                    const k = `${t.chainId}-${t.address}`;
                                    const added = hasToken(walletKey, t.address, Number(t.chainId));
                                    const inAssets = isAlreadyInAssets(t.address, Number(t.chainId));
                                    const chainMeta = CHAINS.find(c => c.id === Number(t.chainId));
                                    const logoUri =
                                        t.logoURI ||
                                        getTokenLogo(t.symbol, Number(t.chainId), t.address) ||
                                        getDexScreenerLogo(Number(t.chainId), t.address) ||
                                        getTrustWalletLogo(Number(t.chainId), t.address);
                                    return (
                                        <TouchableOpacity
                                            key={k}
                                            style={styles.browseRow}
                                            onPress={() => handleBrowsePick(t)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.browseLogoWrapper}>
                                                {logoUri ? (
                                                    <Image source={{ uri: logoUri }} style={styles.browseLogo} contentFit="cover" />
                                                ) : (
                                                    <View style={[styles.browseLogo, {
                                                        backgroundColor: getColorFromSeed(t.symbol || '?'),
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }]}>
                                                        <Text style={styles.browseLogoFallbackText}>
                                                            {(t.symbol || '?').charAt(0).toUpperCase()}
                                                        </Text>
                                                    </View>
                                                )}
                                                {chainMeta && (
                                                    <View style={styles.browseChainBadge}>
                                                        <Image source={chainMeta.icon} style={styles.browseChainBadgeIcon} contentFit="contain" />
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.browseMeta}>
                                                <Text style={styles.browseSymbol} numberOfLines={1}>{t.symbol}</Text>
                                                <Text style={styles.browseName} numberOfLines={1}>{t.name}</Text>
                                            </View>
                                            {inAssets ? (
                                                <Text style={styles.browseAdded}>In Assets</Text>
                                            ) : added ? (
                                                <Text style={styles.browseAdded}>Added</Text>
                                            ) : (
                                                <Ionicons name="add-circle-outline" size={20} color={colors.primaryCTA} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>

            {/* Add by Contract Address — opens from the header + button */}
            <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={closeAddModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add by Contract Address</Text>
                            <TouchableOpacity onPress={closeAddModal} hitSlop={8} style={styles.modalClose}>
                                <Ionicons name="close" size={22} color={colors.titleText} />
                            </TouchableOpacity>
                        </View>

                            <ScrollView
                                style={styles.modalBody}
                                contentContainerStyle={styles.modalScroll}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                {/* Chain Selector */}
                                <Text style={styles.label}>Select Chain <Text style={styles.labelOptional}>(Optional)</Text></Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chainRow}>
                                    {CHAINS.map(chain => (
                                        <TouchableOpacity
                                            key={chain.id}
                                            style={[styles.chainChip, selectedChain === chain.id && styles.chainChipActive]}
                                            onPress={() => { setSelectedChain(chain.id); setTokenInfo(null); setError(''); }}
                                        >
                                            <Image source={chain.icon} style={styles.chainChipIcon} contentFit="contain" />
                                            <Text style={[styles.chainChipText, selectedChain === chain.id && styles.chainChipTextActive]}>
                                                {chain.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                {/* Contract Address Input */}
                                <Text style={styles.label}>Contract Address</Text>
                                <View style={styles.inputRow}>
                                    <View style={styles.inputWrapper}>
                                        <TextInput
                                            value={contractAddress}
                                            onChangeText={(t) => { setContractAddress(t); setTokenInfo(null); setError(''); }}
                                            placeholder="0x... or token address"
                                            placeholderTextColor={colors.mutedText}
                                            style={styles.input}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <TouchableOpacity
                                            onPress={async () => {
                                                const text = await Clipboard.getStringAsync();
                                                if (text) {
                                                    setContractAddress(text.trim());
                                                    setTokenInfo(null);
                                                    setError('');
                                                }
                                            }}
                                            style={styles.pasteButton}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Image source={PasteIcon} style={styles.pasteIcon} contentFit="contain" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Lookup Button */}
                                <TouchableOpacity
                                    style={[styles.lookupBtn, isLoading && { opacity: 0.5 }]}
                                    onPress={handleLookup}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator size="small" color="#000" />
                                    ) : (
                                        <Text style={styles.lookupBtnText}>Lookup Token</Text>
                                    )}
                                </TouchableOpacity>

                                {/* Error */}
                                {error ? <Text style={styles.error}>{error}</Text> : null}

                                {/* Token Preview */}
                                {tokenInfo && (
                                    <View style={styles.previewCard}>
                                        <View style={styles.previewRow}>
                                            {tokenInfo.logoURI ? (
                                                <Image source={{ uri: tokenInfo.logoURI }} style={styles.previewIcon} contentFit="cover" />
                                            ) : (
                                                <View style={[styles.previewIcon, styles.previewFallback]}>
                                                    <Text style={styles.previewFallbackText}>{tokenInfo.symbol.charAt(0)}</Text>
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.previewSymbol}>{tokenInfo.symbol}</Text>
                                                <Text style={styles.previewName}>{tokenInfo.name}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                {parseFloat(tokenInfo.balanceFormatted || '0') > 0 ? (
                                                    <>
                                                        <Text style={styles.previewBalance}>
                                                            {parseFloat(tokenInfo.balanceFormatted).toFixed(4)} {tokenInfo.symbol}
                                                        </Text>
                                                        <Text style={styles.previewUsd}>
                                                            ${parseFloat(tokenInfo.usdValue || '0').toFixed(2)}
                                                        </Text>
                                                    </>
                                                ) : tokenInfo.price ? (
                                                    <>
                                                        <Text style={styles.previewBalance}>0 {tokenInfo.symbol}</Text>
                                                        <Text style={styles.previewPrice}>
                                                            @${parseFloat(tokenInfo.price).toFixed(6)}
                                                        </Text>
                                                    </>
                                                ) : (
                                                    <Text style={styles.previewBalance}>0 {tokenInfo.symbol}</Text>
                                                )}
                                            </View>
                                        </View>

                                        <TouchableOpacity
                                            style={[styles.addBtn, (alreadyAdded || alreadyInAssets) && { backgroundColor: colors.bgStroke }]}
                                            onPress={handleAdd}
                                            disabled={alreadyAdded || alreadyInAssets}
                                        >
                                            <Text style={[styles.addBtnText, (alreadyAdded || alreadyInAssets) && { color: colors.mutedText }]}>
                                                {alreadyInAssets ? 'Already in Assets' : alreadyAdded ? 'Already Added' : 'Add to Wallet'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Confirm-before-delete modal for custom tokens */}
            <Modal
                visible={!!tokenToRemove}
                transparent
                animationType="fade"
                onRequestClose={() => setTokenToRemove(null)}
            >
                <View style={styles.removeModalOverlay}>
                    <View style={styles.removeModalCard}>
                        <View style={styles.removeIconCircle}>
                            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                        </View>
                        <Text style={styles.removeModalTitle}>Remove Token</Text>
                        <Text style={styles.removeModalMessage}>
                            Remove {tokenToRemove?.symbol ?? 'this token'} from your added tokens? You can always add it back later.
                        </Text>
                        <View style={styles.removeModalButtons}>
                            <TouchableOpacity
                                style={[styles.removeModalBtn, styles.removeModalCancel]}
                                onPress={() => setTokenToRemove(null)}
                            >
                                <Text style={styles.removeModalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.removeModalBtn, styles.removeModalConfirm]}
                                onPress={() => {
                                    if (tokenToRemove) {
                                        removeToken(walletKey, tokenToRemove.address, tokenToRemove.chainId);
                                    }
                                    setTokenToRemove(null);
                                }}
                            >
                                <Text style={styles.removeModalConfirmText}>Remove</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    flex1: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.bgStroke,
    },
    headerBack: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    scrollContent: {
        padding: 20,
    },
    subtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: colors.mutedText,
        marginBottom: 20,
        lineHeight: 18,
    },
    label: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: colors.bodyText,
        marginBottom: 8,
    },
    labelOptional: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.mutedText,
    },
    chainRow: {
        gap: 8,
        marginBottom: 16,
        paddingBottom: 4,
    },
    chainChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    chainChipActive: {
        backgroundColor: 'rgba(177, 241, 40, 0.1)',
        borderColor: colors.primaryCTA,
    },
    chainChipIcon: {
        width: 18,
        height: 18,
        borderRadius: 9,
    },
    chainChipText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    chainChipTextActive: {
        color: colors.primaryCTA,
    },
    inputRow: {
        marginBottom: 12,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        paddingRight: 8,
    },
    pasteButton: {
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pasteIcon: {
        width: 20,
        height: 20,
        opacity: 0.7,
    },
    input: {
        flex: 1,
        height: 48,
        paddingHorizontal: 14,
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: colors.titleText,
    },
    lookupBtn: {
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.primaryCTA,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    lookupBtnText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: '#000',
    },
    error: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: '#FF3B30',
        marginBottom: 12,
        textAlign: 'center',
    },
    previewCard: {
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        gap: 14,
    },
    previewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    previewIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    previewFallback: {
        backgroundColor: colors.bgStroke,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewFallbackText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.titleText,
    },
    previewSymbol: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.titleText,
    },
    previewName: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.mutedText,
    },
    previewPrice: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
        marginTop: 2,
    },
    previewBalance: {
        fontFamily: 'Manrope-Bold',
        fontSize: 15,
        color: colors.titleText,
    },
    previewUsd: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: colors.primaryCTA,
        marginTop: 2,
    },
    addBtn: {
        height: 44,
        borderRadius: 10,
        backgroundColor: colors.primaryCTA,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addBtnText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: '#000',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
        marginBottom: 10,
    },
    myTokensList: {
        gap: 8,
    },
    myTokenRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    myTokenLogo: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    myTokenMeta: {
        flex: 1,
    },
    myTokenSymbol: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    myTokenName: {
        fontFamily: 'Manrope-Regular',
        fontSize: 11,
        color: colors.mutedText,
    },
    myTokenRemove: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        marginRight: 4,
    },
    myTokenBalance: {
        alignItems: 'flex-end',
        marginRight: 8,
        maxWidth: 120,
    },
    myTokenBalanceAmount: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.titleText,
    },
    myTokenBalanceUsd: {
        fontFamily: 'Manrope-Regular',
        fontSize: 11,
        color: colors.mutedText,
        marginTop: 2,
    },
    browseLoader: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    browseEmpty: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.mutedText,
        textAlign: 'center',
        paddingVertical: 16,
    },
    browseList: {
        marginTop: 10,
        borderRadius: 12,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        overflow: 'hidden',
    },
    browseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.bgStroke,
    },
    browseLogoWrapper: {
        width: 36,
        height: 36,
        position: 'relative',
    },
    browseLogo: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    browseLogoFallbackText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: '#FFFFFF',
    },
    browseChainBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    browseChainBadgeIcon: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    browseChainBar: {
        flexGrow: 0,
        marginTop: 10,
        marginBottom: 4,
    },
    browseChainContent: {
        gap: 8,
        paddingRight: 12,
    },
    browseChainChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 100,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    browseChainChipActive: {
        backgroundColor: colors.primaryCTA,
        borderColor: colors.primaryCTA,
    },
    browseChainIcon: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    browseChainText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.bodyText,
    },
    browseChainTextActive: {
        color: colors.bg,
    },
    browseMeta: {
        flex: 1,
    },
    browseSymbol: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: colors.titleText,
    },
    browseName: {
        fontFamily: 'Manrope-Regular',
        fontSize: 11,
        color: colors.mutedText,
    },
    browseAdded: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 11,
        color: colors.mutedText,
    },
    browseNativeBadge: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 11,
        color: colors.primaryCTA,
        letterSpacing: 0.5,
    },
    divider: {
        height: 0.5,
        backgroundColor: colors.bgStroke,
        marginBottom: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        maxHeight: '85%',
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 24,
        overflow: 'hidden',
    },
    modalBody: {
        flexGrow: 0,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.bgStroke,
    },
    modalTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    modalClose: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalScroll: {
        padding: 20,
    },
    removeModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    removeModalCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: colors.bgCards,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    removeIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 59, 48, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    removeModalTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: colors.titleText,
        marginBottom: 8,
    },
    removeModalMessage: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: colors.bodyText,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 20,
    },
    removeModalButtons: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    removeModalBtn: {
        flex: 1,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeModalCancel: {
        backgroundColor: colors.bgStroke,
    },
    removeModalCancelText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    removeModalConfirm: {
        backgroundColor: '#FF3B30',
    },
    removeModalConfirmText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: '#FFFFFF',
    },
});
