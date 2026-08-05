/**
 * Unwrap service — turns a wrapped-native token back into the chain's native coin.
 *
 * EVM     : `withdraw(uint256)` on the WETH9-style wrapper. Simulated first so a
 *           mis-registered address in constants/wrappedNatives.ts fails loudly
 *           instead of burning gas.
 * Solana  : closing the wSOL associated token account returns its lamports to the
 *           owner. SPL has no partial-unwrap instruction, so a partial amount is
 *           expressed as one atomic transaction: close the account (everything
 *           becomes SOL), recreate it, and re-wrap the remainder with
 *           `syncNative`. The account rent is returned by the close and paid
 *           straight back into the new account, so it nets out to the fee.
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
  /** Base units actually unwrapped. */
  amount: bigint;
}

/**
 * Unwrap `amount` base units of `info` held by `owner` into the native coin.
 * Throws with a user-presentable message on any failure.
 */
export async function unwrapToNative(params: {
  info: WrappedNativeInfo;
  owner: string;
  amount: bigint;
}): Promise<UnwrapResult> {
  const { info, owner } = params;
  if (!owner) throw new Error('No wallet address available for this chain.');
  if (params.amount <= 0n) throw new Error('Enter an amount to unwrap.');

  const result = info.family === 'solana'
    ? await unwrapSolana(info, owner, params.amount)
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

async function unwrapSolana(
  info: WrappedNativeInfo,
  owner: string,
  requested: bigint,
): Promise<UnwrapResult> {
  const { PublicKey, SystemProgram, Transaction } = await import('@solana/web3.js');
  const {
    createAssociatedTokenAccountInstruction,
    createCloseAccountInstruction,
    createSyncNativeInstruction,
    getAssociatedTokenAddressSync,
    NATIVE_MINT,
  } = await import('@solana/spl-token');
  const { getSolanaConnection } = await import('@/services/swap/core/utils/wallet-helpers');

  const connection = await getSolanaConnection();
  const ownerKey = new PublicKey(owner);
  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, ownerKey, true);

  const [account, lamports] = await Promise.all([
    connection.getTokenAccountBalance(ata).catch(() => null),
    connection.getBalance(ownerKey).catch(() => null),
  ]);
  const balance = BigInt(account?.value?.amount ?? '0');
  if (balance <= 0n) throw new Error('No WSOL balance to unwrap.');
  if (requested > balance) throw new Error('Amount exceeds your WSOL balance.');

  // Closing the account still costs a network fee, and the fee payer is the
  // owner — a wallet holding only WSOL and zero SOL can't pay it. Preflight
  // would fail with a bare "simulation failed", so say what's actually wrong.
  if (lamports !== null && lamports < 5_000) {
    throw new Error(
      'Not enough SOL to pay the network fee. Closing the WSOL account costs about 0.000005 SOL — ' +
      'send a small amount of SOL to this wallet, then unwrap.',
    );
  }

  const amount = requested > 0n ? requested : balance;
  const remainder = balance - amount;

  const tx = new Transaction().add(
    // Closing the account credits its full lamport balance (rent + wrapped
    // SOL) back to the owner — this is how wSOL is unwrapped.
    createCloseAccountInstruction(ata, ownerKey, ownerKey),
  );

  // Partial unwrap: SPL has no "withdraw part of a wrapped balance", so put the
  // remainder back. Recreating the ATA costs the same rent the close just
  // returned, and `syncNative` is what makes the transferred lamports show up as
  // a token balance. All in one transaction, so it can't half-apply.
  if (remainder > 0n) {
    tx.add(
      createAssociatedTokenAccountInstruction(ownerKey, ata, ownerKey, NATIVE_MINT),
      SystemProgram.transfer({
        fromPubkey: ownerKey,
        toPubkey: ata,
        lamports: remainder,
      }),
      createSyncNativeInstruction(ata),
    );
  }

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
