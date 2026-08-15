import { REVENUE_WALLETS, TAX_RATES, BASIS_POINTS, getTaxRate } from '@/services/swap/core/config/tax-config';
import { createPublicClient, http, encodeFunctionData, parseUnits, formatUnits, type Address, type Chain, type Hex } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, bsc, avalanche, fantom, gnosis, celo, scroll, linea, blast, zora } from 'viem/chains';
import type { SwapExecutionParams } from '../types';
import { useSwapStore } from '@/services/swap/core/platform/swap-store';

// Tax rate for non-BSC chains: 0.25%
const DEFAULT_TAX_RATE_BPS = TAX_RATES.DEFAULT;
const EVM_REVENUE_WALLET = REVENUE_WALLETS.evm as Address;

// Native token addresses
const NATIVE_TOKEN_ADDRESSES = [
    '0x0000000000000000000000000000000000000000',
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
];

import { getCachedPublicClient } from '@/services/swap/core/platform/viem-clients';

export function isNativeToken(address: string): boolean {
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

// Chain configs
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
    534352: scroll,
    59144: linea,
    81457: blast,
    7777777: zora,
};

/**
 * True when the route already collects the Tiwi fee INLINE (the aggregator skims it inside
 * the swap tx). In that case executors must NOT send a separate tax transfer - doing so would
 * double-charge the user and add a redundant signature.
 */
export function isTaxInline(route: SwapExecutionParams['route']): boolean {
    return route?.fees?.taxMode === 'inline';
}

/**
 * Whether this execution must NOT collect a separate Tiwi tax:
 *  - `skipTax` was set by the caller (e.g. the 2nd leg of a multi-leg swap - tax is charged
 *    once, on leg 1), or
 *  - the route already collects the fee inline (aggregator skims it inside the swap).
 * Centralized so every tax collector (this helper + the LiFi/EVM-DEX copies) agrees.
 */
export function shouldSkipSeparateTax(params: SwapExecutionParams): boolean {
    return params?.skipTax === true || isTaxInline(params?.route);
}

export async function collectEvmTax(
    params: SwapExecutionParams,
    logPrefix: string,
    onStatusUpdate?: (status: any) => void
): Promise<{ taxCollected: boolean; taxAmount: string }> {
    try {
        const { route, fromToken, fromAmount, userAddress, walletClient } = params;
        const chainId = fromToken?.chainId || route.fromToken.chainId;

        // Skip the separate tax transfer when the fee is folded inline OR this leg opted out
        // (multi-leg swaps charge the fee exactly once, on leg 1).
        if (shouldSkipSeparateTax(params)) {
            console.log(`[${logPrefix}] Skipping separate tax transfer (inline fee or skipTax leg)`);
            return { taxCollected: false, taxAmount: '0' };
        }

        // Skip tax for Solana (handled separately), or if no wallet client
        // We NO LONGER skip BSC here, because Relay/LiFi executors need to collect tax too
        if (categoryIdEquals(chainId, 7565164) || !walletClient) {
            return { taxCollected: false, taxAmount: '0' };
        }

        // Skip tax for native token input (would need different handling)
        const fromTokenAddress = fromToken?.address || route.fromToken.address;
        if (isNativeToken(fromTokenAddress)) {
            console.log(`[${logPrefix}] Skipping tax for native token input`);
            return { taxCollected: false, taxAmount: '0' };
        }

        const { selectedGasTokenType } = useSwapStore.getState();
        const taxRateBps = getTaxRate(chainId, selectedGasTokenType);

        const decimals = fromToken?.decimals || route.fromToken.decimals || 18;
        const fromAmountWei = parseUnits(fromAmount, decimals);
        const taxAmountWei = (fromAmountWei * BigInt(taxRateBps)) / BigInt(BASIS_POINTS);

        if (taxAmountWei <= BigInt(0)) {
            return { taxCollected: false, taxAmount: '0' };
        }

        // Get chain config
        const chain = CHAIN_CONFIGS[chainId];
        if (!chain) {
            console.warn(`[${logPrefix}] Chain config not found for chainId:`, chainId);
            return { taxCollected: false, taxAmount: '0' };
        }

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

        console.log(`[${logPrefix}] Collecting tax (ON TOP):`, {
            swapAmount: fromAmount,
            taxAmount: formatUnits(taxAmountWei, decimals),
            totalFromWallet: formatUnits(totalRequired, decimals),
            taxRate: `${taxRateBps / 100}%`,
            revenueWallet: EVM_REVENUE_WALLET,
        });

        onStatusUpdate?.({
            stage: 'preparing',
            message: 'Preparing...',
        });

        // Transfer tax to revenue wallet
        const transferData = encodeFunctionData({
            abi: ERC20_TRANSFER_ABI,
            functionName: 'transfer',
            args: [EVM_REVENUE_WALLET, taxAmountWei],
        });

        const taxTxHash = await walletClient.sendTransaction({
            to: fromTokenAddress as Address,
            data: transferData,
            chain,
        });

        console.log(`[${logPrefix}] Tax transfer tx:`, taxTxHash);

        // Wait for confirmation
        await publicClient.waitForTransactionReceipt({
            hash: taxTxHash,
            timeout: 30000,
        });

        console.log(`[${logPrefix}] Tax collected successfully`);

        return {
            taxCollected: true,
            taxAmount: formatUnits(taxAmountWei, decimals),
        };
    } catch (error: any) {
        console.error(`[${logPrefix}] Tax collection failed:`, error.message);
        // Re-throw balance errors
        if (error.message?.includes('Insufficient')) {
            throw error;
        }
        // Don't fail the swap if tax collection fails for other reasons - log and continue
        return { taxCollected: false, taxAmount: '0' };
    }
}


function categoryIdEquals(chainId: any, val: number): boolean {
    return Number(chainId) === val;
}
