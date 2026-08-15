const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const UNIT_MS: Record<string, number> = {
    s: SECOND_MS,
    sec: SECOND_MS,
    secs: SECOND_MS,
    second: SECOND_MS,
    seconds: SECOND_MS,
    m: MINUTE_MS,
    min: MINUTE_MS,
    mins: MINUTE_MS,
    minute: MINUTE_MS,
    minutes: MINUTE_MS,
    h: HOUR_MS,
    hr: HOUR_MS,
    hrs: HOUR_MS,
    hour: HOUR_MS,
    hours: HOUR_MS,
    d: DAY_MS,
    day: DAY_MS,
    days: DAY_MS,
    w: 7 * DAY_MS,
    week: 7 * DAY_MS,
    weeks: 7 * DAY_MS,
    mo: 30 * DAY_MS,
    mos: 30 * DAY_MS,
    month: 30 * DAY_MS,
    months: 30 * DAY_MS,
    y: 365 * DAY_MS,
    yr: 365 * DAY_MS,
    yrs: 365 * DAY_MS,
    year: 365 * DAY_MS,
    years: 365 * DAY_MS,
};

type TimeInput = Date | number | string | null | undefined;
type AmountInput = bigint | number | string | null | undefined;

export interface StakingLockInfo {
    minStakingPeriodMs: number;
    poolStartMs: number | null;
    unlockAtMs: number | null;
    remainingMs: number;
    isLocked: boolean;
}

export function parseStakingPeriodToMs(period: string | number | null | undefined): number {
    if (typeof period === 'number') {
        return Number.isFinite(period) && period > 0 ? period * DAY_MS : 0;
    }

    const value = period?.trim().toLowerCase();
    if (!value || value === 'none' || value === 'no lock' || value === 'flexible') return 0;

    const match = value.match(/(\d+(?:\.\d+)?)\s*([a-z]+)?/);
    if (!match) return 0;

    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    const unit = match[2];
    if (!unit) {
        return amount > 1000 ? amount * SECOND_MS : amount * DAY_MS;
    }

    return amount * (UNIT_MS[unit] || DAY_MS);
}

export function formatRemainingStakingLock(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / SECOND_MS));
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    return `${seconds}s`;
}

export function getStakingLockInfo({
    minStakingPeriod,
    poolStartedAt,
    stakedAmount,
    nowMs = Date.now(),
}: {
    minStakingPeriod: string | number | null | undefined;
    poolStartedAt: TimeInput;
    stakedAmount: AmountInput;
    nowMs?: number;
}): StakingLockInfo {
    const minStakingPeriodMs = parseStakingPeriodToMs(minStakingPeriod);
    const hasStake = hasPositiveAmount(stakedAmount);
    const poolStartMs = parseTimeMs(poolStartedAt);
    const unlockAtMs = minStakingPeriodMs > 0 && poolStartMs !== null ? poolStartMs + minStakingPeriodMs : null;
    const remainingMs = unlockAtMs !== null ? Math.max(0, unlockAtMs - nowMs) : 0;

    return {
        minStakingPeriodMs,
        poolStartMs,
        unlockAtMs,
        remainingMs,
        isLocked: hasStake && unlockAtMs !== null && remainingMs > 0,
    };
}

function parseTimeMs(value: TimeInput): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) {
        const timestamp = value.getTime();
        return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    }
    if (typeof value === 'number') {
        const timestamp = value > 1_000_000_000_000 ? value : value * SECOND_MS;
        return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
        const timestamp = numeric > 1_000_000_000_000 ? numeric : numeric * SECOND_MS;
        return timestamp;
    }

    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

function hasPositiveAmount(amount: AmountInput): boolean {
    if (amount === null || amount === undefined) return false;
    if (typeof amount === 'bigint') return amount > 0n;
    const numeric = Number(amount);
    return Number.isFinite(numeric) && numeric > 0;
}
