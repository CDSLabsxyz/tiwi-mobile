import { colors } from '@/constants/colors';
import { ChainItem } from '@/lib/mobile/api-client';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import {
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Brand lime (colors.primaryCTA) at the opacities used for tints and hairlines.
const ACCENT_TINT = 'rgba(177, 241, 40, 0.10)';
const ACCENT_TINT_STRONG = 'rgba(177, 241, 40, 0.14)';
const ACCENT_BORDER = 'rgba(177, 241, 40, 0.28)';

export type StatInfoId =
    | 'twc-price'
    | 'chain-count'
    | 'twc-mcap'
    | 'twc-vol'
    | 'twc-total-supply';

interface StatInfoCopy {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    /** Caption above the live figure at the top of the sheet. */
    valueLabel: string;
    /** Body copy. Text wrapped in `**` renders bold. */
    body: string;
}

/**
 * Plain-language explainer for each home stat tile. Every number the home
 * screen shows is derived, so each entry says what it means and where it
 * comes from.
 */
const STAT_INFO: Record<StatInfoId, StatInfoCopy> = {
    'twc-price': {
        title: 'TWC Token Price',
        icon: 'pricetag-outline',
        valueLabel: 'Current price',
        body:
            'The current price of one **TWC (TIWICAT)** token in US dollars, taken live from the deepest TWC liquidity pool on BNB Smart Chain.\n\n' +
            'Because TWC trades at a very small unit price, the leading zeros are shortened. **$0.0(9)5135** means **nine zeros** after the decimal point, then **5135**.\n\n' +
            'Price moves whenever someone buys or sells against the pool, so this figure updates continuously.',
    },
    'chain-count': {
        title: 'Active Chains',
        icon: 'globe-outline',
        valueLabel: 'Chains supported',
        body:
            'The number of blockchains you can hold, send, swap and bridge assets across inside this wallet.\n\n' +
            'Each chain listed below is fully wired up. The wallet derives an address for it, reads your balances, and can route a swap through it.',
    },
    'twc-mcap': {
        title: 'Market Cap',
        icon: 'lock-closed-outline',
        valueLabel: 'Current market cap',
        body:
            'Market capitalisation is the total US-dollar value of every TWC token in circulation.\n\n' +
            'It is calculated as **token price × circulating supply**.\n\n' +
            'Market cap moves with the price, and also drops permanently whenever tokens are burned. TWC is **deflationary**, so supply only ever goes down.',
    },
    'twc-vol': {
        title: '24h Volume',
        icon: 'trending-up-outline',
        valueLabel: 'Traded in the last 24 hours',
        body:
            'The total US-dollar value of TWC bought and sold over the last **24 hours**, across the token\'s liquidity pools.\n\n' +
            'Volume measures **trading activity, not value**. A high number means the token changed hands a lot, which usually also means you can trade a larger size without moving the price as much.\n\n' +
            'This resets on a rolling 24-hour window, so it is not a running total.',
    },
    'twc-total-supply': {
        title: 'Total Supply',
        icon: 'layers-outline',
        valueLabel: 'Tokens in existence right now',
        body:
            'The total number of TWC tokens that currently exist, read directly from the token contract on BNB Smart Chain.\n\n' +
            'TWC is **deflationary**. A portion of tokens is burned over time, and burned tokens are destroyed permanently. That is why this figure sits below the launch supply and only ever falls.\n\n' +
            'This is the **live on-chain figure**, not a stored one.',
    },
};

/**
 * Renders `**bold**` segments inside a paragraph. Keeps the copy above
 * readable as plain strings instead of nested Text arrays.
 */
const renderRichText = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
            <Text key={i} style={styles.bodyStrong}>{part.slice(2, -2)}</Text>
        ) : (
            part
        ),
    );

interface StatInfoSheetProps {
    statId: StatInfoId | null;
    onClose: () => void;
    /** Populates the chain list inside the "Active Chains" sheet. */
    chains?: ChainItem[];
    /**
     * The live figure shown on the tile that opened this sheet, already
     * formatted. Rendered at the top so the explainer and the tile can never
     * disagree about the number.
     */
    value?: string;
}

/**
 * Bottom sheet explaining a single home stat tile. Opened by tapping the tile.
 */
export const StatInfoSheet: React.FC<StatInfoSheetProps> = ({ statId, onClose, chains = [], value }) => {
    const { bottom } = useSafeAreaInsets();

    const { height: screenHeight } = Dimensions.get('window');
    const sheetHeight = Math.min(screenHeight * 0.78, 620);

    const translateY = useSharedValue(sheetHeight);
    const backdropOpacity = useSharedValue(0);
    const startY = useSharedValue(0);

    const isVisible = statId !== null;
    const info = statId ? STAT_INFO[statId] : null;

    useEffect(() => {
        if (isVisible) {
            translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
            backdropOpacity.value = withTiming(1, { duration: 250 });
        } else {
            translateY.value = withTiming(sheetHeight, { duration: 250 });
            backdropOpacity.value = withTiming(0, { duration: 250 });
        }
    }, [isVisible, sheetHeight]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const panGesture = Gesture.Pan()
        .onStart(() => {
            startY.value = translateY.value;
        })
        .onUpdate((event) => {
            translateY.value = Math.max(0, Math.min(sheetHeight, startY.value + event.translationY));
        })
        .onEnd((event) => {
            if (event.translationY > 80) {
                translateY.value = withTiming(sheetHeight, { duration: 250 }, (finished) => {
                    if (finished) runOnJS(onClose)();
                });
                backdropOpacity.value = withTiming(0, { duration: 250 });
            } else {
                translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
            }
        });

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.modalOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <Animated.View style={[styles.backdrop, backdropStyle]} />
                </Pressable>

                <Animated.View
                    style={[
                        styles.sheet,
                        sheetStyle,
                        { height: sheetHeight, paddingBottom: (bottom || 24) + 16 },
                    ]}
                >
                    {/* Drag-to-dismiss is bound to the header only - attaching it
                        to the whole sheet would swallow the chain list's scroll. */}
                    <GestureDetector gesture={panGesture}>
                        <View>
                            <View style={styles.handle} />

                            <View style={styles.headerRow}>
                                <View style={styles.headerIcon}>
                                    <Ionicons
                                        name={info?.icon ?? 'information-circle-outline'}
                                        size={20}
                                        color={colors.primaryCTA}
                                    />
                                </View>
                                <Text style={styles.title}>{info?.title}</Text>
                                <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeButton}>
                                    <Ionicons name="close" size={18} color={colors.bodyText} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.headerDivider} />
                        </View>
                    </GestureDetector>

                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Live figure - same string the tile shows. */}
                        {info && value ? (
                            <View style={styles.valueCard}>
                                <Text style={styles.valueLabel}>{info.valueLabel}</Text>
                                <Text style={styles.valueText} numberOfLines={1} adjustsFontSizeToFit>
                                    {value}
                                </Text>
                            </View>
                        ) : null}

                        <Text style={styles.body}>
                            {info?.body ? renderRichText(info.body) : null}
                        </Text>

                        {/* Chain list - only the Active Chains sheet has one. */}
                        {statId === 'chain-count' && (
                            <View style={styles.chainSection}>
                                <View style={styles.chainSectionHeader}>
                                    <Text style={styles.chainSectionTitle}>Supported chains</Text>
                                    {chains.length > 0 && (
                                        <View style={styles.countPill}>
                                            <Text style={styles.countPillText}>{chains.length}</Text>
                                        </View>
                                    )}
                                </View>

                                {chains.length === 0 ? (
                                    <Text style={styles.chainEmpty}>
                                        Chain list is still loading. Pull down on the home screen to refresh.
                                    </Text>
                                ) : (
                                    <View style={styles.chainList}>
                                        {chains.map((chain, index) => (
                                            <View
                                                key={chain.id}
                                                style={[
                                                    styles.chainRow,
                                                    index < chains.length - 1 && styles.chainRowDivider,
                                                ]}
                                            >
                                                {chain.logoURI ? (
                                                    <Image
                                                        source={{ uri: chain.logoURI }}
                                                        style={styles.chainLogo}
                                                        contentFit="cover"
                                                    />
                                                ) : (
                                                    <View style={[styles.chainLogo, styles.chainLogoFallback]}>
                                                        <Text style={styles.chainLogoLetter}>
                                                            {chain.name.charAt(0).toUpperCase()}
                                                        </Text>
                                                    </View>
                                                )}
                                                <Text style={styles.chainName} numberOfLines={1}>
                                                    {chain.name}
                                                </Text>
                                                {chain.nativeCurrency?.symbol ? (
                                                    <View style={styles.symbolPill}>
                                                        <Text style={styles.symbolPillText}>
                                                            {chain.nativeCurrency.symbol}
                                                        </Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}

                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(1, 5, 1, 0.82)',
    },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        // Matches the app's green-tinted dark palette rather than a neutral grey.
        backgroundColor: colors.bgSemi,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: colors.bgStroke,
        paddingTop: 10,
        paddingHorizontal: 20,
    },
    handle: {
        width: 44,
        height: 4,
        backgroundColor: colors.bgStroke,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 18,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT_TINT,
        borderWidth: 1,
        borderColor: ACCENT_BORDER,
    },
    title: {
        flex: 1,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: colors.titleText,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    headerDivider: {
        height: 1,
        backgroundColor: colors.bgStroke,
        marginTop: 16,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 16,
        paddingBottom: 24,
    },
    valueCard: {
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 18,
        gap: 6,
        backgroundColor: ACCENT_TINT,
        borderWidth: 1,
        borderColor: ACCENT_BORDER,
    },
    valueLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    valueText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 26,
        color: colors.primaryCTA,
    },
    body: {
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        lineHeight: 26,
        color: colors.bodyText,
    },
    // Inherits the body's size so inline highlights sit on the same baseline -
    // only weight and colour change.
    bodyStrong: {
        fontFamily: 'Manrope-SemiBold',
        color: colors.primaryCTA,
    },
    chainSection: {
        marginTop: 22,
        gap: 12,
    },
    chainSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    chainSectionTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: colors.titleText,
    },
    countPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: ACCENT_TINT_STRONG,
        borderWidth: 1,
        borderColor: ACCENT_BORDER,
    },
    countPillText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 11,
        color: colors.primaryCTA,
    },
    chainEmpty: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: colors.mutedText,
    },
    chainList: {
        borderRadius: 18,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        overflow: 'hidden',
    },
    chainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    chainRowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke,
    },
    chainLogo: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.bgStroke,
    },
    chainLogoFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    chainLogoLetter: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.primaryCTA,
    },
    chainName: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    symbolPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    symbolPillText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        color: colors.mutedText,
    },
});
