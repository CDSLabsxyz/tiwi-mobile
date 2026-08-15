/**
 * Create / Add Liquidity wizard - /pool/create
 * Ported from tiwi-user-app app/pool/create/page.tsx (3-stage flow).
 *  Stage 1: choose token pair + fee level
 *  Stage 2: starting price + price range + deposit amounts
 *  Stage 3: success
 *
 * Deep-link prefill (from "Add Liquidity"): aAddress,aSymbol,aLogo,aDecimals,
 * bAddress,bSymbol,bLogo,bDecimals,chainId,feeBps,pairAddress,existing.
 *
 * Writes go through useLiquidityHub.createPoolOnChain (device-signed); metadata
 * is recorded via api.liquidity.createPool + createPosition (status 'pending').
 */
import { type TokenOption } from '@/components/sections/Swap/TokenSelectSheet';
import { UnifiedAssetSelectSheet } from '@/components/sections/Swap/UnifiedAssetSelectSheet';
import { SwapKeyboard } from '@/components/sections/Swap/SwapKeyboard';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { formatNumberInput, parseNumberInput } from '@/utils/formatting';
import { Fonts } from '@/theme';
import { RemoteIcon, resolveAssetUrl } from '@/components/liquidity/shared';
import { bootstrapLiquidityAddresses, isLiquidityChainLive, LIQUIDITY_CHAIN_NAMES } from '@/constants/liquidity';
import { useLiquidityHub } from '@/hooks/useLiquidityHub';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { api, TIWI_API_BASE_URL } from '@/lib/mobile/api-client';
import { useWalletStore } from '@/store/walletStore';
import type { LiquidityToken } from '@/types/liquidity';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatUnits, parseUnits, type Address } from 'viem';

const FEE_LEVELS = [
  { label: '0.01%', bps: 1 },
  { label: '0.05%', bps: 5 },
  { label: '0.25%', bps: 25 },
  { label: '1%', bps: 100 },
];
const RANGE_PRESETS = [10, 20, 50];
const DEPOSIT_PERCENTS = [25, 50, 75, 100];

/**
 * A value the `numeric` columns will accept, or undefined. Anything the DB
 * can't parse - "∞", "", a stray symbol - becomes undefined (→ NULL) rather
 * than being posted and rejected.
 */
function finiteOrUndefined(value: string): string | undefined {
  const n = parseFloat(value);
  return Number.isFinite(n) ? String(n) : undefined;
}

/** Format a number as a plain decimal string - never scientific notation. */
function toPlainDecimal(n: number): string {
  if (!isFinite(n) || n === 0) return '0';
  if (Math.abs(n) >= 1) return parseFloat(n.toFixed(8)).toString();
  const decimals = Math.min(20, Math.ceil(-Math.log10(Math.abs(n))) + 6);
  return n.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
}

interface WizToken extends LiquidityToken { chainId: number; priceUsd?: number }

function tokenFromParams(p: Record<string, string>, prefix: 'a' | 'b', chainId: number): WizToken | null {
  const address = p[`${prefix}Address`];
  if (!address) return null;
  return {
    address,
    symbol: p[`${prefix}Symbol`] || '',
    logo: p[`${prefix}Logo`] || '',
    decimals: p[`${prefix}Decimals`] ? Number(p[`${prefix}Decimals`]) : 18,
    chainId,
  };
}

export default function CreatePoolScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const { address, walletGroups, activeGroupId } = useWalletStore();
  const { createPoolOnChain, readPairOnChain, isPending } = useLiquidityHub();
  const { data: balancesData } = useWalletBalances();

  const wallet = useMemo(() => {
    const g = walletGroups.find((x) => x.id === activeGroupId);
    return g?.addresses?.EVM || address || null;
  }, [walletGroups, activeGroupId, address]);

  const addingToExisting = params.existing === '1';
  const initialChain = params.chainId ? Number(params.chainId) : 56;

  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [chainId, setChainId] = useState<number>(initialChain);
  const [tokenA, setTokenA] = useState<WizToken | null>(null);
  const [tokenB, setTokenB] = useState<WizToken | null>(null);
  const [feeBps, setFeeBps] = useState<number>(params.feeBps ? Number(params.feeBps) : 25);
  const [customFee, setCustomFee] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [picker, setPicker] = useState<'a' | 'b' | null>(null);

  const [startingPrice, setStartingPrice] = useState('');
  const [rangeMode, setRangeMode] = useState<'full' | 'custom'>('full');
  const [minPrice, setMinPrice] = useState('0');
  const [maxPrice, setMaxPrice] = useState('∞');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customRangePct, setCustomRangePct] = useState('');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [poolRatio, setPoolRatio] = useState<number>(0);

  const [priceLoading, setPriceLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** Pool is live on-chain but its DB record didn't save - shown on stage 3. */
  const [recordWarning, setRecordWarning] = useState<string | null>(null);
  const [result, setResult] = useState<{ pairAddress: string; lpTokens: string; tradable: boolean } | null>(null);

  // Deep-link prefill (once) + backend factory/router addresses.
  useEffect(() => {
    bootstrapLiquidityAddresses();
    if (params.aAddress && !tokenA) setTokenA(tokenFromParams(params as any, 'a', initialChain));
    if (params.bAddress && !tokenB) setTokenB(tokenFromParams(params as any, 'b', initialChain));
    // A deep-linked non-preset fee (e.g. 0.30%) opens in custom mode.
    if (params.feeBps) {
      const bps = Number(params.feeBps);
      if (isFinite(bps) && ![1, 5, 25, 100].includes(bps)) {
        setCustomMode(true);
        setCustomFee(String(bps / 100));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // For existing pools, read the live ratio to lock starting price + auto-fill.
  useEffect(() => {
    (async () => {
      if (!addingToExisting || !params.pairAddress || !tokenA || !tokenB) return;
      const snap = await readPairOnChain(chainId, params.pairAddress as Address, tokenA.decimals, tokenB.decimals, tokenA.address as Address);
      if (snap) {
        const rA = parseFloat(snap.reserveAFormatted || '0');
        const rB = parseFloat(snap.reserveBFormatted || '0');
        if (rA > 0) { setPoolRatio(rB / rA); setStartingPrice((rB / rA).toString()); }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addingToExisting, params.pairAddress, tokenA?.address, tokenB?.address]);

  const balanceRowOf = (t: WizToken | null): any | undefined => {
    if (!t || !balancesData?.tokens) return undefined;
    return balancesData.tokens.find(
      (x: any) => Number(x.chainId) === t.chainId && (x.address || '').toLowerCase() === t.address.toLowerCase(),
    );
  };

  /** Display only - a float can't hold an 18-significant-digit balance. */
  const balanceOf = (t: WizToken | null): number => {
    const row = balanceRowOf(t);
    return row ? parseFloat(row.balanceFormatted || row.balance || '0') : 0;
  };

  /**
   * Exact on-chain balance in base units. Every amount that becomes a
   * transferFrom MUST come from here, never from `balanceOf`: the API rounds
   * `balanceFormatted` to ~16 significant digits, and parseUnits on that
   * rounded value can land ABOVE the true balance (157127302.9869899 → …900
   * vs a real …885). The transfer then reverts, and TWC reverts with no
   * reason string, which surfaces as the useless "reverted with reason: 0x".
   */
  const rawBalanceOf = (t: WizToken | null): bigint | null => {
    const raw = balanceRowOf(t)?.balance;
    if (raw === undefined || raw === null || raw === '') return null;
    try {
      return BigInt(String(raw).split('.')[0]);
    } catch {
      return null;
    }
  };

  const effectiveFeeBps = () => {
    if (customMode) {
      const pct = parseFloat(customFee);
      if (isFinite(pct) && pct > 0) return Math.min(Math.max(Math.round(pct * 100), 1), 9999);
    }
    return feeBps;
  };

  const handleAssetSelect = (_chain: any, t: TokenOption) => {
    const wt: WizToken = {
      address: t.address,
      symbol: t.symbol,
      // The selector stores the logo URL in `icon` (t.logoURI); local requires
      // come through as numbers/objects which we can't use as a remote uri.
      logo: typeof t.icon === 'string' ? t.icon : undefined,
      decimals: t.decimals,
      chainId: t.chainId,
      priceUsd: t.priceUSD ? parseFloat(t.priceUSD) : undefined,
    };
    if (picker === 'a') { setTokenA(wt); setChainId(t.chainId); }
    else if (picker === 'b') setTokenB(wt);
    setPicker(null);
  };

  const setDepositPercent = (side: 'a' | 'b', pct: number) => {
    const t = side === 'a' ? tokenA : tokenB;
    // Take the percentage on the raw integer. Doing it in float and
    // re-parsing rounds UP on long balances, so "Max" asked for a few base
    // units more than the wallet held and every Max deposit reverted.
    const raw = rawBalanceOf(t);
    const amt = raw !== null
      ? formatUnits((raw * BigInt(pct)) / 100n, t?.decimals ?? 18)
      : ((balanceOf(t) * pct) / 100).toString();
    if (side === 'a') { setAmountA(amt); if (poolRatio > 0) setAmountB((parseFloat(amt) * poolRatio).toString()); }
    else { setAmountB(amt); if (poolRatio > 0) setAmountA((parseFloat(amt) / poolRatio).toString()); }
  };

  const onAmountA = (v: string) => { setAmountA(v); if (poolRatio > 0 && v) setAmountB((parseFloat(v) * poolRatio).toString()); };
  const onAmountB = (v: string) => { setAmountB(v); if (poolRatio > 0 && v) setAmountA((parseFloat(v) / poolRatio).toString()); };

  // Deposit amounts use the app's own numpad (same as Swap / Send / Stake)
  // instead of the OS keyboard, so the sheet's 25/50/75/Max pills and the
  // 6-decimal cap apply here too. `keypadFor` doubles as the visibility flag.
  const [keypadFor, setKeypadFor] = useState<'a' | 'b' | null>(null);
  const scrollViewRef = React.useRef<ScrollView>(null);

  // Lift the card clear of the sheet, exactly as the swap screen does.
  useEffect(() => {
    if (!keypadFor) return;
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [keypadFor]);

  const handleKeypadPress = (key: string) => {
    if (!keypadFor) return;
    const current = keypadFor === 'a' ? amountA : amountB;
    const apply = keypadFor === 'a' ? onAmountA : onAmountB;

    if (key === 'CLEAR') return apply('');
    if (key === 'DELETE') return apply(current.slice(0, -1));
    if (key === '.' && current.includes('.')) return;
    if (key === '.' && !current) return apply('0.');
    if (current.includes('.')) {
      const [, dec] = current.split('.');
      if (dec && dec.length >= 6) return;
    }
    apply(current + key);
  };

  const setRangeFromPercent = (pct: number) => {
    setRangeMode('custom');
    setMinPrice((1 - pct / 100).toFixed(4));
    setMaxPrice((1 + pct / 100).toFixed(4));
  };

  const priceOf = (t: WizToken | null): number => {
    if (!t || !balancesData?.tokens) return 0;
    const row = balancesData.tokens.find(
      (x: any) => x.chainId === t.chainId && (x.address || '').toLowerCase() === t.address.toLowerCase(),
    );
    return row ? parseFloat(row.priceUSD || (row as any).priceUsd || '0') : 0;
  };

  // "Use Market Price": existing pools lock to the live ratio; new pools derive
  // from the two tokens' USD prices - selector price → wallet feed → backend.
  const useMarketPrice = async () => {
    if (poolRatio > 0) { setStartingPrice(toPlainDecimal(poolRatio)); return; }
    if (!tokenA || !tokenB) return;
    setPriceLoading(true);
    try {
      let pa = tokenA.priceUsd || priceOf(tokenA);
      let pb = tokenB.priceUsd || priceOf(tokenB);
      if (!(pa > 0) || !(pb > 0)) {
        const res = await fetch(`${TIWI_API_BASE_URL}/api/v1/token-prices`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tokens: [
              { address: tokenA.address, chainId: tokenA.chainId, symbol: tokenA.symbol },
              { address: tokenB.address, chainId: tokenB.chainId, symbol: tokenB.symbol },
            ],
          }),
        });
        const j = await res.json().catch(() => ({}));
        const prices = j?.prices || {};
        const keyA = `${tokenA.chainId}:${tokenA.address.toLowerCase()}`;
        const keyB = `${tokenB.chainId}:${tokenB.address.toLowerCase()}`;
        if (!(pa > 0)) pa = Number(prices[keyA]) || 0;
        if (!(pb > 0)) pb = Number(prices[keyB]) || 0;
      }
      if (pa > 0 && pb > 0) setStartingPrice(toPlainDecimal(pb / pa));
    } catch {
      /* leave the manual value */
    } finally {
      setPriceLoading(false);
    }
  };

  // Swap the token order (and price / amounts) - mirrors the web swap button.
  const invertTokens = () => {
    const t = tokenA; setTokenA(tokenB); setTokenB(t);
    const a = amountA; setAmountA(amountB); setAmountB(a);
    const p = parseFloat(startingPrice);
    if (p > 0) setStartingPrice(toPlainDecimal(1 / p));
    setPoolRatio((r) => (r > 0 ? 1 / r : r));
  };

  const stepRange = (which: 'min' | 'max', dir: 1 | -1) => {
    const cur = which === 'min' ? minPrice : maxPrice;
    const base = parseFloat(cur);
    const n = isFinite(base) ? base : 0;
    const step = n !== 0 ? Math.abs(n) * 0.1 : 0.1;
    const next = toPlainDecimal(Math.max(0, n + dir * step));
    if (which === 'min') setMinPrice(next); else setMaxPrice(next);
  };

  const handleCreate = async () => {
    setSubmitError(null);
    setRecordWarning(null);
    if (!wallet) return setSubmitError('Connect a wallet first.');
    if (!tokenA || !tokenB) return setSubmitError('Select both tokens.');
    if (tokenA.chainId !== tokenB.chainId) return setSubmitError('Both tokens must be on the same chain.');
    const a = parseFloat(amountA); const b = parseFloat(amountB);
    if (!(a > 0) || !(b > 0)) return setSubmitError('Enter both deposit amounts.');

    // Catch a shortfall here, in base units, rather than letting the router's
    // transferFrom revert. Some tokens (TWC among them) revert with no reason
    // string, which reaches the user as "Execution reverted with reason: 0x".
    const shortfall = ([[tokenA, amountA], [tokenB, amountB]] as const)
      .map(([t, amt]) => {
        const raw = rawBalanceOf(t);
        if (raw === null) return null;
        try {
          return parseUnits(amt, t.decimals ?? 18) > raw ? t : null;
        } catch {
          return null;
        }
      })
      .find(Boolean);
    if (shortfall) {
      return setSubmitError(
        `Not enough ${shortfall.symbol}. You have ${formatUnits(rawBalanceOf(shortfall)!, shortfall.decimals ?? 18)}.`,
      );
    }

    const feeBpsVal = effectiveFeeBps();
    const cid = tokenA.chainId;
    const tradable = isLiquidityChainLive(cid);
    const chainName = LIQUIDITY_CHAIN_NAMES[cid] || `Chain ${cid}`;
    const pair = `${tokenA.symbol}/${tokenB.symbol}`;
    const price = startingPrice || (a > 0 ? (b / a).toString() : '0');

    try {
      let pairAddress = params.pairAddress || undefined;
      let factoryAddress: string | undefined;
      let lpTokens = '0';

      let txHash = '';
      if (tradable) {
        const res = await createPoolOnChain({ chainId: cid, tokenA, tokenB, feeBps: feeBpsVal, amountA, amountB });
        pairAddress = res.pairAddress; factoryAddress = res.factoryAddress; lpTokens = res.lpTokens; txHash = res.txHash;
      }

      // The pool is ALREADY deployed and seeded by this point, so a failure
      // below must not read as "nothing happened" - that invites a retry that
      // deploys a second pool and spends the tokens twice. Anything from here
      // on is bookkeeping: it is caught, surfaced as a warning on the success
      // screen, and never rethrown.
      let recordFailure: string | null = null;

      const poolRes = await api.liquidity.createPool({
        creatorWallet: wallet,
        chainId: cid,
        chainName,
        pair,
        pairAddress,
        factoryAddress,
        feeBps: feeBpsVal,
        tokenA,
        tokenB,
        seedAmountA: amountA,
        seedAmountB: amountB,
        startingPrice: price,
        // min_price/max_price are numeric(38,18) and nullable. An unbounded
        // side must be sent as undefined so the column stays NULL - posting
        // the "∞" the UI shows was rejected outright ("invalid input syntax
        // for type numeric") and failed every create. Note "custom" alone
        // isn't enough of a guard: switching to the custom tab without
        // editing leaves maxPrice at its "∞" default. Matches the web wizard.
        minPrice: rangeMode === 'full' ? undefined : finiteOrUndefined(minPrice),
        maxPrice: rangeMode === 'full' ? undefined : finiteOrUndefined(maxPrice),
        status: 'pending',
        tradable,
        source: 'tiwi',
      }).catch((e: any) => {
        recordFailure = e?.message || 'Could not save the pool record.';
        return null;
      });

      const poolId = poolRes?.pool?.id;
      if (poolId) {
        await api.liquidity.createPosition({
          userWallet: wallet, poolId, amountA, amountB, lpTokens, poolShare: '0', status: 'pending',
        }).catch((e: any) => {
          recordFailure = e?.message || 'Could not save your position record.';
        });
      }

      // Record in the activities board - only for real on-chain pools (a
      // recorded-only pool has no tx to point at). Reflects create vs top-up.
      if (txHash) {
        void api.wallet.logTransaction({
          walletAddress: wallet,
          transactionHash: txHash,
          chainId: cid,
          type: addingToExisting ? 'AddLiquidity' : 'CreateLiquidityPool',
          fromTokenAddress: tokenA.address,
          fromTokenSymbol: tokenA.symbol,
          toTokenAddress: tokenB.address,
          toTokenSymbol: tokenB.symbol,
          amount: amountA,
          amountFormatted: `${amountA} ${tokenA.symbol}`,
          // The B-side amount, same as the web records - without it the
          // activity row shows only half the deposit.
          toAmountFormatted: amountB,
          routerName: pair,
          poolAddress: pairAddress,
          blockTimestamp: new Date().toISOString(),
        }).catch(() => { /* tracking is best-effort */ });
      }

      // No tx means nothing was deployed (record-only chain), so a failed
      // record leaves nothing behind - that IS a plain failure, and retrying
      // is the right move. With a tx, the pool exists on-chain regardless.
      if (recordFailure && !txHash) {
        setSubmitError(recordFailure);
        return;
      }

      setRecordWarning(recordFailure);
      setResult({ pairAddress: pairAddress || '', lpTokens, tradable });
      setStage(3);
    } catch (e: any) {
      setSubmitError(e?.message || 'Failed to create pool');
    }
  };

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <CustomStatusBar />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => (stage > 1 && stage < 3 ? setStage((stage - 1) as any) : router.back())} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.titleText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{addingToExisting ? 'Add to Pool' : 'Add Liquidity'}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Step rail */}
      <View style={styles.rail}>
        {[1, 2, 3].map((n) => (
          <React.Fragment key={n}>
            <View style={[styles.stepDot, stage >= n && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, stage >= n && { color: '#04120A' }]}>{n}</Text>
            </View>
            {n < 3 && <View style={[styles.stepLine, stage > n && styles.stepLineActive]} />}
          </React.Fragment>
        ))}
      </View>

      <ScrollView
        ref={scrollViewRef}
        // Extra runway while the numpad is up so the active card can clear it.
        contentContainerStyle={{ padding: 16, paddingBottom: keypadFor ? 420 : 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {stage === 1 && (
          <>
            <Text style={styles.sectionTitle}>Choose a Token Pair</Text>
            <Text style={styles.sectionSub}>Select the tokens you want to provide liquidity for.</Text>
            <View style={styles.pairRow}>
              <TokenChip token={tokenA} placeholder="Token A" onPress={() => setPicker('a')} />
              <TouchableOpacity style={styles.swapTokens} onPress={() => { const t = tokenA; setTokenA(tokenB); setTokenB(t); }}>
                <Ionicons name="swap-horizontal" size={16} color={colors.titleText} />
              </TouchableOpacity>
              <TokenChip token={tokenB} placeholder="Token B" onPress={() => setPicker('b')} />
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Fee Level</Text>
            <Text style={styles.sectionSub}>Set the amount based on your strategy and risk level.</Text>
            <View style={styles.feeRow}>
              {FEE_LEVELS.map((f) => {
                const active = !customMode && feeBps === f.bps;
                return (
                  <TouchableOpacity
                    key={f.bps}
                    style={[styles.feeChip, active && styles.feeChipActive]}
                    onPress={() => { setCustomMode(false); setFeeBps(f.bps); setCustomFee(''); }}
                  >
                    <Text style={[styles.feeChipText, active && styles.feeChipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.feeChip, customMode && styles.feeChipActive]}
                onPress={() => setCustomMode(true)}
              >
                <Text style={[styles.feeChipText, customMode && styles.feeChipTextActive]}>Custom</Text>
              </TouchableOpacity>
            </View>
            {customMode ? (
              <View style={styles.customFeeRow}>
                <TextInput
                  value={customFee}
                  onChangeText={(t) => setCustomFee(t.replace(/[^0-9.]/g, ''))}
                  placeholder="0.30"
                  placeholderTextColor={colors.mutedText}
                  keyboardType="decimal-pad"
                  autoFocus
                  style={styles.customFeeInput}
                />
                <Text style={styles.customFeePct}>% fee</Text>
              </View>
            ) : null}

            <TouchableOpacity style={[styles.primaryBtn, (!tokenA || !tokenB) && styles.btnDisabled]} disabled={!tokenA || !tokenB} onPress={() => setStage(2)}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {stage === 2 && tokenA && tokenB && (
          <>
            {/* Pair summary */}
            <View style={styles.summaryCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TokenAvatar token={tokenA} size={26} />
                  <View style={{ marginLeft: -9 }}><TokenAvatar token={tokenB} size={26} /></View>
                </View>
                <View>
                  <Text style={styles.summaryPair}>{tokenA.symbol}/{tokenB.symbol}</Text>
                  <Text style={styles.summaryChain}>{LIQUIDITY_CHAIN_NAMES[tokenA.chainId] || `Chain ${tokenA.chainId}`}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => setStage(1)}>
                <Ionicons name="pencil" size={13} color={colors.primaryCTA} />
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>

            {/* Starting price */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Set Starting Price</Text>
              <TouchableOpacity style={styles.marketBtn} onPress={useMarketPrice} disabled={priceLoading}>
                {priceLoading ? <ActivityIndicator size="small" color={colors.primaryCTA} /> : <Text style={styles.marketBtnText}>Use Market Price</Text>}
              </TouchableOpacity>
            </View>
            <View style={styles.priceCard}>
              <TokenAvatar token={tokenA} size={28} />
              <TextInput
                value={formatNumberInput(addingToExisting ? toPlainDecimal(parseFloat(startingPrice) || 0) : startingPrice)}
                onChangeText={(t) => setStartingPrice(parseNumberInput(t))}
                editable={!addingToExisting}
                placeholder="0.0"
                placeholderTextColor={colors.mutedText}
                keyboardType="decimal-pad"
                style={styles.priceInput}
              />
              <Text style={styles.priceUnit}>{tokenA.symbol} = 1 {tokenB.symbol}</Text>
              <TouchableOpacity style={styles.swapMini} onPress={invertTokens}>
                <Ionicons name="swap-horizontal" size={15} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            {/* Price range */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Set Price Range</Text>
            <Text style={styles.sectionSub}>Full range keeps your position active across all prices but may increase impermanent loss.</Text>
            <View style={styles.rangeToggle}>
              <TouchableOpacity style={[styles.rangeTab, rangeMode === 'full' && styles.rangeTabActive]} onPress={() => { setRangeMode('full'); setMinPrice('0'); setMaxPrice('∞'); }}>
                <Text style={[styles.rangeTabText, rangeMode === 'full' && styles.rangeTabTextActive]}>Full range</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rangeTab, rangeMode === 'custom' && styles.rangeTabActive]} onPress={() => setRangeMode('custom')}>
                <Text style={[styles.rangeTabText, rangeMode === 'custom' && styles.rangeTabTextActive]}>Custom</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.rangeInputs}>
              <RangeCard label="Min price" value={rangeMode === 'full' ? '0' : minPrice} unit={`${tokenA.symbol} = 1 ${tokenB.symbol}`} editable={rangeMode === 'custom'} onChange={setMinPrice} onStep={(d) => stepRange('min', d)} />
              <RangeCard label="Max price" value={rangeMode === 'full' ? '∞' : maxPrice} unit={`${tokenA.symbol} = 1 ${tokenB.symbol}`} editable={rangeMode === 'custom'} onChange={setMaxPrice} onStep={(d) => stepRange('max', d)} />
            </View>
            <View style={styles.presetRow}>
              {RANGE_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={styles.preset}
                  onPress={() => { setShowCustomRange(false); setCustomRangePct(''); setRangeFromPercent(p); }}
                >
                  <Text style={styles.presetText}>{p}%</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.preset, showCustomRange && styles.presetActive]}
                onPress={() => { setRangeMode('custom'); setShowCustomRange(true); }}
              >
                <Text style={[styles.presetText, showCustomRange && styles.presetTextActive]}>Custom</Text>
              </TouchableOpacity>
            </View>
            {showCustomRange ? (
              <View style={styles.customRangeRow}>
                <TextInput
                  value={customRangePct}
                  onChangeText={(t) => {
                    const v = t.replace(/[^0-9.]/g, '');
                    setCustomRangePct(v);
                    const n = parseFloat(v);
                    if (isFinite(n) && n > 0) setRangeFromPercent(n);
                  }}
                  placeholder="e.g. 15"
                  placeholderTextColor={colors.mutedText}
                  keyboardType="decimal-pad"
                  autoFocus
                  style={styles.customRangeInput}
                />
                <Text style={styles.customRangePct}>% range around price</Text>
              </View>
            ) : null}

            {/* Deposits */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Deposit Amounts</Text>
            <DepositCard token={tokenA} amount={amountA} balance={balanceOf(tokenA)} priceUsd={priceOf(tokenA)} onPercent={(p) => setDepositPercent('a', p)} onInputPress={() => setKeypadFor('a')} active={keypadFor === 'a'} />
            <DepositCard token={tokenB} amount={amountB} balance={balanceOf(tokenB)} priceUsd={priceOf(tokenB)} onPercent={(p) => setDepositPercent('b', p)} onInputPress={() => setKeypadFor('b')} active={keypadFor === 'b'} />

            {submitError ? <Text style={styles.errorBanner}>{submitError}</Text> : null}

            <TouchableOpacity style={[styles.primaryBtn, isPending && styles.btnDisabled]} disabled={isPending} onPress={handleCreate}>
              {isPending ? <ActivityIndicator color="#04120A" /> : <Text style={styles.primaryBtnText}>{addingToExisting ? 'Add Liquidity' : 'Create Pool'}</Text>}
            </TouchableOpacity>
          </>
        )}

        {stage === 3 && result && (
          <View style={styles.successOuter}>
            <View style={styles.successInner}>
              <View style={styles.successCheck}>
                <Ionicons name="checkmark" size={34} color="#010501" />
              </View>

              <Text style={styles.successTitle}>Liquidity Added Successfully!</Text>
              <Text style={styles.successSub}>
                {result.tradable
                  ? `Your ${tokenA?.symbol}/${tokenB?.symbol} pool is live on-chain and tradable.`
                  : `Your ${tokenA?.symbol}/${tokenB?.symbol} pool is queued for admin verification.`}
              </Text>

              <View style={styles.successInfo}>
                <View style={styles.successInfoIcon}>
                  <Ionicons name="information" size={14} color={colors.primaryCTA} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.successInfoTitle}>{result.tradable ? 'Pool is live' : 'Admin verification pending'}</Text>
                  <Text style={styles.successInfoDesc}>
                    {result.tradable
                      ? 'Your liquidity is deposited on-chain. The pool is now public and earning fees on every swap.'
                      : 'Once the admin verifies this pool, it will become public in TIWI Protocol Pools.'}
                  </Text>
                </View>
              </View>

              {/* Deployed, but not recorded. Say so plainly - the danger is a
                  user reading "failed", running it again, and paying for a
                  second identical pool. */}
              {recordWarning ? (
                <View style={styles.successWarn}>
                  <Ionicons name="warning-outline" size={16} color="#E8A838" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.successWarnTitle}>Pool created - but not saved to your list</Text>
                    <Text style={styles.successWarnDesc}>
                      Your funds are deposited and the pool is live on-chain, so do NOT create it
                      again. It just may not appear under Pools yet. {recordWarning}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.successMetrics}>
                <SuccessMetric label="Pool Share" value="Pending review" />
                <SuccessMetric label={`${tokenA?.symbol} Deposited`} value={`${amountA} ${tokenA?.symbol}`} />
                <SuccessMetric label={`${tokenB?.symbol} Deposited`} value={`${amountB} ${tokenB?.symbol}`} />
                <SuccessMetric label="LP Tokens Received" value={result.tradable ? parseFloat(result.lpTokens).toFixed(6) : 'Pending verification'} />
              </View>

              <View style={styles.successBtns}>
                <TouchableOpacity
                  style={styles.addMoreBtn}
                  onPress={() => { setResult(null); setRecordWarning(null); setAmountA(''); setAmountB(''); setStage(1); }}
                >
                  <Text style={styles.addMoreText}>Add More Liquidity</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.viewPoolBtn} onPress={() => router.replace('/pool' as any)}>
                  <Text style={styles.viewPoolText}>View Pool</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <UnifiedAssetSelectSheet
        visible={picker !== null}
        initialChainId={picker === 'b' ? (tokenA?.chainId ?? null) : (tokenA?.chainId ?? chainId ?? null)}
        initialStep={picker === 'b' && tokenA ? 'tokens' : 'chains'}
        selectedTokenId={
          picker === 'a'
            ? (tokenA ? `${tokenA.chainId}-${tokenA.address}` : null)
            : (tokenB ? `${tokenB.chainId}-${tokenB.address}` : null)
        }
        onSelect={handleAssetSelect}
        onClose={() => setPicker(null)}
      />

      <SwapKeyboard
        visible={keypadFor !== null}
        onClose={() => setKeypadFor(null)}
        onKeyPress={handleKeypadPress}
        onPercentagePress={(p) => keypadFor && setDepositPercent(keypadFor, p)}
        onMaxPress={() => keypadFor && setDepositPercent(keypadFor, 100)}
      />
    </View>
  );
}

function TokenChip({ token, placeholder, onPress }: { token: WizToken | null; placeholder: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tokenChip} onPress={onPress}>
      {token ? <TokenAvatar token={token} size={24} /> : <View style={styles.tokenChipLogo} />}
      <Text style={styles.tokenChipText}>{token?.symbol || placeholder}</Text>
      <Ionicons name="chevron-down" size={16} color={colors.mutedText} />
    </TouchableOpacity>
  );
}

function TokenAvatar({ token, size = 26 }: { token: WizToken; size: number }) {
  const resolved = resolveAssetUrl(token.logo);
  if (resolved) {
    return <RemoteIcon uri={resolved} size={size} background={colors.bgStroke} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bgStroke, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.bodyText, fontSize: size * 0.4, fontFamily: Fonts.bold }}>{(token.symbol || '?').slice(0, 1)}</Text>
    </View>
  );
}

function RangeCard({ label, value, unit, editable, onChange, onStep }: {
  label: string; value: string; unit: string; editable: boolean; onChange: (v: string) => void; onStep: (dir: 1 | -1) => void;
}) {
  return (
    <View style={styles.rangeCard}>
      <Text style={styles.rangeLabel}>{label}</Text>
      <View style={styles.rangeInputRow}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(-1)} disabled={!editable}>
          <Ionicons name="remove" size={15} color={editable ? colors.titleText : colors.mutedText} />
        </TouchableOpacity>
        <TextInput
          // "Max price" carries a literal "∞" on a full-range pool - grouping
          // only applies to values that are actually numbers.
          value={/\d/.test(value) ? formatNumberInput(value) : value}
          onChangeText={(t) => onChange(parseNumberInput(t))}
          editable={editable}
          keyboardType="decimal-pad"
          style={styles.rangeInput}
          placeholderTextColor={colors.mutedText}
        />
        <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(1)} disabled={!editable}>
          <Ionicons name="add" size={15} color={editable ? colors.titleText : colors.mutedText} />
        </TouchableOpacity>
      </View>
      <Text style={styles.rangeUnit}>{unit}</Text>
    </View>
  );
}

function DepositCard({ token, amount, balance, priceUsd, onPercent, onInputPress, active }: {
  token: WizToken; amount: string; balance: number; priceUsd: number; onPercent: (p: number) => void;
  onInputPress: () => void; active: boolean;
}) {
  const usd = (parseFloat(amount || '0') || 0) * (priceUsd || 0);
  return (
    <View style={[styles.depositCard, active && styles.depositCardActive]}>
      <View style={styles.depositTopRow}>
        <Text style={styles.depositAmountLbl}>Amount</Text>
        {/* Opens the in-app numpad rather than the OS keyboard - the value is
            display-only here, every edit arrives through onKeyPress. */}
        <TouchableOpacity activeOpacity={0.7} onPress={onInputPress} style={styles.depositInputBtn}>
          <Text
            style={[styles.depositInput, !amount && { color: colors.mutedText }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {formatNumberInput(amount) || '0.00'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.depositMidRow}>
        <View style={styles.depositTokenChip}>
          <TokenAvatar token={token} size={26} />
          <View>
            <Text style={styles.depositSym}>{token.symbol}</Text>
            <Text style={styles.depositChain}>{LIQUIDITY_CHAIN_NAMES[token.chainId] || `Chain ${token.chainId}`}</Text>
          </View>
        </View>
        <Text style={styles.depositUsd}>${usd.toFixed(2)}</Text>
      </View>
      <View style={styles.depositBottom}>
        <Text style={styles.depositBalance} numberOfLines={1}>Balance: {balance.toFixed(4)} {token.symbol}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {DEPOSIT_PERCENTS.map((p) => (
            <TouchableOpacity key={p} style={styles.pctBtn} onPress={() => onPercent(p)} disabled={balance <= 0}>
              <Text style={styles.pctBtnText}>{p === 100 ? 'Max' : `${p}%`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

function SuccessMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.successMetricRow}>
      <Text style={styles.successMetricLabel}>{label}</Text>
      <Text style={styles.successMetricValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 48 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.titleText, fontSize: 16, fontFamily: Fonts.bold },
  rail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 4 },
  stepDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: colors.primaryCTA, borderColor: colors.primaryCTA },
  stepDotText: { color: colors.mutedText, fontSize: 12, fontFamily: Fonts.bold },
  stepLine: { width: 48, height: 1, backgroundColor: colors.border },
  stepLineActive: { backgroundColor: colors.primaryCTA },
  sectionTitle: { color: colors.titleText, fontSize: 15, fontFamily: Fonts.bold },
  sectionSub: { color: colors.mutedText, fontSize: 12, marginTop: 4 },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  tokenChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgCards, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  tokenChipLogo: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.bgStroke },
  tokenChipText: { flex: 1, color: colors.titleText, fontSize: 14, fontFamily: Fonts.semibold },
  swapTokens: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bgCards, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  feeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  feeChip: { paddingHorizontal: 14, height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgCards },
  feeChipActive: { backgroundColor: colors.bgShade20, borderColor: colors.primaryCTA },
  feeChipText: { color: colors.bodyText, fontSize: 13, fontFamily: Fonts.semibold },
  feeChipTextActive: { color: colors.primaryCTA },
  customFeeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, backgroundColor: colors.bgCards, borderWidth: 1, borderColor: colors.primaryCTA, borderRadius: 12, paddingHorizontal: 14, height: 48 },
  customFeeInput: { flex: 1, color: colors.titleText, fontSize: 18, fontFamily: Fonts.semibold, padding: 0 },
  customFeePct: { color: colors.mutedText, fontSize: 13, fontFamily: Fonts.medium },
  primaryBtn: { backgroundColor: colors.primaryCTA, borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  primaryBtnText: { color: '#04120A', fontSize: 15, fontFamily: Fonts.bold },
  btnDisabled: { opacity: 0.4 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bgCards, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 20 },
  summaryPair: { color: colors.titleText, fontSize: 15, fontFamily: Fonts.bold },
  summaryChain: { color: colors.mutedText, fontSize: 11, fontFamily: Fonts.medium, marginTop: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bgShade20, borderRadius: 8, paddingHorizontal: 10, height: 30 },
  editLink: { color: colors.primaryCTA, fontSize: 13, fontFamily: Fonts.semibold },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  marketBtn: { backgroundColor: 'rgba(177,241,40,0.08)', borderColor: 'rgba(177,241,40,0.3)', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 30, justifyContent: 'center' },
  marketBtnText: { color: colors.primaryCTA, fontSize: 12, fontFamily: Fonts.semibold },
  priceCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCards, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 62, marginTop: 12 },
  priceInput: { flex: 1, color: colors.titleText, fontSize: 20, fontFamily: Fonts.bold, padding: 0 },
  priceUnit: { color: colors.mutedText, fontSize: 11, fontFamily: Fonts.medium },
  swapMini: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bgShade20, alignItems: 'center', justifyContent: 'center' },
  rangeToggle: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rangeTab: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgCards },
  rangeTabActive: { backgroundColor: colors.bgShade20, borderColor: colors.primaryCTA },
  rangeTabText: { color: colors.bodyText, fontSize: 13, fontFamily: Fonts.semibold },
  rangeTabTextActive: { color: colors.primaryCTA },
  rangeInputs: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rangeCard: { flex: 1, backgroundColor: colors.bgCards, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: 'center' },
  rangeLabel: { color: colors.mutedText, fontSize: 11, fontFamily: Fonts.medium, textAlign: 'center' },
  rangeInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 8 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bgShade20, alignItems: 'center', justifyContent: 'center' },
  rangeInput: { flex: 1, color: colors.titleText, fontSize: 16, fontFamily: Fonts.bold, textAlign: 'center', padding: 0 },
  rangeUnit: { color: colors.mutedText, fontSize: 10, fontFamily: Fonts.medium, marginTop: 6, textAlign: 'center' },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  preset: { flex: 1, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  presetActive: { backgroundColor: colors.bgShade20, borderColor: colors.primaryCTA },
  presetText: { color: colors.bodyText, fontSize: 12, fontFamily: Fonts.semibold },
  presetTextActive: { color: colors.primaryCTA },
  customRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, backgroundColor: colors.bgCards, borderWidth: 1, borderColor: colors.primaryCTA, borderRadius: 12, paddingHorizontal: 14, height: 46 },
  customRangeInput: { minWidth: 60, color: colors.titleText, fontSize: 16, fontFamily: Fonts.semibold, padding: 0 },
  customRangePct: { color: colors.mutedText, fontSize: 12, fontFamily: Fonts.medium },
  depositCard: { backgroundColor: colors.bgCards, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 12 },
  // Which card the numpad is currently editing.
  depositCardActive: { borderColor: colors.primaryCTA },
  depositTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  depositAmountLbl: { color: colors.mutedText, fontSize: 12, fontFamily: Fonts.medium },
  depositInputBtn: { flex: 1, marginLeft: 12 },
  depositInput: { color: colors.titleText, fontSize: 22, fontFamily: Fonts.bold, textAlign: 'right', padding: 0 },
  depositMidRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  depositTokenChip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  depositSym: { color: colors.titleText, fontSize: 14, fontFamily: Fonts.semibold },
  depositChain: { color: colors.mutedText, fontSize: 10, fontFamily: Fonts.medium, marginTop: 1 },
  depositUsd: { color: colors.mutedText, fontSize: 13, fontFamily: Fonts.medium },
  depositBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  depositBalance: { color: colors.mutedText, fontSize: 11, fontFamily: Fonts.medium, flex: 1 },
  pctBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.bgShade20 },
  pctBtnText: { color: colors.primaryCTA, fontSize: 11, fontFamily: Fonts.semibold },
  errorBanner: { color: colors.error, fontSize: 12, marginTop: 14 },
  successOuter: { marginTop: 8, borderRadius: 22, borderWidth: 1, borderColor: colors.bgStroke, backgroundColor: colors.bg, padding: 4 },
  successInner: { borderRadius: 20, backgroundColor: '#071007', paddingHorizontal: 20, paddingVertical: 40, alignItems: 'center' },
  successCheck: {
    width: 78, height: 78, borderRadius: 39, backgroundColor: colors.primaryCTA, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primaryCTA, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  successTitle: { color: colors.titleText, fontSize: 19, fontFamily: Fonts.semibold, marginTop: 28, textAlign: 'center' },
  successSub: { color: colors.bodyText, fontSize: 13, fontFamily: Fonts.medium, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  successInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, width: '100%', marginTop: 24, borderRadius: 16, borderWidth: 1, borderColor: '#263226', backgroundColor: colors.bg, padding: 16 },
  successInfoIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1D281D', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  successInfoTitle: { color: colors.titleText, fontSize: 14, fontFamily: Fonts.semibold },
  successInfoDesc: { color: colors.bodyText, fontSize: 13, fontFamily: Fonts.medium, marginTop: 6, lineHeight: 19 },
  successWarn: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: 'rgba(232,168,56,0.10)', borderWidth: 1, borderColor: 'rgba(232,168,56,0.35)', borderRadius: 12, padding: 12, marginTop: 12 },
  successWarnTitle: { color: '#E8A838', fontSize: 13, fontFamily: Fonts.bold },
  successWarnDesc: { color: colors.bodyText, fontSize: 12, fontFamily: Fonts.medium, marginTop: 4, lineHeight: 18 },
  successMetrics: { width: '100%', marginTop: 28, gap: 16 },
  successMetricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  successMetricLabel: { color: colors.bodyText, fontSize: 13, fontFamily: Fonts.medium },
  successMetricValue: { color: colors.titleText, fontSize: 13, fontFamily: Fonts.medium, textAlign: 'right', flexShrink: 1 },
  successBtns: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 32, borderRadius: 18, borderWidth: 1, borderColor: colors.bgStroke, backgroundColor: colors.bg, padding: 8 },
  addMoreBtn: { flex: 1, height: 48, borderRadius: 13, backgroundColor: '#063D05', alignItems: 'center', justifyContent: 'center' },
  addMoreText: { color: colors.primaryCTA, fontSize: 14, fontFamily: Fonts.semibold },
  viewPoolBtn: { flex: 1, height: 48, borderRadius: 13, backgroundColor: '#071007', alignItems: 'center', justifyContent: 'center' },
  viewPoolText: { color: colors.bodyText, fontSize: 14, fontFamily: Fonts.semibold },
});
