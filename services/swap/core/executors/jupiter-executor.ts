/**
 * Jupiter Swap Executor
 *
 * Executes swaps using Jupiter V6 API for Solana same-chain swaps.
 * 1. Takes a V6 Quote (from adapter)
 * 2. Collects 0.25% tax and sends to revenue wallet
 * 3. Calls V6 Swap API to get transaction
 * 4. Signs and sends transaction to Solana network
 */
import { VersionedTransaction, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createSyncNativeInstruction, createCloseAccountInstruction, createInitializeAccountInstruction, ACCOUNT_SIZE } from '@solana/spl-token';
import type { SwapExecutionParams, SwapExecutionResult, SwapRouterExecutor } from '../types';
import type { RouterRoute } from '@/services/swap/core/router-types';
import { SwapExecutionError, SwapErrorCode } from '../types';
import { createSwapError, formatErrorMessage } from '../utils/error-handler';
import { getSolanaConnection, getSolanaWallet } from '../utils/wallet-helpers';
import { REVENUE_WALLETS, TAX_RATES, BASIS_POINTS } from '@/services/swap/core/config/tax-config';
import { apiUrl } from '@/services/swap/core/platform/api-base';

// Jupiter swap API - uses server-side proxy to avoid CORS issues
// The proxy forwards requests to public.jupiterapi.com
const JUPITER_SWAP_PROXY = apiUrl('/api/v1/jupiter/swap');

// Tax rate for Solana: 0.25%
const TAX_RATE_BPS = TAX_RATES.DEFAULT;
const SOLANA_REVENUE_WALLET = new PublicKey(REVENUE_WALLETS.solana);

// Native SOL mint address
const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

function isNativeSol(address: string): boolean {
  return !address || address === NATIVE_SOL_MINT || address === '11111111111111111111111111111111';
}

/**
 * Jupiter executor implementation
 */
export class JupiterExecutor implements SwapRouterExecutor {
  /**
   * Check if this executor can handle the given route
   */
  canHandle(route: RouterRoute): boolean {
    return route.router === 'jupiter';
  }

  /**
   * Collect tax before swap execution
   * Tax is ON TOP of swap amount - user swaps exact fromAmount
   * Total taken from wallet = fromAmount + taxAmount
   */
  private async collectTax(
    route: RouterRoute,
    wallet: any,
    connection: any,
    onStatusUpdate?: (status: any) => void
  ): Promise<{ taxCollected: boolean; taxAmount: string }> {
    try {
      const inputMint = route.raw?.inputMint || route.fromToken.address;
      const inAmount = route.raw?.inAmount || route.fromToken.amount;

      // Skip tax for native SOL (would need different handling with SystemProgram)
      if (isNativeSol(inputMint)) {
        console.log('[JupiterExecutor] Skipping tax for native SOL input');
        return { taxCollected: false, taxAmount: '0' };
      }

      const decimals = route.fromToken.decimals || 9;
      const inAmountBigInt = BigInt(inAmount);
      const taxAmountBigInt = (inAmountBigInt * BigInt(TAX_RATE_BPS)) / BigInt(BASIS_POINTS);

      if (taxAmountBigInt <= BigInt(0)) {
        return { taxCollected: false, taxAmount: '0' };
      }

      // Check user has enough balance (swap amount + tax)
      const totalRequired = inAmountBigInt + taxAmountBigInt;
      const mintPubkey = new PublicKey(inputMint);
      const userTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        wallet.publicKey
      );

      // Get user's token balance
      const tokenBalance = await connection.getTokenAccountBalance(userTokenAccount);
      const userBalance = BigInt(tokenBalance.value.amount);
      const tokenSymbol = route.fromToken.symbol || 'tokens';

      if (userBalance < totalRequired) {
        const swapAmountFormatted = (Number(inAmountBigInt) / 10 ** decimals).toFixed(6);
        const taxFormatted = (Number(taxAmountBigInt) / 10 ** decimals).toFixed(6);
        const totalFormatted = (Number(totalRequired) / 10 ** decimals).toFixed(6);
        const balanceFormatted = (Number(userBalance) / 10 ** decimals).toFixed(6);

        throw new Error(
          `Insufficient ${tokenSymbol} balance. ` +
          `You need ${totalFormatted} (${swapAmountFormatted} swap + ${taxFormatted} tax) ` +
          `but only have ${balanceFormatted}`
        );
      }

      console.log('[JupiterExecutor] Collecting tax (ON TOP):', {
        inputMint,
        swapAmount: inAmount,
        taxAmount: taxAmountBigInt.toString(),
        totalFromWallet: totalRequired.toString(),
        taxRate: `${TAX_RATE_BPS / 100}%`,
        revenueWallet: SOLANA_REVENUE_WALLET.toBase58(),
      });

      onStatusUpdate?.({
        stage: 'preparing',
        message: 'Processing...',
      });

      // Get revenue token account
      const revenueTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        SOLANA_REVENUE_WALLET
      );

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        userTokenAccount,
        revenueTokenAccount,
        wallet.publicKey,
        taxAmountBigInt,
        [],
        TOKEN_PROGRAM_ID
      );

      // Build and send transaction
      const transaction = new Transaction().add(transferInstruction);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTx = await wallet.signTransaction(transaction);
      const txHash = await connection.sendRawTransaction(signedTx.serialize());

      await connection.confirmTransaction(txHash, 'confirmed');

      console.log('[JupiterExecutor] Tax collected successfully:', txHash);

      return {
        taxCollected: true,
        taxAmount: (Number(taxAmountBigInt) / 10 ** decimals).toFixed(6),
      };
    } catch (error: any) {
      console.error('[JupiterExecutor] Tax collection failed:', error.message);
      // Re-throw balance errors
      if (error.message?.includes('Insufficient')) {
        throw error;
      }
      // Don't fail the swap if tax collection fails for other reasons - log and continue
      return { taxCollected: false, taxAmount: '0' };
    }
  }

  /**
   * Execute a swap using Jupiter
   */
  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    const { route, onStatusUpdate } = params;

    try {
      // Validate route
      if (route.router !== 'jupiter') {
        throw new SwapExecutionError(
          'Invalid route provided',
          SwapErrorCode.INVALID_ROUTE,
          'jupiter'
        );
      }

      // Check if route has quote data (raw)
      if (!route.raw) {
        throw new SwapExecutionError(
          'Route missing quote data (raw)',
          SwapErrorCode.INVALID_ROUTE,
          'jupiter'
        );
      }

      onStatusUpdate?.({
        stage: 'preparing',
        message: 'Preparing...',
      });

      const wallet = await getSolanaWallet();
      const connection = await getSolanaConnection();

      if (!wallet.isConnected || !wallet.publicKey) {
        throw new SwapExecutionError(
          'Solana wallet not connected',
          SwapErrorCode.WALLET_NOT_CONNECTED,
          'jupiter'
        );
      }

      // Intercept Wrap/Unwrap
      // Jupiter quote inputMint/outputMint are BOTH normalized to So111...112
      // We must check the original un-normalized route.fromToken.address to distinguish SOL from WSOL
      const originalFromAddress = route.fromToken.address;
      const originalToAddress = route.toToken.address;

      const isFromNative = originalFromAddress === '11111111111111111111111111111111' || originalFromAddress.toLowerCase() === 'native';
      const isToNative = originalToAddress === '11111111111111111111111111111111' || originalToAddress.toLowerCase() === 'native';

      const isFromWsol = originalFromAddress === NATIVE_SOL_MINT;
      const isToWsol = originalToAddress === NATIVE_SOL_MINT;

      if (route.raw.isWrapUnwrap || (isFromNative && isToWsol) || (isFromWsol && isToNative)) {
        const isWrap = isFromNative || originalFromAddress.toLowerCase() === 'native' || originalFromAddress === '11111111111111111111111111111111'; // True if from Native SOL to WSOL, False if from WSOL to Native SOL
        return await this.executeWrapUnwrap(route, wallet, connection, isWrap, onStatusUpdate);
      }

      // If for some reason we missed it
      if (route.raw.isWrapUnwrap) {
        throw new SwapExecutionError('Wrap/Unwrap shortcut hit but direction could not be determined.', SwapErrorCode.EXECUTION_FAILED, 'jupiter');
      }

      // Collect tax before swap (0.25% to revenue wallet)
      const { taxCollected, taxAmount } = await this.collectTax(route, wallet, connection, onStatusUpdate);
      if (taxCollected) {
        console.log(`[JupiterExecutor] Tax of ${taxAmount} collected`);
      }

      // 1. Fetch Swap Transaction from Jupiter V6 API
      const swapTransactionBase64 = await this.getSwapTransaction(route.raw, wallet.publicKey.toBase58());

      // 2. Deserialize transaction
      const transactionBuffer = Buffer.from(swapTransactionBase64, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      // 3. Sign transaction
      onStatusUpdate?.({
        stage: 'signing',
        message: 'Confirming in wallet...',
      });

      const signedTransaction = await wallet.signTransaction(transaction);
      const signedTransactionBuffer = Buffer.from(signedTransaction.serialize());

      // 4. Send transaction
      onStatusUpdate?.({
        stage: 'submitting',
        message: 'Submitting...',
      });

      // Use standard connection sendRawTransaction (not Jupiter API execute)
      const txHash = await connection.sendRawTransaction(signedTransactionBuffer, {
        skipPreflight: true, // We rely on Jupiter's simulation or simply submit
        maxRetries: 2
      });

      // 5. Confirm transaction
      onStatusUpdate?.({
        stage: 'confirming',
        message: 'Reviewing...',
        txHash,
      });

      let confirmation: any = null;
      try {
        confirmation = await connection.confirmTransaction(txHash, 'confirmed');

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        onStatusUpdate?.({
          stage: 'completed',
          message: 'Success',
          txHash,
        });
      } catch (confirmError: any) {
        if (confirmError.message?.includes('was not confirmed in') || confirmError.message?.includes('timeout')) {
          console.warn(`[JupiterExecutor] Confirmation timeout (tx was broadcast): ${confirmError.message}`);
          onStatusUpdate?.({
            stage: 'completed',
            message: 'Swap is processing. Please check your wallet balance for confirmation.',
            txHash,
          });
        } else {
          throw confirmError;
        }
      }

      return {
        success: true,
        txHash,
        receipt: confirmation,
        actualToAmount: route.toToken.amount,
      };

    } catch (error) {
      const swapError = createSwapError(error, SwapErrorCode.TRANSACTION_FAILED, 'jupiter');

      onStatusUpdate?.({
        stage: 'failed',
        message: formatErrorMessage(swapError),
        error: swapError,
      });

      throw swapError;
    }
  }

  /**
   * Call Jupiter V6 Swap API to get the serialized transaction
   */
  private async getSwapTransaction(quoteResponse: any, userPublicKey: string): Promise<string> {
    try {
      console.log('[JupiterExecutor] 🔄 Getting swap transaction...');
      console.log('[JupiterExecutor] Quote response:', {
        inputMint: quoteResponse?.inputMint,
        outputMint: quoteResponse?.outputMint,
        inAmount: quoteResponse?.inAmount,
        outAmount: quoteResponse?.outAmount,
      });
      console.log('[JupiterExecutor] User public key:', userPublicKey);

      const body = {
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      };

      // Use server-side proxy to avoid CORS issues
      const response = await fetch(JUPITER_SWAP_PROXY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const responseText = await response.text();

      if (!response.ok) {
        console.error('[JupiterExecutor] ❌ Swap API failed:', response.status, response.statusText);
        console.error('[JupiterExecutor] Response:', responseText);

        // Try to parse error message
        try {
          const errorJson = JSON.parse(responseText);
          if (errorJson.error) {
            throw new Error(`Swap failed: ${errorJson.error}`);
          }
        } catch (parseError) {
          // Not JSON
        }

        throw new Error(`Swap API failed: ${response.statusText}. ${responseText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[JupiterExecutor] ❌ Failed to parse swap response:', responseText);
        throw new Error('Failed to parse swap response');
      }

      if (!data.swapTransaction) {
        console.error('[JupiterExecutor] ❌ No swapTransaction in response:', data);
        throw new Error('API did not return a swap transaction');
      }

      console.log('[JupiterExecutor] ✅ Got swap transaction');
      return data.swapTransaction;
    } catch (error: any) {
      console.error('[JupiterExecutor] ❌ Error fetching swap transaction:', error.message || error);
      throw error;
    }
  }

  /**
   * Execute manual Wrap or Unwrap transaction to avoid Jupiter API failing with "Invalid route plan for identical mint"
   */
  private async executeWrapUnwrap(
    route: RouterRoute,
    wallet: any,
    connection: any,
    isWrap: boolean,
    onStatusUpdate?: (status: any) => void
  ): Promise<SwapExecutionResult> {
    const amount = BigInt(route.raw?.inAmount || route.fromToken.amount);

    onStatusUpdate?.({ stage: 'preparing', message: 'Preparing...' });

    const instructions = [];
    const signers: Keypair[] = [];

    const ownerPubkey = wallet.publicKey;
    const WSOL_MINT = new PublicKey(NATIVE_SOL_MINT);
    const userWsolAta = await getAssociatedTokenAddress(WSOL_MINT, ownerPubkey);

    if (isWrap) {
      // Wrap SOL
      const wsolAtaInfo = await connection.getAccountInfo(userWsolAta);
      if (!wsolAtaInfo) {
        instructions.push(createAssociatedTokenAccountInstruction(
          ownerPubkey, userWsolAta, ownerPubkey, WSOL_MINT
        ));
      }

      // Transfer lamports to WSOL ATA
      instructions.push(SystemProgram.transfer({
        fromPubkey: ownerPubkey,
        toPubkey: userWsolAta,
        lamports: amount
      }));

      // Sync Native
      instructions.push(createSyncNativeInstruction(userWsolAta));
    } else {
      // Unwrap WSOL (Partial or Full)
      const wsolAtaInfo = await connection.getAccountInfo(userWsolAta);
      if (!wsolAtaInfo) throw new Error("No Wrapped SOL account found");

      const tokenBalance = await connection.getTokenAccountBalance(userWsolAta);
      const wsolBalance = BigInt(tokenBalance.value.amount);

      // If unwrapping ALL of the WSOL (or more than what exists), the cheapest and most standard method is 
      // just closing the account, which dumps all lamports back to native SOL.
      if (amount >= wsolBalance) {
        instructions.push(createCloseAccountInstruction(userWsolAta, ownerPubkey, ownerPubkey));
      } else {
        // Partial unwrap requires creating a temporary standard token account, moving the partial 
        // WSOL there, and then closing the temporary account to release exactly that partial amount
        // of lamports as Native SOL.
        const nativeSolBalance = await connection.getBalance(ownerPubkey);
        const rentExempt = await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);

        if (nativeSolBalance < rentExempt + 10000) {
          throw new Error("Insufficient Native SOL to pay for partial unwrap rent. Try unwrapping 100% of your WSOL instead, which is free.");
        }

        const tempAccount = Keypair.generate();
        signers.push(tempAccount);

        instructions.push(SystemProgram.createAccount({
          fromPubkey: ownerPubkey,
          newAccountPubkey: tempAccount.publicKey,
          lamports: rentExempt,
          space: ACCOUNT_SIZE,
          programId: TOKEN_PROGRAM_ID
        }));

        instructions.push(createInitializeAccountInstruction(tempAccount.publicKey, WSOL_MINT, ownerPubkey));
        instructions.push(createTransferInstruction(userWsolAta, tempAccount.publicKey, ownerPubkey, amount));
        instructions.push(createCloseAccountInstruction(tempAccount.publicKey, ownerPubkey, ownerPubkey));
      }
    }

    // Build & Send Tx
    const transaction = new Transaction().add(...instructions);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = ownerPubkey;

    if (signers.length > 0) {
      transaction.partialSign(...signers);
    }

    onStatusUpdate?.({ stage: 'signing', message: 'Confirming in wallet...' });
    const signedTx = await wallet.signTransaction(transaction);

    onStatusUpdate?.({ stage: 'submitting', message: 'Submitting...' });
    const txHash = await connection.sendRawTransaction(signedTx.serialize());
    let confirmation: any = null;
    try {
      confirmation = await connection.confirmTransaction(txHash, 'confirmed');
      if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      onStatusUpdate?.({ stage: 'completed', message: 'Success', txHash });
    } catch (err: any) {
      if (err.message?.includes('was not confirmed in') || err.message?.includes('timeout')) {
        onStatusUpdate?.({ stage: 'completed', message: 'Swap is processing. Please check your wallet balance for confirmation.', txHash });
      } else {
        throw err;
      }
    }

    return {
      success: true,
      txHash,
      receipt: confirmation,
      actualToAmount: route.toToken.amount
    };
  }
}

