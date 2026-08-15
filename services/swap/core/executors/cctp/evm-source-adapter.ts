/**
 * EVM CCTP source adapter - approve USDC → TokenMessengerV2, then depositForBurn.
 *
 * This is the 'evm' implementation of CctpSourceAdapter. It is a faithful extraction of the burn
 * half that used to live inline in tiwi-cctp-executor.ts; behavior is unchanged. Non-EVM source
 * adapters (svm/cosmos/…) implement the same interface with their own signer + burn instruction.
 */
import { encodeFunctionData, getAddress, type Address, type Hex } from 'viem';
import type { CctpSourceAdapter, CctpSourceBurnParams } from '@/services/swap/core/contracts/cctp-adapters';
import { getCctpChain, TOKEN_MESSENGER_V2_ABI, CCTP_GAS_LIMIT } from '@/services/swap/core/contracts/cctp';
import { getEVMWalletClient, getEVMPublicClient, ensureCorrectChain } from '../../utils/wallet-helpers';
import { ensureTokenApproval } from '../../services/approval-handler';

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

export const evmCctpSourceAdapter: CctpSourceAdapter = {
  vm: 'evm',

  async burn(p: CctpSourceBurnParams): Promise<{ srcTxHash: string; receipt?: unknown }> {
    const { fromChainId, userAddress, usdcAmount, destDomain, mintRecipientBytes32, maxFee, minFinality, walletClient, onStatusUpdate } = p;
    const src = getCctpChain(fromChainId);
    if (!src?.tokenMessenger) throw new Error(`No CCTP TokenMessenger for chain ${fromChainId}`);

    const wallet = walletClient || (await getEVMWalletClient(fromChainId));
    await ensureCorrectChain(fromChainId);
    const publicClient = getEVMPublicClient(fromChainId);
    const usdcAddr = getAddress(src.usdc) as Address;
    const user = getAddress(userAddress) as Address;

    // Approve USDC → TokenMessengerV2 (one-time if allowance already covers it).
    onStatusUpdate?.({ stage: 'approving', message: 'Approving USDC for the bridge...' });
    await ensureTokenApproval(
      usdcAddr, userAddress, src.tokenMessenger, usdcAmount.toString(), fromChainId,
      (m: string) => onStatusUpdate?.({ stage: 'approving', message: m }), wallet,
    );

    // depositForBurn - burns USDC here; Circle mints it to mintRecipient (the relayer) on dest.
    onStatusUpdate?.({ stage: 'signing', message: 'Confirming the cross-chain transfer in your wallet...' });
    const data = encodeFunctionData({
      abi: TOKEN_MESSENGER_V2_ABI,
      functionName: 'depositForBurn',
      args: [
        usdcAmount,
        destDomain,
        mintRecipientBytes32,
        usdcAddr,
        ZERO_BYTES32,          // destinationCaller = anyone (the relayer)
        maxFee,
        minFinality,
      ],
    }) as Hex;

    const srcTxHash = await wallet.sendTransaction({
      account: wallet.account ?? user,
      chain: wallet.chain,
      to: getAddress(src.tokenMessenger),
      data,
      gas: CCTP_GAS_LIMIT,
    } as any);

    onStatusUpdate?.({ stage: 'confirming', message: 'Confirming burn on the source chain...', txHash: srcTxHash });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: srcTxHash, timeout: 120_000 });
    if (receipt.status !== 'success') throw new Error('depositForBurn reverted');

    return { srcTxHash, receipt };
  },
};
