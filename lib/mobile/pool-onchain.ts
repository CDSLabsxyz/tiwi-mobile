/**
 * Device-side reads of a V2 `TiwiStakingPool`, plus reward-token identity.
 *
 * Two problems this solves, both ported from the web app:
 *
 * 1. **`onChain: null` renders as zero.** The `/api/v1/mobile/staking/*` routes
 *    enrich pools with server-side `getPoolInfo` reads, but that read is
 *    best-effort — when the backend's RPC calls fail it returns `onChain: null`
 *    and every figure on the manage screen collapses to a `0` that is
 *    indistinguishable from an empty pool. The device has its own RPC path, so
 *    it re-reads rather than displaying a convincing zero.
 *
 * 2. **A pool has TWO tokens.** `maxTvl` / `totalStaked` / `userInfo.amount` are
 *    in the STAKING token; `poolReward` / `rewardPerSecond` / `rewardBalance` /
 *    `pendingReward` are in the REWARD token (`getPoolInfo()[1]`). They're the
 *    same asset for "stake A, earn A" and nobody notices — for "stake A, earn B"
 *    formatting the reward side with the staking token's decimals is a factor of
 *    10^(d_reward - d_stake) error. A 1 USDT (18dp) reward pool read against
 *    TWC's 9dp shows as 1,000,000,000, and that number then feeds the APR, the
 *    live earning rate and the claimed amount written back to the DB.
 */

import { STAKING_POOL_V2_ABI } from '@/constants/abis';
import { createTransportForChain } from '@/constants/rpc';
import { createPublicClient, formatUnits, type Address, type PublicClient } from 'viem';
import { arbitrum, avalanche, base, bsc, mainnet, optimism, polygon } from 'viem/chains';

const CHAIN_MAP: Record<number, any> = {
    1: mainnet, 56: bsc, 137: polygon, 42161: arbitrum, 8453: base, 10: optimism, 43114: avalanche,
};

const ERC20_METADATA_ABI = [
    { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
] as const;

const clientCache = new Map<number, PublicClient>();

/** Public client for a chain, on the app's health-ranked fallback transport. */
export function getClientForChain(chainId: number): PublicClient {
    const cached = clientCache.get(chainId);
    if (cached) return cached;
    const client = createPublicClient({
        chain: CHAIN_MAP[chainId] || bsc,
        transport: createTransportForChain(chainId),
    }) as PublicClient;
    clientCache.set(chainId, client);
    return client;
}

const isEvmAddr = (v?: string | null): v is string => !!v && /^0x[a-fA-F0-9]{40}$/.test(v);

// Decimals and symbol are immutable, so one read per token per app session is
// enough. Keyed by chainId:token — the same address on two chains is two tokens.
const rewardCache = new Map<string, RewardTokenInfo>();

export interface RewardTokenInfo {
    address?: string;
    symbol?: string;
    decimals: number;
    /** True when the pool pays out a different token than it takes in. */
    isCrossToken: boolean;
}

/**
 * Resolve the decimals/symbol to use for a pool's REWARD amounts.
 *
 * Falls back to the staking token's values whenever the reward token is unknown
 * or its metadata can't be read — that's the pre-existing behaviour, so a failed
 * read is never worse than before.
 */
export async function resolveRewardToken(params: {
    chainId: number;
    /** Reward token address, e.g. `getPoolInfo()[1]`. */
    rewardTokenAddress?: string;
    /** The pool's staking token — when it matches, no reads are needed. */
    stakingTokenAddress?: string;
    stakingSymbol?: string;
    stakingDecimals: number;
}): Promise<RewardTokenInfo> {
    const { chainId, rewardTokenAddress, stakingTokenAddress, stakingSymbol, stakingDecimals } = params;

    const sameAsStaking: RewardTokenInfo = {
        address: rewardTokenAddress || stakingTokenAddress,
        symbol: stakingSymbol,
        decimals: stakingDecimals,
        isCrossToken: false,
    };

    if (!isEvmAddr(rewardTokenAddress)) return sameAsStaking;
    if (isEvmAddr(stakingTokenAddress) && rewardTokenAddress.toLowerCase() === stakingTokenAddress.toLowerCase()) {
        return sameAsStaking;
    }

    const key = `${chainId}:${rewardTokenAddress.toLowerCase()}`;
    const cached = rewardCache.get(key);
    if (cached) return cached;

    try {
        const client = getClientForChain(chainId);
        const [decimals, symbol] = await Promise.all([
            client.readContract({
                address: rewardTokenAddress as Address,
                abi: ERC20_METADATA_ABI,
                functionName: 'decimals',
            }) as Promise<number>,
            client.readContract({
                address: rewardTokenAddress as Address,
                abi: ERC20_METADATA_ABI,
                functionName: 'symbol',
            }).catch(() => undefined) as Promise<string | undefined>,
        ]);

        const info: RewardTokenInfo = {
            address: rewardTokenAddress,
            symbol: symbol || undefined,
            decimals: Number.isFinite(Number(decimals)) ? Number(decimals) : stakingDecimals,
            isCrossToken: true,
        };
        rewardCache.set(key, info);
        return info;
    } catch (e) {
        console.warn('[pool-onchain] reward token metadata read failed', e);
        // Still cross-token, we just don't know its metadata — keep the address
        // so callers can link to it, but don't cache a guess.
        return { ...sameAsStaking, address: rewardTokenAddress, isCrossToken: true };
    }
}

/** Same shape the staking API returns as `pool.onChain`, so callers can use either. */
export interface PoolOnChainInfo {
    poolReward: string;
    rewardDurationSeconds: number;
    maxTvl: string;
    rewardPerSecond: string;
    totalStaked: string;
    rewardBalance: string;
    startTime: number;
    endTime: number;
    active: boolean;
    funded: boolean;
    stakingToken: string;
    rewardToken: string;
    rewardTokenSymbol?: string;
    rewardTokenDecimals: number;
    isCrossToken: boolean;
}

/**
 * Read a pool's full on-chain state, with reward figures denominated in the
 * REWARD token. Returns null on failure — treat that as "unknown", not "zero".
 */
export async function readPoolInfoClient(params: {
    chainId: number;
    poolAddress: string;
    stakingDecimals: number;
    stakingSymbol?: string;
}): Promise<PoolOnChainInfo | null> {
    const { chainId, poolAddress, stakingDecimals, stakingSymbol } = params;
    if (!isEvmAddr(poolAddress)) return null;

    try {
        const client = getClientForChain(chainId);
        // viem infers a readonly 13-tuple from the const ABI.
        const tuple = await client.readContract({
            address: poolAddress as Address,
            abi: STAKING_POOL_V2_ABI,
            functionName: 'getPoolInfo',
        });

        const rewardInfo = await resolveRewardToken({
            chainId,
            rewardTokenAddress: tuple[1],
            stakingTokenAddress: tuple[0],
            stakingSymbol,
            stakingDecimals,
        });

        return {
            poolReward: formatUnits(tuple[3], rewardInfo.decimals),
            rewardDurationSeconds: Number(tuple[4]),
            maxTvl: formatUnits(tuple[5], stakingDecimals),
            rewardPerSecond: formatUnits(tuple[6], rewardInfo.decimals),
            startTime: Number(tuple[7]),
            endTime: Number(tuple[8]),
            active: Boolean(tuple[9]),
            totalStaked: formatUnits(tuple[10], stakingDecimals),
            rewardBalance: formatUnits(tuple[11], rewardInfo.decimals),
            funded: Boolean(tuple[12]),
            stakingToken: tuple[0],
            rewardToken: tuple[1],
            rewardTokenSymbol: rewardInfo.symbol,
            rewardTokenDecimals: rewardInfo.decimals,
            isCrossToken: rewardInfo.isCrossToken,
        };
    } catch (e) {
        console.warn('[pool-onchain] readPoolInfoClient failed', poolAddress, e);
        return null;
    }
}

export interface PoolStatusOnChain {
    startTime: number;
    endTime: number;
    active: boolean;
    funded: boolean;
    /** endTime has passed. */
    ended: boolean;
}

/**
 * Just the lifecycle fields — no token metadata reads. Used where a listing
 * needs to say whether a pool is still running without pulling its full state.
 */
export async function readPoolStatusClient(params: {
    chainId: number;
    poolAddress: string;
}): Promise<PoolStatusOnChain | null> {
    const { chainId, poolAddress } = params;
    if (!isEvmAddr(poolAddress)) return null;

    try {
        const client = getClientForChain(chainId);
        // viem infers a readonly 13-tuple from the const ABI.
        const tuple = await client.readContract({
            address: poolAddress as Address,
            abi: STAKING_POOL_V2_ABI,
            functionName: 'getPoolInfo',
        });

        const endTime = Number(tuple[8]);
        return {
            startTime: Number(tuple[7]),
            endTime,
            active: Boolean(tuple[9]),
            funded: Boolean(tuple[12]),
            ended: endTime > 0 && Date.now() / 1000 >= endTime,
        };
    } catch (e) {
        console.warn('[pool-onchain] readPoolStatusClient failed', poolAddress, e);
        return null;
    }
}

export interface StakerOnChain {
    /** Principal currently in the pool, in the STAKING token. */
    stakedAmount: number;
    /** Unclaimed rewards, in the REWARD token. */
    pendingReward: number;
}

/**
 * Read one wallet's position. The manage screen uses this so the stakers list
 * reports what the contract holds rather than the `user_stakes` mirror, which
 * drifts — TWC is fee-on-transfer, so a 5000 deposit lands as 4900 and the
 * mirror's 5000 produced a 102% pool share.
 */
export async function readStakerOnChain(params: {
    chainId: number;
    poolAddress: string;
    wallet: string;
    stakingDecimals: number;
    rewardDecimals: number;
}): Promise<StakerOnChain | null> {
    const { chainId, poolAddress, wallet, stakingDecimals, rewardDecimals } = params;
    if (!isEvmAddr(poolAddress) || !isEvmAddr(wallet)) return null;

    try {
        const client = getClientForChain(chainId);
        const [userInfo, pending] = await Promise.all([
            client.readContract({
                address: poolAddress as Address,
                abi: STAKING_POOL_V2_ABI,
                functionName: 'getUserInfo',
                args: [wallet as Address],
            }),
            client.readContract({
                address: poolAddress as Address,
                abi: STAKING_POOL_V2_ABI,
                functionName: 'pendingReward',
                args: [wallet as Address],
            }),
        ]);

        return {
            stakedAmount: Number(formatUnits(userInfo[0], stakingDecimals)),
            pendingReward: Number(formatUnits(pending, rewardDecimals)),
        };
    } catch (e) {
        console.warn('[pool-onchain] readStakerOnChain failed', wallet, e);
        return null;
    }
}
