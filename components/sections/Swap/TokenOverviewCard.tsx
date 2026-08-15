import { colors } from '@/constants/colors';
import { getChainName } from '@/utils/chain';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface CuratedTokenLink {
    type: string;
    url: string;
}

interface TokenOverviewCardProps {
    /** Admin-authored description */
    about?: string;
    /** Admin-curated ordered links from the Listing / Spotlight row */
    links?: CuratedTokenLink[];
    /** Provider-sourced socials, used to fill gaps the admin didn't curate */
    socials?: {
        website?: string;
        twitter?: string;
        telegram?: string;
        discord?: string;
    };
    symbol?: string;
    name?: string;
    logo?: string;
    address?: string;
    chainId?: number;
    isLoading?: boolean;
}

/** Labels for the admin link types, mirroring the admin app's picker. */
const LINK_TYPE_LABELS: Record<string, string> = {
    website: 'Website',
    twitter: 'Twitter / X',
    telegram: 'Telegram',
    discord: 'Discord',
    medium: 'Medium',
    github: 'GitHub',
    reddit: 'Reddit',
    youtube: 'YouTube',
    whitepaper: 'Whitepaper',
    docs: 'Docs',
    explorer: 'Explorer',
    coingecko: 'CoinGecko',
    coinmarketcap: 'CoinMarketCap',
    audit: 'Audit',
    other: 'Link',
};

function labelForType(type: string): string {
    return LINK_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/** Address-shaped identifiers only - market rows put a symbol in the address slot. */
const ADDRESS_RE =
    /^(0x[a-fA-F0-9]{40}|0x[a-fA-F0-9]{64}|[1-9A-HJ-NP-Za-km-z]{32,44}|T[1-9A-HJ-NP-Za-km-z]{33})$/;

function shorten(address: string): string {
    if (address.length <= 20) return address;
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

/**
 * The admin-curated token overview shown beneath the swap CTA.
 *
 * Only rendered for tokens opened from the Listing / Spotlight tabs - the swap
 * screen gates this on the `infoSource` route param.
 */
export default function TokenOverviewCard({
    about,
    links = [],
    socials,
    symbol,
    name,
    logo,
    address,
    chainId,
    isLoading = false,
}: TokenOverviewCardProps) {
    const [copied, setCopied] = useState(false);

    const trimmedAbout = (about || '').trim();

    /**
     * Admin-curated links first - their order is deliberate - then any provider
     * social the admin didn't already cover, deduped by URL.
     */
    const validLinks = useMemo(() => {
        const out: CuratedTokenLink[] = [];
        const seenUrls = new Set<string>();
        const seenTypes = new Set<string>();

        const push = (type: string, url?: string | null) => {
            const trimmed = (url || '').trim();
            if (!trimmed) return;
            const key = trimmed.toLowerCase();
            if (seenUrls.has(key)) return;
            seenUrls.add(key);
            seenTypes.add(type);
            out.push({ type, url: trimmed });
        };

        for (const link of links) push(link?.type || 'other', link?.url);

        const fallbacks: Array<[string, string | undefined]> = [
            ['website', socials?.website],
            ['twitter', socials?.twitter],
            ['telegram', socials?.telegram],
            ['discord', socials?.discord],
        ];
        for (const [type, url] of fallbacks) {
            if (!seenTypes.has(type)) push(type, url);
        }

        return out;
    }, [links, socials]);

    const contract = (address || '').trim();
    const showContract = ADDRESS_RE.test(contract);
    const chainName = chainId ? getChainName(chainId, symbol) : '';

    const handleCopy = async () => {
        if (!contract) return;
        await Clipboard.setStringAsync(contract);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
    };

    const openLink = (url: string) => {
        const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        Linking.openURL(target).catch(() => {
            // Nothing sensible to show if no handler is installed
        });
    };

    const hasContent = trimmedAbout || validLinks.length > 0 || showContract;
    if (!isLoading && !hasContent) return null;

    return (
        <View style={styles.container}>
            {/* Identity row */}
            <View style={styles.header}>
                {logo ? (
                    <Image source={{ uri: logo }} style={styles.logo} contentFit="cover" />
                ) : (
                    <View style={[styles.logo, styles.logoFallback]}>
                        <Text style={styles.logoFallbackText}>
                            {(symbol || '?').charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}

                <View style={styles.identity}>
                    <Text style={styles.name} numberOfLines={1}>
                        {name || symbol || 'Token'}
                    </Text>
                    {!!symbol && <Text style={styles.symbol}>{symbol.toUpperCase()}</Text>}
                </View>

                {!!chainName && (
                    <View style={styles.chip}>
                        <Text style={styles.chipText}>{chainName}</Text>
                    </View>
                )}
            </View>

            {showContract && (
                <TouchableOpacity
                    style={styles.contractRow}
                    onPress={handleCopy}
                    activeOpacity={0.7}
                >
                    <Text style={styles.contractLabel}>CONTRACT</Text>
                    <Text style={styles.contractValue} numberOfLines={1}>
                        {shorten(contract)}
                    </Text>
                    <Ionicons
                        name={copied ? 'checkmark' : 'copy-outline'}
                        size={14}
                        color={copied ? colors.primaryCTA : colors.mutedText}
                    />
                </TouchableOpacity>
            )}

            {isLoading && !hasContent ? (
                <View style={styles.skeletonWrap}>
                    <View style={[styles.skeleton, { width: '100%' }]} />
                    <View style={[styles.skeleton, { width: '80%' }]} />
                    <View style={[styles.skeleton, { width: '60%' }]} />
                </View>
            ) : (
                <>
                    {!!trimmedAbout && (
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>OVERVIEW</Text>
                            <Text style={styles.aboutText}>{trimmedAbout}</Text>
                        </View>
                    )}

                    {validLinks.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>LINKS</Text>
                            <View style={styles.linkRow}>
                                {validLinks.map((link, index) => (
                                    <TouchableOpacity
                                        key={`${link.type}-${index}`}
                                        style={styles.linkChip}
                                        onPress={() => openLink(link.url)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.linkChipText}>
                                            {labelForType(link.type)}
                                        </Text>
                                        <Ionicons
                                            name="open-outline"
                                            size={12}
                                            color={colors.mutedText}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignSelf: 'center',
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        gap: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    logo: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.bgCards,
    },
    logoFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    logoFallbackText: {
        color: colors.titleText,
        fontSize: 13,
        fontWeight: '600',
    },
    identity: {
        flex: 1,
        minWidth: 0,
    },
    name: {
        color: colors.titleText,
        fontSize: 14,
        fontWeight: '600',
    },
    symbol: {
        color: colors.mutedText,
        fontSize: 11,
        marginTop: 1,
        letterSpacing: 0.5,
    },
    chip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    chipText: {
        color: colors.bodyText,
        fontSize: 11,
        fontWeight: '500',
    },
    contractRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
    },
    contractLabel: {
        color: colors.mutedText,
        fontSize: 10,
        letterSpacing: 1.5,
    },
    contractValue: {
        flex: 1,
        color: colors.bodyText,
        fontSize: 12,
        fontVariant: ['tabular-nums'],
    },
    section: {
        gap: 8,
    },
    sectionLabel: {
        color: colors.mutedText,
        fontSize: 10,
        letterSpacing: 1.5,
    },
    aboutText: {
        color: colors.bodyText,
        fontSize: 13,
        lineHeight: 20,
    },
    linkRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    linkChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    linkChipText: {
        color: colors.titleText,
        fontSize: 12,
        fontWeight: '500',
    },
    skeletonWrap: {
        gap: 8,
    },
    skeleton: {
        height: 10,
        borderRadius: 4,
        backgroundColor: colors.bgStroke,
    },
});
