/**
 * Cosmos-family chain config for on-device signing.
 *
 * Values mirror the web app's COSMOS_MULTISEND_CONFIG (lib/wallet/utils/
 * multi-send-cosmos.ts) exactly - wrong denom/gasPrice = failed tx.
 *
 * Injective (8000001) is DELIBERATELY EXCLUDED: it's eth_secp256k1 (its inj1…
 * address is the EVM key re-encoded, coinType 60), so DirectSecp256k1HdWallet
 * (coinType 118) would derive the WRONG account. Injective needs its own engine
 * (@injectivelabs/sdk-ts). THORChain (8000002) is excluded too (non-standard
 * bank/fee model), matching the web.
 */

import type { AddressKey } from '@/store/walletStore';

export interface CosmosNetwork {
    /** cosmos.directory chain slug, used for the RPC endpoint. */
    registryName: string;
    /** bech32 address prefix (cosmos, osmo, juno, …). */
    prefix: string;
    /** denom used for a native send. */
    nativeDenom: string;
    /** Gas price "<amount><denom>" for cosmjs auto-fee. */
    gasPrice: string;
    /** Extra RPC endpoints tried (in order) if the cosmos.directory proxy fails. */
    extraRpcs?: string[];
    /** The wallet-address key this chain's address is stored under. */
    addressKey: AddressKey;
    /** Native token decimals (for the send-amount fallback). */
    decimals: number;
}

/** Keyed by our canonical chainId. */
export const COSMOS_CHAIN_CONFIG: Record<number, CosmosNetwork> = {
    118:     { registryName: 'cosmoshub', prefix: 'cosmos',   nativeDenom: 'uatom', gasPrice: '0.025uatom', extraRpcs: ['https://cosmos-rpc.publicnode.com:443'], addressKey: 'COSMOS',    decimals: 6 },
    249339:  { registryName: 'osmosis',   prefix: 'osmo',     nativeDenom: 'uosmo', gasPrice: '0.025uosmo', extraRpcs: ['https://osmosis-rpc.publicnode.com:443'], addressKey: 'OSMOSIS',  decimals: 6 },
    8000003: { registryName: 'juno',      prefix: 'juno',     nativeDenom: 'ujuno', gasPrice: '0.075ujuno', addressKey: 'JUNO',     decimals: 6 },
    8000004: { registryName: 'stride',    prefix: 'stride',   nativeDenom: 'ustrd', gasPrice: '0.025ustrd', addressKey: 'STRIDE',   decimals: 6 },
    8000005: { registryName: 'dydx',      prefix: 'dydx',     nativeDenom: 'adydx', gasPrice: '25000000000adydx', addressKey: 'DYDX', decimals: 18 },
    8000006: { registryName: 'kujira',    prefix: 'kujira',   nativeDenom: 'ukuji', gasPrice: '0.0034ukuji', addressKey: 'KUJIRA',   decimals: 6 },
    8000007: { registryName: 'secretnetwork', prefix: 'secret', nativeDenom: 'uscrt', gasPrice: '0.25uscrt', addressKey: 'SECRET', decimals: 6 },
    8000008: { registryName: 'celestia',  prefix: 'celestia', nativeDenom: 'utia',  gasPrice: '0.02utia',  addressKey: 'CELESTIA', decimals: 6 },
    8000009: { registryName: 'archway',   prefix: 'archway',  nativeDenom: 'aarch', gasPrice: '1000000000000aarch', addressKey: 'ARCHWAY', decimals: 18 },
    8000010: { registryName: 'saga',      prefix: 'saga',     nativeDenom: 'usaga', gasPrice: '0.025usaga', addressKey: 'SAGA',     decimals: 6 },
    8000011: { registryName: 'neutron',   prefix: 'neutron',  nativeDenom: 'untrn', gasPrice: '0.025untrn', addressKey: 'NEUTRON',  decimals: 6 },
    8000012: { registryName: 'nibiru',    prefix: 'nibi',     nativeDenom: 'unibi', gasPrice: '0.025unibi', addressKey: 'NIBIRU',   decimals: 6 },
};

export function getCosmosConfig(chainId: number | string | undefined): CosmosNetwork | undefined {
    return COSMOS_CHAIN_CONFIG[Number(chainId)];
}

export function isCosmosChainId(chainId: number | string | undefined): boolean {
    return !!getCosmosConfig(chainId);
}

export function cosmosRpcUrls(network: CosmosNetwork): string[] {
    return [
        `https://rpc.cosmos.directory/${network.registryName}`,
        ...(network.extraRpcs ?? []),
    ];
}
