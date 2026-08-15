import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { useStakingPool } from '@/hooks/useStakingPool';
import { formatCompactNumber } from '@/utils/formatting';
import AntDesign from '@expo/vector-icons/AntDesign';
import React, { useState } from 'react';
import { LayoutAnimation, Platform, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { PoolTokenIcon } from './PoolTokenIcon';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface StakingPoolAccordionProps {
    /** Legacy on-chain numeric id OR DB UUID (V2). */
    poolId: number | string;
    /** V2 per-pool contract address - when present, reads go directly to it. */
    poolContractAddress?: string;
    decimals?: number;
    /** Admin-set pool name. When present it becomes the title; symbol shows underneath. */
    name?: string;
    tokenSymbol: string;
    tokenName: string;
    tokenIcon?: any;
    rewardTokenSymbol?: string;
    rewardTokenIcon?: any;
    minStakingPeriod?: string;
    onStakePress: () => void;
}

export const StakingPoolAccordion: React.FC<StakingPoolAccordionProps> = ({
    poolId,
    poolContractAddress,
    decimals,
    name,
    tokenSymbol,
    tokenIcon,
    rewardTokenSymbol,
    rewardTokenIcon,
    minStakingPeriod,
    onStakePress
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    // List rows read nothing that the event-log history scan produces, so skip
    // it - it is the single most expensive thing this hook can do.
    const stakingData = useStakingPool(poolId, decimals ?? 9, {
        poolContractAddress,
        skipHistoryScan: true,
    });
    const { apr, lockPeriod, tvlCompact, activeStakersCount, isCoreLoading } = stakingData;
    const isLoading = isCoreLoading;
    const displayLockPeriod = minStakingPeriod || lockPeriod || 'No Lock';

    const aprNum = parseFloat(String(apr).replace(/[^\d.-]/g, ''));
    const aprCompact = Number.isFinite(aprNum)
        ? `${formatCompactNumber(aprNum, { decimals: aprNum < 10 ? 2 : 1 })}%`
        : apr;

    const isStakersResolved = activeStakersCount !== undefined && activeStakersCount !== 'N/A';
    const stakersDisplay = isStakersResolved ? activeStakersCount : '0';

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(!isExpanded);
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Skeleton width={40} height={40} borderRadius={20} />
                    <Skeleton width={120} height={20} style={{ marginLeft: 12 }} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={toggleExpand}
                style={styles.header}
            >
                <View style={styles.tokenInfo}>
                    <PoolTokenIcon
                        tokenIcon={tokenIcon}
                        tokenSymbol={tokenSymbol}
                        rewardTokenIcon={rewardTokenIcon}
                        rewardTokenSymbol={rewardTokenSymbol}
                        size={36}
                        style={styles.tokenIcon}
                    />
                    <View style={styles.titleColumn}>
                        <Text style={styles.symbolText} numberOfLines={1}>
                            {name || tokenSymbol}
                        </Text>
                    </View>
                </View>

                <AntDesign
                    name={isExpanded ? "up" : "down"}
                    size={18}
                    color={colors.mutedText}
                />
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.content}>
                    {/* Headers Row */}
                    <View style={styles.labelRow}>
                        <Text style={[styles.label, styles.labelCol]}>APR</Text>
                        <Text style={[styles.label, styles.labelCol]}>Lock Period</Text>
                        <View style={{ width: 20 }} />
                    </View>

                    {/* Value Row (Actionable) */}
                    <TouchableOpacity
                        style={styles.valueRow}
                        onPress={onStakePress}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.valueText}>{aprCompact}</Text>
                        <Text style={styles.valueText}>{displayLockPeriod}</Text>
                        <AntDesign name="arrow-right" size={20} color={colors.titleText} />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    {/* Secondary Stats Row */}
                    <View style={styles.secondaryStats}>
                        <View style={styles.statBox}>
                            <Text style={styles.secondaryLabel}>TVL</Text>
                            <Text style={styles.secondaryValue}>{tvlCompact} {tokenSymbol}</Text>
                        </View>
                        <View style={[styles.statBox, styles.statBoxRight]}>
                            <Text style={styles.secondaryLabel}>STAKERS</Text>
                            <Text style={styles.secondaryValue}>{stakersDisplay} USERS</Text>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bgSecondary,
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        justifyContent: 'space-between',
    },
    tokenInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        minWidth: 0,
        marginRight: 8,
    },
    tokenIcon: {
        marginRight: 10,
    },
    titleColumn: {
        flexShrink: 1,
        minWidth: 0,
    },
    symbolText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.titleText,
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    labelCol: {
        flex: 1,
        textAlign: 'left',
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    valueText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: colors.titleText,
        flex: 1,
        textAlign: 'left',
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 12,
        opacity: 0.5,
    },
    secondaryStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statBox: {
        flex: 1,
    },
    statBoxRight: {
        alignItems: 'flex-end',
    },
    secondaryLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    secondaryValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
        color: colors.titleText,
    },
});
