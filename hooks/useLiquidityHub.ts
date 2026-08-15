/**
 * useLiquidityHub (mobile) - faithful port of tiwi-user-app hooks/useLiquidityHub.ts.
 *
 * Writes are encoded on-device and signed via `signerController` (the same path
 * mobile staking uses); reads use chain-pinned viem public clients. Every write
 * waits for its receipt before the next step. minAmounts are 0 (the pair/router
 * enforce ratio internally), deadline is +30min - matching the web hook.
 *
 * Supported/wrapped-native chains: 1, 56, 137, 42161, 10, 8453, 43114.
 */
import {
  LIQUIDITY_ERC20_ABI,
  TIWI_LIQUIDITY_FACTORY_ABI,
  TIWI_LIQUIDITY_PAIR_ABI,
  TIWI_LIQUIDITY_ROUTER_ABI,
  WRAPPED_NATIVE_ABI,
} from '@/constants/abis-liquidity';
import {
  getLiquidityFactoryAddress,
  getLiquidityPublicClient,
  getLiquidityRouterAddress,
  isZeroOrNative,
  WRAPPED_NATIVE,
} from '@/constants/liquidity';
import { signerController } from '@/services/signer/SignerController';
import { useWalletStore } from '@/store/walletStore';
import type { LiquidityToken } from '@/types/liquidity';
import { useCallback, useState } from 'react';
import { encodeFunctionData, formatUnits, parseUnits, type Address } from 'viem';

const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 1800);

export interface PoolFees {
  creator: string;
  platform: string;
  creatorFeeShareBps: number;
  platformFeeShareBps: number;
  creator0: string;
  creator1: string;
  platform0: string;
  platform1: string;
}

// ── Reads (chain-pinned client) ──────────────────────────────────────────────

async function readDecimals(chainId: number, token: Address): Promise<number> {
  try {
    const client = getLiquidityPublicClient(chainId);
    return Number(await client.readContract({ address: token, abi: LIQUIDITY_ERC20_ABI, functionName: 'decimals' }));
  } catch {
    return 18;
  }
}

/** Live pair snapshot in DISPLAY order (tokenA/tokenB), null when unreadable. */
export async function readPairOnChain(
  chainId: number,
  pairAddress: Address,
  decimalsA = 18,
  decimalsB = 18,
  tokenAAddress?: Address,
) {
  try {
    const client = getLiquidityPublicClient(chainId);
    const [reserves, token0, token1, totalSupply, feeBps] = await Promise.all([
      client.readContract({ address: pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'getReserves' }) as Promise<any>,
      client.readContract({ address: pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'token0' }) as Promise<Address>,
      client.readContract({ address: pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'token1' }) as Promise<Address>,
      client.readContract({ address: pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'totalSupply' }) as Promise<bigint>,
      client.readContract({ address: pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'feeBps' }) as Promise<number>,
    ]);
    const reserve0 = reserves[0] as bigint;
    const reserve1 = reserves[1] as bigint;
    const wrapped = WRAPPED_NATIVE[chainId];
    const resolvedA = tokenAAddress && isZeroOrNative(tokenAAddress) ? wrapped : tokenAAddress;
    const aIsToken0 = resolvedA ? resolvedA.toLowerCase() === token0.toLowerCase() : true;
    const decA0 = aIsToken0 ? decimalsA : decimalsB;
    const decA1 = aIsToken0 ? decimalsB : decimalsA;
    return {
      pairAddress,
      token0,
      token1,
      reserve0: reserve0.toString(),
      reserve1: reserve1.toString(),
      reserve0Formatted: formatUnits(reserve0, decA0),
      reserve1Formatted: formatUnits(reserve1, decA1),
      reserveAFormatted: aIsToken0 ? formatUnits(reserve0, decimalsA) : formatUnits(reserve1, decimalsA),
      reserveBFormatted: aIsToken0 ? formatUnits(reserve1, decimalsB) : formatUnits(reserve0, decimalsB),
      aIsToken0,
      totalSupply: totalSupply.toString(),
      feeBps: Number(feeBps),
    };
  } catch {
    return null;
  }
}

/** Creator/platform accrued fees on a pair. Returns null on pre-upgrade pools. */
export async function readPoolFees(pairAddress: Address, chainId: number): Promise<PoolFees | null> {
  try {
    const client = getLiquidityPublicClient(chainId);
    const [pending, creator, platform, creatorBps, platformBps] = await Promise.all([
      client.readContract({ address: pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'pendingFees' }) as Promise<any>,
      client.readContract({ address: pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'creator' }) as Promise<Address>,
      client.readContract({ address: pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'platform' }) as Promise<Address>,
      client.readContract({ address: pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'creatorFeeShareBps' }) as Promise<number>,
      client.readContract({ address: pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'platformFeeShareBps' }) as Promise<number>,
    ]);
    return {
      creator, platform,
      creatorFeeShareBps: Number(creatorBps),
      platformFeeShareBps: Number(platformBps),
      creator0: (pending[0] as bigint).toString(),
      creator1: (pending[1] as bigint).toString(),
      platform0: (pending[2] as bigint).toString(),
      platform1: (pending[3] as bigint).toString(),
    };
  } catch {
    return null; // pre-upgrade pair (functions absent) → caller hides the fees card
  }
}

// ── The hook ─────────────────────────────────────────────────────────────────

export interface CreatePoolParams {
  chainId: number;
  tokenA: LiquidityToken;
  tokenB: LiquidityToken;
  feeBps: number;
  amountA: string;
  amountB: string;
}
export interface CreatePoolResult {
  pairAddress: string;
  factoryAddress: string;
  txHash: string;
  lpTokens: string;
}

export function useLiquidityHub() {
  const activeAddress = useWalletStore((s) => s.activeAddress);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Encode → sign via signerController → wait for receipt. Returns the receipt. */
  const sendWrite = useCallback(async (opts: {
    chainId: number; to: Address; abi: readonly any[]; functionName: string; args: readonly any[]; value?: bigint;
  }) => {
    if (!activeAddress) throw new Error('Wallet not connected');
    const data = encodeFunctionData({ abi: opts.abi as any, functionName: opts.functionName, args: opts.args as any });
    const result = await signerController.executeTransaction(
      { chainFamily: 'evm', to: opts.to, data, value: opts.value?.toString(), chainId: opts.chainId },
      activeAddress,
      { skipAuthorize: true },
    );
    if (result.status !== 'success' || !result.hash) throw new Error(result.error || 'Transaction failed');
    const hash = result.hash as `0x${string}`;
    const client = getLiquidityPublicClient(opts.chainId);
    const receipt = await client.waitForTransactionReceipt({ hash }).catch(() => null);
    return { hash, receipt };
  }, [activeAddress]);

  /** Read allowance; approve `spender` for `amount` only when short. */
  const approveIfNeeded = useCallback(async (chainId: number, token: Address, spender: Address, amount: bigint) => {
    if (!activeAddress) throw new Error('Wallet not connected');
    const client = getLiquidityPublicClient(chainId);
    let allowance = 0n;
    try {
      allowance = (await client.readContract({
        address: token, abi: LIQUIDITY_ERC20_ABI, functionName: 'allowance', args: [activeAddress as Address, spender],
      })) as bigint;
    } catch { /* treat as zero */ }
    if (allowance < amount) {
      await sendWrite({ chainId, to: token, abi: LIQUIDITY_ERC20_ABI, functionName: 'approve', args: [spender, amount] });
    }
  }, [activeAddress, sendWrite]);

  const createPoolOnChain = useCallback(async (params: CreatePoolParams): Promise<CreatePoolResult> => {
    setError(null); setIsPending(true);
    try {
      if (!activeAddress) throw new Error('Wallet not connected');
      const { chainId, feeBps } = params;
      const factory = getLiquidityFactoryAddress(chainId);
      if (!factory) throw new Error('Liquidity Hub is not deployed on this chain.');
      const wrapped = WRAPPED_NATIVE[chainId];
      const to = activeAddress as Address;

      const aNative = isZeroOrNative(params.tokenA.address);
      const bNative = isZeroOrNative(params.tokenB.address);
      if (aNative && bNative) throw new Error('Both sides cannot be the native coin.');
      if ((aNative || bNative) && !wrapped) throw new Error('Native pools not supported on this chain.');

      // Resolve display tokens → ERC20 addresses (native → wrapped) + decimals.
      const addrA = (aNative ? wrapped : params.tokenA.address) as Address;
      const addrB = (bNative ? wrapped : params.tokenB.address) as Address;
      const decA = aNative ? 18 : (params.tokenA.decimals ?? await readDecimals(chainId, addrA));
      const decB = bNative ? 18 : (params.tokenB.decimals ?? await readDecimals(chainId, addrB));
      const amountAWei = parseUnits(params.amountA, decA);
      const amountBWei = parseUnits(params.amountB, decB);

      const router = getLiquidityRouterAddress(chainId);
      let pairAddress: Address;
      let seedHash = ''; // hash of the liquidity-seeding tx, surfaced for activity logging

      if (router) {
        // ── Router path (single seed tx) ──
        if (aNative || bNative) {
          // addLiquidityNative(token, amountTokenDesired, 0, 0, feeBps, to, deadline){value}
          const token = (aNative ? addrB : addrA);
          const tokenAmount = aNative ? amountBWei : amountAWei;
          const nativeAmount = aNative ? amountAWei : amountBWei;
          await approveIfNeeded(chainId, token, router, tokenAmount);
          seedHash = (await sendWrite({
            chainId, to: router, abi: TIWI_LIQUIDITY_ROUTER_ABI, functionName: 'addLiquidityNative',
            args: [token, tokenAmount, 0n, 0n, feeBps, to, deadline()], value: nativeAmount,
          })).hash;
          pairAddress = (await getLiquidityPublicClient(chainId).readContract({
            address: factory, abi: TIWI_LIQUIDITY_FACTORY_ABI, functionName: 'pairFor', args: [token, wrapped, feeBps],
          })) as Address;
        } else {
          await approveIfNeeded(chainId, addrA, router, amountAWei);
          await approveIfNeeded(chainId, addrB, router, amountBWei);
          seedHash = (await sendWrite({
            chainId, to: router, abi: TIWI_LIQUIDITY_ROUTER_ABI, functionName: 'addLiquidity',
            args: [addrA, addrB, amountAWei, amountBWei, 0n, 0n, feeBps, to, deadline()],
          })).hash;
          pairAddress = (await getLiquidityPublicClient(chainId).readContract({
            address: factory, abi: TIWI_LIQUIDITY_FACTORY_ABI, functionName: 'pairFor', args: [addrA, addrB, feeBps],
          })) as Address;
        }
      } else {
        // ── Router-less path ──
        // 1. wrap native side up-front
        if (aNative) await sendWrite({ chainId, to: wrapped, abi: WRAPPED_NATIVE_ABI, functionName: 'deposit', args: [], value: amountAWei });
        if (bNative) await sendWrite({ chainId, to: wrapped, abi: WRAPPED_NATIVE_ABI, functionName: 'deposit', args: [], value: amountBWei });

        // 2. resolve / create the pair
        let pair = (await getLiquidityPublicClient(chainId).readContract({
          address: factory, abi: TIWI_LIQUIDITY_FACTORY_ABI, functionName: 'pairFor', args: [addrA, addrB, feeBps],
        })) as Address;
        if (isZeroOrNative(pair)) {
          await sendWrite({ chainId, to: factory, abi: TIWI_LIQUIDITY_FACTORY_ABI, functionName: 'createPair', args: [addrA, addrB, feeBps] });
          pair = (await getLiquidityPublicClient(chainId).readContract({
            address: factory, abi: TIWI_LIQUIDITY_FACTORY_ABI, functionName: 'pairFor', args: [addrA, addrB, feeBps],
          })) as Address;
        }

        // 3. sort amounts into token0/token1 order and seed
        const aIsToken0 = addrA.toLowerCase() < addrB.toLowerCase();
        const amount0 = aIsToken0 ? amountAWei : amountBWei;
        const amount1 = aIsToken0 ? amountBWei : amountAWei;
        await approveIfNeeded(chainId, aIsToken0 ? addrA : addrB, pair, amount0);
        await approveIfNeeded(chainId, aIsToken0 ? addrB : addrA, pair, amount1);
        seedHash = (await sendWrite({
          chainId, to: pair, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'addLiquidity',
          args: [amount0, amount1, 0n, 0n, to, deadline()],
        })).hash;
        pairAddress = pair;
      }

      // Read minted LP balance
      let lpTokens = '0';
      try {
        const bal = (await getLiquidityPublicClient(chainId).readContract({
          address: pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'balanceOf', args: [to],
        })) as bigint;
        lpTokens = formatUnits(bal, 18);
      } catch { /* best-effort */ }

      return { pairAddress, factoryAddress: factory, txHash: seedHash, lpTokens };
    } catch (e: any) {
      setError(e?.message || 'Failed to create pool');
      throw e;
    } finally {
      setIsPending(false);
    }
  }, [activeAddress, approveIfNeeded, sendWrite]);

  const removeLiquidityOnChain = useCallback(async (params: { chainId: number; pairAddress: Address; liquidity: string }) => {
    setError(null); setIsPending(true);
    try {
      if (!activeAddress) throw new Error('Wallet not connected');
      const liquidityWei = parseUnits(params.liquidity, 18);
      const { hash } = await sendWrite({
        chainId: params.chainId, to: params.pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI,
        functionName: 'removeLiquidity', args: [liquidityWei, 0n, 0n, activeAddress as Address, deadline()],
      });
      return { txHash: hash };
    } catch (e: any) {
      setError(e?.message || 'Failed to remove liquidity');
      throw e;
    } finally { setIsPending(false); }
  }, [activeAddress, sendWrite]);

  const claimCreatorFeesOnChain = useCallback(async (params: { pairAddress: Address; chainId: number }) => {
    setError(null); setIsPending(true);
    try {
      const { hash } = await sendWrite({ chainId: params.chainId, to: params.pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'claimCreatorFees', args: [] });
      return { txHash: hash };
    } catch (e: any) { setError(e?.message || 'Failed to claim'); throw e; }
    finally { setIsPending(false); }
  }, [sendWrite]);

  const claimPlatformFeesOnChain = useCallback(async (params: { pairAddress: Address; chainId: number }) => {
    setError(null); setIsPending(true);
    try {
      const { hash } = await sendWrite({ chainId: params.chainId, to: params.pairAddress, abi: TIWI_LIQUIDITY_PAIR_ABI, functionName: 'claimPlatformFees', args: [] });
      return { txHash: hash };
    } catch (e: any) { setError(e?.message || 'Failed to claim'); throw e; }
    finally { setIsPending(false); }
  }, [sendWrite]);

  return {
    createPoolOnChain,
    removeLiquidityOnChain,
    claimCreatorFeesOnChain,
    claimPlatformFeesOnChain,
    readPoolFees,
    readPairOnChain,
    isPending,
    error,
  };
}
