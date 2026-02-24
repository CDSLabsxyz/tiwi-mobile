import { DISPERSE_CONTRACTS } from '@/constants/contracts';
import { useWalletStore } from '@/store/walletStore';
import { toSmallestUnit } from '@/utils/formatting';
import { createPublicClient, encodeFunctionData, http } from 'viem';
import { activityService } from './activityService';
import { apiClient } from './apiClient';
import { signerController } from './signer/SignerController';
import { TransactionRequest } from './signer/SignerTypes';
import { getChainById } from './signer/SignerUtils';

// Minimal ERC20 ABI
const ERC20_ABI = [
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
] as const;

// Minimal Disperse ABI
const DISPERSE_ABI = [
    {
        name: 'disperseEther',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
            { name: 'recipients', type: 'address[]' },
            { name: 'values', type: 'uint256[]' },
        ],
        outputs: [],
    },
    {
        name: 'disperseTokenSimple',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'recipients', type: 'address[]' },
            { name: 'values', type: 'uint256[]' },
        ],
        outputs: [],
    },
] as const;

export interface SendTokenParams {
    tokenAddress: string;
    symbol: string;
    decimals: number;
    recipientAddress: string;
    amount: string;
    chainId: number;
    isNative: boolean;
}

/**
 * TransactionService handles high-level transaction logic
 * It integrates with SignerController for execution and ApiClient for logging
 */
export const transactionService = {
    /**
     * Sends a token (Native or ERC20) to a recipient
     */
    async sendToken(params: SendTokenParams): Promise<{ hash: string; status: 'success' | 'failed'; error?: string }> {
        const { address: fromAddress } = useWalletStore.getState();
        if (!fromAddress) throw new Error('No active wallet found');

        const amountBIStr = toSmallestUnit(params.amount, params.decimals);

        let txRequest: TransactionRequest;

        if (params.isNative) {
            txRequest = {
                chainFamily: 'evm',
                to: params.recipientAddress,
                value: amountBIStr,
                chainId: params.chainId,
            };
        } else {
            // Encode ERC20 transfer data (matches transferERC20Token in reference)
            const data = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [params.recipientAddress as `0x${string}`, BigInt(amountBIStr)],
            });

            txRequest = {
                chainFamily: 'evm',
                to: params.tokenAddress,
                data,
                chainId: params.chainId,
            };
        }

        // Execute via SignerController
        const result = await signerController.executeTransaction(txRequest, fromAddress);

        if (result.status === 'success' && result.hash) {
            // Log to backend
            try {
                await apiClient.logTransaction({
                    walletAddress: fromAddress,
                    transactionHash: result.hash,
                    chainId: params.chainId,
                    type: 'Sent',
                    fromTokenAddress: params.tokenAddress,
                    fromTokenSymbol: params.symbol,
                    amount: params.amount,
                    amountFormatted: `${params.amount} ${params.symbol}`,
                    toTokenAddress: params.recipientAddress,
                });

                // Log to local activity
                await activityService.logTransaction(
                    fromAddress,
                    'transaction',
                    'Sent Successfully',
                    `You sent ${params.amount} ${params.symbol} to ${params.recipientAddress}`,
                    result.hash
                );
            } catch (logError) {
                console.error('Failed to log transaction metadata:', logError);
                // We don't fail the whole function if logging fails, as the tx is already on-chain
            }
        }

        return result;
    },

    /**
     * Multi-sends a token to multiple recipients
     */
    async multiSend(
        params: Omit<SendTokenParams, 'recipientAddress' | 'amount'> & { recipients: string[]; amounts: string[] }
    ): Promise<{ hash: string; status: 'success' | 'failed'; error?: string }> {
        const { address: fromAddress } = useWalletStore.getState();
        if (!fromAddress) throw new Error('No active wallet found');

        const disperseAddress = DISPERSE_CONTRACTS[params.chainId];
        if (!disperseAddress) throw new Error(`Disperse contract not found for chain ${params.chainId}`);

        const amountsBI = params.amounts.map(a => BigInt(toSmallestUnit(a, params.decimals)));
        const totalAmountBI = amountsBI.reduce((a, b) => a + b, 0n);

        let txRequest: TransactionRequest;

        if (params.isNative) {
            txRequest = {
                chainFamily: 'evm',
                to: disperseAddress,
                value: totalAmountBI.toString(),
                data: encodeFunctionData({
                    abi: DISPERSE_ABI,
                    functionName: 'disperseEther',
                    args: [params.recipients as `0x${string}`[], amountsBI],
                }),
                chainId: params.chainId,
            };
        } else {
            txRequest = {
                chainFamily: 'evm',
                to: disperseAddress,
                data: encodeFunctionData({
                    abi: DISPERSE_ABI,
                    functionName: 'disperseTokenSimple',
                    args: [params.tokenAddress as `0x${string}`, params.recipients as `0x${string}`[], amountsBI],
                }),
                chainId: params.chainId,
            };
        }

        const result = await signerController.executeTransaction(txRequest, fromAddress);
        return result;
    },

    /**
     * Estimates gas for a send transaction
     */
    async estimateGas(params: SendTokenParams): Promise<{ gasLimit: bigint; gasCostNative: bigint; gasCostUSD: number }> {
        const chain = getChainById(params.chainId);
        const client = createPublicClient({
            chain,
            transport: http()
        });

        const amountBI = BigInt(toSmallestUnit(params.amount, params.decimals));
        let gasLimit = 21000n;

        try {
            if (params.isNative) {
                gasLimit = await client.estimateGas({
                    account: useWalletStore.getState().address as `0x${string}`,
                    to: params.recipientAddress as `0x${string}`,
                    value: amountBI,
                });
            } else {
                const data = encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: 'transfer',
                    args: [params.recipientAddress as `0x${string}`, amountBI],
                });

                gasLimit = await client.estimateGas({
                    account: useWalletStore.getState().address as `0x${string}`,
                    to: params.tokenAddress as `0x${string}`,
                    data,
                });
            }

            const gasPrice = await client.getGasPrice();
            const gasCostNative = gasLimit * gasPrice;

            // Simplified USD conversion (ideally fetch price of native asset)
            const gasCostUSD = 0.05; // Mock for now until price service integrated

            return { gasLimit, gasCostNative, gasCostUSD };
        } catch (error) {
            console.error('Gas estimation failed:', error);
            return { gasLimit: 21000n, gasCostNative: 0n, gasCostUSD: 0 };
        }
    },

    /**
     * Simulates a send transaction to check for errors/gas
     */
    async simulateSend(params: SendTokenParams): Promise<{ success: boolean; error?: string; gasEstimate?: string }> {
        try {
            const { gasLimit } = await this.estimateGas(params);
            return { success: true, gasEstimate: gasLimit.toString() };
        } catch (error: any) {
            console.error('Simulation failed:', error);
            return { success: false, error: error.message || 'Simulation failed' };
        }
    }
};
