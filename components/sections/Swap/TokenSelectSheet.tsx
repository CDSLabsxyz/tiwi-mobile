import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useTokens } from '@/hooks/useTokens';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { getColorFromSeed, formatTokenQuantity, formatUSDPrice } from '@/utils/formatting';
import { truncateAddress } from '@/utils/wallet';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import type { ChainId } from './ChainSelectSheet';
import { SelectionBottomSheet } from './SelectionBottomSheet';

const CheckmarkIcon = require('@/assets/swap/checkmark-circle-01.svg');

export interface TokenOption {
    id: string;
    symbol: string;
    name: string;
    icon: any;
    chainIcon?: any;
    tvl: string;
    balanceFiat: string;
    balanceToken: string;
    address: string;
    chainId: number;
    decimals: number;
    priceUSD?: string;
}

interface TokenSelectSheetProps {
    visible: boolean;
    chainId: ChainId | null;
    selectedTokenId?: string | null;
    onClose: () => void;
    onSelect: (token: TokenOption) => void;
}

/**
 * Token selection bottom sheet with real-time search support and wallet balances
 */
export const TokenSelectSheet: React.FC<TokenSelectSheetProps> = ({
    visible,
    chainId,
    selectedTokenId,
    onClose,
    onSelect,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const { data: balanceData } = useWalletBalances();
    const { data: chains } = useChains();
    const { data: response, isLoading } = useTokens({
        query: searchQuery,
        // Ensure chainId is a number for filtering
        chains: typeof chainId === 'number' ? [chainId] : undefined,
    });
    const tokens = response?.tokens;

    const options: TokenOption[] = React.useMemo(() => {
        if (!tokens) return [];

        const TWC_ADDRESS = '0xda1060158f7d593667cce0a15db346bb3ffb3596'.toLowerCase();
        const NATIVE_ADDRS = ['0x0000000000000000000000000000000000000000', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'];

        // Filtering: Smart Heuristic Scam Filter
        const filteredTokens = tokens.filter(t => {
            const isOnChain = (typeof chainId === 'number') ? t.chainId === chainId : true;
            if (!isOnChain) return false;

            const name = t.name?.toLowerCase() || '';
            const symbol = t.symbol?.toLowerCase() || '';
            const address = t.address?.toLowerCase() || '';

            const isTWC = address.toLowerCase() === TWC_ADDRESS;

            // Get native symbol from chains data
            const chInfo = chains?.find(c => c.id === t.chainId);
            const nativeSym = chInfo?.nativeCurrency?.symbol?.toLowerCase();
            const isNativeToken = NATIVE_ADDRS.includes(address.toLowerCase()) || (nativeSym && symbol === nativeSym);

            // CRITICAL: Always allow Native Tokens (BNB, ETH, etc) and TWC through
            if (isNativeToken || isTWC) return true;

            // 1. Pump.fun Filter
            if (address.endsWith('pump') || name.includes('pump.fun')) return false;

            // 2. Chinese/Spam Script Filter (Scanner garbage)
            const isChinese = /[\u4e00-\u9fa5]/.test(name) || /[\u4e00-\u9fa5]/.test(symbol);
            if (isChinese) return false;

            // 3. Phishing/Ad Keywords
            const spamKeywords = ['.com', '.xyz', '.net', 'claim', 'airdrop', 'visit', 'free', 'reward', 'voucher'];
            if (spamKeywords.some(k => name.includes(k) || symbol.includes(k))) return false;

            // 4. Impersonation Filter: Escape fake "BSC", "ETH", "USDT" etc.
            const coreNames = ['ethereum', 'usdt', 'usdc', 'weth', 'bnb', 'solana', 'wrapped bnb', 'bitcoin', 'tether', 'bsc', 'binance'];
            const isFakeCore = !t.verified && coreNames.some(cn => name === cn || symbol === cn);
            if (isFakeCore) return false;

            return true;
        });

        const mapped = filteredTokens.map(t => {
            // Find if this token has a balance in our wallet
            const walletToken = balanceData?.tokens.find(
                wt => wt.address.toLowerCase() === t.address.toLowerCase() && wt.chainId === t.chainId
            );

            // Find chain logo for the badge
            const chainInfo = chains?.find(c => c.id === t.chainId);
            const chainIcon = chainInfo?.logoURI || chainInfo?.logo;

            const hasBal = !!walletToken;
            const balNum = parseFloat(walletToken?.balanceFormatted || '0');
            const prcNum = parseFloat(t.priceUSD || '0');
            const totUSD = balNum * prcNum;

            return {
                id: `${t.chainId}-${t.address}`,
                symbol: t.symbol,
                name: t.name,
                icon: t.logoURI,
                chainIcon: chainIcon,
                tvl: t.liquidity ? `$${t.liquidity.toLocaleString()}` : 'N/A',
                balanceFiat: totUSD > 0 ? formatUSDPrice(totUSD) : '$0.00',
                balanceToken: hasBal ? `${formatTokenQuantity(walletToken.balanceFormatted)} ${t.symbol}` : `0 ${t.symbol}`,
                address: t.address,
                chainId: t.chainId,
                decimals: t.decimals,
                priceUSD: t.priceUSD,
                isOwned: hasBal,
                usdValueNum: totUSD,
            };
        });

        // Sorting Logic: Native -> TWC -> Owned -> Others
        return mapped.sort((a, b) => {
            const chainInfo = chains?.find(c => c.id === a.chainId);
            const nativeSymbol = chainInfo?.nativeCurrency?.symbol;

            // 1. Native Token is absolute priority (#1)
            const isANative = NATIVE_ADDRS.includes(a.address.toLowerCase()) || 
                             (nativeSymbol && a.symbol.toUpperCase() === nativeSymbol.toUpperCase());
            const isBNative = NATIVE_ADDRS.includes(b.address.toLowerCase()) || 
                             (nativeSymbol && b.symbol.toUpperCase() === nativeSymbol.toUpperCase());

            if (isANative && !isBNative) return -1;
            if (!isANative && isBNative) return 1;

            // 2. TWC Protocol Token (#2)
            const isATWC = a.address.toLowerCase() === TWC_ADDRESS;
            const isBTWC = b.address.toLowerCase() === TWC_ADDRESS;
            if (isATWC && !isBTWC) return -1;
            if (!isATWC && isBTWC) return 1;

            // 3. Owned tokens (balance > 0)
            if (a.isOwned && !b.isOwned) return -1;
            if (!a.isOwned && b.isOwned) return 1;

            if (a.isOwned && b.isOwned) {
                return b.usdValueNum - a.usdValueNum;
            }

            return 0;
        });
    }, [tokens, balanceData, chains]);

    return (
        <SelectionBottomSheet
            visible={visible}
            title="Token Selection"
            onClose={onClose}
        >
            <View style={styles.content}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={colors.mutedText} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or address"
                        placeholderTextColor={colors.mutedText}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                    />
                </View>

                {isLoading ? (
                    <View style={styles.loaderContainer}>
                        <TIWILoader size={60} />
                    </View>
                ) : (
                    <ScrollView
                        style={styles.container}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {options.map((token) => {
                            const isActive = token.id === selectedTokenId;

                            return (
                                <TouchableOpacity
                                    key={token.id}
                                    activeOpacity={0.9}
                                    onPress={() => onSelect(token)}
                                    style={[
                                        styles.optionItem,
                                        isActive && styles.activeItem
                                    ]}
                                >
                                    <View style={styles.optionContent}>
                                        {/* Left: icon + symbol + TVL */}
                                        <View style={styles.leftInfo}>
                                            <View style={styles.iconWrapper}>
                                                {token.icon ? (
                                                    <Image source={token.icon} style={styles.fullSize} contentFit="contain" />
                                                ) : (
                                                    <View style={[styles.fallbackCircle, { backgroundColor: getColorFromSeed(token.symbol) }]}>
                                                        <Text style={styles.fallbackText}>{token.symbol.charAt(0).toUpperCase()}</Text>
                                                    </View>
                                                )}

                                                {/* Chain Badge */}
                                                {token.chainIcon && (
                                                    <View style={styles.chainBadge}>
                                                        <Image source={token.chainIcon} style={styles.fullSize} contentFit="contain" />
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.textColumn}>
                                                <Text style={styles.symbol}>{token.symbol}</Text>
                                                <Text style={styles.tvl}>{truncateAddress(token.address)}</Text>
                                            </View>
                                        </View>

                                        {/* Right: balances + checkmark */}
                                        <View style={styles.rightInfo}>
                                            <View style={styles.balanceColumn}>
                                                <Text style={styles.tokenBalance}>{token.balanceToken}</Text>
                                                <Text style={styles.fiatBalance}>{token.balanceFiat}</Text>
                                            </View>

                                            {isActive && (
                                                <View style={styles.checkWrapper}>
                                                    <Image source={CheckmarkIcon} style={styles.fullSize} contentFit="contain" />
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
            </View>
        </SelectionBottomSheet>
    );
};

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingTop: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    loaderContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        gap: 16,
    },
    optionItem: {
        height: 76,
        borderRadius: 16,
        backgroundColor: colors.bgSemi,
        overflow: 'hidden',
    },
    activeItem: {
        backgroundColor: colors.bgShade20,
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        height: '100%',
    },
    leftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.bgSemi,
    },
    chainBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.bgSemi,
        borderWidth: 1.5,
        borderColor: colors.bgSemi,
        overflow: 'hidden',
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
    fallbackCircle: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fallbackText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: '#FFFFFF',
    },
    textColumn: {
        gap: 4,
    },
    symbol: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.titleText,
    },
    tvl: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    rightInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    balanceColumn: {
        alignItems: 'flex-end',
        gap: 4,
    },
    tokenBalance: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    fiatBalance: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    checkWrapper: {
        width: 24,
        height: 24,
    },
});
