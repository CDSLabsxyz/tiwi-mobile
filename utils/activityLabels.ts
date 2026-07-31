/**
 * Human-readable labels for activity/transaction categories on the mobile
 * activities board. Mirrors the web app's lib/shared/utils/activity-labels.ts.
 *
 * Rows carry a machine `category` (e.g. `CreateStakingPool`) that reads badly
 * raw. This maps each (case-insensitively) to the copy the board should show.
 * Unknown categories fall back to the original string so new types still render.
 */
const ACTIVITY_LABELS: Record<string, string> = {
    swap: 'Swap',
    sent: 'Sent',
    send: 'Sent',
    received: 'Received',
    receive: 'Received',
    stake: 'Staked',
    unstake: 'Unstaked',
    claimfromstake: 'Claimed rewards',
    approve: 'Approve',
    transfer: 'Transfer',
    multisend: 'Multi-send',
    singlesend: 'Sent',
    addliquidity: 'Added liquidity',
    removeliquidity: 'Removed liquidity',
    createstakingpool: 'Created staking pool',
    createliquiditypool: 'Created liquidity pool',
    aisubscription: 'TIWI AI credits',
};

export function getActivityLabel(category?: string | null): string {
    const raw = (category || '').trim();
    if (!raw) return 'Transaction';
    return ACTIVITY_LABELS[raw.toLowerCase()] ?? raw;
}
