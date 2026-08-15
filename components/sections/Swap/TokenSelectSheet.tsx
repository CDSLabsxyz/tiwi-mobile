import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useSwapDefaultTokens } from '@/hooks/useSwapDefaultTokens';
import { useTokens } from '@/hooks/useTokens';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import type { ChainItem } from '@/lib/mobile/api-client';
import { useCustomTokenStore } from '@/store/customTokenStore';
import { useWalletStore } from '@/store/walletStore';
import { getColorFromSeed } from '@/utils/formatting';
import { buildTokenOptions, type TokenOption } from '@/utils/token-list';
import { truncateAddress } from '@/utils/wallet';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ChainId } from './ChainSelectSheet';
import { SelectionBottomSheet } from './SelectionBottomSheet';

const CheckmarkIcon = require('@/assets/swap/checkmark-circle-01.svg');

export type { TokenOption };

interface TokenSelectSheetProps {
    visible: boolean;
    chainId: ChainId | null;
    selectedTokenId?: string | null;
    onClose: () => void;
    onSelect: (token: TokenOption) => void;
    /**
     * Restrict the list to tokens the wallet actually holds. See
     * {@link buildTokenOptions} - set by the staking pool creator, where a
     * token the user doesn't hold can't fund a pool.
     */
    walletOnly?: boolean;
}

/**
 * Token selection bottom sheet with real-time search and wallet balances.
 *
 * The list itself is composed by {@link buildTokenOptions}, which ports the
 * web selector's browse/search split - see that file for why the raw
 * `/api/v1/tokens` index can't be browsed directly.
 */
export const TokenSelectSheet: React.FC<TokenSelectSheetProps> = ({
    visible,
    chainId,
    selectedTokenId,
    onClose,
    onSelect,
    walletOnly = false,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const { data: balanceData, isLoading: isLoadingBalances } = useWalletBalances();
    const { data: chains } = useChains();
    // In walletOnly mode neither the curated list nor the raw index
    // contributes a row, so don't pay for either request.
    const { data: swapDefaults } = useSwapDefaultTokens({ enabled: !walletOnly });
    const { data: response, isLoading: isLoadingTokens } = useTokens({
        query: searchQuery,
        // Ensure chainId is a number for filtering
        chains: typeof chainId === 'number' ? [chainId] : undefined,
        enabled: !walletOnly,
    });
    const tokens = response?.tokens;
    const isLoading = walletOnly ? isLoadingBalances : isLoadingTokens;

    // Per-wallet hidden-token sets - anything the user toggled off in
    // Manage Tokens must also disappear from the selector until re-enabled.
    const { activeGroupId, address } = useWalletStore();
    const walletKey = activeGroupId || address || 'default';
    const hiddenWalletTokens = useCustomTokenStore(s => s.hiddenWalletTokens);
    const customTokens = useCustomTokenStore(s => s.tokensByWallet);
    const hiddenKeys = React.useMemo(() => {
        const set = new Set<string>();
        (hiddenWalletTokens[walletKey] || []).forEach(r => {
            set.add(`${r.chainId}-${r.address.toLowerCase()}`);
        });
        (customTokens[walletKey] || []).forEach(ct => {
            if (ct.hidden) set.add(`${ct.chainId}-${ct.address.toLowerCase()}`);
        });
        return set;
    }, [hiddenWalletTokens, customTokens, walletKey]);

    const chainIconFor = React.useCallback((cid?: number) => {
        // `logo` isn't on ChainItem but some backend responses carry it -
        // keep the fallback the previous implementation relied on.
        const info = chains?.find((c: ChainItem) => c.id === cid) as
            | (ChainItem & { logo?: string })
            | undefined;
        return info?.logoURI || info?.logo;
    }, [chains]);

    const options: TokenOption[] = React.useMemo(() => buildTokenOptions({
        apiTokens: tokens || [],
        curated: swapDefaults || [],
        held: balanceData?.tokens || [],
        imported: customTokens[walletKey] || [],
        hiddenKeys,
        chainIconFor,
        chainId: typeof chainId === 'number' ? chainId : null,
        searchQuery,
        walletOnly,
    }), [tokens, swapDefaults, balanceData, customTokens, walletKey, hiddenKeys, chainIconFor, chainId, searchQuery, walletOnly]);
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
                ) : options.length === 0 ? (
                    // walletOnly narrows hard - an empty list is a normal
                    // outcome (no balances at all, or none on the chain the
                    // earn side is pinned to). Say so instead of rendering a
                    // blank sheet that reads as a failed load.
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyTitle}>
                            {searchQuery.trim() ? 'No matching tokens' : 'No tokens in this wallet'}
                        </Text>
                        <Text style={styles.emptyBody}>
                            {searchQuery.trim()
                                ? 'Nothing in your wallet matches that name or address.'
                                : walletOnly
                                    ? 'Fund this wallet with the token you want to use, then try again.'
                                    : 'No tokens available for this network.'}
                        </Text>
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
    emptyContainer: {
        paddingHorizontal: 32,
        paddingTop: 48,
        alignItems: 'center',
        gap: 8,
    },
    emptyTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 15,
        color: colors.titleText,
        textAlign: 'center',
    },
    emptyBody: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: colors.mutedText,
        textAlign: 'center',
        lineHeight: 18,
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
