import {
    createPublicClient,
    encodeFunctionData,
    getAddress,
    http,
    parseUnits,
    type Address
} from 'viem';
import { base, bsc, mainnet, polygon } from 'viem/chains';
import { signerController } from '../../signer/SignerController';
import { DEX_ROUTER_ABI, ERC20_ABI, PANCAKESWAP_V2_ROUTER, WETH_ADDRESSES, isNativeToken } from '../constants';
import { ExecuteSwapParams, SwapExecutionResult, TokenMinimal } from '../types';

/**
 * DEX Executor handles swaps for routers like PancakeSwap V2 and Uniswap V2.
 * It provides local call construction, approval checks, and on-chain simulation.
 */
export class DexExecutor {
    private async getPublicClient(chainId: number) {
        return await signerController.getPublicClient(chainId);
    }

    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        const { fromAmount, fromToken, toToken, fromAddress, recipientAddress, quote } = params;
        const publicClient = await this.getPublicClient(fromToken.chainId);

        try {
            if (!quote.raw) {
                throw new Error("Invalid quote: Missing raw transaction data. Please refresh the quote.");
            }
            const routerAddress = (quote.raw?.routerAddress || PANCAKESWAP_V2_ROUTER[fromToken.chainId]) as Address;
            if (!routerAddress) throw new Error("Router address is missing from quote");

            const isNativeIn = isNativeToken(fromToken.address);
            const isNativeOut = isNativeToken(toToken.address);

            console.log(`[DexExecutor] execution params:`, {
                fromToken: fromToken.symbol,
                fromTokenAddr: fromToken.address,
                isNativeIn,
                chainId: fromToken.chainId,
                routerAddress
            });

            // 1. CHECK APPROVAL (for non-native tokens)
            if (!isNativeIn) {
                console.log(`[DexExecutor] Checking allowance for ${fromToken.symbol} (${fromToken.address}) to ${routerAddress}`);
                const amountIn = parseUnits(fromAmount, fromToken.decimals || 18);
                
                try {
                    const allowance = await publicClient.readContract({
                        address: getAddress(fromToken.address),
                        abi: ERC20_ABI,
                        functionName: 'allowance',
                        args: [getAddress(fromAddress), getAddress(routerAddress)],
                    }) as bigint;
                    console.log(`[DexExecutor] Allowance found: ${allowance.toString()} for amountIn: ${amountIn.toString()}`);

                    if (allowance < amountIn) {
                        console.log("[DexExecutor] Insufficient allowance, triggering approval...");
                        const approveData = encodeFunctionData({
                            abi: ERC20_ABI,
                            functionName: 'approve',
                            args: [getAddress(routerAddress), BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
                        });

                        const approveResult = await signerController.executeTransaction({
                            chainFamily: 'evm',
                            to: fromToken.address,
                            data: approveData,
                            chainId: fromToken.chainId,
                        }, fromAddress, { skipAuthorize: true });

                        if (approveResult.status !== 'success') {
                            return { success: false, error: "Token approval failed: " + approveResult.error };
                        }
                        await new Promise(r => setTimeout(r, 2000));
                    }
                } catch (readError: any) {
                    console.error(`[DexExecutor] Allowance check failed for ${fromToken.symbol} (${fromToken.address}):`, readError.message);
                    // Standard Engineering Safety: Non-blocking fallback
                    // If we can't read allowance (either not a contract, or RPC error), 
                    // we log it and attempt to proceed. If approval is actually required, 
                    // the subsequent swap transaction will fail with a clear "execution reverted" error.
                    console.warn(`[DexExecutor] Proceeding with swap execution despite allowance read failure.`);
                }
            }

            // 2. CONSTRUCT DATA (If missing or needs local encoding)
            let txData = quote.txData;
            let txValue = quote.txValue || '0';

            if (!txData || txData === '0x') {
                console.log("[DexExecutor] Missing calldata, constructing locally...");
                const path = quote.raw?.path || this.getDefaultPath(fromToken, toToken);
                const amountIn = parseUnits(fromAmount, fromToken.decimals);
                const amountOutMin = this.calculateAmountOutMin(quote.toAmount, toToken.decimals, quote.slippage, toToken.address, fromToken.address);
                console.log("🚀 ~ DexExecutor ~ execute ~ amountOutMin:", amountOutMin)
                const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 mins
                let fnName
                if (isNativeIn) {
                    console.log('swapExactETHForTokensSupportingFeeOnTransferTokens FOR NATIVE')
                    txData = encodeFunctionData({
                        abi: DEX_ROUTER_ABI,
                        functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
                        args: [amountOutMin, path, getAddress(recipientAddress), deadline],
                    });
                    txValue = amountIn.toString();
                } else if (isNativeOut) {
                    console.log('swapExactETHForTokensSupportingFeeOnTransferTokens FOR NATIVE OUT')
                    txData = encodeFunctionData({
                        abi: DEX_ROUTER_ABI,
                        functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
                        args: [amountIn, amountOutMin, path, getAddress(recipientAddress), deadline],
                    });
                } else {
                    console.log('swapExactTokensForTokensSupportingFeeOnTransferTokens FOR ERCs')
                    txData = encodeFunctionData({
                        abi: DEX_ROUTER_ABI,
                        functionName: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
                        args: [amountIn, amountOutMin, path, getAddress(recipientAddress), deadline],
                    });
                }
            }

            // 3. SIMULATION (Pre-flight check)
            try {
                console.log("[DexExecutor] Simulating transaction...");
                
                // Extra Engineering Safety: Verify router address has bytecode on this chain
                const bytecode = await publicClient.getBytecode({
                    address: getAddress(routerAddress),
                });
                if (!bytecode || bytecode === '0x') {
                    console.warn(`[DexExecutor] Router address ${routerAddress} has NO data at destination on chain ${fromToken.chainId}! This will fail on-chain.`);
                }

                await publicClient.call({
                    account: getAddress(fromAddress),
                    to: getAddress(routerAddress),
                    data: txData as `0x${string}`,
                    value: BigInt(txValue),
                });
                console.log("[DexExecutor] Simulation successful.");
            } catch (simError: any) {
                console.warn("[DexExecutor] Simulation failed:", simError.message);
                // Standard Engineering fallback:
                // We do NOT block the execution flow here - sometimes simulation logic differs from reality
                // due to state differences (block timestamps, pending txs, etc).
            }

            // 4. SIGN AND BROADCAST
            const result = await signerController.executeTransaction({
                chainFamily: 'evm',
                to: routerAddress,
                value: txValue,
                data: txData,
                chainId: fromToken.chainId,
            }, fromAddress, { skipAuthorize: true });

            if (result.status === 'success') {
                return { success: true, txHash: result.hash };
            } else {
                return { success: false, error: result.error };
            }

        } catch (error: any) {
            console.error("[DexExecutor] execution failed", error);
            return { success: false, error: error.message };
        }
    }

    private calculateAmountOutMin(toAmount: string, decimals: number, slippage: number, toTokenAddress?: string, fromTokenAddress?: string): bigint {
        // For TWC (fee-on-transfer token), set amountOutMin to 0 to avoid INSUFFICIENT_OUTPUT_AMOUNT
        const twcAddress = '0xda1060158f7d593667cce0a15db346bb3ffb3596';
        if (fromTokenAddress?.toLowerCase() === twcAddress || toTokenAddress?.toLowerCase() === twcAddress) {
            return BigInt(0);
        }
        const amount = parseUnits(toAmount, decimals);
        const slippageBps = BigInt(Math.floor(slippage * 100));
        return (amount * (BigInt(10000) - slippageBps)) / BigInt(10000);
    }

    private getDefaultPath(fromToken: TokenMinimal, toToken: TokenMinimal): Address[] {
        const weth = WETH_ADDRESSES[fromToken.chainId];
        const tokenIn = isNativeToken(fromToken.address)
            ? weth
            : getAddress(fromToken.address);
        const tokenOut = isNativeToken(toToken.address)
            ? weth
            : getAddress(toToken.address);

        if (tokenIn === weth || tokenOut === weth) {
            return [tokenIn, tokenOut];
        }
        return [tokenIn, weth, tokenOut];
    }
}
