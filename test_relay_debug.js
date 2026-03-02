
const { createClient } = require("@relayprotocol/relay-sdk");
const { parseUnits, getAddress, formatUnits } = require("viem");

async function testRelay() {
    const client = createClient({
        baseApiUrl: "https://api.relay.link",
        source: "tiwi-mobile"
    });

    const fromToken = {
        symbol: "TWC",
        address: "0xDA1060158F7D593667cCE0a15DB346BB3FfB3596",
        decimals: 18,
        chainId: 56
    };

    const toToken = {
        symbol: "ETH",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        chainId: 1
    };

    const fromAmount = "1000000000"; // 1B TWC
    const amountIn = parseUnits(fromAmount, fromToken.decimals);
    const fromAddress = "0xb827487001633584F38A076fB758DeecDFDCfAFe";

    console.log(`Testing Relay Quote for ${fromToken.symbol} -> ${toToken.symbol}`);

    try {
        const payload = {
            chainId: Number(fromToken.chainId),
            toChainId: Number(toToken.chainId),
            currency: fromToken.address,
            toCurrency: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            user: getAddress(fromAddress),
            recipient: getAddress(fromAddress),
            amount: amountIn.toString(),
            tradeType: 'EXACT_INPUT',
            slippageTolerance: "0.5",
        };

        console.log("Payload:", JSON.stringify(payload, null, 2));
        const quote = await client.actions.getQuote(payload);
        console.log("Quote Success:", JSON.stringify(quote, null, 2));
    } catch (error) {
        console.error("Quote Failed:", error.message);
        if (error.response?.data) {
            console.error("API Error Detail:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

testRelay().catch(console.error);
