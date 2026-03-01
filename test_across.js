
const { acrossService } = require('./services/acrossService');
const { mainnet, optimism } = require('viem/chains');

async function testAcross() {
    console.log("Testing Across Protocol SDK with USDC...");

    // USDC Mainnet
    const fromToken = {
        symbol: 'USDC',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 6,
        chainId: 1
    };

    // USDC Optimism
    const toToken = {
        symbol: 'USDC',
        address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        decimals: 6,
        chainId: 10
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
            console.log("SUCCESS! Quote Received:");
            console.log(`From: 100 ${fromToken.symbol} at ${fromToken.chainId}`);
            console.log(`To: ${quote.toAmount} ${toToken.symbol} at ${toToken.chainId}`);
            console.log(`Fee: ${quote.gasFee}`);
            console.log(`Source: ${quote.source.join(' ')}`);
        } else {
            console.log("FAILURE: Quote was null.");
        }
    } catch (err) {
        console.error("Test failed with error:", err);
    }
}

testAcross();
