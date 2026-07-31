
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';
import { getCosmosWallet, getEVMWalletClient } from '../utils/wallet-helpers';
import { SigningStargateClient } from '@cosmjs/stargate';

/**
 * Squid executor implementation (Cosmos & Cross-chain)
 */
export class SquidExecutor implements SwapRouterExecutor {
    /**
     * Check if this executor can handle the given route
     */
    canHandle(route: RouterRoute): boolean {
        // ONLY real Squid routes. The old `|| chainId === 118` catch-all pre-dates
        // the Skip integration and wrongly grabbed Cosmos (ATOM/OSMO/…) routes
        // built by the `skip` router — which carry `raw.operations`, not the
        // Squid-shaped `raw.transaction.messages` this executor reads. That made
        // executeCosmosTrade sign an EMPTY message set (Keplr: "0 Messages"),
        // and the chain rejected it with code 18 "must contain at least one
        // message". Skip routes now fall through to SkipExecutor as intended.
        return route.router === 'squid';
    }

    /**
     * Get the spender address for token approval if needed
     */
    async getSpenderAddress(route: RouterRoute): Promise<string | null> {
        if (route.router !== 'squid') return null;

        const trade = route.raw;
        if (!trade) return null;

        // For Squid, the spender is usually the target of the swap transaction
        const txData = trade.transaction || trade.tx;
        return txData?.to || null;
    }

    /**
     * Execute a swap using Squid
     */
    async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, userAddress, onStatusUpdate, walletClient } = params;

        try {
            if (!userAddress) {
                throw new SwapExecutionError('User address is required', SwapErrorCode.WALLET_NOT_CONNECTED, 'squid');
            }

            onStatusUpdate?.({ stage: 'preparing', message: 'Preparing...' });

            const trade = route.raw;
            if (!trade) {
                throw new SwapExecutionError('Trade data missing', SwapErrorCode.INVALID_ROUTE, 'squid');
            }

            // Determine if starting on EVM or Cosmos
            const fromChainId = route.fromToken.chainId;
            const isFromCosmos = fromChainId === 118;

            if (isFromCosmos) {
                return this.executeCosmosTrade(params);
            } else {
                return this.executeEVMTrade(params);
            }

        } catch (error) {
            console.error('[SquidExecutor] Execution error:', error);
            const swapError = createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'squid');
            onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(swapError), error: swapError });
            throw swapError;
        }
    }

    /**
     * Execute EVM -> Cosmos/EVM trade
     */
    private async executeEVMTrade(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, userAddress, onStatusUpdate, walletClient } = params;
        const trade = route.raw;

        if (!walletClient) {
            throw new SwapExecutionError('Wallet client is required for execution', SwapErrorCode.WALLET_NOT_CONNECTED, 'squid');
        }

        const chainId = route.fromToken.chainId;

        // Ensure wallet is on the correct chain
        const { ensureCorrectChain } = await import('../utils/wallet-helpers');
        await ensureCorrectChain(chainId);

        // Collect tax before swap
        const { collectEvmTax } = await import('../utils/evm-tax-helper');
        const { taxCollected, taxAmount } = await collectEvmTax(params, 'SquidExecutor', onStatusUpdate);
        if (taxCollected) {
            console.log(`[SquidExecutor] Tax of ${taxAmount} collected`);
        }

        onStatusUpdate?.({ stage: 'signing', message: 'Approve Now' });

        // Squid EVM transaction data
        const txData = trade.transaction || trade.tx;

        const hash = await walletClient.sendTransaction({
            account: userAddress as `0x${string}`,
            to: txData.to as `0x${string}`,
            data: txData.data as `0x${string}`,
            value: txData.value ? BigInt(txData.value) : BigInt(0),
        });

        onStatusUpdate?.({
            stage: 'confirming',
            message: 'Reviewing...',
            txHash: hash
        });

        return {
            success: true,
            txHash: hash,
            txHashes: [hash],
        };
    }

    /**
     * Execute Cosmos -> EVM/Cosmos trade
     */
    private async executeCosmosTrade(params: SwapExecutionParams): Promise<SwapExecutionResult> {
        const { route, userAddress, onStatusUpdate } = params;
        const trade = route.raw;

        try {
            onStatusUpdate?.({ stage: 'preparing', message: 'Connecting to Cosmos wallet...' });

            const keplr = await getCosmosWallet();
            const chainId = route.fromToken.chainId === 118 ? 'cosmoshub-4' : (trade.fromChain?.providerId || 'cosmoshub-4');

            onStatusUpdate?.({ stage: 'signing', message: 'Please sign the Cosmos transaction...' });

            // Get offline signer from Keplr/Leap
            const offlineSigner = (window as any).getOfflineSigner(chainId);
            const rpcUrl = "https://cosmos-rpc.publicnode.com"; // Should ideally come from config

            const client = await SigningStargateClient.connectWithSigner(rpcUrl, offlineSigner);

            // Squid Cosmos transactions are typically returned as ready-to-sign messages
            const messages = trade.transaction?.messages || [];
            const fee = trade.transaction?.fee || { amount: [], gas: "200000" };
            const memo = trade.transaction?.memo || "Swap via TIWI Squid";

            const result = await client.signAndBroadcast(userAddress, messages, fee, memo);

            if (result.code !== 0) {
                throw new Error(`Cosmos transaction failed: ${result.rawLog}`);
            }

            onStatusUpdate?.({ stage: 'completed', message: 'Cosmos swap successful', txHash: result.transactionHash });

            return {
                success: true,
                txHash: result.transactionHash,
            };
        } catch (error: any) {
            throw createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'squid-cosmos');
        }
    }
}
