
const { createClient } = require("@relayprotocol/relay-sdk");
const { parseUnits, getAddress, formatUnits } = require("viem");

async function testRelay() {
    const client = createClient({
        baseApiUrl: "https://api.relay.link",
        source: "tiwi-mobile"
    });

    const fromAddress = "0xb827487001633584F38A076fB758DeecDFDCfAFe";

    console.log(`Testing Relay Quote for BNB (56) -> ETH (1) using 0x0...`);

    try {
        const payload = {
            chainId: 56,
            toChainId: 1,
            currency: "0x0000000000000000000000000000000000000000",
            toCurrency: "0x0000000000000000000000000000000000000000",
            user: getAddress(fromAddress),
            recipient: getAddress(fromAddress),
            amount: parseUnits("0.01", 18).toString(),
            tradeType: 'EXACT_INPUT',
        };

        const quote = await client.actions.getQuote(payload);
        console.log("Quote Success!");
        console.log("Result:", JSON.stringify(quote, null, 2));
    } catch (error) {
        console.error("Quote Failed:", error.message);
        if (error.response?.data) {
            console.error("API Error:", JSON.stringify(error.response.data));
        }
    }
}

testRelay().catch(console.error);
