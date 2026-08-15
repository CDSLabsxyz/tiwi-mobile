/**
 * Tax Configuration
 *
 * Multi-chain revenue wallet configuration and tax rate settings.
 * Tax is charged on all swaps as a percentage of the FROM amount.
 */

// ============================================================================
// Chain Types
// ============================================================================

export type ChainType = 'evm' | 'solana' | 'cosmos' | 'tron' | 'ton';

// ============================================================================
// Revenue Wallets
// ============================================================================

/**
 * Revenue wallet addresses for each chain
 * Tax fees are sent to these wallets
 */
export const REVENUE_WALLETS: Record<ChainType, string> = {
  evm: '0x2452fc6b401fab80d9fda6050b2de0dd42b233bc',
  solana: 'FGpaSPsz144JaHZLXZmpP4MGKWctSpTE1eNzxh2y71L2',
  cosmos: 'cosmos1z0h0ew2zvrkx5622p9zl37vht5wudgfcg77w07',
  tron: 'TAtWtEqhL7NREPhowfQLpXmnjTwS1SwDxb',
  ton: 'UQDfQBlcPdgzUC82xmIxCaefMbY5mNnI9iQOM69Psv60l8kb',
};

// ============================================================================
// Tax Rates (in basis points, 100 = 1%)
// ============================================================================

/**
 * Gas token types for BSC relayer
 */
export enum GasTokenType {
  TWC = 0,        // 0.20% tax - incentivizes TWC usage
  BNB = 1,        // 0.25% tax - default native gas
  OTHER_BSC = 2,  // 0.30% tax - premium for flexibility
}

/**
 * Tax rates in basis points
 */
export const TAX_RATES = {
  // BSC Relayer rates (based on gas token choice)
  BSC_TWC: 20,        // 0.20% when using TWC for gas
  BSC_BNB: 25,        // 0.25% when using BNB for gas
  BSC_OTHER: 30,      // 0.30% when using other BSC tokens for gas

  // Default rate for all other chains (no relayer)
  DEFAULT: 25,        // 0.25%
} as const;

/**
 * Basis points denominator
 */
export const BASIS_POINTS = 10000;

// ============================================================================
// BSC Relayer Configuration
// ============================================================================

/**
 * BSC Relayer contract addresses
 */
export const BSC_RELAYER_CONFIG = {
  // Mainnet - V1 (user pays gas)
  mainnet: {
    chainId: 56,
    relayerContract: '0xa08cd8BE5663f1Ee83B503C960dcf328C10bde64',
    twcToken: '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596',
    relayerWallet: '0x2452fc6b401fab80d9fda6050b2de0dd42b233bc',
    // Allowed routers (must be whitelisted in the contract)
    allowedRouters: [
      '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2 Router
      '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4', // PancakeSwap V3 SwapRouter
    ],
  },
  // Testnet
  testnet: {
    chainId: 97,
    relayerContract: '', // TODO: Add after deployment
    twcToken: '', // Add testnet TWC if needed
    relayerWallet: '0x2452fc6b401fab80d9fda6050b2de0dd42b233bc',
    allowedRouters: [],
  },
} as const;

/**
 * BSC Relayer V2.1 Configuration (TRUE GASLESS - relayer pays gas)
 *
 * V2.1 uses meta-transactions with native BNB output support:
 * 1. User signs swap request (EIP-712) - FREE
 * 2. Backend relayer submits transaction using its own BNB
 * 3. User pays fee in tokens to compensate relayer
 * 4. Native BNB output (not WBNB) when swapping to BNB
 */
export const BSC_RELAYER_V2_CONFIG = {
  // Mainnet - V2.1 (relayer pays gas, native BNB support)
  mainnet: {
    chainId: 56,
    // V2.1 Contract: 0x6011D1b2f97361528749635632E5d477b9AA395f (deployed 2026-08-09).
    // The previous default here, 0xfCa2E4468bb376F5b74834F75D76714390b4540A, was
    // V2 and is dead - it is what the hand-ported gasless executor was pointing
    // at. relayerWallet below is still the live fee/drip wallet and is read by
    // the server, so only the contract address was stale.
    relayerContract: process.env.EXPO_PUBLIC_BSC_RELAYER_V2_CONTRACT || '0x6011D1b2f97361528749635632E5d477b9AA395f',
    twcToken: '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596',
    revenueWallet: '0x2452fc6b401fab80d9fda6050b2de0dd42b233bc',  // Tax fees go here
    relayerWallet: '0x3292311984Fc13F265d4D434778FB3C87689BC3A',  // Gas reimbursements go here
    // Allowed routers
    allowedRouters: [
      '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2 Router
      '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4', // PancakeSwap V3 SwapRouter
      '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE', // LiFi Diamond
    ],
  },
  testnet: {
    chainId: 97,
    relayerContract: '',
    twcToken: '',
    revenueWallet: '0x2452fc6b401fab80d9fda6050b2de0dd42b233bc',
    relayerWallet: '0x2452fc6b401fab80d9fda6050b2de0dd42b233bc',
    allowedRouters: [],
  },
} as const;

/**
 * Check if gasless (V2) relayer is available
 */
export function isGaslessRelayerAvailable(chainId: number): boolean {
  if (chainId === 56) {
    return !!BSC_RELAYER_V2_CONFIG.mainnet.relayerContract;
  }
  if (chainId === 97) {
    return !!BSC_RELAYER_V2_CONFIG.testnet.relayerContract;
  }
  return false;
}

/**
 * WBNB address on BSC
 */
export const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// ============================================================================
// Chain ID to Chain Type Mapping
// ============================================================================

/**
 * Map chain IDs to chain types
 */
export function getChainType(chainId: number): ChainType {
  // Solana
  if (chainId === 7565164) return 'solana';

  // TRON
  if (chainId === 728126428) return 'tron';

  // TON
  if (chainId === 607) return 'ton';

  // Cosmos chains
  const cosmosChainIds = [
    118,      // Cosmos Hub
    529,      // Secret
    330,      // Terra
    990,      // Kava
    459,      // Akash
    500,      // Osmosis
  ];
  if (cosmosChainIds.includes(chainId)) return 'cosmos';

  // Default to EVM
  return 'evm';
}

/**
 * Get revenue wallet for a chain
 */
export function getRevenueWallet(chainId: number): string {
  const chainType = getChainType(chainId);
  return REVENUE_WALLETS[chainType];
}

/**
 * Check if chain uses BSC relayer
 */
export function usesBscRelayer(chainId: number): boolean {
  return chainId === 56 || chainId === 97; // BSC mainnet or testnet
}

/**
 * Get tax rate for a chain/gas token combination
 * @param chainId - Chain ID
 * @param gasTokenType - Gas token type (for BSC only)
 * @returns Tax rate in basis points
 */
export function getTaxRate(chainId: number, gasTokenType?: GasTokenType): number {
  // BSC with relayer - rate depends on gas token choice
  if (usesBscRelayer(chainId) && gasTokenType !== undefined) {
    switch (gasTokenType) {
      case GasTokenType.TWC:
        return TAX_RATES.BSC_TWC;
      case GasTokenType.BNB:
        return TAX_RATES.BSC_BNB;
      case GasTokenType.OTHER_BSC:
        return TAX_RATES.BSC_OTHER;
    }
  }

  // All other chains use default rate
  return TAX_RATES.DEFAULT;
}

/**
 * Integrator (inline) fee for a chain: the same Tiwi tax rate, packaged for an
 * aggregator's native fee parameter (LiFi `fee`, Relay `appFees`, OpenOcean `referrerFee`).
 * When a router collects this inline, the fee is skimmed INSIDE the swap tx - no separate
 * transfer signature. `bps` is basis points; `recipient` is the chain's revenue wallet.
 */
export function getIntegratorFee(
  chainId: number,
  gasTokenType?: GasTokenType
): { bps: number; recipient: string } {
  return {
    bps: getTaxRate(chainId, gasTokenType),
    recipient: getRevenueWallet(chainId),
  };
}

/**
 * Whether a router should collect the Tiwi fee INLINE (folded into the swap via the
 * aggregator's integrator-fee param) instead of as a separate transfer signature.
 *
 * Controlled by NEXT_PUBLIC_INLINE_FEE_ROUTERS - a comma-separated list of router names
 * (e.g. "relay,openocean"). Empty/unset → every router keeps the current separate-transfer
 * behavior, so this is a safe, reversible, per-router rollout switch.
 */
export function isInlineFeeRouter(router: string): boolean {
  const raw = process.env.EXPO_PUBLIC_INLINE_FEE_ROUTERS || '';
  if (!raw.trim()) return false;
  const enabled = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return enabled.includes((router || '').toLowerCase());
}

/**
 * Calculate tax amount
 * @param fromAmount - Swap input amount (human readable)
 * @param chainId - Chain ID
 * @param gasTokenType - Gas token type (for BSC only)
 * @returns Tax amount in the same units as fromAmount
 */
export function calculateTaxAmount(
  fromAmount: string,
  chainId: number,
  gasTokenType?: GasTokenType
): string {
  const amount = parseFloat(fromAmount);
  if (isNaN(amount) || amount <= 0) return '0';

  const taxRate = getTaxRate(chainId, gasTokenType);
  const taxAmount = (amount * taxRate) / BASIS_POINTS;

  return taxAmount.toFixed(8);
}

/**
 * Calculate tax in USD
 * @param fromAmountUSD - Swap input amount in USD
 * @param chainId - Chain ID
 * @param gasTokenType - Gas token type (for BSC only)
 * @returns Tax amount in USD
 */
export function calculateTaxUSD(
  fromAmountUSD: number,
  chainId: number,
  gasTokenType?: GasTokenType
): string {
  if (fromAmountUSD <= 0) return '0.00';

  const taxRate = getTaxRate(chainId, gasTokenType);
  const taxAmount = (fromAmountUSD * taxRate) / BASIS_POINTS;

  return taxAmount.toFixed(6);
}
