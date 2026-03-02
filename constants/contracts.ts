/**
 * Contract Addresses
 * Common contract addresses used across different chains
 */

export const DISPERSE_CONTRACTS: Record<number, string> = {
    1: '0xD152f549545093347A162Dce210e7293f1452150', // Mainnet (D15 is common here)
    10: '0xd152f549545093347a162dce210e7293f1452150', // Optimism
    137: '0xd152f549545093347a162dce210e7293f1452150', // Polygon
    42161: '0xd152f549545093347a162dce210e7293f1452150', // Arbitrum
    56: '0xd152f549545093347a162dce210e7293f1452150', // BSC
};

export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

export const STAKING_FACTORY_ADDRESSES: Record<number, `0x${string}`> = {
    56: '0x8505c412Ba61e5B260686a260C5213905DAAa130', // BSC Production
};
