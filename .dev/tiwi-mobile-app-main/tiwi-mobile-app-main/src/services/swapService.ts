/**
 * Swap service - handles swap-related API calls
 * Moved from utils/swap.ts for better organization
 */

export interface SwapQuote {
  toAmount: string;
  fiatAmount: string;
  rate: number;
  slippage: number;
  gasEstimate: string;
  gasFee: string; // Gas fee as percentage (e.g., "0.001%")
  twcFee: string; // TWC fee as percentage (e.g., "0.40%")
  source: string[]; // Source array (e.g., ["Best", "TWC"])
}

/**
 * Token price mapping (simulated)
 * In production, this would come from a price oracle or DEX aggregator
 */
const TOKEN_PRICES: Record<string, number> = {
  twc: 1.0, // TWC = $1
  usdc: 1.0, // USDC = $1 (stablecoin)
  tether: 1.0, // USDT = $1 (stablecoin)
  bnb: 600.0, // BNB = $600 (example)
};

/**
 * Exchange rates between token pairs (simulated)
 * In production, this would come from a DEX aggregator API
 */
const EXCHANGE_RATES: Record<string, Record<string, number>> = {
  twc: {
    usdc: 0.95, // 1 TWC = 0.95 USDC
    tether: 0.94, // 1 TWC = 0.94 USDT
    bnb: 0.00167, // 1 TWC = 0.00167 BNB (1/600)
  },
  usdc: {
    twc: 1.05, // 1 USDC = 1.05 TWC
    tether: 0.999, // 1 USDC = 0.999 USDT
    bnb: 0.00167, // 1 USDC = 0.00167 BNB
  },
  tether: {
    twc: 1.06, // 1 USDT = 1.06 TWC
    usdc: 1.001, // 1 USDT = 1.001 USDC
    bnb: 0.00167, // 1 USDT = 0.00167 BNB
  },
  bnb: {
    twc: 600.0, // 1 BNB = 600 TWC
    usdc: 600.0, // 1 BNB = 600 USDC
    tether: 600.0, // 1 BNB = 600 USDT
  },
};

/**
 * Simulates fetching a swap quote from the API
 * In production, this would call the actual swap aggregator API
 */
export async function fetchSwapQuote(
  fromAmount: string,
  fromTokenId: string,
  toTokenId: string
): Promise<SwapQuote> {
  // Simulate API delay (300ms - 800ms for better UX and faster testing)
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));

  const amount = parseFloat(fromAmount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Invalid amount");
  }

  // Normalize token IDs to lowercase
  const fromId = fromTokenId.toLowerCase();
  const toId = toTokenId.toLowerCase();

  // Get exchange rate
  let rate: number;
  if (fromId === toId) {
    rate = Math.floor(1.0); // Same token
  } else if (EXCHANGE_RATES[fromId] && EXCHANGE_RATES[fromId][toId]) {
    rate = EXCHANGE_RATES[fromId][toId];
  } else {
    // Fallback: use price-based calculation
    const fromPrice = TOKEN_PRICES[fromId] || 1.0;
    const toPrice = TOKEN_PRICES[toId] || 1.0;
    rate = fromPrice / toPrice;
  }

  // Calculate output amount
  const toAmountValue = amount * rate;
  
  // Format based on token value
  // For very large values, use fewer decimals; for small values, show more
  let toAmount: string;
  if (toAmountValue >= 1000000) {
    // For millions+, show 2 decimals
    toAmount = toAmountValue.toFixed(2);
  } else if (toAmountValue >= 1000) {
    // For thousands, show 2 decimals
    toAmount = toAmountValue.toFixed(2);
  } else if (toAmountValue >= 1) {
    // For values >= 1, show 4 decimals
    toAmount = toAmountValue.toFixed(4);
  } else {
    // For values < 1, show 6 decimals
    toAmount = toAmountValue.toFixed(6);
  }
  
  // Remove trailing zeros for cleaner display, but ensure it's never empty
  toAmount = parseFloat(toAmount).toString();
  
  // Safety check: ensure toAmount is never empty or invalid
  if (!toAmount || toAmount === "" || toAmount === "NaN" || isNaN(parseFloat(toAmount))) {
    // Fallback to a safe default calculation
    toAmount = (amount * 0.95).toFixed(4);
  }

  // Calculate fiat value (USD)
  const toPrice = TOKEN_PRICES[toId] || 1.0;
  const fiatValue = toAmountValue * toPrice;
  const fiatAmount = `$${fiatValue.toFixed(2)}`;

  console.log("📊 Quote Calculation Complete:", {
    fromAmount: amount,
    fromToken: fromId,
    toToken: toId,
    rate: rate,
    calculatedToAmount: toAmountValue,
    formattedToAmount: toAmount,
    fiatAmount: fiatAmount,
  });

  return {
    toAmount,
    fiatAmount,
    rate,
    slippage: 0.5,
    gasEstimate: "0.001",
    gasFee: "0.001%", // Gas fee from API
    twcFee: "0.40%", // TWC fee from API
    source: ["Best", "TWC"], // Source from API
  };
}

/**
 * Simulates executing a swap transaction
 * In production, this would submit the transaction to the blockchain
 */
export async function executeSwap(
  fromAmount: string,
  fromTokenId: string,
  toTokenId: string
): Promise<{ txHash: string }> {
  // Simulate transaction processing (2-3 seconds)
  await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000));

  // Generate a mock transaction hash
  const txHash = `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("")}`;

  return { txHash };
}

