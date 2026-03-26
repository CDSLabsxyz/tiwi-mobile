import { createClient, convertViemChainToRelayChain } from "@relayprotocol/relay-sdk";
import { formatUnits, getAddress, parseUnits } from "viem";
import { arbitrum, base, bsc, mainnet, optimism, polygon, zksync, scroll, mantle, blast, lisk } from "viem/chains";
import { acrossService } from "./acrossService";
import { SwapQuote, TokenMinimal } from "./swap/types";

const SUPPORTED_CHAINS_RAW = [mainnet, optimism, arbitrum, bsc, polygon, base, zksync, scroll, mantle, blast, lisk];

class RelayService {
    // We initialize the client but also provide a helper to ensure it stays configured
    public client = createClient({
        baseApiUrl: "https://api.relay.link",
        source: "tiwi-mobile",
        chains: SUPPORTED_CHAINS_RAW.map(c => convertViemChainToRelayChain(c))
    });

    public ensureChains() {
        // Nuclear option: Re-inject chains into the global singleton
        this.client.configure({
            chains: SUPPORTED_CHAINS_RAW.map(c => convertViemChainToRelayChain(c))
        });
    }

    /**
     * Fetch a quote from Relay Protocol
     */
    async fetchRelayQuote(
        fromAmount: string,
        fromToken: TokenMinimal,
        toToken: TokenMinimal,
        fromAddress: string,
        recipient: string,
        slippage?: number
    ): Promise<SwapQuote | null> {
        try {
            const amountIn = parseUnits(fromAmount, fromToken.decimals);
            
            // RELAY USES 0x000... FOR NATIVE TOKENS
            const inputToken = fromToken.address === '0x0000000000000000000000000000000000000000' 
                ? '0x0000000000000000000000000000000000000000' 
                : getAddress(fromToken.address);
            const outputToken = toToken.address === '0x0000000000000000000000000000000000000000'
                ? '0x0000000000000000000000000000000000000000'
                : getAddress(toToken.address);

            // Re-sync chains to the global singleton before fetching
            this.ensureChains();

            console.log(`[RelayService] Requesting quote for ${inputToken} on ${fromToken.chainId} -> ${outputToken} on ${toToken.chainId}`);

            // Smart Slippage: Detect taxed tokens like TWC and use safe defaults
            const isTaxToken = fromToken.address.toLowerCase() === '0xda1060158f7d593667cce0a15db346bb3ffb3596';
            const finalSlippage = isTaxToken ? Math.max(slippage || 0, 15.0) : (slippage || 0.5);

            // RELAY TRICK: Quote for a lower amount to provide a safety buffer 
            // for SDK simulation gaps / potential token taxes.
            // For TWC (5% tax), we use a 95% quote. For others, 98% is a safe buffer.
            const amountToQuote = isTaxToken ? (amountIn * 95n) / 100n : (amountIn * 98n) / 100n;

            const payload = {
                chainId: Number(fromToken.chainId),
                toChainId: Number(toToken.chainId),
                currency: inputToken,
                toCurrency: outputToken,
                user: getAddress(fromAddress),
                recipient: getAddress(recipient || fromAddress),
                amount: amountToQuote.toString(),
                tradeType: 'EXACT_INPUT',
                options: {
                    slippageTolerance: finalSlippage.toString(),
                }
            } as any;

            console.log("[RelayService] Requesting quote with payload:", JSON.stringify(payload));

            const quote = await this.client.actions.getQuote(payload);

            if (!quote || !quote.steps) {
                console.warn("[RelayService] No quote returned from Relay");
                return null;
            }

            // RELAY V2 RESPONSE PARSING
            // The SDK returns a v2 response structure where output is in details.currencyOut
            const outputAmount = quote.details?.currencyOut?.amount || (quote as any).details?.outputAmount || "0";
            const outputAmountUsd = quote.details?.currencyOut?.amountUsd || (quote as any).details?.outputAmountUsd || "0";
            
            // Fees are in the fees object
            const relayerFee = quote.fees?.relayer;
            const gasFeeUsd = relayerFee?.amountUsd || "0";
            const gasFeeAtomic = relayerFee?.amount || "0";

            return {
                toAmount: formatUnits(BigInt(outputAmount), toToken.decimals),
                fiatAmount: outputAmountUsd,
                slippage: finalSlippage,
                gasEstimate: gasFeeAtomic,
                gasFee: `$${parseFloat(gasFeeUsd).toFixed(2)}`,
                twcFee: '0.00%', // Application fee REMOVED
                source: ['Relay'],
                txTo: quote.steps[0]?.items?.[0]?.data?.to || "",
                txData: quote.steps[0]?.items?.[0]?.data?.data || "0x",
                txValue: quote.steps[0]?.items?.[0]?.data?.value || "0",
                raw: {
                    ...quote,
                    _isRelayTrick: true,
                    _quoteAmount: amountToQuote.toString(),
                    _originalAmount: amountIn.toString()
                },
                router: 'relay',
            };
        } catch (error: any) {
            console.error(`[RelayService] Quote failure for ${fromToken.symbol} -> ${toToken.symbol}:`, error.message);
            
            if (error.response?.data) {
                console.error("[RelayService] API Error:", JSON.stringify(error.response.data));
            }
            return null;
        }
    }
}

export const relayService = new RelayService();
