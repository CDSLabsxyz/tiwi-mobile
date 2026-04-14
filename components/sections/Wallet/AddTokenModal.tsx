import { colors } from '@/constants/colors';
import { api } from '@/lib/mobile/api-client';
import { getTokenLogo, getDexScreenerLogo } from '@/services/tokenLogoService';
import { useCustomTokenStore } from '@/store/customTokenStore';
import { useWalletStore } from '@/store/walletStore';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const PasteIcon = require('@/assets/wallet/clipboard.svg');
import { createPublicClient, http, erc20Abi, formatUnits } from 'viem';
import { mainnet, bsc, polygon, base, arbitrum, optimism, avalanche } from 'viem/chains';

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

// Fetch SPL token balance on Solana via public RPC (no API key needed)
async function fetchSolanaBalance(mintAddr: string, walletAddr: string) {
    const rpcUrl = 'https://api.mainnet-beta.solana.com';
    const body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
            walletAddr,
            { mint: mintAddr },
            { encoding: 'jsonParsed' },
        ],
    };
    const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await resp.json();
    const accounts = data?.result?.value || [];
    if (accounts.length === 0) {
        return { balance: '0', balanceFormatted: '0', decimals: 9 };
    }
    const info = accounts[0]?.account?.data?.parsed?.info;
    return {
        balance: info?.tokenAmount?.amount || '0',
        balanceFormatted: info?.tokenAmount?.uiAmountString || '0',
        decimals: info?.tokenAmount?.decimals ?? 9,
    };
}

// Fetch TRC20 token balance on TRON via public HTTP API
async function fetchTronBalance(contractAddr: string, walletAddr: string) {
    // TRON uses base58 addresses but the HTTP API accepts them natively
    const url = `https://api.trongrid.io/v1/accounts/${walletAddr}/tokens?limit=200`;
    const resp = await fetch(url);
    const data = await resp.json();
    const tokens = Array.isArray(data?.data) ? data.data : [];
    const match = tokens.find((t: any) =>
        (t.tokenId === contractAddr) ||
        (t.contractAddress?.toLowerCase() === contractAddr.toLowerCase())
    );
    if (!match) {
        return { balance: '0', balanceFormatted: '0', decimals: 6, symbol: '', name: '' };
    }
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

// Fetch TON jetton balance via TonCenter public API
async function fetchTonBalance(jettonMasterAddr: string, walletAddr: string) {
    const url = `https://toncenter.com/api/v3/jetton/wallets?owner_address=${walletAddr}&jetton_address=${jettonMasterAddr}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const wallets = Array.isArray(data?.jetton_wallets) ? data.jetton_wallets : [];
    if (wallets.length === 0) {
        return { balance: '0', balanceFormatted: '0', decimals: 9 };
    }
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

// Fetch Cosmos IBC/CW20 token balance via LCD (REST) endpoint
async function fetchCosmosBalance(denom: string, walletAddr: string) {
    const url = `https://cosmos-rest.publicnode.com/cosmos/bank/v1beta1/balances/${walletAddr}/by_denom?denom=${encodeURIComponent(denom)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const amount = data?.balance?.amount || '0';
    const decimals = 6; // Cosmos default (uatom = 6 decimals)
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

interface AddTokenModalProps {
    visible: boolean;
    onClose: () => void;
    onAdded?: () => void;
}

export const AddTokenModal: React.FC<AddTokenModalProps> = ({ visible, onClose, onAdded }) => {
    const [selectedChain, setSelectedChain] = useState(56);
    const [contractAddress, setContractAddress] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [tokenInfo, setTokenInfo] = useState<any>(null);
    const [error, setError] = useState('');

    const { addToken, hasToken } = useCustomTokenStore();
    const { walletGroups, activeGroupId, address } = useWalletStore();
    const walletKey = activeGroupId || address || 'default';
    const { data: balanceData } = useWalletBalances();
    const fetchedTokens = balanceData?.tokens || [];

    // Check if a token is already in the fetched asset list
    const isAlreadyInAssets = (address: string, chainId: number): boolean => {
        return fetchedTokens.some((t: any) =>
            t.address?.toLowerCase() === address.toLowerCase() && Number(t.chainId) === chainId
        );
    };

    const handleLookup = async () => {
        const addr = contractAddress.trim();
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

        // Fire EVERYTHING in parallel — this is the big speedup
        const [tokenInfoResults, searchResult, onChainResults, solBal, tronBal, tonBal, cosmosBal] = await Promise.all([
            // 1. TIWI tokenInfo across all chains
            Promise.all(allChains.map(async (cid) => {
                try {
                    const info = await api.tokenInfo.get(cid, addr);
                    if (info?.token && info?.pool?.priceUsd) return { chainId: cid, info };
                    return null;
                } catch { return null; }
            })),

            // 2. Token search
            api.tokens.list({ query: addr, limit: 10 }).catch(() => ({ tokens: [] } as any)),

            // 3. EVM on-chain contract reads across all EVM chains
            evmAddr ? Promise.all(evmChains.map(async (cid) => {
                try {
                    const r = await fetchOnChainBalance(cid, addr, evmAddr);
                    return { chainId: cid, ...r };
                } catch { return null; }
            })) : Promise.resolve([] as any[]),

            // 4. Non-EVM balances in parallel
            solAddr ? fetchSolanaBalance(addr, solAddr).catch(() => null) : Promise.resolve(null),
            tronAddr ? fetchTronBalance(addr, tronAddr).catch(() => null) : Promise.resolve(null),
            tonAddr ? fetchTonBalance(addr, tonAddr).catch(() => null) : Promise.resolve(null),
            cosmosAddr ? fetchCosmosBalance(addr, cosmosAddr).catch(() => null) : Promise.resolve(null),
        ]);

        let tokenData: any = null;

        // Pick best tokenInfo result — prefer selected chain, then first match
        const tokenInfoMatch = tokenInfoResults.find(r => r?.chainId === selectedChain && r?.info?.pool?.priceUsd)
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

        // Fallback to search result
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

        // Pick best on-chain EVM result — balance > API match > selected chain > any valid
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
                const selected = onChainResults.find(r => r?.chainId === selectedChain);
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

        // Apply non-EVM balance if the resolved chain is non-EVM
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

        // Token not found anywhere
        if (!tokenData) {
            setError('Token not found on any supported network. This token may be on an unsupported chain (e.g. zkSync Era, Scroll, Mantle). Support for more networks is coming soon.');
            setIsLoading(false);
            return;
        }

        // Ensure we always have a logo — try multiple fallback sources
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

        setContractAddress('');
        setTokenInfo(null);
        setError('');
        onAdded?.();
        onClose();
    };

    const handleClose = () => {
        setContractAddress('');
        setTokenInfo(null);
        setError('');
        onClose();
    };

    const alreadyAdded = tokenInfo ? hasToken(walletKey, tokenInfo.address, tokenInfo.chainId) : false;
    const alreadyInAssets = tokenInfo ? isAlreadyInAssets(tokenInfo.address, tokenInfo.chainId) : false;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                        <Text style={{ fontSize: 20, color: colors.titleText }}>✕</Text>
                    </TouchableOpacity>

                    <Text style={styles.title}>Add Custom Token</Text>
                    <Text style={styles.subtitle}>Enter a contract address to add a token to your wallet view</Text>

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
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    content: {
        width: '100%',
        backgroundColor: colors.bgCards,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        maxHeight: '85%',
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 1,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
        color: colors.titleText,
        marginBottom: 6,
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
        backgroundColor: colors.bg,
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
        backgroundColor: colors.bg,
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
        backgroundColor: colors.bg,
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
    balanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
    },
    balanceLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: colors.mutedText,
    },
    balanceValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.titleText,
    },
    balanceUsd: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
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
});
