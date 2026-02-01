import { arbitrum, avalanche, base, bsc, mainnet, optimism, polygon } from 'viem/chains';

export const EVM_CHAINS: Record<number, any> = {
    1: mainnet,
    137: polygon,
    42161: arbitrum,
    10: optimism,
    56: bsc,
    8453: base,
    43114: avalanche,
};

export function getChainById(chainId: number) {
    return EVM_CHAINS[chainId] || mainnet;
}
