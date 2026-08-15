import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React, { useEffect, useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

const TWCIcon = require('../../../assets/home/tiwicat.svg');

interface PoolTokenIconProps {
    tokenIcon?: any;
    tokenSymbol?: string;
    rewardTokenIcon?: any;
    rewardTokenSymbol?: string;
    size?: number;
    style?: StyleProp<ViewStyle>;
}

function normalizeSymbol(symbol?: string) {
    return (symbol || '').trim().toLowerCase();
}

function shortSymbol(symbol?: string) {
    const cleaned = (symbol || '?').trim().toUpperCase();
    return cleaned.slice(0, cleaned.length > 2 ? 3 : 2);
}

function fallbackIconForSymbol(symbol?: string) {
    const normalized = (symbol || '').trim().toUpperCase();
    if (normalized === 'TWC' || normalized === 'TIWICAT') return TWCIcon;
    return undefined;
}

function remoteUri(icon?: any): string | undefined {
    return typeof icon?.uri === 'string' && icon.uri.trim() ? icon.uri : undefined;
}

function shouldUseLocalIcon(symbol?: string) {
    return !!fallbackIconForSymbol(symbol);
}

function TokenDisc({
    icon,
    symbol,
    size,
    borderWidth = 0,
}: {
    icon?: any;
    symbol?: string;
    size: number;
    borderWidth?: number;
}) {
    const localFallback = fallbackIconForSymbol(symbol);
    const imageSource = shouldUseLocalIcon(symbol) ? localFallback : icon;
    const hasLocalBadge = !!localFallback;
    const hasImageSource = !!imageSource;

    return (
        <View
            style={[
                styles.disc,
                hasLocalBadge && styles.localBadgeDisc,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: hasLocalBadge ? Math.max(borderWidth, 1) : borderWidth,
                },
            ]}
        >
            {!localFallback && !hasImageSource && (
                <Text style={[styles.fallbackText, { fontSize: Math.max(9, Math.round(size * 0.28)) }]}>
                    {shortSymbol(symbol)}
                </Text>
            )}
            {hasImageSource ? (
                <Image
                    source={imageSource}
                    placeholder={localFallback}
                    placeholderContentFit="contain"
                    style={styles.fullImage}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    priority="high"
                    transition={0}
                />
            ) : null}
        </View>
    );
}

export function PoolTokenIcon({
    tokenIcon,
    tokenSymbol,
    rewardTokenIcon,
    rewardTokenSymbol,
    size = 36,
    style,
}: PoolTokenIconProps) {
    const isCrossToken = !!rewardTokenSymbol
        && normalizeSymbol(rewardTokenSymbol) !== normalizeSymbol(tokenSymbol);
    const tokenIconUri = shouldUseLocalIcon(tokenSymbol) ? undefined : remoteUri(tokenIcon);
    const rewardTokenIconUri = shouldUseLocalIcon(rewardTokenSymbol) ? undefined : remoteUri(rewardTokenIcon);
    const prefetchUris = useMemo(
        () => [
            tokenIconUri,
            rewardTokenIconUri,
        ].filter((uri): uri is string => !!uri),
        [rewardTokenIconUri, tokenIconUri],
    );

    useEffect(() => {
        if (prefetchUris.length === 0) return;
        Image.prefetch(prefetchUris, 'memory-disk').catch(() => undefined);
    }, [prefetchUris]);

    if (!isCrossToken) {
        return (
            <View style={[{ width: size, height: size }, style]}>
                <TokenDisc icon={tokenIcon} symbol={tokenSymbol} size={size} />
            </View>
        );
    }

    const childSize = Math.round(size * 0.72);

    return (
        <View style={[{ width: size, height: size }, style]}>
            <View style={styles.stakeIcon}>
                <TokenDisc icon={tokenIcon} symbol={tokenSymbol} size={childSize} borderWidth={2} />
            </View>
            <View style={styles.rewardIcon}>
                <TokenDisc icon={rewardTokenIcon} symbol={rewardTokenSymbol} size={childSize} borderWidth={2} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    disc: {
        backgroundColor: '#1f261e',
        borderColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    localBadgeDisc: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E8E8E8',
    },
    fullImage: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    fallbackText: {
        fontFamily: 'Manrope-Bold',
        color: colors.primaryCTA,
    },
    stakeIcon: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
    rewardIcon: {
        position: 'absolute',
        right: 0,
        bottom: 0,
    },
});
