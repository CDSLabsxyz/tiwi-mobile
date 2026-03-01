
const { acrossService } = require('./services/acrossService');

async function listAcrossSupport() {
    console.log("Listing Across Support...");
    try {
        const chains = await acrossService.client.getSwapChains();
        console.log("Supported Chains:", chains);

        const tokens = await acrossService.client.getSwapTokens();
        console.log("Supported Tokens First 5:", tokens.slice(0, 5));
    } catch (err) {
        console.error("List failed:", err);
    }
}

listAcrossSupport();
