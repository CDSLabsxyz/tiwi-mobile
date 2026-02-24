import { APIStakingPool, APIUserStake } from '@/services/apiClient';

/**
 * Mock Staking Pools for UI implementation and testing
 * High-quality metrics to ensure rich visuals (web-like APYs and TVLs)
 */
export const MOCK_STAKING_POOLS: APIStakingPool[] = [
    {
        id: 'mock-1',
        tokenSymbol: 'TWC',
        tokenName: 'TIWICAT',
        apy: 12.5,
        tokenLogo: null, // Will use local icon in UI
        minStakeAmount: 50,
        maxStakeAmount: 1000000,
        contractAddress: '0x9178044f7cC0DD0dB121E7fCD4b068a0d1B76b07',
        chainId: 56,
        tokenAddress: '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596',
        poolId: 0,
    },
    {
        id: 'mock-2',
        tokenSymbol: 'BTC',
        tokenName: 'Bitcoin',
        apy: 5.4,
        tokenLogo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
        minStakeAmount: 0.001,
        maxStakeAmount: 10,
        contractAddress: '0x9178044f7cC0DD0dB121E7fCD4b068a0d1B76b07',
        chainId: 56,
        tokenAddress: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // BEP20 BTCB
        poolId: 1,
        status: 'active'
    },
    {
        id: 'mock-3',
        tokenSymbol: 'ETH',
        tokenName: 'Ethereum',
        apy: 8.2,
        tokenLogo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        minStakeAmount: 0.01,
        maxStakeAmount: 100,
        contractAddress: '0x9178044f7cC0DD0dB121E7fCD4b068a0d1B76b07',
        chainId: 56,
        tokenAddress: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // BEP20 ETH
        poolId: 2,
        status: 'active'
    }
];

/**
 * Mock User Stakes to simulate active positions
 */
export const MOCK_USER_STAKES: APIUserStake[] = [
    {
        id: 'user-stake-1',
        userWallet: '0x...',
        pool: MOCK_STAKING_POOLS[0],
        stakedAmount: 5000,
        rewardsEarned: 124.5,
        lockPeriodDays: 30,
        status: 'active',
        createdAt: new Date().toISOString(),
    },
    {
        id: 'user-stake-2',
        userWallet: '0x...',
        pool: MOCK_STAKING_POOLS[1],
        stakedAmount: 0.05,
        rewardsEarned: 0.002,
        lockPeriodDays: null, // Flexible
        status: 'active',
        createdAt: new Date().toISOString(),
    }
];
