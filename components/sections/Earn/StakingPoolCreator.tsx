/**
 * StakingPoolCreator (mobile)
 *
 * Native port of the web `components/earn/staking-pool-creator.tsx`. Same fields,
 * same order, same validation, same submit orchestration:
 *   name check → deploy → record staking_pools (inactive) → pay fee (if any)
 *   → record user_staking_pools (pending) → session list + notice.
 *
 * Renders a plain View tree (no ScrollView) so it can be embedded inside the
 * Earn tab sub-tab or the standalone /earn/create screen.
 */

import { colors } from '@/constants/colors';
import { CHAIN_NAMES, useStakingDeployer, type CreatePoolStatus } from '@/hooks/useStakingDeployer';
import { useRequireBackup } from '@/hooks/useRequireBackup';
import { api, type PoolFeeSettings } from '@/lib/mobile/api-client';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { formatNumberInput } from '@/utils/formatting';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { isAddress, type Address } from 'viem';
import { SwapKeyboard } from '../Swap/SwapKeyboard';
import { TokenSelectSheet, type TokenOption } from '../Swap/TokenSelectSheet';

const TWC_ICON = require('../../../assets/home/tiwicat.svg');

type RewardMode = 'same' | 'cross';
type TokenSide = 'stake' | 'earn';
type DurationUnit = 'days' | 'hours' | 'minutes';
type CreationStep = 'idle' | 'creating' | 'saving' | 'paying';
/** The six numeric "Pool settings" inputs, all driven by the in-app numpad. */
type NumericField = 'reward' | 'duration' | 'maxTvl' | 'minStake' | 'maxStake' | 'minLock';

const DURATION_UNIT_SECONDS: Record<DurationUnit, number> = { days: 86400, hours: 3600, minutes: 60 };

const CHAIN_LABELS: Record<number, string> = {
    1: 'Ethereum', 56: 'BSC', 137: 'Polygon', 42161: 'Arbitrum', 8453: 'Base', 10: 'Optimism', 43114: 'Avalanche',
};

interface PoolToken {
    symbol: string;
    name: string;
    address: string;
    chainId: number;
    decimals: number;
    icon?: any;
    chainIcon?: any;
}

const DEFAULT_STAKE_TOKEN: PoolToken = {
    symbol: 'TWC', name: 'TIWICAT', address: '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596',
    chainId: 56, decimals: 9, icon: TWC_ICON,
};
const DEFAULT_EARN_TOKEN: PoolToken = {
    symbol: 'USDC', name: 'USD Coin', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    chainId: 56, decimals: 18,
};

interface CreatedPool {
    id: string;
    pair: string;
    chain: string;
    feeStatus: 'paid' | 'unpaid';
    visibility: 'Public' | 'Hidden';
}

interface Props {
    activeWalletAddress?: string | null;
    onConnectEvmWallet?: () => void;
    onViewPools?: () => void;
    /** The enclosing ScrollView. Given one, the form lifts the Pool settings
     *  block above the numpad when it opens (the form itself renders no scroller). */
    scrollRef?: React.RefObject<ScrollView | null>;
}

const isEvmAddress = (v?: string | null) => /^0x[a-fA-F0-9]{40}$/.test(v || '');
const parseNumber = (value: string, fallback = 0) => {
    const n = Number((value || '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : fallback;
};
const compactAddress = (a?: string | null) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : 'No EVM wallet');
const chainName = (id: number) => CHAIN_LABELS[id] || CHAIN_NAMES[id] || `Chain ${id}`;

function toPoolToken(t: TokenOption): PoolToken {
    return {
        symbol: t.symbol, name: t.name, address: t.address, chainId: t.chainId,
        decimals: t.decimals, icon: t.icon, chainIcon: t.chainIcon,
    };
}

export function StakingPoolCreator({ activeWalletAddress, onConnectEvmWallet, onViewPools, scrollRef }: Props) {
    const [rewardMode, setRewardMode] = useState<RewardMode>('same');
    const [poolName, setPoolName] = useState('');
    const [stakeToken, setStakeToken] = useState<PoolToken>(DEFAULT_STAKE_TOKEN);
    const [earnToken, setEarnToken] = useState<PoolToken>(DEFAULT_EARN_TOKEN);
    const [tokenModalSide, setTokenModalSide] = useState<TokenSide | null>(null);
    const [maxTvl, setMaxTvl] = useState('');
    const [rewardAmount, setRewardAmount] = useState('');
    const [durationDays, setDurationDays] = useState('');
    const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');
    const [minStake, setMinStake] = useState('');
    const [maxStake, setMaxStake] = useState('');
    const [minStakePeriod, setMinStakePeriod] = useState('');
    const [stakeModificationFee, setStakeModificationFee] = useState(false);
    const [timeBoost, setTimeBoost] = useState(false);
    const [createdPools, setCreatedPools] = useState<CreatedPool[]>([]);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [creationStep, setCreationStep] = useState<CreationStep>('idle');
    const [createError, setCreateError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [blockingError, setBlockingError] = useState<string | null>(null);
    const [feeSettings, setFeeSettings] = useState<PoolFeeSettings | null>(null);
    // Pool settings are typed on the app's own numpad (the Swap / Send / Pool-create
    // sheet) instead of the OS keyboard. `keypadField` names the field being edited
    // and doubles as the sheet's visibility flag.
    const [keypadField, setKeypadField] = useState<NumericField | null>(null);
    const settingsRef = useRef<View>(null);
    // Name availability, fetched when the preview opens so the submit path can
    // reuse the in-flight promise rather than starting the round trip cold.
    const nameCheck = useRef<{ name: string; promise: Promise<any> } | null>(null);
    // Each card's y within the settings grid, filled in by its onLayout — the
    // grid wraps into rows, so the third row is ~2 card-heights down.
    const fieldOffsets = useRef<Partial<Record<NumericField, number>>>({});

    const { createPool, payCreationFee, status: deployStatus } = useStakingDeployer();
    const { data: balanceData } = useWalletBalances();
    const { requireBackup, BackupRequiredModal } = useRequireBackup();

    // Load the admin-set creation-fee config.
    useEffect(() => {
        let cancelled = false;
        api.staking.poolSettings()
            .then((s) => { if (!cancelled) setFeeSettings(s); })
            .catch((e) => console.warn('[StakingPoolCreator] fee settings load failed', e));
        return () => { cancelled = true; };
    }, []);

    // Lift the field being edited to the top of the viewport when the numpad
    // opens, so it can't sit behind the sheet — the bottom row (Max stake / Min
    // lock) otherwise stays hidden even with the whole block scrolled up.
    // Mirrors swap.tsx's scroll-on-open, but measured: the grid's position
    // differs between this form's two hosts, and each row needs its own offset.
    useEffect(() => {
        if (!keypadField) return;
        const scroller = scrollRef?.current;
        const grid = settingsRef.current;
        const row = fieldOffsets.current[keypadField];
        if (!scroller || !grid) return;

        const timer = setTimeout(() => {
            const inner = (scroller as any).getInnerViewRef?.() ?? (scroller as any).getInnerViewNode?.();
            if (!inner) return;
            try {
                grid.measureLayout(
                    inner,
                    (_x: number, gridY: number) =>
                        scroller.scrollTo({ y: Math.max(gridY + (row ?? 0) - 12, 0), animated: true }),
                    () => { /* measurement is best-effort */ },
                );
            } catch {
                /* older/newer arch mismatch — leave the scroll position alone */
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [keypadField, scrollRef]);

    const feeActive =
        !!feeSettings?.creationFeeEnabled &&
        feeSettings.creationFeeAmount > 0 &&
        isEvmAddress(feeSettings.creationFeeTokenAddress) &&
        isEvmAddress(feeSettings.creationFeeTreasuryAddress);

    const evmReady = isEvmAddress(activeWalletAddress);
    const activeEarnToken = rewardMode === 'same' ? stakeToken : earnToken;

    // Wallet balance of the reward token — the only figure on this form that is a
    // share of something the user holds, so it's what the numpad's %/Max act on.
    const rewardTokenBalance = useMemo(() => {
        const rows = (balanceData as any)?.tokens;
        if (!Array.isArray(rows)) return '';
        const row = rows.find(
            (t: any) =>
                t.chainId === activeEarnToken.chainId &&
                String(t.address || '').toLowerCase() === activeEarnToken.address.toLowerCase(),
        );
        return String(row?.balanceFormatted || '').replace(/,/g, '');
    }, [balanceData, activeEarnToken.chainId, activeEarnToken.address]);
    const pairLabel = `${stakeToken.symbol} → ${activeEarnToken.symbol}`;
    const network = chainName(stakeToken.chainId);
    const isSubmitting = creationStep !== 'idle';

    const estimatedApr = useMemo(() => {
        const rewardAmountNum = parseNumber(rewardAmount);
        const maxTvlNum = parseNumber(maxTvl, 1);
        const durationNum = Math.max(parseNumber(durationDays, 1), 1);
        const durationSecondsNum = Math.max(durationNum * DURATION_UNIT_SECONDS[durationUnit], 1);
        if (!rewardAmountNum || !maxTvlNum || !durationSecondsNum) return 0;
        return (rewardAmountNum / (maxTvlNum * durationSecondsNum)) * 31_536_000 * 100;
    }, [rewardAmount, maxTvl, durationDays, durationUnit]);

    const handleSelectToken = (t: TokenOption) => {
        const pt = toPoolToken(t);
        if (tokenModalSide === 'stake') setStakeToken(pt);
        else if (tokenModalSide === 'earn') setEarnToken(pt);
        setTokenModalSide(null);
    };

    /** Warm the name-availability check while the user reads the preview. */
    const primeNameCheck = () => {
        const name = poolName.trim();
        if (!name || nameCheck.current?.name === name) return;
        const promise = api.staking.checkPoolName(name);
        promise.catch(() => { /* submit path re-reads it and falls back */ });
        nameCheck.current = { name, promise };
    };

    const handleSwapTokens = () => {
        if (rewardMode === 'same') return;
        setStakeToken(earnToken);
        setEarnToken(stakeToken);
    };

    const handleCreatePool = async () => {
        if (!evmReady) { onConnectEvmWallet?.(); return; }

        setCreateError(null);
        setNotice(null);
        setBlockingError(null);

        const trimmedName = poolName.trim();
        if (!trimmedName) { setCreateError('Give your pool a name.'); return; }

        const poolRewardValue = parseNumber(rewardAmount);
        const maxTvlValue = parseNumber(maxTvl);
        const durationValue = parseNumber(durationDays);
        const minStakeValue = parseNumber(minStake);
        const maxStakeValue = parseNumber(maxStake);
        const minStakePeriodValue = parseNumber(minStakePeriod);

        if (!poolRewardValue || !maxTvlValue || !durationValue) {
            setCreateError('Reward pool, Max TVL, and Duration are required and must be greater than zero.');
            return;
        }
        if (maxStakeValue && minStakeValue && maxStakeValue < minStakeValue) {
            setCreateError("Max stake can't be lower than min stake."); return;
        }
        const chainId = stakeToken.chainId;
        if (!chainId) { setCreateError('Selected staking token has no chain id.'); return; }
        if (rewardMode === 'cross' && activeEarnToken.chainId !== chainId) {
            setCreateError(`Stake and earn tokens must be on the same chain. Pick an earn token on ${network}.`);
            return;
        }
        if (!isAddress(stakeToken.address) || !isAddress(activeEarnToken.address)) {
            setCreateError('Selected token has an invalid address.'); return;
        }

        // In-app mnemonic wallets must be backed up before signing.
        if (!requireBackup()) return;

        const stakingDecimals = stakeToken.decimals ?? 18;
        const rewardDecimals = activeEarnToken.decimals ?? 18;
        const rewardDurationSeconds = Math.round(durationValue * DURATION_UNIT_SECONDS[durationUnit]);

        try {
            // 0. Reserve the name — reject collisions BEFORE deploying on-chain.
            //    Usually already in flight from when the preview opened, so this
            //    resolves immediately instead of costing a round trip here.
            try {
                const nameRes = await (nameCheck.current?.name === trimmedName
                    ? nameCheck.current.promise
                    : api.staking.checkPoolName(trimmedName));
                if (nameRes?.available === false) {
                    setCreateError('That pool name is already taken. Pick a different name.');
                    return;
                }
            } catch (e) {
                console.warn('[StakingPoolCreator] name check failed', e); // DB unique index is the backstop
            }

            // 1. Deploy the pool (approve + createPool + event parse).
            setCreationStep('creating');
            const deployResult = await createPool({
                chainId,
                stakingToken: stakeToken.address as Address,
                rewardToken: activeEarnToken.address as Address,
                poolReward: String(poolRewardValue),
                rewardDurationSeconds,
                maxTvl: String(maxTvlValue),
                stakingDecimals,
                rewardDecimals,
                walletAddress: activeWalletAddress as Address,
            });
            const deployer = deployResult.deployerAddress;

            // 2. Persist pool metadata as 'inactive' (hidden until admin approves).
            //    Kicked off here but awaited AFTER the fee tx is broadcast: the DB
            //    write and the fee transfer don't depend on each other, so running
            //    them in series just added a round trip to the user's wait.
            setCreationStep('saving');
            let savedPoolId: string | undefined;
            const savePool = api.staking.createPoolRecord({
                name: trimmedName,
                chainId,
                chainName: network,
                tokenAddress: stakeToken.address,
                tokenSymbol: stakeToken.symbol,
                tokenName: stakeToken.name,
                tokenLogo: typeof stakeToken.icon === 'string' ? stakeToken.icon : undefined,
                decimals: stakingDecimals,
                minStakingPeriod: minStakePeriodValue > 0 ? `${minStakePeriodValue} days` : undefined,
                minStakeAmount: minStakeValue,
                maxStakeAmount: maxStakeValue > 0 ? maxStakeValue : undefined,
                stakeModificationFee,
                timeBoost,
                timeBoostConfig: timeBoost ? {} : undefined,
                maxTvl: maxTvlValue,
                poolReward: poolRewardValue,
                rewardDurationSeconds,
                poolContractAddress: deployResult.poolAddress,
                factoryAddress: deployer,
                status: 'inactive',
            });
            // Don't let an unawaited rejection escape while the fee tx runs.
            savePool.catch(() => { /* surfaced where it's awaited below */ });

            // Record the deployment in the activities board — shows as
            // "Created staking pool" in Activities. Best-effort; never blocks.
            if (activeWalletAddress) {
                void api.wallet.logTransaction({
                    walletAddress: activeWalletAddress,
                    transactionHash: deployResult.txHash,
                    chainId,
                    type: 'CreateStakingPool',
                    fromTokenAddress: activeEarnToken.address,
                    fromTokenSymbol: activeEarnToken.symbol,
                    amount: String(poolRewardValue),
                    amountFormatted: `${poolRewardValue} ${activeEarnToken.symbol}`,
                    routerName: 'Tiwi Staking',
                    poolAddress: deployResult.poolAddress,
                    blockTimestamp: new Date().toISOString(),
                }).catch(() => { /* tracking is best-effort */ });
            }

            // 3. Charge the admin-set creation fee (deploy-first, but MANDATORY).
            let feePaidTxHash: string | undefined;
            let feePaymentError: string | undefined;
            if (feeActive && feeSettings) {
                setCreationStep('paying');
                try {
                    feePaidTxHash = await payCreationFee({
                        chainId: feeSettings.creationFeeChainId,
                        tokenAddress: feeSettings.creationFeeTokenAddress as Address,
                        treasury: feeSettings.creationFeeTreasuryAddress as Address,
                        amount: String(feeSettings.creationFeeAmount),
                        decimals: feeSettings.creationFeeTokenDecimals,
                        walletAddress: activeWalletAddress as Address,
                    });
                } catch (e: any) {
                    feePaymentError = e?.message || 'The fee payment was rejected.';
                    console.warn('[StakingPoolCreator] creation fee payment failed', e);
                }
            }

            // 3b. Collect the pool-metadata write started in step 2.
            try {
                const poolJson = await savePool;
                savedPoolId = poolJson?.pool?.id;
            } catch (e: any) {
                throw new Error(
                    `Pool deployed at ${deployResult.poolAddress} but saving it failed: ${e?.message || 'unknown error'}. ` +
                    `Contact support with this address.`,
                );
            }

            // 4. Record ownership → admin approval queue + creator's "My Pools".
            let ownershipError: string | undefined;
            if (!savedPoolId) {
                ownershipError = 'the pool was saved but no pool id came back';
            } else {
                try {
                    await api.staking.recordUserPool({
                        creatorWallet: activeWalletAddress as string,
                        stakingPoolId: savedPoolId,
                        poolName: trimmedName,
                        poolContractAddress: deployResult.poolAddress,
                        chainId,
                        txHash: deployResult.txHash,
                        creationFeeAmount: feePaidTxHash ? feeSettings?.creationFeeAmount : undefined,
                        creationFeeToken: feePaidTxHash ? (feeSettings?.creationFeeTokenSymbol || feeSettings?.creationFeeTokenAddress) : undefined,
                        creationFeeTxHash: feePaidTxHash,
                        tokenSymbol: stakeToken.symbol,
                        rewardTokenSymbol: activeEarnToken.symbol,
                        poolType: rewardMode,
                        minStakingPeriod: minStakePeriodValue > 0 ? `${minStakePeriodValue} days` : undefined,
                        minStakeAmount: minStakeValue,
                        maxStakeAmount: maxStakeValue > 0 ? maxStakeValue : undefined,
                        maxTvl: maxTvlValue,
                        poolReward: poolRewardValue,
                        rewardDurationSeconds,
                        stakeModificationFee,
                        timeBoost,
                        timeBoostConfig: timeBoost ? {} : undefined,
                    });
                } catch (e: any) {
                    ownershipError = e?.message || 'network error';
                    console.warn('[StakingPoolCreator] failed to record pool ownership:', ownershipError);
                }
            }

            // 5. Reflect the new pool in the session list (Unpaid until fee clears).
            const feeUnpaid = feeActive && !feePaidTxHash;
            setCreatedPools((current) => [
                {
                    id: savedPoolId || deployResult.poolAddress,
                    pair: pairLabel,
                    chain: network,
                    feeStatus: feeUnpaid ? 'unpaid' : 'paid',
                    visibility: 'Hidden',
                },
                ...current,
            ]);
            setPreviewOpen(false);

            // 6a. Ownership-record gate.
            if (ownershipError) {
                setBlockingError(
                    `Your pool was deployed and saved, but it couldn't be submitted for admin review (${ownershipError}). ` +
                    `It won't show under My Pools yet — please try again.`,
                );
                return;
            }

            // 6b. Mandatory-fee gate.
            if (feeUnpaid) {
                const feeLabelText = `${feeSettings?.creationFeeAmount} ${feeSettings?.creationFeeTokenSymbol || 'tokens'}`;
                setBlockingError(
                    `Your pool was deployed but the ${feeLabelText} creation fee wasn't paid` +
                    (feePaymentError ? ` (${feePaymentError})` : '') +
                    `. It's saved as Unpaid — open it under “My Pools” and tap “Pay fee” to complete it.`,
                );
                return;
            }

            setNotice('Pool submitted! An admin will review it before it goes live in the app.');
        } catch (e: any) {
            setCreateError(e?.message || 'Failed to create pool. Please try again.');
        } finally {
            setCreationStep('idle');
        }
    };

    const numericFields: Record<NumericField, { value: string; set: (v: string) => void }> = {
        reward: { value: rewardAmount, set: setRewardAmount },
        duration: { value: durationDays, set: setDurationDays },
        maxTvl: { value: maxTvl, set: setMaxTvl },
        minStake: { value: minStake, set: setMinStake },
        maxStake: { value: maxStake, set: setMaxStake },
        minLock: { value: minStakePeriod, set: setMinStakePeriod },
    };

    // Numpad edits the raw digits; the field grouped-formats them for display.
    // Same key semantics as the swap / pool-create sheets, long-press CLEAR included.
    const handleKeypadPress = (key: string) => {
        if (!keypadField) return;
        const { value: current, set } = numericFields[keypadField];

        if (key === 'CLEAR') return set('');
        if (key === 'DELETE') return set(current.slice(0, -1));
        if (key === '.') {
            if (current.includes('.')) return;
            return set(current ? `${current}.` : '0.');
        }
        const [, decimals] = current.split('.');
        if (decimals && decimals.length >= 6) return;
        set(current + key);
    };

    // %/Max only appear on Reward pool (see rewardTokenBalance). Max reuses the
    // balance string verbatim so a float round-trip can't shave the last digits.
    const rewardBalanceNum = parseNumber(rewardTokenBalance);
    const handlePercentagePress = (percent: number) => {
        if (keypadField !== 'reward' || rewardBalanceNum <= 0) return;
        if (percent >= 100) return setRewardAmount(rewardTokenBalance);
        const amount = (rewardBalanceNum * percent) / 100;
        const fixed = amount.toFixed(6);
        setRewardAmount(fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed);
    };

    return (
        <View style={styles.wrap}>
            {notice ? (
                <View style={[styles.banner, styles.bannerOk]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.primaryCTA} />
                    <Text style={[styles.bannerText, { color: colors.primaryCTA }]}>{notice}</Text>
                </View>
            ) : null}
            {blockingError ? (
                <View style={[styles.banner, styles.bannerErr]}>
                    <Text style={[styles.bannerText, { color: '#f87171', flex: 1 }]}>{blockingError}</Text>
                    <TouchableOpacity onPress={() => setBlockingError(null)}>
                        <Ionicons name="close" size={16} color="#f87171" />
                    </TouchableOpacity>
                </View>
            ) : null}

            {/* Form card */}
            <View style={styles.card}>
                {/* Pool name */}
                <FormBlock title="Pool name" hint="Shown to stakers on the pool card.">
                    <TextInput
                        value={poolName}
                        onChangeText={setPoolName}
                        maxLength={60}
                        placeholder="e.g. TWC Genesis Pool"
                        placeholderTextColor="#4f594f"
                        style={styles.nameInput}
                    />
                </FormBlock>

                {/* Pool type */}
                <FormBlock title="Pool type">
                    <View style={styles.modeRow}>
                        <ModeButton active={rewardMode === 'same'} title="Stake A, earn A" onPress={() => setRewardMode('same')} />
                        <ModeButton active={rewardMode === 'cross'} title="Stake A, earn B" onPress={() => setRewardMode('cross')} />
                    </View>
                </FormBlock>

                {/* Token(s) */}
                <FormBlock title={rewardMode === 'same' ? 'Token' : 'Tokens'} hint="Tap a token to pick the asset and network.">
                    {rewardMode === 'same' ? (
                        <TokenSelector label="Stake and earn" token={stakeToken} onPress={() => setTokenModalSide('stake')} />
                    ) : (
                        <View style={styles.crossRow}>
                            <View style={{ flex: 1 }}>
                                <TokenSelector label="Stake" token={stakeToken} onPress={() => setTokenModalSide('stake')} />
                            </View>
                            <TouchableOpacity onPress={handleSwapTokens} style={styles.swapBtn}>
                                <Ionicons name="swap-horizontal" size={18} color={colors.primaryCTA} />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                                <TokenSelector label="Earn" token={earnToken} onPress={() => setTokenModalSide('earn')} />
                            </View>
                        </View>
                    )}
                </FormBlock>

                {/* Pool settings */}
                <FormBlock title="Pool settings">
                    <View ref={settingsRef} collapsable={false} style={styles.grid}>
                        <Field
                            label="Reward pool"
                            value={rewardAmount}
                            placeholder="0"
                            suffix={activeEarnToken.symbol}
                            hint={rewardBalanceNum > 0 ? `Balance ${formatNumberInput(rewardTokenBalance)}` : undefined}
                            active={keypadField === 'reward'}
                            onPress={() => setKeypadField('reward')}
                            onLayout={(e) => { fieldOffsets.current.reward = e.nativeEvent.layout.y; }}
                        />
                        <DurationField
                            value={durationDays}
                            unit={durationUnit}
                            onUnitChange={setDurationUnit}
                            active={keypadField === 'duration'}
                            onPress={() => setKeypadField('duration')}
                            onLayout={(e) => { fieldOffsets.current.duration = e.nativeEvent.layout.y; }}
                        />
                        <Field label="Max TVL" value={maxTvl} placeholder="0" suffix={stakeToken.symbol} active={keypadField === 'maxTvl'} onPress={() => setKeypadField('maxTvl')} onLayout={(e) => { fieldOffsets.current.maxTvl = e.nativeEvent.layout.y; }} />
                        <Field label="Min stake" value={minStake} placeholder="0" suffix={stakeToken.symbol} active={keypadField === 'minStake'} onPress={() => setKeypadField('minStake')} onLayout={(e) => { fieldOffsets.current.minStake = e.nativeEvent.layout.y; }} />
                        <Field label="Max stake" value={maxStake} placeholder="0" suffix={stakeToken.symbol} active={keypadField === 'maxStake'} onPress={() => setKeypadField('maxStake')} onLayout={(e) => { fieldOffsets.current.maxStake = e.nativeEvent.layout.y; }} />
                        <Field label="Min lock" value={minStakePeriod} placeholder="0" suffix="days" active={keypadField === 'minLock'} onPress={() => setKeypadField('minLock')} onLayout={(e) => { fieldOffsets.current.minLock = e.nativeEvent.layout.y; }} />
                    </View>
                </FormBlock>

                {/* Options */}
                <FormBlock title="Options" hint="Fine-tune how stakers interact with the pool.">
                    <View style={{ gap: 8 }}>
                        <ToggleRow
                            title="Stake modification fee"
                            hint="Charge a fee when stakers change an existing position."
                            active={stakeModificationFee}
                            onToggle={() => setStakeModificationFee((v) => !v)}
                        />
                        <ToggleRow
                            title="Time boost"
                            hint="Reward longer lock-ups with boosted yield."
                            active={timeBoost}
                            onToggle={() => setTimeBoost((v) => !v)}
                        />
                    </View>
                </FormBlock>

                <View style={{ paddingHorizontal: 16, paddingVertical: 18 }}>
                    <TouchableOpacity style={styles.previewBtn} onPress={() => { primeNameCheck(); setPreviewOpen(true); }}>
                        <Text style={styles.previewBtnText}>Preview pool</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Created pools (session-local) */}
            <View style={styles.card}>
                <View style={styles.createdHeader}>
                    <Text style={styles.createdTitle}>Created pools</Text>
                    <TouchableOpacity onPress={onViewPools} style={styles.viewPoolsBtn}>
                        <Text style={styles.viewPoolsText}>View pools</Text>
                    </TouchableOpacity>
                </View>
                {createdPools.map((pool) => (
                    <View key={pool.id} style={styles.createdRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.createdPair}>{pool.pair}</Text>
                            <Text style={styles.createdChain}>{pool.chain}</Text>
                        </View>
                        <StatusChip status={pool.feeStatus} />
                        <View style={styles.visRow}>
                            <Ionicons name={pool.visibility === 'Public' ? 'checkmark' : 'eye-off'} size={14} color={pool.visibility === 'Public' ? colors.primaryCTA : '#facc15'} />
                            <Text style={styles.visText}>{pool.visibility}</Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* Preview modal */}
            <PoolPreviewModal
                open={previewOpen}
                onClose={() => { if (!isSubmitting) setPreviewOpen(false); }}
                stakeToken={stakeToken}
                earnToken={activeEarnToken}
                pairLabel={pairLabel}
                network={network}
                estimatedApr={estimatedApr}
                rewardAmount={rewardAmount}
                durationDays={durationDays}
                durationUnit={durationUnit}
                maxTvl={maxTvl}
                minStake={minStake}
                maxStake={maxStake}
                minStakePeriod={minStakePeriod}
                stakeModificationFee={stakeModificationFee}
                timeBoost={timeBoost}
                feeLabel={feeActive && feeSettings ? `${feeSettings.creationFeeAmount} ${feeSettings.creationFeeTokenSymbol || 'tokens'}` : 'Free'}
                walletAddress={activeWalletAddress}
                evmReady={evmReady}
                creationStep={creationStep}
                deployStatus={deployStatus}
                createError={createError}
                onSubmit={handleCreatePool}
            />

            {/* Token selector — earn token in cross mode is constrained to the stake chain */}
            <TokenSelectSheet
                visible={!!tokenModalSide}
                chainId={tokenModalSide === 'earn' && rewardMode === 'cross' ? stakeToken.chainId : null}
                selectedTokenId={tokenModalSide === 'earn' ? `${earnToken.chainId}-${earnToken.address}` : `${stakeToken.chainId}-${stakeToken.address}`}
                onClose={() => setTokenModalSide(null)}
                onSelect={handleSelectToken}
            />

            {/* Room to scroll the edited field clear of the numpad sheet. */}
            {keypadField ? <View style={{ height: 420 }} /> : null}

            {/* In-app numpad. The %/Max pills only make sense on Reward pool
                (a share of the wallet's reward-token balance) — the other five
                are pool config, so the pills are hidden there. */}
            <SwapKeyboard
                visible={keypadField !== null}
                showQuickActions={keypadField === 'reward' && rewardBalanceNum > 0}
                onKeyPress={handleKeypadPress}
                onPercentagePress={handlePercentagePress}
                onMaxPress={() => handlePercentagePress(100)}
                onClose={() => setKeypadField(null)}
            />

            {BackupRequiredModal}
        </View>
    );
}

// ── Preview modal ────────────────────────────────────────────────────────────
function PoolPreviewModal(props: {
    open: boolean; onClose: () => void;
    stakeToken: PoolToken; earnToken: PoolToken; pairLabel: string; network: string; estimatedApr: number;
    rewardAmount: string; durationDays: string; durationUnit: DurationUnit; maxTvl: string;
    minStake: string; maxStake: string; minStakePeriod: string;
    stakeModificationFee: boolean; timeBoost: boolean; feeLabel: string;
    walletAddress?: string | null; evmReady: boolean; creationStep: CreationStep;
    deployStatus?: CreatePoolStatus;
    createError: string | null; onSubmit: () => void;
}) {
    const { open, onClose, stakeToken, earnToken, pairLabel, network, estimatedApr, rewardAmount, durationDays,
        durationUnit, maxTvl, minStake, maxStake, minStakePeriod, stakeModificationFee, timeBoost, feeLabel,
        walletAddress, evmReady, creationStep, deployStatus, createError, onSubmit } = props;
    const isSubmitting = creationStep !== 'idle';
    const isFree = feeLabel === 'Free';
    // 'creating' covers a two-tx batch (approve, then deploy). Naming the tx in
    // flight makes the wait legible instead of one label stuck for both.
    const submitLabel =
        creationStep === 'creating'
            ? (deployStatus === 'approving' ? `Approving ${earnToken.symbol}…` : 'Deploying & funding pool…')
            : creationStep === 'saving' ? 'Saving pool…'
                : creationStep === 'paying' ? 'Charging fee…'
                    : !evmReady ? 'Connect EVM wallet'
                        : isFree ? 'Create pool' : 'Pay fee and create';

    return (
        <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.modalBackdrop} onPress={onClose}>
                <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Pool preview</Text>
                        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={20} color="#8A929A" /></TouchableOpacity>
                    </View>

                    <View style={styles.previewInner}>
                        <View style={styles.previewBox}>
                            <View style={styles.previewTopRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.previewMuted}>Pool</Text>
                                    <View style={styles.previewPairRow}>
                                        <TokenIcon token={stakeToken} size={28} />
                                        <View style={{ marginLeft: -10 }}><TokenIcon token={earnToken} size={28} /></View>
                                        <Text style={styles.previewPair} numberOfLines={1}>{pairLabel}</Text>
                                    </View>
                                    <Text style={[styles.previewMuted, { marginTop: 4 }]}>{network}</Text>
                                </View>
                                <View style={styles.aprChip}>
                                    <Text style={styles.aprChipText}>{estimatedApr.toFixed(2)}% APR</Text>
                                </View>
                            </View>

                            <View style={styles.summaryGrid}>
                                <SummaryRow label="Reward pool" value={`${rewardAmount || '0'} ${earnToken.symbol}`} />
                                <SummaryRow label="Duration" value={`${durationDays || '0'} ${durationUnit}`} />
                                <SummaryRow label="Max TVL" value={`${maxTvl || '0'} ${stakeToken.symbol}`} />
                                <SummaryRow label="Min stake" value={`${minStake || '0'} ${stakeToken.symbol}`} />
                                <SummaryRow label="Max stake" value={maxStake ? `${maxStake} ${stakeToken.symbol}` : 'No cap'} />
                                <SummaryRow label="Min lock" value={minStakePeriod ? `${minStakePeriod} days` : 'None'} />
                                <SummaryRow label="Stake mod. fee" value={stakeModificationFee ? 'On' : 'Off'} />
                                <SummaryRow label="Time boost" value={timeBoost ? 'On' : 'Off'} />
                            </View>
                        </View>

                        <View style={styles.previewBox}>
                            <View style={styles.previewTopRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.previewMuted}>EVM payment wallet</Text>
                                    <Text style={styles.previewWallet} numberOfLines={1}>{compactAddress(walletAddress)}</Text>
                                </View>
                                <View style={[styles.readyChip, { backgroundColor: evmReady ? '#063D05' : '#201a08' }]}>
                                    <Text style={[styles.readyChipText, { color: evmReady ? colors.primaryCTA : '#facc15' }]}>{evmReady ? 'Ready' : 'Needed'}</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.feeRow}>
                            <Text style={styles.previewMuted}>Creation fee</Text>
                            <Text style={styles.feeValue}>{feeLabel}</Text>
                        </View>

                        {createError ? (
                            <View style={styles.previewErr}><Text style={styles.previewErrText}>{createError}</Text></View>
                        ) : null}
                    </View>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.backBtn} onPress={onClose} disabled={isSubmitting}>
                            <Text style={styles.backBtnText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]} onPress={onSubmit} disabled={isSubmitting}>
                            <Text style={styles.submitBtnText}>{submitLabel}</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function FormBlock({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <View style={styles.formBlock}>
            <Text style={styles.formTitle}>{title}</Text>
            {hint ? <Text style={styles.formHint}>{hint}</Text> : null}
            <View style={{ marginTop: 14 }}>{children}</View>
        </View>
    );
}

function ModeButton({ active, title, onPress }: { active: boolean; title: string; onPress: () => void }) {
    return (
        <TouchableOpacity onPress={onPress} style={[styles.modeBtn, active && styles.modeBtnActive]}>
            <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>{title}</Text>
        </TouchableOpacity>
    );
}

function TokenSelector({ label, token, onPress }: { label: string; token: PoolToken; onPress: () => void }) {
    return (
        <View style={{ gap: 8 }}>
            <Text style={styles.tokenLabel}>{label}</Text>
            <TouchableOpacity onPress={onPress} style={styles.tokenBtn} activeOpacity={0.8}>
                <TokenIcon token={token} size={34} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.tokenSym} numberOfLines={1}>{token.symbol}</Text>
                    <Text style={styles.tokenName} numberOfLines={1}>{token.name}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={colors.bodyText} />
            </TouchableOpacity>
        </View>
    );
}

function TokenIcon({ token, size = 34 }: { token: PoolToken; size?: number }) {
    return (
        <View style={{ width: size, height: size }}>
            {token.icon ? (
                <Image source={token.icon} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="contain" />
            ) : (
                <View style={[styles.tokenFallback, { width: size, height: size, borderRadius: size / 2 }]}>
                    <Text style={styles.tokenFallbackText}>{token.symbol.charAt(0).toUpperCase()}</Text>
                </View>
            )}
            {token.chainIcon ? (
                <View style={styles.tokenChainBadge}>
                    <Image source={token.chainIcon} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                </View>
            ) : null}
        </View>
    );
}

function Field({ label, value, suffix, placeholder, hint, active, onPress, onLayout }: { label: string; value: string; suffix: string; placeholder?: string; hint?: string; active: boolean; onPress: () => void; onLayout?: (e: LayoutChangeEvent) => void }) {
    return (
        <TouchableOpacity activeOpacity={0.85} onPress={onPress} onLayout={onLayout} style={[styles.field, active && styles.fieldActive]}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={styles.fieldRow}>
                {/* Grouped for readability; state keeps the raw digits. */}
                <Text numberOfLines={1} style={[styles.fieldInput, !value && styles.fieldPlaceholder]}>
                    {value ? formatNumberInput(value) : placeholder ?? '0'}
                </Text>
                <Text style={[styles.fieldSuffix, { color: value ? colors.primaryCTA : '#4f594f' }]}>{suffix}</Text>
            </View>
            {hint ? <Text numberOfLines={1} style={styles.fieldHint}>{hint}</Text> : null}
        </TouchableOpacity>
    );
}

function DurationField({ value, unit, onUnitChange, active, onPress, onLayout }: { value: string; unit: DurationUnit; onUnitChange: (u: DurationUnit) => void; active: boolean; onPress: () => void; onLayout?: (e: LayoutChangeEvent) => void }) {
    const units: DurationUnit[] = ['days', 'hours', 'minutes'];
    return (
        <TouchableOpacity activeOpacity={0.85} onPress={onPress} onLayout={onLayout} style={[styles.field, active && styles.fieldActive]}>
            <Text style={styles.fieldLabel}>Duration</Text>
            <View style={styles.fieldRow}>
                <Text numberOfLines={1} style={[styles.fieldInput, !value && styles.fieldPlaceholder]}>
                    {value ? formatNumberInput(value) : '30'}
                </Text>
                <TouchableOpacity
                    style={styles.unitChip}
                    onPress={() => onUnitChange(units[(units.indexOf(unit) + 1) % units.length])}
                >
                    <Text style={styles.unitChipText}>{unit}</Text>
                    <Ionicons name="chevron-down" size={12} color={colors.primaryCTA} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}

function ToggleRow({ title, hint, active, onToggle }: { title: string; hint: string; active: boolean; onToggle: () => void }) {
    return (
        <View style={styles.toggleRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.toggleTitle}>{title}</Text>
                <Text style={styles.toggleHint}>{hint}</Text>
            </View>
            <TouchableOpacity onPress={onToggle} style={[styles.switch, { backgroundColor: active ? colors.primaryCTA : '#1D281D' }]}>
                <View style={[styles.switchKnob, { transform: [{ translateX: active ? 22 : 2 }] }]} />
            </TouchableOpacity>
        </View>
    );
}

function StatusChip({ status }: { status: 'paid' | 'unpaid' }) {
    const paid = status === 'paid';
    return (
        <View style={[styles.statusChip, { backgroundColor: paid ? '#063D05' : '#201a08' }]}>
            <Ionicons name={paid ? 'checkmark' : 'wallet'} size={12} color={paid ? colors.primaryCTA : '#facc15'} />
            <Text style={[styles.statusChipText, { color: paid ? colors.primaryCTA : '#facc15' }]}>{paid ? 'Paid' : 'Unpaid'}</Text>
        </View>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { width: '100%', gap: 16 },
    banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
    bannerOk: { borderColor: '#1f5c1a', backgroundColor: 'rgba(10,31,8,0.8)' },
    bannerErr: { borderColor: '#5b1a1a', backgroundColor: 'rgba(26,8,8,0.8)' },
    bannerText: { fontFamily: 'Manrope-Medium', fontSize: 13, lineHeight: 18 },

    card: { borderRadius: 24, borderWidth: 1, borderColor: '#1f321d', backgroundColor: 'rgba(1,5,1,0.95)', overflow: 'hidden' },
    formBlock: { paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#1f321d' },
    formTitle: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 15 },
    formHint: { color: colors.bodyText, fontFamily: 'Manrope-Medium', fontSize: 13, marginTop: 6, lineHeight: 18 },

    nameInput: { height: 54, borderRadius: 16, backgroundColor: '#121912', paddingHorizontal: 16, color: '#fff', fontSize: 17, fontFamily: 'Manrope-SemiBold' },

    modeRow: { flexDirection: 'row', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: '#263226', backgroundColor: '#030703', padding: 4 },
    modeBtn: { flex: 1, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    modeBtnActive: { backgroundColor: '#063D05' },
    modeBtnText: { color: colors.bodyText, fontFamily: 'Manrope-SemiBold', fontSize: 13 },
    modeBtnTextActive: { color: colors.primaryCTA },

    crossRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    swapBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1D281D', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },

    tokenLabel: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 12 },
    tokenBtn: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 16, backgroundColor: '#121912', paddingHorizontal: 14 },
    tokenSym: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 16 },
    tokenName: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 12, marginTop: 1 },
    tokenFallback: { backgroundColor: '#263226', alignItems: 'center', justifyContent: 'center' },
    tokenFallbackText: { color: '#fff', fontFamily: 'Manrope-Bold', fontSize: 16 },
    tokenChainBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#121912', backgroundColor: '#101611', overflow: 'hidden' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    field: { width: '47.5%', flexGrow: 1, borderRadius: 18, borderWidth: 1, borderColor: '#1f321d', backgroundColor: 'rgba(7,16,7,0.8)', padding: 14 },
    fieldLabel: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 12 },
    fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    fieldActive: { borderColor: 'rgba(177,241,40,0.45)' },
    // minHeight holds the card at the height the TextInput used to give it.
    fieldInput: { flex: 1, color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 18, lineHeight: 24, minHeight: 24, padding: 0 },
    fieldPlaceholder: { color: '#4f594f', fontFamily: 'Manrope-Regular' },
    fieldHint: { color: '#8F9891', fontFamily: 'Manrope-Regular', fontSize: 10, marginTop: 4 },
    fieldSuffix: { fontFamily: 'Manrope-SemiBold', fontSize: 12 },
    unitChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, borderWidth: 1, borderColor: '#263226', backgroundColor: '#0b120a', paddingHorizontal: 8, paddingVertical: 4 },
    unitChipText: { color: colors.primaryCTA, fontFamily: 'Manrope-SemiBold', fontSize: 12 },

    toggleRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#1f321d', backgroundColor: 'rgba(7,16,7,0.8)', paddingHorizontal: 14, paddingVertical: 12 },
    toggleTitle: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 14 },
    toggleHint: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 12, marginTop: 2, lineHeight: 16 },
    switch: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center' },
    switchKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },

    previewBtn: { height: 52, borderRadius: 999, backgroundColor: colors.primaryCTA, alignItems: 'center', justifyContent: 'center' },
    previewBtnText: { color: '#010501', fontFamily: 'Manrope-SemiBold', fontSize: 16 },

    createdHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f321d' },
    createdTitle: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 16 },
    viewPoolsBtn: { borderRadius: 999, borderWidth: 1, borderColor: '#263226', paddingHorizontal: 14, paddingVertical: 8 },
    viewPoolsText: { color: colors.primaryCTA, fontFamily: 'Manrope-SemiBold', fontSize: 13 },
    createdRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f321d' },
    createdPair: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 14 },
    createdChain: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 11, marginTop: 2 },
    visRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    visText: { color: colors.bodyText, fontFamily: 'Manrope-Medium', fontSize: 13 },

    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    statusChipText: { fontFamily: 'Manrope-SemiBold', fontSize: 12 },

    // preview modal
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#0A0D0A', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#1f321d', maxHeight: '88%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f321d' },
    modalTitle: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 14 },
    previewInner: { padding: 16, gap: 12 },
    previewBox: { borderRadius: 18, borderWidth: 1, borderColor: '#1f321d', backgroundColor: 'rgba(7,16,7,0.8)', padding: 14 },
    previewTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    previewMuted: { color: '#8F9891', fontFamily: 'Manrope-Medium', fontSize: 12 },
    previewPairRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    previewPair: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 17, marginLeft: 8, flexShrink: 1 },
    previewWallet: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 14, marginTop: 4 },
    aprChip: { borderRadius: 999, backgroundColor: '#063D05', paddingHorizontal: 10, paddingVertical: 5 },
    aprChipText: { color: colors.primaryCTA, fontFamily: 'Manrope-SemiBold', fontSize: 12 },
    readyChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    readyChipText: { fontFamily: 'Manrope-SemiBold', fontSize: 12 },
    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    summaryCell: { width: '47.5%', flexGrow: 1, borderRadius: 14, borderWidth: 1, borderColor: '#1f321d', backgroundColor: 'rgba(1,5,1,0.6)', paddingHorizontal: 12, paddingVertical: 10 },
    summaryLabel: { color: '#8F9891', fontFamily: 'Manrope-Regular', fontSize: 11 },
    summaryValue: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 13, marginTop: 2 },
    feeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 18, borderWidth: 1, borderColor: '#1f321d', backgroundColor: 'rgba(7,16,7,0.8)', paddingHorizontal: 14, paddingVertical: 12 },
    feeValue: { color: '#fff', fontFamily: 'Manrope-SemiBold', fontSize: 14 },
    previewErr: { borderRadius: 14, borderWidth: 1, borderColor: '#5b1a1a', backgroundColor: 'rgba(26,8,8,0.8)', paddingHorizontal: 14, paddingVertical: 12 },
    previewErrText: { color: '#f87171', fontFamily: 'Manrope-Medium', fontSize: 13 },
    modalFooter: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1f321d' },
    backBtn: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: '#263226', paddingVertical: 12, alignItems: 'center' },
    backBtnText: { color: '#B5B5B5', fontFamily: 'Manrope-SemiBold', fontSize: 14 },
    submitBtn: { flex: 2, borderRadius: 999, backgroundColor: colors.primaryCTA, paddingVertical: 12, alignItems: 'center' },
    submitBtnText: { color: '#010501', fontFamily: 'Manrope-SemiBold', fontSize: 14 },
});
