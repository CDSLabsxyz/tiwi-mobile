/**
 * Staking Factory ABI
 * Extracted from TiwiStakingPoolFactory.json
 */
export const STAKING_FACTORY_ABI = [
    {
        inputs: [
            { internalType: 'uint256', name: '_poolId', type: 'uint256' }
        ],
        name: 'getPoolInfo',
        outputs: [
            {
                components: [
                    { internalType: 'uint256', name: 'poolId', type: 'uint256' },
                    { internalType: 'address', name: 'stakingToken', type: 'address' },
                    { internalType: 'address', name: 'rewardToken', type: 'address' },
                    { internalType: 'address', name: 'poolOwner', type: 'address' },
                    { internalType: 'uint256', name: 'poolReward', type: 'uint256' },
                    { internalType: 'uint256', name: 'rewardDurationSeconds', type: 'uint256' },
                    { internalType: 'uint256', name: 'maxTvl', type: 'uint256' },
                    { internalType: 'uint256', name: 'rewardPerSecond', type: 'uint256' },
                    { internalType: 'uint256', name: 'startTime', type: 'uint256' },
                    { internalType: 'uint256', name: 'endTime', type: 'uint256' },
                    { internalType: 'bool', name: 'active', type: 'bool' },
                    { internalType: 'uint256', name: 'createdAt', type: 'uint256' }
                ],
                internalType: 'struct TiwiStakingPoolFactory.PoolConfig',
                name: 'config',
                type: 'tuple'
            },
            {
                components: [
                    { internalType: 'uint256', name: 'totalStaked', type: 'uint256' },
                    { internalType: 'uint256', name: 'accRewardPerShare', type: 'uint256' },
                    { internalType: 'uint256', name: 'lastRewardTime', type: 'uint256' },
                    { internalType: 'uint256', name: 'rewardBalance', type: 'uint256' },
                    { internalType: 'bool', name: 'funded', type: 'bool' }
                ],
                internalType: 'struct TiwiStakingPoolFactory.PoolState',
                name: 'state',
                type: 'tuple'
            }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'getActivePoolIds',
        outputs: [
            { internalType: 'uint256[]', name: '', type: 'uint256[]' }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [
            { internalType: 'address', name: '_stakingToken', type: 'address' },
            { internalType: 'address', name: '_rewardToken', type: 'address' }
        ],
        name: 'getPoolsByTokenPair',
        outputs: [
            { internalType: 'uint256[]', name: '', type: 'uint256[]' }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [
            { internalType: 'uint256', name: '_poolId', type: 'uint256' },
            { internalType: 'address', name: '_user', type: 'address' }
        ],
        name: 'getUserInfo',
        outputs: [
            { internalType: 'uint256', name: 'amount', type: 'uint256' },
            { internalType: 'uint256', name: 'rewardDebt', type: 'uint256' },
            { internalType: 'uint256', name: 'stakeTime', type: 'uint256' },
            { internalType: 'uint256', name: 'pending', type: 'uint256' }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [
            { internalType: 'uint256', name: '_poolId', type: 'uint256' },
            { internalType: 'address', name: '_user', type: 'address' }
        ],
        name: 'pendingReward',
        outputs: [
            { internalType: 'uint256', name: '', type: 'uint256' }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [
            { internalType: 'uint256', name: '_poolId', type: 'uint256' },
            { internalType: 'uint256', name: '_amount', type: 'uint256' }
        ],
        name: 'deposit',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [
            { internalType: 'uint256', name: '_poolId', type: 'uint256' },
            { internalType: 'uint256', name: '_amount', type: 'uint256' }
        ],
        name: 'withdraw',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [
            { internalType: 'uint256', name: '_poolId', type: 'uint256' }
        ],
        name: 'claim',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    }
] as const;

export const ERC20_ABI = [
    {
        inputs: [
            { internalType: 'address', name: 'spender', type: 'address' },
            { internalType: 'uint256', name: 'amount', type: 'uint256' }
        ],
        name: 'approve',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [
            { internalType: 'address', name: 'owner', type: 'address' },
            { internalType: 'address', name: 'spender', type: 'address' }
        ],
        name: 'allowance',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
    }
] as const;
