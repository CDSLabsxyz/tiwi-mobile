/**
 * Mayan Sui Cross-Chain Executor.
 *
 * Executes `router: 'mayan'` routes whose SOURCE is Sui (chainId 101): native SUI
 * (or any Sui coin) → a token on a CCTP destination chain (Ethereum, Arbitrum,
 * Base, Optimism, Polygon, Avalanche, Solana), in ONE Sui signature. Mayan's MCTP
 * protocol + relayer settle the destination side; the user only signs on Sui.
 *
 * Flow: fetchQuote (fresh) → createSwapFromSuiMoveCalls builds the Sui PTB →
 * resolve intents against a client → sign+submit with the internal keypair
 * (internal-sui-signer) or the external Sui wallet (external-sui-wallet). Mirrors
 * the Cetus executor's signing; the only difference is where the tx comes from.
 *
 * BSC is NOT reachable here (excluded from CCTP) — that pair is served by the
 * Allbridge rail.
 */

import { parseUnits } from 'viem';
import type { Ed25519Keypair } from '@mysten/sui-v2/keypairs/ed25519';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';

const SUI_CANONICAL_CHAIN_ID = 101;
const SUI_NATIVE_COIN_TYPE = '0x2::sui::SUI';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Canonical chainId → Mayan chain name (destinations Mayan MCTP can settle from Sui).
const CANONICAL_TO_MAYAN_CHAIN: Record<number, string> = {
  1: 'ethereum',
  42161: 'arbitrum',
  10: 'optimism',
  137: 'polygon',
  8453: 'base',
  43114: 'avalanche',
  7565164: 'solana',
};

interface InternalSuiWalletClient {
  suiKeypair: Ed25519Keypair;
  suiAddress: string;
}
function isInternalSuiWalletClient(wc: unknown): wc is InternalSuiWalletClient {
  return !!wc && typeof wc === 'object' && 'suiKeypair' in wc && 'suiAddress' in wc;
}

function toSuiCoinType(address: string | undefined): string {
  const a = (address || '').toLowerCase();
  if (!a || a === 'native' || a === ZERO_ADDRESS || a === '0x2' || a === '0x2::sui::sui') return SUI_NATIVE_COIN_TYPE;
  return address as string;
}

export class MayanSuiExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    return route.router === 'mayan' && (route.fromToken.chainId ?? 0) === SUI_CANONICAL_CHAIN_ID;
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, fromAmount, userAddress, recipientAddress, walletClient, onStatusUpdate } = params;

    try {
      const suiAddress = isInternalSuiWalletClient(walletClient) ? walletClient.suiAddress : userAddress;
      if (!suiAddress) {
        throw new SwapExecutionError('No Sui wallet address available', SwapErrorCode.WALLET_NOT_CONNECTED, 'mayan');
      }
      // Cross-chain: the destination recipient (EVM/Solana address) is required.
      const destinationAddress = recipientAddress;
      if (!destinationAddress) {
        throw new SwapExecutionError(
          'A destination address is required for a cross-chain Sui swap.',
          SwapErrorCode.INVALID_ROUTE,
          'mayan',
        );
      }

      const toChain = CANONICAL_TO_MAYAN_CHAIN[Number(route.toToken.chainId)];
      if (!toChain) {
        throw new SwapExecutionError(
          'This destination chain is not supported by Mayan from Sui.',
          SwapErrorCode.INVALID_ROUTE,
          'mayan',
        );
      }

      onStatusUpdate?.({ stage: 'preparing', message: 'Building cross-chain swap...' });

      const from = toSuiCoinType(route.fromToken.address);
      const toToken = route.toToken.address || ZERO_ADDRESS;
      const fromDecimals = route.fromToken.decimals ?? fromToken?.decimals ?? 9;
      const amountIn64 = parseUnits(fromAmount, fromDecimals).toString();
      const slippagePct = typeof params.slippage === 'number' ? params.slippage : parseFloat(route.slippage || '1');
      const slippageBps = Math.max(50, Math.round((isFinite(slippagePct) ? slippagePct : 1) * 100));

      // Fresh quote + Sui PTB from the Mayan SDK.
      const mayan = await import('@mayanfinance/swap-sdk');
      const quotes = await mayan.fetchQuote(
        { amountIn64, fromToken: from, fromChain: 'sui', toToken, toChain: toChain as never, slippageBps },
        { mctp: true, swift: true, fastMctp: false },
      );
      const quote = Array.isArray(quotes) ? quotes[0] : null;
      if (!quote) {
        throw new SwapExecutionError('Mayan route expired or unavailable. Please try again.', SwapErrorCode.QUOTE_EXPIRED, 'mayan');
      }

      const { SuiJsonRpcClient, getJsonRpcFullnodeUrl } = await import('@mysten/sui-v2/jsonRpc');
      const { Transaction } = await import('@mysten/sui-v2/transactions');
      const suiClient = new SuiJsonRpcClient({ network: 'mainnet', url: getJsonRpcFullnodeUrl('mainnet') });

      // Build the Sui transaction (queries the user's coins; needs a funded wallet).
      const builtTx = await mayan.createSwapFromSuiMoveCalls(
        quote,
        suiAddress,
        destinationAddress,
        null,
        null,
        suiClient as never,
      );
      // Resolve any intents into a client-independent Transaction (same as Cetus).
      const resolvedTx = Transaction.from(await builtTx.toJSON({ client: suiClient as any }));

      let digest: string;
      if (isInternalSuiWalletClient(walletClient)) {
        onStatusUpdate?.({ stage: 'submitting', message: 'Submitting...' });
        const res = await suiClient.signAndExecuteTransaction({
          signer: walletClient.suiKeypair,
          transaction: resolvedTx,
          options: { showEffects: true },
        });
        const status = res.effects?.status?.status;
        if (status && status !== 'success') {
          throw new Error(`Sui swap failed: ${res.effects?.status?.error || status}`);
        }
        digest = res.digest;
      } else {
        onStatusUpdate?.({ stage: 'signing', message: 'Approve in your Sui wallet...' });
        const { getExternalSuiSigner } = await import('@/services/swap/core/platform/external-sui-wallet');
        const signer = await getExternalSuiSigner(suiAddress);
        digest = await (signer as any).signAndExecute(resolvedTx);
      }

      onStatusUpdate?.({
        stage: 'completed',
        message: 'Sui side submitted — Mayan is delivering on the destination chain.',
        txHash: digest,
      });

      return { success: true, txHash: digest, actualToAmount: route.toToken.amount };
    } catch (error) {
      const swapError = createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'mayan');
      onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(swapError), error: swapError });
      throw swapError;
    }
  }
}
