/**
 * The wallet's network list — the single source of truth for every screen that
 * shows "which chains does this wallet have an address on".
 *
 * This MIRRORS the web app's `chains` array in
 * `tiwi-user-app/components/wallet/address-selector-dropdown.tsx`: same order,
 * same labels, same networks. The mobile app derives the same 27 accounts as
 * the web app (see `deriveMultiChainAddressesFromMnemonic`), but each mobile
 * screen used to carry its own hand-written subset — 12 rows in Account
 * Settings, 17 in the wallet modal — so most of the derived addresses were
 * invisible and unreachable. One list, imported everywhere, fixes that.
 *
 * `addressKey` is the slot in `WalletGroup.addresses` a row displays, and
 * `chain` is the ChainType made active when it is selected. They differ for the
 * Cosmos-family chains: Juno/Celestia/… are one COSMOS secp256k1 account
 * re-encoded per bech32 prefix, so they all sign as COSMOS while each showing
 * its own address.
 *
 * Icons prefer a bundled asset (instant, works offline) and fall back to the
 * same CDN URL the web app uses when we have no local file.
 */

import type { AddressKey, ChainType } from '@/store/walletStore';

export interface WalletNetwork {
    /** Stable id — persisted as `activeNetworkId`, so never rename these. */
    id: string;
    name: string;
    /** Which `addresses` slot this row shows. */
    addressKey: AddressKey;
    /**
     * The ChainType activated when this row is selected. OMITTED for chains the
     * app derives and can receive on but cannot yet sign for (Polkadot, the
     * non-Bitcoin UTXO chains, Stacks, THORChain) — those rows display and copy
     * their address but must never become the active signing chain, or a send
     * would be routed to an engine for a different chain.
     */
    chain?: ChainType;
    /** Canonical numeric id (EIP-155 for EVM). */
    chainId?: number;
    symbol?: string;
    /** `require(...)` asset or `{ uri }` — both accepted by expo-image. */
    icon: any;
}

const local = {
    ethereum: require('@/assets/home/chains/ethereum.svg'),
    bsc: require('@/assets/home/chains/bsc.svg'),
    solana: require('@/assets/home/chains/solana.svg'),
    tron: require('@/assets/home/chains/tron.png'),
    ton: require('@/assets/home/chains/ton.jpg'),
    sui: require('@/assets/home/chains/sui.svg'),
    polygon: require('@/assets/home/chains/polygon.svg'),
    base: require('@/assets/home/chains/base.png'),
    optimism: require('@/assets/home/chains/optimism.png'),
    avalanche: require('@/assets/home/chains/avalanche.svg'),
    cosmos: require('@/assets/home/chains/cosmos.svg'),
    osmosis: require('@/assets/home/chains/osmosis.svg'),
    injective: require('@/assets/home/chains/injective.svg'),
    aptos: require('@/assets/home/chains/aptos.svg'),
    bitcoin: require('@/assets/home/chains/bitcoin.svg'),
    starknet: require('@/assets/home/chains/starknet.svg'),
};

/** CDN icons — identical URLs to the web app's list, for chains with no asset. */
const remote = {
    sei: { uri: 'https://assets.coingecko.com/coins/images/28205/small/Sei_Logo_-_Transparent.png' },
    arbitrum: { uri: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg' },
    linea: { uri: 'https://assets.coingecko.com/asset_platforms/images/135/small/linea.jpeg' },
    zksync: { uri: 'https://assets.coingecko.com/asset_platforms/images/121/small/zksync.jpeg' },
    scroll: { uri: 'https://assets.coingecko.com/asset_platforms/images/153/small/scroll.jpeg' },
    juno: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14299.png' },
    celestia: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/22861.png' },
    thorchain: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4157.png' },
    stride: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/21781.png' },
    dydx: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/28324.png' },
    kujira: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/15185.png' },
    secret: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5604.png' },
    archway: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27358.png' },
    saga: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/30097.png' },
    neutron: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/26680.png' },
    nibiru: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/28508.png' },
    litecoin: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2.png' },
    dogecoin: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/74.png' },
    bitcoincash: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1831.png' },
    stacks: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4847.png' },
    polkadot: { uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6636.png' },
};

export const WALLET_NETWORKS: WalletNetwork[] = [
    // ── Priority chains ──────────────────────────────────────────────────────
    { id: 'ETH', name: 'Ethereum', addressKey: 'EVM', chain: 'EVM', chainId: 1, symbol: 'ETH', icon: local.ethereum },
    { id: 'BSC', name: 'BNB Chain', addressKey: 'EVM', chain: 'EVM', chainId: 56, symbol: 'BNB', icon: local.bsc },
    { id: 'SOLANA', name: 'Solana', addressKey: 'SOLANA', chain: 'SOLANA', chainId: 7565164, symbol: 'SOL', icon: local.solana },
    { id: 'TRON', name: 'Tron', addressKey: 'TRON', chain: 'TRON', chainId: 728126428, symbol: 'TRX', icon: local.tron },
    { id: 'TON', name: 'TON', addressKey: 'TON', chain: 'TON', chainId: 1100, symbol: 'TON', icon: local.ton },
    { id: 'SUI', name: 'Sui', addressKey: 'SUI', chain: 'SUI', chainId: 101, symbol: 'SUI', icon: local.sui },
    { id: 'SEI', name: 'Sei', addressKey: 'EVM', chain: 'EVM', chainId: 1329, symbol: 'SEI', icon: remote.sei },

    // ── Other EVM networks (one address, many chains) ─────────────────────────
    { id: 'POLYGON', name: 'Polygon', addressKey: 'EVM', chain: 'EVM', chainId: 137, symbol: 'POL', icon: local.polygon },
    { id: 'ARBITRUM', name: 'Arbitrum', addressKey: 'EVM', chain: 'EVM', chainId: 42161, symbol: 'ARB', icon: remote.arbitrum },
    { id: 'BASE', name: 'Base', addressKey: 'EVM', chain: 'EVM', chainId: 8453, symbol: 'ETH', icon: local.base },
    { id: 'OPTIMISM', name: 'Optimism', addressKey: 'EVM', chain: 'EVM', chainId: 10, symbol: 'OP', icon: local.optimism },
    { id: 'AVALANCHE', name: 'Avalanche', addressKey: 'EVM', chain: 'EVM', chainId: 43114, symbol: 'AVAX', icon: local.avalanche },
    { id: 'LINEA', name: 'Linea', addressKey: 'EVM', chain: 'EVM', chainId: 59144, icon: remote.linea },
    { id: 'ZKSYNC', name: 'zkSync Era', addressKey: 'EVM', chain: 'EVM', chainId: 324, icon: remote.zksync },
    { id: 'SCROLL', name: 'Scroll', addressKey: 'EVM', chain: 'EVM', chainId: 534352, icon: remote.scroll },
    { id: 'OTHER_EVM', name: 'Other EVM Networks', addressKey: 'EVM', chain: 'EVM', symbol: 'ETH', icon: local.ethereum },

    // ── Cosmos family (one secp256k1 account, re-encoded per prefix) ──────────
    { id: 'COSMOS', name: 'Cosmos', addressKey: 'COSMOS', chain: 'COSMOS', chainId: 118, symbol: 'ATOM', icon: local.cosmos },
    { id: 'OSMOSIS', name: 'Osmosis', addressKey: 'OSMOSIS', chain: 'OSMOSIS', chainId: 249339, symbol: 'OSMO', icon: local.osmosis },
    { id: 'INJECTIVE', name: 'Injective', addressKey: 'INJECTIVE', chain: 'INJECTIVE', chainId: 8000001, symbol: 'INJ', icon: local.injective },
    { id: 'JUNO', name: 'Juno', addressKey: 'JUNO', chain: 'COSMOS', chainId: 8000003, symbol: 'JUNO', icon: remote.juno },
    { id: 'CELESTIA', name: 'Celestia', addressKey: 'CELESTIA', chain: 'COSMOS', chainId: 8000008, symbol: 'TIA', icon: remote.celestia },
    // THORChain is deliberately absent from COSMOS_CHAIN_CONFIG (non-standard
    // bank/fee model), so it is receive-only for now — same as the web app.
    { id: 'THORCHAIN', name: 'THORChain', addressKey: 'THORCHAIN', symbol: 'RUNE', icon: remote.thorchain },
    { id: 'STRIDE', name: 'Stride', addressKey: 'STRIDE', chain: 'COSMOS', chainId: 8000004, symbol: 'STRD', icon: remote.stride },
    { id: 'DYDX', name: 'dYdX', addressKey: 'DYDX', chain: 'COSMOS', chainId: 8000005, symbol: 'DYDX', icon: remote.dydx },
    { id: 'KUJIRA', name: 'Kujira', addressKey: 'KUJIRA', chain: 'COSMOS', chainId: 8000006, symbol: 'KUJI', icon: remote.kujira },
    { id: 'SECRET', name: 'Secret', addressKey: 'SECRET', chain: 'COSMOS', chainId: 8000007, symbol: 'SCRT', icon: remote.secret },
    { id: 'ARCHWAY', name: 'Archway', addressKey: 'ARCHWAY', chain: 'COSMOS', chainId: 8000009, symbol: 'ARCH', icon: remote.archway },
    { id: 'SAGA', name: 'Saga', addressKey: 'SAGA', chain: 'COSMOS', chainId: 8000010, symbol: 'SAGA', icon: remote.saga },
    { id: 'NEUTRON', name: 'Neutron', addressKey: 'NEUTRON', chain: 'COSMOS', chainId: 8000011, symbol: 'NTRN', icon: remote.neutron },
    { id: 'NIBIRU', name: 'Nibiru', addressKey: 'NIBIRU', chain: 'COSMOS', chainId: 8000012, symbol: 'NIBI', icon: remote.nibiru },

    // ── Remaining non-EVM chains ─────────────────────────────────────────────
    { id: 'APTOS', name: 'Aptos', addressKey: 'APTOS', chain: 'APTOS', chainId: 637, symbol: 'APT', icon: local.aptos },
    { id: 'BITCOIN', name: 'Bitcoin', addressKey: 'BITCOIN', chain: 'BITCOIN', chainId: 8332, symbol: 'BTC', icon: local.bitcoin },

    // ── Also derived on device. The web app derives these too but does not
    //    list them in its dropdown; hiding an address the wallet actually owns
    //    would make funds sent there look lost, so they are shown here.
    { id: 'STARKNET', name: 'Starknet', addressKey: 'STARKNET', chain: 'STARKNET', chainId: 23448594291968334, symbol: 'STRK', icon: local.starknet },
    // Receive-only (no `chain`) — derived and displayable, not yet signable.
    { id: 'POLKADOT', name: 'Polkadot', addressKey: 'POLKADOT', symbol: 'DOT', icon: remote.polkadot },
    { id: 'LITECOIN', name: 'Litecoin', addressKey: 'LITECOIN', symbol: 'LTC', icon: remote.litecoin },
    { id: 'DOGECOIN', name: 'Dogecoin', addressKey: 'DOGECOIN', symbol: 'DOGE', icon: remote.dogecoin },
    { id: 'BITCOINCASH', name: 'Bitcoin Cash', addressKey: 'BITCOINCASH', symbol: 'BCH', icon: remote.bitcoincash },
    { id: 'STACKS', name: 'Stacks', addressKey: 'STACKS', symbol: 'STX', icon: remote.stacks },
];

/** Networks whose row should show, given the addresses a wallet actually has. */
export function networksWithAddress(
    addresses: Partial<Record<AddressKey, string>> | undefined,
): WalletNetwork[] {
    if (!addresses) return [];
    return WALLET_NETWORKS.filter(n => !!addresses[n.addressKey]);
}

/** Look up a network row by its persisted id. */
export function getWalletNetwork(id: string | null | undefined): WalletNetwork | undefined {
    return id ? WALLET_NETWORKS.find(n => n.id === id) : undefined;
}

/**
 * The network a wallet should land on for a given signing chain — the first
 * listed row belonging to that chain that the wallet actually has an address
 * for (Ethereum for EVM, Solana for SOLANA, Cosmos for COSMOS, …).
 *
 * Selecting a wallet used to hard-code `'ETH'` regardless of its chain, so an
 * imported Solana or Cosmos wallet displayed its own address under an "ETH"
 * badge and reported chain id 1 to the dApp browser.
 */
export function defaultNetworkIdForChain(
    chain: ChainType,
    addresses?: Partial<Record<AddressKey, string>>,
): string | null {
    const rows = WALLET_NETWORKS.filter(n => n.chain === chain);
    if (rows.length === 0) return null;
    const owned = addresses ? rows.find(n => !!addresses[n.addressKey]) : undefined;
    return (owned ?? rows[0]).id;
}

/**
 * True when a persisted `activeNetworkId` genuinely belongs to `activeChain`.
 * Guards against state written before the two were kept in sync.
 */
export function isNetworkOnChain(networkId: string | null | undefined, chain: ChainType): boolean {
    const network = getWalletNetwork(networkId);
    return !!network && network.chain === chain;
}

/** EVM network id → EIP-155 chain id, for the dApp browser bridge. */
export const EVM_NETWORK_CHAIN_IDS: Record<string, number> = Object.fromEntries(
    WALLET_NETWORKS.filter(n => n.chain === 'EVM' && n.chainId).map(n => [n.id, n.chainId!]),
);
