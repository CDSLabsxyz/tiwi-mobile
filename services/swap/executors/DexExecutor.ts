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
import { DEX_ROUTER_ABI, ERC20_ABI, WETH_ADDRESSES } from '../constants';
import { ExecuteSwapParams, SwapExecutionResult, TokenMinimal } from '../types';

/**
 * DEX Executor handles swaps for routers like PancakeSwap V2 and Uniswap V2.
 * It provides local call construction, approval checks, and on-chain simulation.
 */
export class DexExecutor {
    private getPublicClient(chainId: number) {
        const chains: Record<number, any> = {
            1: mainnet,
            56: bsc,
            137: polygon,
            8453: base,
        };

        const chain = chains[chainId] || mainnet;
        return createPublicClient({
            chain,
            transport: http(),
        });
    }

    async execute(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
        const { fromAmount, fromToken, toToken, fromAddress, recipientAddress, quote } = params;
        const publicClient = this.getPublicClient(fromToken.chainId);

        try {
            if (!quote.raw) {
                throw new Error("Invalid quote: Missing raw transaction data. Please refresh the quote.");
            }
            const routerAddress = quote.raw.routerAddress as Address;
            if (!routerAddress) throw new Error("Router address is missing from quote");

            const isNativeIn = fromToken.address === '0x0000000000000000000000000000000000000000';
            const isNativeOut = toToken.address === '0x0000000000000000000000000000000000000000';

            // 1. CHECK APPROVAL (for non-native tokens)
            if (!isNativeIn) {
                const amountIn = parseUnits(fromAmount, fromToken.decimals);
                const allowance = await publicClient.readContract({
                    address: getAddress(fromToken.address),
                    abi: ERC20_ABI,
                    functionName: 'allowance',
                    args: [getAddress(fromAddress), getAddress(routerAddress)],
                }) as bigint;
                console.log("🚀 ~ DexExecutor ~ execute ~ allowance:", { allowance, amountIn })

                if (allowance < amountIn) {
                    console.log("[DexExecutor] Insufficient allowance, triggering approval...");
                    // In a production app, we might return a 'status: need_approval' 
                    // but for this direct execution, we'll try to execute approval first or fail.
                    // Requesting approval via signerController
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
                    }, fromAddress);
                    console.log("🚀 ~ DexExecutor ~ execute ~ approveResult:", approveResult)

                    if (approveResult.status !== 'success') {
                        return { success: false, error: "Token approval failed: " + approveResult.error };
                    }
                    console.log("[DexExecutor] Approval successful, waiting for indexing...");
                    // Small delay for indexing (optional but helpful)
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            // 2. CONSTRUCT DATA (If missing or needs local encoding)
            let txData = quote.txData;
            let txValue = quote.txValue || '0';

            if (!txData || txData === '0x') {
                console.log("[DexExecutor] Missing calldata, constructing locally...");
                const path = quote.raw?.path || this.getDefaultPath(fromToken, toToken);
                const amountIn = parseUnits(fromAmount, fromToken.decimals);
                const amountOutMin = this.calculateAmountOutMin(quote.toAmount, toToken.decimals, quote.slippage, toToken.address);
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
                // Note: We don't use simulateContract here because we already have the data.
                // We'll use eth_call via publicClient.call for a raw dry-run.
                await publicClient.call({
                    account: getAddress(fromAddress),
                    to: getAddress(routerAddress),
                    data: txData as `0x${string}`,
                    value: BigInt(txValue),
                });
            } catch (simError: any) {
                console.warn("[DexExecutor] Simulation failed:", simError.message);
                // We keep going as some RPCs fail simulation but succeed in reality, 
                // but this is a warning sign.
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

    private calculateAmountOutMin(toAmount: string, decimals: number, slippage: number, toTokenAddress?: string): bigint {
        const amount = parseUnits(toAmount, decimals);
        const slippageBps = BigInt(Math.floor(slippage * 100));
        return (amount * (BigInt(10000) - slippageBps)) / BigInt(10000);
    }

    private getDefaultPath(fromToken: TokenMinimal, toToken: TokenMinimal): Address[] {
        const weth = WETH_ADDRESSES[fromToken.chainId];
        const tokenIn = fromToken.address === '0x0000000000000000000000000000000000000000'
            ? weth
            : getAddress(fromToken.address);
        const tokenOut = toToken.address === '0x0000000000000000000000000000000000000000'
            ? weth
            : getAddress(toToken.address);

        if (tokenIn === weth || tokenOut === weth) {
            return [tokenIn, tokenOut];
        }
        return [tokenIn, weth, tokenOut];
    }
}
