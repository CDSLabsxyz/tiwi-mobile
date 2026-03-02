
const { createClient } = require("@relayprotocol/relay-sdk");
const { parseUnits, getAddress, formatUnits } = require("viem");

async function testRelay() {
    const client = createClient({
        baseApiUrl: "https://api.relay.link",
        source: "tiwi-mobile"
    });

    const fromToken = {
        symbol: "BNB",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        chainId: 56
    };

    const toToken = {
        symbol: "ETH",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        chainId: 1
    };

    const fromAmount = "0.01"; 
    const amountIn = parseUnits(fromAmount, fromToken.decimals);
    const fromAddress = "0xb827487001633584F38A076fB758DeecDFDCfAFe";

    console.log(`Testing Relay Quote for ${fromToken.symbol} -> ${toToken.symbol}`);

    try {
        const payload = {
            chainId: Number(fromToken.chainId),
            toChainId: Number(toToken.chainId),
            currency: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            toCurrency: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            user: getAddress(fromAddress),
            recipient: getAddress(fromAddress),
            amount: amountIn.toString(),
            tradeType: 'EXACT_INPUT',
            slippageTolerance: "0.5",
        };

        const quote = await client.actions.getQuote(payload);
        console.log("Quote Success!");
        console.log("To Amount:", formatUnits(quote.details.outputAmount, 18));
    } catch (error) {
        console.error("Quote Failed:", error.message);
    }
}

testRelay().catch(console.error);
