/**
 * Token Approval Handler
 * 
 * Handles ERC20 token approvals for EVM chains.
 * This service ensures tokens are approved before swap execution.
 */

import { getAddress, type Address } from 'viem';
import { type WalletClient, type PublicClient, encodeFunctionData } from 'viem';
import { erc20Abi } from 'viem';
import type { ApprovalInfo } from '../types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { getCachedPublicClient } from '@/services/swap/core/platform/viem-clients';
import { getEVMWalletClient } from '../utils/wallet-helpers';
import { getStandardApprovalAmount, MAX_UINT256 } from '../utils/approval-amounts';

/**
 * Check if token needs approval
 */
export async function checkTokenApproval(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  requiredAmount: string,
  chainId: number
): Promise<ApprovalInfo> {
  try {
    const publicClient = getCachedPublicClient(chainId);

    const tokenAddr = getAddress(tokenAddress) as Address;
    const ownerAddr = getAddress(ownerAddress) as Address;
    const spenderAddr = getAddress(spenderAddress) as Address;

    // Get current allowance
    const currentAllowance = await publicClient.readContract({
      address: tokenAddr,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [ownerAddr, spenderAddr],
    });

    const requiredAmountBigInt = BigInt(requiredAmount);
    const currentAllowanceBigInt = BigInt(currentAllowance.toString());

    return {
      tokenAddress: tokenAddr,
      spenderAddress: spenderAddr,
      amount: requiredAmount,
      currentAllowance: currentAllowance.toString(),
      needsApproval: currentAllowanceBigInt < requiredAmountBigInt,
    };
  } catch (error) {
    throw new SwapExecutionError(
      `Failed to check token approval: ${error instanceof Error ? error.message : 'Unknown error'}`,
      SwapErrorCode.NETWORK_ERROR
    );
  }
}

/**
 * Approve token spending
 * 
 * @param tokenAddress - Token contract address
 * @param spenderAddress - Address to approve (router contract)
 * @param amount - Amount to approve (use max approval if not specified)
 * @param chainId - Chain ID
 * @returns Transaction hash
 */
export async function approveToken(
  tokenAddress: string,
  spenderAddress: string,
  chainId: number,
  amount?: string,
  walletClient?: WalletClient
): Promise<string> {
  try {
    // On mobile there is no injected provider to fall back to — the local
    // signer is the only source of a wallet client.
    const client = walletClient || await getEVMWalletClient(chainId);

    const tokenAddr = getAddress(tokenAddress) as Address;
    const spenderAddr = getAddress(spenderAddress) as Address;

    // Standard policy: approve max/infinite so a (token, spender) pair is signed ONCE,
    // ever. The allowance is only *permission*; the actual amount moved by a swap is
    // bounded by the swap calldata (resolveSpendAmountWei), never by this allowance.
    // Callers may still pass an explicit `amount` (e.g. to reduce an existing allowance).
    const approvalAmount = amount || getStandardApprovalAmount().toString();

    // Encode approval function call
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [spenderAddr, BigInt(approvalAmount)],
    });

    // Send approval transaction
    // walletClient already has account bound from getWalletClientForChain
    const hash = await client.sendTransaction({
      to: tokenAddr,
      data,
    } as Parameters<typeof client.sendTransaction>[0]);

    return hash;
  } catch (error) {
    if (error instanceof SwapExecutionError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('rejected') || errorMessage.includes('User rejected')) {
      throw new SwapExecutionError(
        'Token approval was rejected',
        SwapErrorCode.APPROVAL_REJECTED
      );
    }

    throw new SwapExecutionError(
      `Failed to approve token: ${errorMessage}`,
      SwapErrorCode.NETWORK_ERROR
    );
  }
}

/**
 * Ensure token is approved (check and approve if needed)
 * 
 * @param tokenAddress - Token contract address
 * @param ownerAddress - Token owner address
 * @param spenderAddress - Address to approve (router contract)
 * @param requiredAmount - Required approval amount
 * @param chainId - Chain ID
 * @param onStatusUpdate - Optional status callback
 * @returns Transaction hash if approval was needed, null if already approved
 */
export async function ensureTokenApproval(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  requiredAmount: string,
  chainId: number,
  onStatusUpdate?: (message: string) => void,
  walletClient?: WalletClient
): Promise<string | null> {
  try {
    // Check current approval
    onStatusUpdate?.('Checking token approval...');
    const approvalInfo = await checkTokenApproval(
      tokenAddress,
      ownerAddress,
      spenderAddress,
      requiredAmount,
      chainId
    );

    if (!approvalInfo.needsApproval) {
      return null; // Already approved
    }

    // Approve max uint256 (infinite) so the user only signs an approval ONCE per
    // (token, spender) instead of re-approving on every swap. This is standard
    // practice (Uniswap etc.) and drastically cuts repeated signatures.
    onStatusUpdate?.('Approving token...');
    const txHash = await approveToken(
      tokenAddress,
      spenderAddress,
      chainId,
      MAX_UINT256.toString(),
      walletClient
    );

    // Wait for confirmation
    onStatusUpdate?.('Waiting for approval confirmation...');
    const publicClient = getCachedPublicClient(chainId);

    await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: 60000, // 60 seconds
    });

    onStatusUpdate?.('Token approved successfully');
    return txHash;
  } catch (error) {
    if (error instanceof SwapExecutionError) {
      throw error;
    }

    throw new SwapExecutionError(
      `Failed to ensure token approval: ${error instanceof Error ? error.message : 'Unknown error'}`,
      SwapErrorCode.NETWORK_ERROR
    );
  }
}

