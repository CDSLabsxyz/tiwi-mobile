import { executeRoute, convertQuoteToRoute, type RouteExtended, type LiFiStep, config, ChainType, getChains } from '@lifi/sdk';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';
import { shouldSkipSeparateTax } from '../utils/evm-tax-helper';
import { REVENUE_WALLETS, TAX_RATES, BASIS_POINTS } from '@/services/swap/core/config/tax-config';
import { createPublicClient, http, encodeFunctionData, parseUnits, formatUnits, type Address, type Chain } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, bsc, avalanche, fantom, gnosis, celo } from 'viem/chains';

// Tax rate for non-BSC chains: 0.25%
const TAX_RATE_BPS = TAX_RATES.DEFAULT;
const EVM_REVENUE_WALLET = REVENUE_WALLETS.evm as Address;

// Native token addresses
const NATIVE_TOKEN_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
];

function isNativeToken(address: string): boolean {
  if (!address) return true;
  return NATIVE_TOKEN_ADDRESSES.some(
    native => native.toLowerCase() === address.toLowerCase()
  );
}

// ERC20 ABI for transfer
const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// Chain configs - expanded for auto chain switching
const CHAIN_CONFIGS: Record<number, Chain> = {
  1: mainnet,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  8453: base,
  56: bsc,
  43114: avalanche,
  250: fantom,
  100: gnosis,
  42220: celo,
};

/**
 * LiFi executor implementation
 */
export class LiFiExecutor implements SwapRouterExecutor {
  /**
   * Check if this executor can handle the given route
   */
  canHandle(route: RouterRoute): boolean {
    return route.router === 'lifi';
  }

  /**
   * Get the spender address for token approval if needed
   */
  async getSpenderAddress(route: RouterRoute): Promise<string | null> {
    if (route.router !== 'lifi') return null;

    // LiFi SDK usually provides the spender in the action of the first step
    const raw = route.raw;
    if (raw && raw.steps && raw.steps.length > 0) {
      const firstStep = raw.steps[0];
      if (firstStep.action && firstStep.action.spender) {
        return firstStep.action.spender;
      }
    }

    // Fallback: check if raw is a LiFi step directly
    if (raw && raw.action && raw.action.spender) {
      return raw.action.spender;
    }

    return null;
  }

  /**
   * Switch wallet to the required chain
   * Prevents "[ProviderError] Chain switch required" errors from LI.FI SDK
   */
  private async ensureCorrectChain(
    requiredChainId: number,
    walletClient: any,
    onStatusUpdate?: (status: any) => void
  ): Promise<void> {
    let activeWallet = walletClient;
    if (!activeWallet) {
      const { getEVMWalletClient } = await import('../utils/wallet-helpers');
      activeWallet = await getEVMWalletClient(requiredChainId || 56);
    }

    try {
      // Get current chain from wallet
      const currentChainId = await activeWallet.getChainId();

      console.log('[LiFiExecutor] Chain check:', {
        currentChainId,
        requiredChainId,
        needsSwitch: currentChainId !== requiredChainId,
      });

      if (currentChainId === requiredChainId) {
        console.log('[LiFiExecutor] Already on correct chain');
        return;
      }

      // Get chain config for the required chain
      const targetChain = CHAIN_CONFIGS[requiredChainId];

      onStatusUpdate?.({
        stage: 'preparing',
        message: 'Switching...',
      });

      console.log('[LiFiExecutor] Switching chain to:', requiredChainId);

      // Use wallet_switchEthereumChain via the wallet client
      // If chain is not added, this will throw and we'll try to add it
      try {
        await activeWallet.switchChain({ id: requiredChainId });
        console.log('[LiFiExecutor] Chain switched successfully');
      } catch (switchError: any) {
        // Error code 4902 means chain not added to wallet
        if (switchError.code === 4902 && targetChain) {
          console.log('[LiFiExecutor] Chain not in wallet, adding it...');

          // Add the chain to the wallet
          await activeWallet.addChain({ chain: targetChain });

          // Try switching again
          await activeWallet.switchChain({ id: requiredChainId });
          console.log('[LiFiExecutor] Chain added and switched successfully');
        } else {
          throw switchError;
        }
      }

      // Wait a moment for the chain switch to propagate
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.error('[LiFiExecutor] Chain switch failed:', error.message);

      // If user rejected, throw a clear error
      if (error.code === 4001 || error.message?.includes('rejected')) {
        throw new SwapExecutionError(
          'Chain switch rejected. Please switch to the correct network to continue.',
          SwapErrorCode.USER_REJECTED,
          'lifi'
        );
      }

      // For other errors, throw with details
      throw new SwapExecutionError(
        `Failed to switch chain: ${error.message}`,
        SwapErrorCode.CHAIN_SWITCH_FAILED,
        'lifi'
      );
    }
  }

  /**
   * Collect tax before swap execution
   * Tax is ON TOP of swap amount - user swaps exact fromAmount
   * Total taken from wallet = fromAmount + taxAmount
   */
  private async collectTax(
    params: SwapExecutionParams,
    onStatusUpdate?: (status: any) => void
  ): Promise<{ taxCollected: boolean; taxAmount: string }> {
    const { route, fromToken, fromAmount, userAddress, walletClient } = params;
    const chainId = fromToken?.chainId || route.fromToken.chainId;

    // Skip when the fee is inline or this leg opted out (multi-leg charges tax once, on leg 1).
    if (shouldSkipSeparateTax(params)) {
      console.log('[LiFiExecutor] Skipping tax (inline fee or skipTax leg)');
      return { taxCollected: false, taxAmount: '0' };
    }

    // Skip tax for BSC (handled by relayer), Solana (handled separately), or if no wallet client
    if (chainId === 56 || chainId === 97 || chainId === 7565164 || !walletClient) {
      return { taxCollected: false, taxAmount: '0' };
    }

    // Skip tax for native token input (would need different handling)
    const fromTokenAddress = fromToken?.address || route.fromToken.address;
    if (isNativeToken(fromTokenAddress)) {
      console.log('[LiFiExecutor] Skipping tax for native token input');
      return { taxCollected: false, taxAmount: '0' };
    }

    try {
      const decimals = fromToken?.decimals || route.fromToken.decimals || 18;
      const fromAmountWei = parseUnits(fromAmount, decimals);
      const taxAmountWei = (fromAmountWei * BigInt(TAX_RATE_BPS)) / BigInt(BASIS_POINTS);

      if (taxAmountWei <= BigInt(0)) {
        return { taxCollected: false, taxAmount: '0' };
      }

      // Get public client using fallback transport
      const { getCachedPublicClient } = await import('@/services/swap/core/platform/viem-clients');
      const publicClient = getCachedPublicClient(chainId);

      // Check user has enough balance (swap amount + tax)
      const totalRequired = fromAmountWei + taxAmountWei;

      const ERC20_BALANCE_ABI = [
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ] as const;

      const userBalance = await publicClient.readContract({
        address: fromTokenAddress as Address,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [userAddress as Address],
      }) as bigint;

      const tokenSymbol = fromToken?.symbol || route.fromToken.symbol || 'tokens';

      if (userBalance < totalRequired) {
        throw new Error(
          `Insufficient ${tokenSymbol} balance. ` +
          `You need ${formatUnits(totalRequired, decimals)} (${fromAmount} swap + ${formatUnits(taxAmountWei, decimals)} tax) ` +
          `but only have ${formatUnits(userBalance, decimals)}`
        );
      }

      console.log('[LiFiExecutor] Collecting tax (ON TOP):', {
        swapAmount: fromAmount,
        taxAmount: formatUnits(taxAmountWei, decimals),
        totalFromWallet: formatUnits(totalRequired, decimals),
        taxRate: `${TAX_RATE_BPS / 100}%`,
        revenueWallet: EVM_REVENUE_WALLET,
      });

      onStatusUpdate?.({
        stage: 'preparing',
        message: 'Checking...',
      });

      // Transfer tax to revenue wallet
      const transferData = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [EVM_REVENUE_WALLET, taxAmountWei],
      });

      // Get chain config for the transaction
      const targetChain = CHAIN_CONFIGS[chainId];

      const taxTxHash = await walletClient.sendTransaction({
        to: fromTokenAddress as Address,
        data: transferData,
        chain: targetChain,
      });

      console.log('[LiFiExecutor] Tax transfer tx:', taxTxHash);

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({
        hash: taxTxHash,
        timeout: 30000,
      });

      console.log('[LiFiExecutor] Tax collected successfully');

      return {
        taxCollected: true,
        taxAmount: formatUnits(taxAmountWei, decimals),
      };
    } catch (error: any) {
      console.error('[LiFiExecutor] Tax collection failed:', error.message);
      // Re-throw balance errors
      if (error.message?.includes('Insufficient')) {
        throw error;
      }
      // Don't fail the swap if tax collection fails for other reasons - log and continue
      return { taxCollected: false, taxAmount: '0' };
    }
  }

  /**
   * Execute a swap using LiFi
   */
  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, userAddress, recipientAddress, onStatusUpdate } = params;

    try {
      if (route.router !== 'lifi') {
        throw new SwapExecutionError('Invalid route provided', SwapErrorCode.INVALID_ROUTE, 'lifi');
      }

      // CRITICAL CHECK: LiFiExecutor should NOT run on pure Solana-to-Solana swaps.
      // Same-chain Solana swaps should use JupiterExecutor.
      // However, CROSS-CHAIN swaps (EVM <-> Solana) ARE supported by LiFi.
      const fromChainId = route.fromToken?.chainId || params.fromToken?.chainId;
      const toChainId = route.toToken?.chainId || params.toToken?.chainId;
      const isSolanaToSolana = fromChainId === 7565164 && toChainId === 7565164;

      if (isSolanaToSolana) {
        throw new SwapExecutionError(
          'Same-chain Solana swaps must use Jupiter. Please refresh and try again.',
          SwapErrorCode.INVALID_ROUTE,
          'lifi'
        );
      }

      if (!userAddress) {
        throw new SwapExecutionError('User address is required', SwapErrorCode.WALLET_NOT_CONNECTED, 'lifi');
      }

      if (!route.raw || typeof route.raw !== 'object') {
        throw new SwapExecutionError('Route missing raw data', SwapErrorCode.INVALID_ROUTE, 'lifi');
      }

      // Ensure wallet is on the correct chain before executing
      // Skip chain switching for Solana (non-EVM) source chains
      const sourceChainId = route.fromToken?.chainId || params.fromToken?.chainId;
      const isSolanaSource = sourceChainId === 7565164;

      if (sourceChainId && !isSolanaSource) {
        await this.ensureCorrectChain(Number(sourceChainId), params.walletClient, onStatusUpdate);
      }

      // Collect tax before swap (0.25% to revenue wallet)
      const { taxCollected, taxAmount } = await this.collectTax(params, onStatusUpdate);
      if (taxCollected) {
        console.log(`[LiFiExecutor] Tax of ${taxAmount} collected`);
      }

      let lifiRoute: RouteExtended = this.convertToLiFiRoute(route.raw);
      const toAddress = recipientAddress || userAddress;

      // Ensure addresses are set in all steps
      if (lifiRoute.steps) {
        lifiRoute.steps.forEach((step) => {
          if (step.action) {
            (step.action as any).fromAddress = userAddress;
            if (!(step.action as any).toAddress) {
              (step.action as any).toAddress = toAddress;
            }
          }
        });
      }

      lifiRoute.fromAddress = userAddress;
      lifiRoute.toAddress = toAddress;

      onStatusUpdate?.({ stage: 'preparing', message: 'Preparing...' });

      console.log('[LiFiExecutor] Executing route:', {
        fromChain: lifiRoute.fromChainId,
        toChain: lifiRoute.toChainId,
        fromToken: lifiRoute.fromToken?.symbol,
        fromTokenAddress: lifiRoute.fromToken?.address,
        toToken: lifiRoute.toToken?.symbol,
        toTokenAddress: lifiRoute.toToken?.address,
        fromAmount: lifiRoute.fromAmount,
        fromAmountDecimals: lifiRoute.fromToken?.decimals,
        fromAddress: lifiRoute.fromAddress,
        toAddress: lifiRoute.toAddress,
        steps: lifiRoute.steps?.length || 0,
        isCrossChain: lifiRoute.fromChainId !== lifiRoute.toChainId,
      });

      // Log additional details for debugging balance issues
      console.log('[LiFiExecutor] Route raw data check:', {
        hasSteps: !!lifiRoute.steps?.length,
        firstStepAction: lifiRoute.steps?.[0]?.action,
        firstStepFromAmount: (lifiRoute.steps?.[0]?.action as any)?.fromAmount,
      });

      const executedRoute = await (executeRoute as any)(lifiRoute, {
        walletClient: params.walletClient, // Pass the specific wallet client
        updateRouteHook: (updatedRoute: RouteExtended) => {
          const latestStep = updatedRoute.steps[0];
          const latestProcess = latestStep?.execution?.process?.slice(-1)[0];

          if (latestProcess) {
            const status = latestProcess.status;
            const txHash = latestProcess.txHash;

            let stage: any = 'confirming';
            let message = `Status: ${status}`;

            if (status === 'PENDING' || status === 'STARTED') {
              stage = 'preparing';
              message = 'Preparing...';
            } else if (status === 'ACTION_REQUIRED' || status === 'MESSAGE_REQUIRED') {
              stage = 'signing';
              message = 'Confirming in wallet...';
            } else if (status === 'DONE') {
              stage = 'completed';
              message = 'Success';
            } else if (status === 'FAILED') {
              stage = 'failed';
              message = 'Swap failed';
            }

            onStatusUpdate?.({
              stage,
              message: txHash ? `${message}` : message,
              txHash,
            });
          }
        },
      } as any);

      const txHashes: string[] = [];
      executedRoute.steps.forEach((step: any) => {
        step.execution?.process?.forEach((p: any) => { if (p.txHash) txHashes.push(p.txHash); });
      });

      return {
        success: true,
        txHash: txHashes[0] || '',
        txHashes,
        receipt: executedRoute,
      };
    } catch (error) {
      console.error('[LiFiExecutor] Execution error:', error);
      console.error('[LiFiExecutor] Error details:', {
        name: (error as any)?.name,
        message: (error as any)?.message,
        code: (error as any)?.code,
        stack: (error as any)?.stack,
      });

      // Handle specific LiFi error types
      const errorMessage = (error as any)?.message || '';
      const errorName = (error as any)?.name || '';

      // Check for balance errors
      if (errorName === 'BalanceError' || errorMessage.toLowerCase().includes('balance is too low')) {
        const balanceError = new SwapExecutionError(
          'Insufficient balance',
          SwapErrorCode.INSUFFICIENT_BALANCE,
          'lifi'
        );
        onStatusUpdate?.({ stage: 'failed', message: 'Insufficient balance', error: balanceError });
        throw balanceError;
      }

      const swapError = createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'lifi');
      onStatusUpdate?.({ stage: 'failed', message: formatErrorMessage(swapError), error: swapError });
      throw swapError;
    }
  }

  private convertToLiFiRoute(raw: any): RouteExtended {
    if (raw.steps) return raw as RouteExtended;
    if (raw.action || raw.tool) return convertQuoteToRoute(raw as LiFiStep);
    throw new SwapExecutionError('Invalid route format', SwapErrorCode.INVALID_ROUTE, 'lifi');
  }
}

