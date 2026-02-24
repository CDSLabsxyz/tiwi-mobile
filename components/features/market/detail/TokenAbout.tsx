import { colors } from '@/constants/colors';
import { EnrichedMarket } from '@/services/apiClient';
import { truncateAddress } from '@/utils/wallet';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface TokenAboutProps {
    token: EnrichedMarket;
}

export const TokenAbout: React.FC<TokenAboutProps> = ({ token }) => {
    const handleCopy = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        Alert.alert('Copied', `${label} copied to clipboard`);
    };

    const handleLink = (url: string) => {
        if (!url) return;
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        Linking.openURL(fullUrl).catch(() => Alert.alert('Error', 'Could not open link'));
    };

    /**
     * getBestWebsite: Scores websites based on proximity to token name/symbol.
     * Prioritizes short, official-looking domains like solana.com over ctosolana.com
     */
    const bestWebsite = useMemo(() => {
        const sites = [
            ...(token.metadata?.websites?.map(w => w.url) || []),
            token.metadata?.website,
            token.website
        ].filter((url): url is string => !!url);

        if (sites.length === 0) return null;

        const tokenSymbol = token.symbol.toLowerCase();
        const tokenName = (token.baseToken?.name || token.name).toLowerCase().replace(/\s/g, '');

        const scoreSite = (url: string) => {
            try {
                const domain = url.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
                let score = 0;

                // 1. Exact domain match (e.g. solana.com matches "solana")
                if (domain.startsWith(tokenSymbol + '.') || domain.startsWith(tokenName + '.')) {
                    score += 100;
                }

                // 2. Contains name
                if (domain.includes(tokenName) || domain.includes(tokenSymbol)) {
                    score += 50;
                }

                // 3. Shorter domains are usually more "official" (e.g. solana.com vs solana-foundation.com)
                score -= domain.length;

                return score;
            } catch (e) {
                return 0;
            }
        };

        return sites.sort((a, b) => scoreSite(b) - scoreSite(a))[0];
    }, [token]);

    /**
     * bestTwitter: Extracts or constructs a clean Twitter URL.
     */
    const bestTwitter = useMemo(() => {
        const twitterUrl = token.metadata?.socials?.find(s => s.type === 'twitter')?.url || token.socials?.twitter;
        if (!twitterUrl) return null;

        // Ensure it's a full URL
        if (twitterUrl.startsWith('http')) return twitterUrl;
        return `https://x.com/${twitterUrl.replace('@', '')}`;
    }, [token]);

    const rows: Array<{
        label: string;
        value: string;
        fullValue?: string;
        copyable?: boolean;
        linkable?: boolean;
    }> = [
            {
                label: 'Token Name',
                value: token.baseToken?.name || token.name,
                copyable: false,
                linkable: false
            },
            {
                label: 'Official X',
                value: bestTwitter ? `@${bestTwitter.split('/').pop()}` : 'N/A',
                fullValue: bestTwitter || undefined,
                copyable: false,
                linkable: !!bestTwitter
            },
            // {
            //     label: 'Telegram',
            //     value: telegramUrl ? 'Join Community' : 'N/A',
            //     fullValue: telegramUrl || undefined,
            //     copyable: false,
            //     linkable: !!telegramUrl
            // },
            {
                label: 'Website',
                value: bestWebsite || 'N/A',
                fullValue: bestWebsite || undefined,
                copyable: false,
                linkable: !!bestWebsite
            },
            {
                label: 'Contract Address',
                value: truncateAddress(token.address!) || 'N/A',
                fullValue: token.address || undefined,
                copyable: true,
                linkable: false
            },
            { label: 'Network', value: token.networkName || '-', copyable: false, linkable: false }
        ];

    const description = token.metadata?.description || token.description;

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>About</Text>

            {description && (
                <View style={styles.descriptionContainer}>
                    <Text style={styles.descriptionText}>{description}</Text>
                </View>
            )}

            <View style={styles.rowsContainer}>
                {rows.map((row, index) => (
                    <View key={index} style={styles.row}>
                        <Text style={styles.label}>{row.label}</Text>
                        <View style={styles.valueContainer}>
                            <Text style={styles.value}>{row.value}</Text>

                            {row.copyable && (
                                <TouchableOpacity
                                    onPress={() => handleCopy(row.fullValue!, row.label)}
                                    style={styles.iconButton}
                                >
                                    <Image
                                        source={require('@/assets/wallet/copy-01.svg')}
                                        style={styles.icon}
                                    />
                                </TouchableOpacity>
                            )}

                            {row.linkable && (
                                <TouchableOpacity
                                    onPress={() => handleLink(row.fullValue!)}
                                    style={styles.iconButton}
                                >
                                    <Image
                                        source={require('@/assets/home/arrow-right-01.svg')}
                                        style={styles.icon}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: colors.bg,
    },
    sectionTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
        marginBottom: 12,
    },
    descriptionContainer: {
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke,
    },
    descriptionText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        lineHeight: 20,
    },
    rowsContainer: {
        width: '100%',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        justifyContent: 'flex-end',
    },
    value: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        textAlign: 'right',
        maxWidth: '80%',
    },
    iconButton: {
        padding: 4,
    },
    icon: {
        width: 16,
        height: 16,
        tintColor: colors.bodyText,
    },
});
