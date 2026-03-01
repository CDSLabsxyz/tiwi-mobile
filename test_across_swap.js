
const { acrossService } = require('./services/acrossService');

async function testAcrossServiceManual() {
    console.log("Testing Across Protocol refined AcrossService with CORRECT addresses...");

    // USDC Mainnet
    const fromToken = {
        symbol: 'USDC',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 6,
        chainId: 1
    };

    // USDC Arbitrum (Verified from Across SDK)
    const toToken = {
        symbol: 'USDC',
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        decimals: 6,
        chainId: 42161
    };

    const fromAddress = '0x1c4CC0158444565C2D437A92Ab2B2B3C4D5e6f7a';

    try {
        const quote = await acrossService.fetchAcrossQuote(
            "100", // 100 USDC
            fromToken,
            toToken,
            fromAddress,
            fromAddress
        );

        if (quote) {
            console.log("SUCCESS! Service Quote Received:");
            console.log(`From: 100 ${fromToken.symbol} at Chain ${fromToken.chainId}`);
            console.log(`To: ${quote.toAmount} ${toToken.symbol} at Chain ${toToken.chainId}`);
            console.log(`Fee: ${quote.gasFee}`);
            console.log(`Source: ${quote.source.join(' ')}`);
        } else {
            console.log("FAILURE: Service returned null.");
        }
    } catch (err) {
        console.error("Manual Test failed with error:", err.message);
    }
}

testAcrossServiceManual();
