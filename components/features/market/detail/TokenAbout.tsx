import { colors } from '@/constants/colors';
import { EnrichedMarket } from '@/services/apiClient';
import { truncateAddress } from '@/utils/wallet';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface TokenAboutProps {
    token: EnrichedMarket;
}

function getChainName(chainId: number, symbol?: string): string | null {
    if (symbol === "BTC" || symbol === "BITCOIN") return "Bitcoin Network";
    const chains: Record<number, string> = {
        1: "Ethereum",
        56: "BNB Chain",
        137: "Polygon",
        42161: "Arbitrum",
        10: "Optimism",
        8453: "Base",
        43114: "Avalanche",
        250: "Fantom",
        7565164: "Solana",
    };
    return chains[chainId] || `Chain ${chainId}`;
}

export const TokenAbout: React.FC<TokenAboutProps & { chainId?: number }> = ({ token, chainId }) => {
    const handleCopy = async (text: string, label: string) => {
        if (!text) return;
        await Clipboard.setStringAsync(text);
        Alert.alert('Copied', `${label} copied to clipboard`);
    };

    const handleLink = (url: string) => {
        if (!url) return;
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        Linking.openURL(fullUrl).catch(() => Alert.alert('Error', 'Could not open link'));
    };

    const effectiveAddress = (token as any).address && (token as any).address.startsWith('0x') 
        ? (token as any).address 
        : (token as any).contractAddress && (token as any).contractAddress.startsWith('0x')
            ? (token as any).contractAddress
            : (token as any).baseToken?.address && (token as any).baseToken?.address.startsWith('0x')
                ? (token as any).baseToken?.address
                : null;

    const effectiveSymbol = token.symbol || (token as any).baseToken?.symbol || '';
    const effectiveName = token.name || (token as any).baseToken?.name || '';
    const displayChainId = chainId || (token as any).chainId || 56;

    const bestWebsite = useMemo(() => {
        return token.website || (token as any).metadata?.website || (token as any).metadata?.websites?.[0]?.url;
    }, [token]);

    const bestTwitter = useMemo(() => {
        const twitterUrl = (token as any).twitter || (token as any).metadata?.socials?.find((s: any) => s.type === 'twitter')?.url;
        if (!twitterUrl) return null;
        if (twitterUrl.startsWith('http')) return twitterUrl;
        return `https://x.com/${twitterUrl.replace('@', '')}`;
    }, [token]);

    const bestTelegram = useMemo(() => {
        const url = (token as any).telegram || (token as any).metadata?.socials?.find((s: any) => s.type === 'telegram')?.url;
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `https://t.me/${url.replace('@', '')}`;
    }, [token]);

    const bestDiscord = useMemo(() => {
        return (token as any).discord || (token as any).metadata?.socials?.find((s: any) => s.type === 'discord')?.url;
    }, [token]);

    const description = (token as any).description || (token as any).metadata?.description;

    return (
        <View style={styles.container}>
            {description && (
                <View style={[styles.card, { marginBottom: 16 }]}>
                    <Text style={styles.sectionTitle}>About {effectiveSymbol || ''}</Text>
                    <Text style={styles.descriptionText}>{description}</Text>
                </View>
            )}

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Info</Text>
                
                <View style={styles.row}>
                    <Text style={styles.label}>Network</Text>
                    <Text style={styles.value}>{getChainName(displayChainId, effectiveSymbol) || '-'}</Text>
                </View>

                {effectiveAddress && effectiveAddress.startsWith('0x') && (
                    <View style={styles.row}>
                        <Text style={styles.label}>Contract</Text>
                        <View style={styles.valueContainer}>
                            <Text style={styles.value}>{truncateAddress(effectiveAddress)}</Text>
                            <TouchableOpacity onPress={() => handleCopy(effectiveAddress, 'Contract')} style={styles.iconButton}>
                                <Ionicons name="copy-outline" size={14} color={colors.mutedText} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Social Links Grid */}
                <View style={styles.socialGrid}>
                    {bestWebsite && (
                        <TouchableOpacity onPress={() => handleLink(bestWebsite)} style={styles.socialButton}>
                            <Ionicons name="globe-outline" size={14} color="#FFF" />
                            <Text style={styles.socialText}>Website</Text>
                        </TouchableOpacity>
                    )}
                    {bestTwitter && (
                        <TouchableOpacity onPress={() => handleLink(bestTwitter)} style={styles.socialButton}>
                            <Ionicons name="logo-twitter" size={14} color="#FFF" />
                            <Text style={styles.socialText}>Twitter</Text>
                        </TouchableOpacity>
                    )}
                    {bestTelegram && (
                        <TouchableOpacity onPress={() => handleLink(bestTelegram)} style={styles.socialButton}>
                            <FontAwesome5 name="telegram-plane" size={14} color="#FFF" />
                            <Text style={styles.socialText}>Telegram</Text>
                        </TouchableOpacity>
                    )}
                    {bestDiscord && (
                        <TouchableOpacity onPress={() => handleLink(bestDiscord)} style={styles.socialButton}>
                            <Ionicons name="logo-discord" size={14} color="#FFF" />
                            <Text style={styles.socialText}>Discord</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    card: {
        backgroundColor: colors.bgSemi,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    sectionTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.titleText,
        marginBottom: 12,
    },
    descriptionText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        lineHeight: 20,
        opacity: 0.8,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.mutedText,
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    value: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    iconButton: {
        padding: 4,
    },
    socialGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.bgCards,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    socialText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: '#FFF',
    },
});

