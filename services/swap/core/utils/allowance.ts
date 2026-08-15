/**
 * Allowance utilities - React Native port of lib/wallet/utils/allowance.ts.
 *
 * Reads go through the swap engine's own cached public clients so an allowance
 * check works on every registry chain, not just the six the app's constants/rpc
 * file knows about.
 */

import { encodeFunctionData, parseAbi, type Address } from 'viem';
import { getCachedPublicClient } from '@/services/swap/core/platform/viem-clients';

const ERC20_ABI = parseAbi([
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
]);

const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

const NATIVE_ADDRESSES = new Set([
    '0x0000000000000000000000000000000000000000',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

export function isNativeToken(address?: string): boolean {
    if (!address) return true;
    return NATIVE_ADDRESSES.has(address.toLowerCase());
}

/** Current ERC-20 allowance. Native tokens report max (they need no approval). */
export async function getAllowance(
    chainId: number,
    tokenAddress: string,
    owner: string,
    spender: string,
): Promise<bigint> {
    if (isNativeToken(tokenAddress)) return MAX_UINT256;

    const publicClient = getCachedPublicClient(chainId);
    return (await publicClient.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner as Address, spender as Address],
    })) as bigint;
}

/** Submit an ERC-20 approve with the caller's wallet client. */
export async function approveToken(
    walletClient: any,
    tokenAddress: string,
    spender: string,
    amount: bigint,
): Promise<`0x${string}`> {
    if (isNativeToken(tokenAddress)) {
        throw new Error('Native tokens do not need approval');
    }

    const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender as Address, amount],
    });

    return (await walletClient.sendTransaction({
        to: tokenAddress as `0x${string}`,
        data,
    })) as `0x${string}`;
}
