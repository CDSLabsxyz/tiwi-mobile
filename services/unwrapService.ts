/**
 * Unwrap service — turns a wrapped-native token back into the chain's native coin.
 *
 * EVM     : `withdraw(uint256)` on the WETH9-style wrapper. Simulated first so a
 *           mis-registered address in constants/wrappedNatives.ts fails loudly
 *           instead of burning gas.
 * Solana  : closing the wSOL associated token account returns its lamports to the
 *           owner. SPL has no partial-unwrap primitive, so Solana always unwraps
 *           the full balance — the UI states this explicitly.
 *
 * Signing goes through `signerController`, the same seam the liquidity hub and
 * send flow use, so hardware/biometric policy is applied consistently.
 */

import { WRAPPED_NATIVE_ABI } from '@/constants/abis-liquidity';
import { createTransportForChain } from '@/constants/rpc';
import type { WrappedNativeInfo } from '@/constants/wrappedNatives';
import { activityService } from '@/services/activityService';
import { signerController } from '@/services/signer/SignerController';
import { getRpcUrls } from '@/services/swap/core/config/rpc-config';
import {
  createPublicClient,
  encodeFunctionData,
  fallback,
  formatUnits,
  http,
  type Address,
  type PublicClient,
} from 'viem';

/** Minimal ERC20 read surface — only `balanceOf` is needed here. */
const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * A read client for any EVM chain in the registry. Deliberately does NOT set
 * viem's `batch` option — several endpoints in these lists return malformed
 * batch responses, which surface as empty `0x` reads with no failover.
 */
function getUnwrapPublicClient(chainId: number): PublicClient {
  const urls = getRpcUrls(chainId) ?? [];
  const transport = urls.length > 0
    ? fallback(urls.map((url) => http(url, { timeout: 8000, retryCount: 1 })), { retryCount: 2 })
    : createTransportForChain(chainId);
  return createPublicClient({ transport }) as PublicClient;
}

export interface UnwrapBalance {
  /** Raw base units (wei / lamports). */
  raw: bigint;
  /** Human-readable, full precision. */
  formatted: string;
}

/** On-chain balance of the wrapped token for `owner`. Returns zero on failure. */
export async function fetchWrappedBalance(
  info: WrappedNativeInfo,
  owner: string,
): Promise<UnwrapBalance> {
  if (!owner) return { raw: 0n, formatted: '0' };

  if (info.family === 'solana') {
    try {
      const { PublicKey } = await import('@solana/web3.js');
      const { getAssociatedTokenAddressSync, NATIVE_MINT } = await import('@solana/spl-token');
      const { getSolanaConnection } = await import('@/services/swap/core/utils/wallet-helpers');

      const connection = await getSolanaConnection();
      const ownerKey = new PublicKey(owner);
      const ata = getAssociatedTokenAddressSync(NATIVE_MINT, ownerKey, true);
      const res = await connection.getTokenAccountBalance(ata).catch(() => null);
      const raw = BigInt(res?.value?.amount ?? '0');
      return { raw, formatted: formatUnits(raw, info.decimals) };
    } catch {
      return { raw: 0n, formatted: '0' };
    }
  }

  try {
    const client = getUnwrapPublicClient(info.chainId);
    const raw = (await client.readContract({
      address: info.address as Address,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [owner as Address],
    })) as bigint;
    return { raw, formatted: formatUnits(raw, info.decimals) };
  } catch {
    return { raw: 0n, formatted: '0' };
  }
}

export interface UnwrapResult {
  hash: string;
  /** Base units actually unwrapped (Solana always unwraps the full balance). */
  amount: bigint;
}

/**
 * Unwrap `amount` base units of `info` held by `owner` into the native coin.
 * Throws with a user-presentable message on any failure.
 */
export async function unwrapToNative(params: {
  info: WrappedNativeInfo;
  owner: string;
  /** Ignored on Solana, which can only unwrap the full account balance. */
  amount: bigint;
}): Promise<UnwrapResult> {
  const { info, owner } = params;
  if (!owner) throw new Error('No wallet address available for this chain.');
  if (params.amount <= 0n) throw new Error('Enter an amount to unwrap.');

  const result = info.family === 'solana'
    ? await unwrapSolana(info, owner)
    : await unwrapEvm(info, owner, params.amount);

  // Best-effort activity log — never let a logging failure mask a good tx.
  activityService
    .logTransaction(
      owner,
      'swap',
      `Unwrapped ${info.wrappedSymbol}`,
      `${formatUnits(result.amount, info.decimals)} ${info.wrappedSymbol} → ${info.nativeSymbol}`,
      result.hash,
      {
        symbol: info.nativeSymbol,
        amount: formatUnits(result.amount, info.decimals),
        chainId: info.chainId,
        tokenAddress: info.address,
        fromSymbol: info.wrappedSymbol,
        toSymbol: info.nativeSymbol,
        kind: 'unwrap',
      },
    )
    .catch(() => undefined);

  return result;
}

async function unwrapEvm(
  info: WrappedNativeInfo,
  owner: string,
  amount: bigint,
): Promise<UnwrapResult> {
  const client = getUnwrapPublicClient(info.chainId);

  // Catch a bad registry entry / insufficient balance before asking the user
  // to sign anything.
  try {
    await client.simulateContract({
      account: owner as Address,
      address: info.address as Address,
      abi: WRAPPED_NATIVE_ABI,
      functionName: 'withdraw',
      args: [amount],
    });
  } catch (e: any) {
    const detail = e?.shortMessage || e?.message || '';
    throw new Error(
      `Unable to unwrap ${info.wrappedSymbol}. ${detail || 'The token rejected the withdrawal.'}`,
    );
  }

  const data = encodeFunctionData({
    abi: WRAPPED_NATIVE_ABI,
    functionName: 'withdraw',
    args: [amount],
  });

  const res = await signerController.executeTransaction(
    { chainFamily: 'evm', to: info.address, data, value: '0', chainId: info.chainId },
    owner,
  );
  if (res.status !== 'success' || !res.hash) {
    throw new Error(res.error || 'Unwrap transaction failed.');
  }

  // A broadcast is not a success — a revert here would otherwise be reported
  // as "unwrapped".
  const receipt = await client
    .waitForTransactionReceipt({ hash: res.hash as `0x${string}`, timeout: 90_000 })
    .catch(() => null);
  if (receipt && receipt.status === 'reverted') {
    throw new Error('Unwrap transaction reverted on-chain.');
  }

  return { hash: res.hash, amount };
}

async function unwrapSolana(info: WrappedNativeInfo, owner: string): Promise<UnwrapResult> {
  const { PublicKey, Transaction } = await import('@solana/web3.js');
  const { createCloseAccountInstruction, getAssociatedTokenAddressSync, NATIVE_MINT } =
    await import('@solana/spl-token');
  const { getSolanaConnection } = await import('@/services/swap/core/utils/wallet-helpers');

  const connection = await getSolanaConnection();
  const ownerKey = new PublicKey(owner);
  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, ownerKey, true);

  const account = await connection.getTokenAccountBalance(ata).catch(() => null);
  const amount = BigInt(account?.value?.amount ?? '0');
  if (amount <= 0n) throw new Error('No WSOL balance to unwrap.');

  const tx = new Transaction().add(
    // Closing the account credits its full lamport balance (rent + wrapped
    // SOL) back to the owner — this is how wSOL is unwrapped.
    createCloseAccountInstruction(ata, ownerKey, ownerKey),
  );
  tx.feePayer = ownerKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  const serialized = tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString('base64');

  const res = await signerController.executeTransaction(
    { chainFamily: 'solana', to: info.address, data: serialized, chainId: info.chainId },
    owner,
  );
  if (res.status !== 'success' || !res.hash) {
    throw new Error(res.error || 'Unwrap transaction failed.');
  }

  return { hash: res.hash, amount };
}
