/**
 * Cetus Swap Executor — Sui same-chain swaps.
 *
 * Executes `router: 'cetus'` routes on Sui (chainId 101). The quote adapter
 * (lib/backend/routers/adapters/cetus-adapter.ts) only prices the swap; the
 * signable transaction is built HERE with the Cetus aggregator SDK, then signed
 * by whichever wallet controls the Sui address:
 *
 *   • Internal (seed-phrase) wallet — params.walletClient carries an ed25519
 *     keypair (see internal-sui-signer.ts). We sign+submit via @mysten/sui's
 *     SuiClient.
 *   • External Sui wallet (Slush/Suiet/…) — params.walletClient is absent; we
 *     re-discover the Wallet-Standard wallet and drive its
 *     sui:signAndExecuteTransaction feature (see external-sui-wallet.ts).
 *
 * The SDK's `fastRouterSwap` selects the user's input coins, performs the multi-
 * DEX swap (DeepBook/Aftermath/Turbos/Kriya/FlowX), and routes the output back
 * to the signer — all in a single PTB.
 */

import { parseUnits } from 'viem';
// The Cetus aggregator SDK is built on @mysten/sui v2, while the rest of the app
// uses v1. We MUST build/sign the Cetus transaction with the same v2 copy the SDK
// expects, or the Transaction types are incompatible. `@mysten/sui-v2` is an npm
// alias to that exact v2 build; it's used ONLY in the Cetus swap flow.
import type { Ed25519Keypair } from '@mysten/sui-v2/keypairs/ed25519';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';

const SUI_CANONICAL_CHAIN_ID = 101;
const SUI_NATIVE_COIN_TYPE = '0x2::sui::SUI';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Shape the internal-wallet path passes as `walletClient`. */
interface InternalSuiWalletClient {
  suiKeypair: Ed25519Keypair;
  suiAddress: string;
}

function isInternalSuiWalletClient(wc: unknown): wc is InternalSuiWalletClient {
  return !!wc && typeof wc === 'object' && 'suiKeypair' in wc && 'suiAddress' in wc;
}

/** Map the app's token address to a Sui Move coin type. Native → 0x2::sui::SUI. */
function toSuiCoinType(address: string | undefined): string {
  const a = (address || '').toLowerCase();
  if (!a || a === 'native' || a === ZERO_ADDRESS || a === '0x2' || a === '0x2::sui::sui') {
    return SUI_NATIVE_COIN_TYPE;
  }
  return address as string;
}

export class CetusExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    return route.router === 'cetus';
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, fromToken, fromAmount, userAddress, walletClient, onStatusUpdate } = params;

    try {
      if (route.router !== 'cetus') {
        throw new SwapExecutionError('Invalid route provided', SwapErrorCode.INVALID_ROUTE, 'cetus');
      }
      if ((route.fromToken.chainId ?? SUI_CANONICAL_CHAIN_ID) !== SUI_CANONICAL_CHAIN_ID) {
        throw new SwapExecutionError('Cetus only executes Sui (chainId 101) swaps', SwapErrorCode.INVALID_ROUTE, 'cetus');
      }

      const suiAddress = isInternalSuiWalletClient(walletClient) ? walletClient.suiAddress : userAddress;
      if (!suiAddress) {
        throw new SwapExecutionError('No Sui wallet address available', SwapErrorCode.WALLET_NOT_CONNECTED, 'cetus');
      }

      onStatusUpdate?.({ stage: 'preparing', message: 'Building Sui swap...' });

      // Coin types + input amount (smallest units).
      const from = toSuiCoinType(route.fromToken.address);
      const target = toSuiCoinType(route.toToken.address);
      const fromDecimals = route.fromToken.decimals ?? fromToken?.decimals ?? 9;
      const amountRaw = parseUnits(fromAmount, fromDecimals).toString();

      // Slippage as a fraction (0.01 = 1%). App carries percent (route.slippage / params.slippage).
      const slippagePct =
        typeof params.slippage === 'number'
          ? params.slippage
          : parseFloat(route.slippage || '1');
      const slippage = Math.min(Math.max(isFinite(slippagePct) ? slippagePct : 1, 0.05), 50) / 100;

      // Build the swap PTB via the Cetus aggregator SDK (dynamically imported —
      // it's a heavy Sui/gRPC dependency we keep out of the main bundle).
      const { AggregatorClient, Env } = await import('@cetusprotocol/aggregator-sdk');
      const { Transaction } = await import('@mysten/sui-v2/transactions');

      const client = new AggregatorClient({ signer: suiAddress, env: Env.Mainnet });

      const routerData = await client.findRouters({ from, target, amount: amountRaw, byAmountIn: true });
      if (
        !routerData ||
        routerData.error ||
        routerData.insufficientLiquidity ||
        !routerData.paths ||
        routerData.paths.length === 0
      ) {
        throw new SwapExecutionError(
          'No live Sui route available for this pair right now. Please try again.',
          SwapErrorCode.INVALID_ROUTE,
          'cetus',
        );
      }

      const txb = new Transaction();
      txb.setSender(suiAddress);
      await client.fastRouterSwap({ router: routerData, txb: txb as any, slippage });

      // fastRouterSwap builds the PTB with CoinWithBalance INTENTS, which can't be
      // serialized without a Sui client — an external wallet calls toJSON() with no
      // client and fails ("Client must be provided ... CoinWithBalance intents").
      // Resolve the intents against a client here (this does NOT select gas, so it
      // works for any funded wallet), producing a plain Transaction both the
      // internal signer and external wallets can serialize + sign; each selects
      // its own gas. v2 renamed the JSON-RPC client → SuiJsonRpcClient and
      // getFullnodeUrl → getJsonRpcFullnodeUrl.
      const { SuiJsonRpcClient, getJsonRpcFullnodeUrl } = await import('@mysten/sui-v2/jsonRpc');
      const suiClient = new SuiJsonRpcClient({ network: 'mainnet', url: getJsonRpcFullnodeUrl('mainnet') });
      const resolvedTx = Transaction.from(await txb.toJSON({ client: suiClient }));

      // Sign + submit through the controlling wallet.
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

      onStatusUpdate?.({ stage: 'completed', message: 'Success', txHash: digest });

      return {
        success: true,
        txHash: digest,
        actualToAmount: route.toToken.amount,
      };
    } catch (error) {
      const swapError = createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'cetus');
      onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(swapError), error: swapError });
      throw swapError;
    }
  }
}
