/**
 * useUnwrap - everything a screen needs to offer "unwrap this token into the
 * chain's native coin": the owning address, the live on-chain balance, and the
 * execute call.
 *
 * Pass `null` when the token isn't a wrapped native; the hook stays inert so it
 * can be called unconditionally from a row/detail screen.
 */

import type { WrappedNativeInfo } from '@/constants/wrappedNatives';
import { fetchWrappedBalance, unwrapToNative, type UnwrapBalance } from '@/services/unwrapService';
import { useWalletStore } from '@/store/walletStore';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const EMPTY_BALANCE: UnwrapBalance = { raw: 0n, formatted: '0' };

/** The active wallet's address on the chain this wrapped token lives on. */
export function useUnwrapOwner(info: WrappedNativeInfo | null): string {
  const activeAddress = useWalletStore((s) => s.activeAddress);
  const address = useWalletStore((s) => s.address);
  const walletGroups = useWalletStore((s) => s.walletGroups);
  const activeGroupId = useWalletStore((s) => s.activeGroupId);

  return useMemo(() => {
    if (!info) return '';
    const group = walletGroups.find((g) => g.id === activeGroupId) ?? walletGroups[0];
    if (info.family === 'solana') return group?.addresses?.SOLANA || '';
    return activeAddress || group?.addresses?.EVM || address || '';
  }, [info, walletGroups, activeGroupId, activeAddress, address]);
}

export function useUnwrap(info: WrappedNativeInfo | null) {
  const queryClient = useQueryClient();
  const owner = useUnwrapOwner(info);

  const [balance, setBalance] = useState<UnwrapBalance>(EMPTY_BALANCE);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!info || !owner) {
      setBalance(EMPTY_BALANCE);
      return EMPTY_BALANCE;
    }
    setIsLoadingBalance(true);
    try {
      const next = await fetchWrappedBalance(info, owner);
      if (mounted.current) setBalance(next);
      return next;
    } finally {
      if (mounted.current) setIsLoadingBalance(false);
    }
  }, [info, owner]);

  // Re-read whenever the target token or wallet changes.
  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const unwrap = useCallback(
    async (amount: bigint) => {
      if (!info) throw new Error('This token cannot be unwrapped.');
      setError(null);
      setIsPending(true);
      try {
        const result = await unwrapToNative({ info, owner, amount });
        if (mounted.current) setTxHash(result.hash);
        // Portfolio rows and the asset screen both read from this query.
        queryClient.invalidateQueries({ queryKey: ['walletBalances'] });
        refreshBalance();
        return result;
      } catch (e: any) {
        const message = e?.message || 'Unwrap failed.';
        if (mounted.current) setError(message);
        throw e;
      } finally {
        if (mounted.current) setIsPending(false);
      }
    },
    [info, owner, queryClient, refreshBalance],
  );

  const reset = useCallback(() => {
    setError(null);
    setTxHash(null);
  }, []);

  return { owner, balance, isLoadingBalance, refreshBalance, unwrap, isPending, error, txHash, reset };
}
