
import { createAcrossClient } from "@across-protocol/app-sdk";
import { createTransportForChain } from "@/constants/rpc";
import { createPublicClient, formatUnits, getAddress, parseUnits } from "viem";
import { arbitrum, base, bsc, mainnet, optimism, polygon, zksync, scroll, mantle, blast, lisk } from "viem/chains";
import { SwapQuote, TokenMinimal } from "./swap/types";

// Supported chains by Across for this app
const SUPPORTED_CHAINS = [mainnet, optimism, arbitrum, bsc, polygon, base, zksync, scroll, mantle, blast, lisk];

// Simple ABI for Uniswap V2 / PancakeSwap V2 Routers
const ROUTER_ABI = [
    {
        "inputs": [
            { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
            { "internalType": "address[]", "name": "path", "type": "address[]" }
        ],
        "name": "getAmountsOut",
        "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    }
];

// Wrapped native tokens for path construction
const WRAPPED_NATIVE: Record<number, string> = {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
    137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
};

// Known routers for same-chain fallback
const KNOWN_ROUTERS: Record<number, string> = {
    56: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2
    1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uni V2
    137: '0xa5E0829CaCEd8fFDD03942105b4458a05E533b39', // QuickSwap
};

export class AcrossService {
    public client = createAcrossClient({
        integratorId: "0x0001", // Placeholder
        chains: SUPPORTED_CHAINS,
        useTestnet: false,
    });

    private getPublicClient(chainId: number) {
        const chain = SUPPORTED_CHAINS.find(c => c.id === chainId) || mainnet;
        return createPublicClient({
            chain,
            transport: createTransportForChain(chainId),
        });
    }

    /**
     * Fetch a quote from Across Protocol
     */
    async fetchAcrossQuote(
        fromAmount: string,
        fromToken: TokenMinimal,
        toToken: TokenMinimal,
        fromAddress: string,
        recipient: string,
        slippage?: number
    ): Promise<SwapQuote | null> {
        let lastError = "No route found";
        try {
            console.log(`[AcrossService] Fetching Across quote: ${fromToken.symbol} (${fromToken.chainId}) -> ${toToken.symbol} (${toToken.chainId})`);

            // 1. Check for Same-Chain Swap (Across doesn't support this)
            if (fromToken.chainId === toToken.chainId) {
                console.log("[AcrossService] Same-chain detected, falling back to DEX logic...");
                return this.fetchSameChainDexQuote(fromAmount, fromToken, toToken, slippage);
            }

            const amountIn = parseUnits(fromAmount, fromToken.decimals);
            const isFromNative = fromToken.address === '0x0000000000000000000000000000000000000000';
            const isToNative = toToken.address === '0x0000000000000000000000000000000000000000';

            // Smart Slippage: Detect taxed tokens like TWC and use safe defaults
            const isTaxToken = fromToken.address.toLowerCase() === '0xda1060158f7d593667cce0a15db346bb3ffb3596';
            const finalSlippage = isTaxToken ? Math.max(slippage || 0, 15.0) : (slippage || 0.5);
            const slippageRatio = finalSlippage / 100;

            try {
                // Across V3 Aggregator + Bridge
                const quote = await this.client.getSwapQuote({
                    route: {
                        originChainId: fromToken.chainId,
                        destinationChainId: toToken.chainId,
                        inputToken: getAddress(fromToken.address),
                        outputToken: getAddress(toToken.address),
                    },
                    amount: amountIn.toString(),
                    depositor: getAddress(fromAddress),
                    recipient: getAddress(recipient),
                    slippage: slippageRatio,
                });

                console.log(`[AcrossService] getSwapQuote Success:`, quote);

                const toAmountAtomic = quote.steps.destinationSwap?.outputAmount || quote.steps.bridge?.outputAmount || "0";

                return {
                    toAmount: formatUnits(BigInt(toAmountAtomic), toToken.decimals),
                    fiatAmount: quote.fees.total.amountUsd || "0",
                    fromAmountUSD: quote.fees.total.amountUsd || "0",
                    toAmountUSD: quote.fees.total.amountUsd || "0",
                    slippage: finalSlippage, // Actual slippage percentage
                    gasEstimate: quote.fees.total.amount,
                    gasFee: `$${parseFloat(quote.fees.total.amountUsd).toFixed(2)}`,
                    twcFee: '0.00%', // Application fee REMOVED
                    source: ['Across', quote.crossSwapType],
                    txTo: quote.tx?.to || quote.approvalTxns?.[0]?.to || fromToken.address,
                    txData: quote.tx?.data || quote.approvalTxns?.[0]?.data || "0x",
                    txValue: quote.tx?.value || "0",
                    raw: quote,
                    router: 'across',
                };
            } catch (err: any) {
                lastError = err.message || "getSwapQuote failed";
                console.warn("[AcrossService] getSwapQuote failed:", lastError);

                // Fallback to basic bridge if it's a bridgeable asset (USDC, USDT, ETH, WBTC)
                const isBridgeable = ['USDC', 'USDT', 'DAI', 'ETH', 'WBTC', 'WBNB'].includes(fromToken.symbol);
                if (isBridgeable) {
                    console.log("[AcrossService] Trying basic getQuote fallback...");
                    const basicQuote = await this.client.getQuote({
                        route: {
                            originChainId: fromToken.chainId,
                            destinationChainId: toToken.chainId,
                            inputToken: getAddress(fromToken.address),
                            outputToken: getAddress(toToken.address),
                        },
                        inputAmount: amountIn,
                        recipient: getAddress(recipient),
                    });

                    return {
                        toAmount: formatUnits(basicQuote.deposit.outputAmount, toToken.decimals),
                        fiatAmount: "0",
                        slippage: 0.5,
                        gasEstimate: basicQuote.fees.totalRelayFee.total.toString(),
                        gasFee: `${formatUnits(basicQuote.fees.totalRelayFee.total, fromToken.decimals)} ${fromToken.symbol}`,
                        twcFee: '2.00%',
                        source: ['Across', 'Bridge'],
                        txTo: basicQuote.deposit.spokePoolAddress,
                        txData: "0x",
                        txValue: isFromNative ? amountIn.toString() : "0",
                        raw: basicQuote,
                        router: 'across',
                        quoteId: basicQuote.deposit.quoteTimestamp.toString(),
                    };
                }
                throw err;
            }
        } catch (error: any) {
            console.warn(`[AcrossService] Quote failure for ${fromToken.symbol} -> ${toToken.symbol}:`, error.message);
            return {
                toAmount: "0",
                fiatAmount: "0",
                router: "error",
                source: ["Error", "Across"],
                error: error.message || lastError,
                slippage: 0,
                gasEstimate: "0",
                gasFee: "0",
                twcFee: "0"
            } as any;
        }
    }

    /**
     * Fallback for same-chain swaps using local DEX routers
     */
    private async fetchSameChainDexQuote(
        fromAmount: string,
        fromToken: TokenMinimal,
        toToken: TokenMinimal,
        userSlippage?: number
    ): Promise<SwapQuote | null> {
        const chainId = fromToken.chainId;
        const routerAddress = KNOWN_ROUTERS[chainId];

        if (!routerAddress) {
            throw new Error(`Same-chain swaps not yet supported on chain ${chainId}. Try a cross-chain swap!`);
        }

        try {
            const publicClient = this.getPublicClient(chainId);
            const amountIn = parseUnits(fromAmount, fromToken.decimals);

            const fromAddr = fromToken.address === '0x0000000000000000000000000000000000000000' ? WRAPPED_NATIVE[chainId] : fromToken.address;
            const toAddr = toToken.address === '0x0000000000000000000000000000000000000000' ? WRAPPED_NATIVE[chainId] : toToken.address;

            // Intelligent Path Finding: [From, WETH, To] if not native, else [From, To]
            const weth = WRAPPED_NATIVE[chainId];
            let path: string[] = [];
            if (!weth || fromAddr === weth || toAddr === weth) {
                path = [fromAddr, toAddr];
            } else {
                path = [fromAddr, weth, toAddr];
            }

            const amounts = await publicClient.readContract({
                address: getAddress(routerAddress),
                abi: ROUTER_ABI,
                functionName: 'getAmountsOut',
                args: [amountIn, path],
            }) as bigint[];

            const outputAmountAtomic = amounts[amounts.length - 1];
            const toAmountFormatted = formatUnits(outputAmountAtomic, toToken.decimals);

            // Standard slippage for DEX swaps.
            const finalSlippage = userSlippage || 0.5;

            return {
                toAmount: toAmountFormatted,
                fiatAmount: "0",
                slippage: finalSlippage,
                gasEstimate: "200000",
                gasFee: "0.001 BNB",
                twcFee: "0.00%",
                source: ["DEX", "Local"],
                router: "dex",
                raw: { routerAddress, path } // Needed by DexExecutor
            };
        } catch (error: any) {
            console.warn("[AcrossService] DEX fallback failed:", error.message);
            throw new Error("DEX swap failed: No direct liquidity for this pair. Try another token.");
        }
    }
}

export const acrossService = new AcrossService();
