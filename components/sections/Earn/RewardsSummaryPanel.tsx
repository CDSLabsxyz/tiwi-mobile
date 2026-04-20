/**
 * Rewards Summary Panel
 *
 * Two-column layout mirrored from the super-app's stake-details-card:
 *   Active   → Claimed  | Pending
 *   Ended    → Claimed  | Withdrawn
 *
 * "Ended" covers both fully-exited positions (status withdrawn/completed) and
 * pools whose on-chain endTime has passed — the caller decides via `hasEnded`.
 *
 * Claimed math:
 *   Active — explicit Claim-button total only (`totalClaimed`).
 *   Ended  — `totalClaimed` + `rewardsEarned` (the auto-harvest leg of
 *            Max-unstake is recorded in rewardsEarned, so both buckets
 *            together represent every reward that ever left the contract).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
    /** Pending (live on-chain) rewards. Only used when `hasEnded` is false. */
    pending: number;
    /** Explicit Claim-button total from the DB. */
    totalClaimed: number;
    /** Auto-harvested rewards at exit (rewards_earned column). */
    rewardsEarned?: number;
    /** Principal returned at exit. Only used when `hasEnded` is true. */
    stakedAmount?: number;
    /** Whether the position is finished (withdrawn / completed / pool ended). */
    hasEnded?: boolean;
    /** Token symbol suffix for the Withdrawn value. */
    tokenSymbol?: string;
}

function formatFull(num: number, maxDecimals = 6): string {
    if (!num) return '0';
    if (num < 0.000001) return num.toExponential(4);
    return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: maxDecimals,
    });
}

export const RewardsSummaryPanel: React.FC<Props> = ({
    pending,
    totalClaimed,
    rewardsEarned = 0,
    stakedAmount = 0,
    hasEnded = false,
    tokenSymbol,
}) => {
    const claimedDisplay = hasEnded ? totalClaimed + rewardsEarned : totalClaimed;
    return (
        <View style={styles.container}>
            <Text style={styles.heading}>REWARDS SUMMARY</Text>
            <View style={styles.row}>
                <View style={styles.cell}>
                    <Text style={styles.label}>CLAIMED</Text>
                    <Text style={styles.valueGreen} numberOfLines={1}>
                        {formatFull(claimedDisplay)}
                    </Text>
                </View>
                {hasEnded ? (
                    <View style={styles.cell}>
                        <Text style={styles.label}>WITHDRAWN</Text>
                        <Text style={styles.valueGreen} numberOfLines={1}>
                            {`${formatFull(stakedAmount)}${tokenSymbol ? ` ${tokenSymbol}` : ''}`}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.cell}>
                        <Text style={styles.label}>PENDING</Text>
                        <Text style={styles.valueYellow} numberOfLines={1}>
                            {formatFull(pending)}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(31,38,30,0.3)',
        borderWidth: 1,
        borderColor: '#273024',
        borderRadius: 12,
        padding: 12,
        marginTop: 16,
    },
    heading: {
        color: '#b1f128',
        fontSize: 10,
        fontFamily: 'Manrope-Bold',
        letterSpacing: 1,
        marginBottom: 10,
        opacity: 0.7,
    },
    row: { flexDirection: 'row', gap: 8 },
    cell: { flex: 1, gap: 4 },
    label: { color: '#7c7c7c', fontSize: 9, fontFamily: 'Manrope-Medium', letterSpacing: 0.5 },
    valueGreen: { color: '#b1f128', fontSize: 12, fontFamily: 'Manrope-SemiBold' },
    valueYellow: { color: '#EAB308', fontSize: 12, fontFamily: 'Manrope-SemiBold' },
});
