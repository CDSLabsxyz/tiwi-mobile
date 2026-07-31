/**
 * Maps the wallet's held balances into the TokenOption[] shape the multi-send
 * pickers, CSV resolver and preview consume. Mirrors the mapping in
 * SendTokenSelectSheet so per-row tokens carry chainId + decimals + address.
 */

import type { TokenOption } from "@/components/sections/Swap/TokenSelectSheet";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { useCustomTokenStore } from "@/store/customTokenStore";
import { useWalletStore } from "@/store/walletStore";
import { useMemo } from "react";

export function useMultiSendTokens(): TokenOption[] {
  const { data: balanceData } = useWalletBalances();
  const { activeGroupId, address } = useWalletStore();
  const walletKey = activeGroupId || address || "default";
  const hiddenWalletTokens = useCustomTokenStore((s) => s.hiddenWalletTokens);

  const hiddenSet = useMemo(() => {
    const list = hiddenWalletTokens[walletKey] || [];
    return new Set(list.map((r) => `${r.chainId}-${r.address.toLowerCase()}`));
  }, [hiddenWalletTokens, walletKey]);

  return useMemo(() => {
    if (!balanceData) return [];
    return balanceData.tokens
      .filter(
        (t: any) =>
          !hiddenSet.has(`${Number(t.chainId)}-${(t.address || "").toLowerCase()}`)
      )
      .map(
        (t: any) =>
          ({
            id: `${t.chainId}-${t.address}`,
            symbol: t.symbol,
            name: t.name,
            icon: t.logoURI,
            tvl: "0",
            balanceFiat: `$${parseFloat(t.usdValue || "0").toFixed(2)}`,
            balanceToken: t.balanceFormatted || "0",
            address: t.address,
            chainId: Number(t.chainId),
            decimals: t.decimals,
            priceUSD: t.priceUSD,
          } as TokenOption)
      );
  }, [balanceData, hiddenSet]);
}
