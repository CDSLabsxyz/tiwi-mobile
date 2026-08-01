import {
    apeChain, arbitrum, arbitrumNova, aurora, avalanche, base, berachain, blast, bsc, coreDao,
    cronos, fantom, gnosis, hyperEvm, ink, kava, linea, lisk, mainnet, mantle, metis, mode, moonbeam,
    moonriver, optimism, polygon, polygonZkEvm, ronin, rootstock, scroll, sei, soneium, sonic,
    taiko, unichain, worldchain, zksync, zora,
} from 'viem/chains';

/**
 * Chains the local EVM signer can build a wallet client for.
 *
 * This map is load-bearing for correctness, not just convenience:
 * `getChainById` falls back to `mainnet`, so a chain missing here would be
 * signed with chainId 1 and broadcast against Ethereum. Anything that offers
 * an on-chain write for a given chain must therefore be gated on
 * `isSignerSupportedChain` (see constants/wrappedNatives.ts).
 */
export const EVM_CHAINS: Record<number, any> = {
    // Majors
    1: mainnet,
    137: polygon,
    42161: arbitrum,
    10: optimism,
    56: bsc,
    8453: base,
    43114: avalanche,

    // ETH-native L2s / rollups
    480: worldchain,
    130: unichain,
    57073: ink,
    1868: soneium,
    1135: lisk,
    34443: mode,
    7777777: zora,
    81457: blast,
    534352: scroll,
    59144: linea,
    324: zksync,
    1101: polygonZkEvm,
    167000: taiko,
    1313161554: aurora,
    42170: arbitrumNova,

    // Own-gas-token chains
    250: fantom,
    146: sonic,
    100: gnosis,
    25: cronos,
    1284: moonbeam,
    1285: moonriver,
    1088: metis,
    5000: mantle,
    1329: sei,
    999: hyperEvm,
    80094: berachain,
    33139: apeChain,
    2222: kava,
    1116: coreDao,
    2020: ronin,
    30: rootstock,
};

/** True when the local signer has a real chain definition for `chainId`. */
export function isSignerSupportedChain(chainId: number): boolean {
    return !!EVM_CHAINS[chainId];
}

export function getChainById(chainId: number) {
    return EVM_CHAINS[chainId] || mainnet;
}
