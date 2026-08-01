/**
 * Bold, self-contained "unwrap this token" call-to-action.
 *
 * Drop it on any token screen with the token's chain + address: it renders
 * nothing unless that token is a wrapped native the wallet actually holds, and
 * otherwise shows a full-width button that opens the unwrap sheet.
 */

import { colors } from '@/constants/colors';
import { getWrappedNative } from '@/constants/wrappedNatives';
import { useUnwrap } from '@/hooks/useUnwrap';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { UnwrapSheet } from './UnwrapSheet';

interface UnwrapButtonProps {
    chainId: number | string | undefined;
    address: string | undefined;
    /** The token's own symbol — keeps native SOL (which shares the WSOL mint
     *  in several feeds) from being offered as unwrappable. */
    symbol?: string;
    logoURI?: string;
    style?: StyleProp<ViewStyle>;
    /**
     * Render even with a zero balance. Off by default — an unwrap button on a
     * token you don't hold is noise.
     */
    showWhenEmpty?: boolean;
}

export const UnwrapButton: React.FC<UnwrapButtonProps> = ({
    chainId,
    address,
    symbol,
    logoURI,
    style,
    showWhenEmpty = false,
}) => {
    const info = useMemo(
        () => getWrappedNative(chainId, address, symbol),
        [chainId, address, symbol],
    );
    const [sheetOpen, setSheetOpen] = useState(false);
    const { balance } = useUnwrap(info);

    if (!info) return null;
    if (!showWhenEmpty && balance.raw <= 0n && !sheetOpen) return null;

    return (
        <View style={style}>
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setSheetOpen(true)}
                style={styles.button}
            >
                <View style={styles.iconCircle}>
                    <Ionicons name="arrow-down" size={16} color={colors.primaryCTA} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>
                        Unwrap {info.wrappedSymbol} → {info.nativeSymbol}
                    </Text>
                    <Text style={styles.subtitle}>
                        Convert back to native {info.nativeSymbol}, 1:1
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#010501" />
            </TouchableOpacity>

            <UnwrapSheet
                visible={sheetOpen}
                info={info}
                logoURI={logoURI}
                onClose={() => setSheetOpen(false)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    button: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.primaryCTA,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#010501',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontFamily: 'Manrope-ExtraBold',
        fontSize: 16,
        letterSpacing: -0.1,
        color: '#010501',
    },
    subtitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        color: 'rgba(1,5,1,0.65)',
        marginTop: 2,
    },
});
