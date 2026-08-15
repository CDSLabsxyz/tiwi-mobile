/**
 * Per-chain private-key export.
 *
 * Port of the web app's `lib/wallet/utils/export-private-keys.ts`, extended to
 * the chains the mobile wallet also derives (Bitcoin family, Stacks, Starknet,
 * Polkadot).
 *
 * Keys are grouped by KEYPAIR, not by display network. The wallet shows ~38
 * networks but they are controlled by far fewer secrets: one EVM key signs on
 * Ethereum, BNB, Polygon, Arbitrum, Base, Sei and every other EVM network, and
 * one Cosmos secp256k1 key signs for the whole Cosmos family. Listing the same
 * key 16 times would imply they are different secrets, so each appears once
 * with a `covers` line naming the networks it controls.
 *
 * Every key is emitted in the format the matching external wallet imports
 * (MetaMask hex, Phantom base58, Sui `suiprivkey1…`, Bitcoin WIF, …) and
 * carries its derivation path so the account can always be re-derived by hand.
 *
 * SECURITY: only ever call this with an in-memory mnemonic that the user has
 * just unlocked. Never persist or log the results, and clear them from React
 * state when the export screen unmounts.
 */

// Only BIP32/BIP39 load with this module - they are small and every chain needs
// the seed. Everything else (@solana/web3.js, bs58, the Sui/Aptos/Starknet SDKs)
// is imported inside its own task, so loading this module does not stall the
// cheap keys behind a heavy SDK's initialisation.
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { tonKeyPairFromBip39 } from '@/services/chainKeys';

export interface ExportedKey {
    /** Stable id - matches the network list's ids where one exists. */
    id: string;
    /** Ecosystem label shown to the user. */
    label: string;
    symbol: string;
    privateKey: string;
    /** Human hint of the encoding, e.g. "Hex", "Base58", "WIF". */
    format: string;
    /** BIP32/SLIP-10 path this key was derived at. */
    path: string;
    /** Networks this single key controls, for the "also used by" hint. */
    covers?: string;
}

const toHex = (u: Uint8Array): string =>
    Array.from(u).map(b => b.toString(16).padStart(2, '0')).join('');

/** bs58 v6 ships CJS/ESM hybrid; mirror walletCreationService's resolution. */
function bs58Encode(mod: any, bytes: Uint8Array): string {
    const encode =
        (typeof mod.encode === 'function' && mod.encode) ||
        (mod.default && typeof mod.default.encode === 'function' && mod.default.encode) ||
        (mod.default && mod.default.default && typeof mod.default.default.encode === 'function' && mod.default.default.encode);
    if (!encode) throw new Error('bs58 encode unavailable');
    return encode(bytes);
}

const LITECOIN_NETWORK = { bech32: 'ltc', pubKeyHash: 0x30, scriptHash: 0x32, wif: 0xb0 };
const DOGECOIN_NETWORK = { bech32: 'doge', pubKeyHash: 0x1e, scriptHash: 0x16, wif: 0x9e };

export interface DeriveOptions {
    /**
     * Called as each key resolves, so the screen can render the cheap keys
     * immediately instead of waiting on the slowest chain. Keys arrive out of
     * order - sort by `displayOrder(key.id)`.
     */
    onKey?: (key: ExportedKey) => void;
}

/** Stable display order; derivation order is whatever finishes first. */
const ORDER = [
    'ETH', 'SOLANA', 'TRON', 'TON', 'COSMOS', 'INJECTIVE', 'SUI', 'APTOS',
    'BITCOIN', 'LITECOIN', 'DOGECOIN', 'BITCOINCASH', 'STACKS', 'STARKNET', 'POLKADOT',
];

export function displayOrder(id: string): number {
    const i = ORDER.indexOf(id);
    return i === -1 ? ORDER.length : i;
}

/**
 * Derive the exportable private keys for every ecosystem the wallet holds.
 *
 * PERFORMANCE: every derivation is independent once the BIP39 seed exists, so
 * they all run CONCURRENTLY. Serially they add up to seconds on device - the
 * Sui and Aptos SDKs alone cost ~600ms and ~750ms to initialise, and awaiting
 * them one at a time made the export screen sit on a spinner. Parallel, the
 * wall clock is the single slowest chain. Do not reintroduce sequential awaits.
 *
 * Each derivation is isolated - one failing chain never blocks the others.
 */
export async function deriveExportablePrivateKeys(
    mnemonic: string,
    options: DeriveOptions = {},
): Promise<ExportedKey[]> {
    const { onKey } = options;
    const m = mnemonic.trim();
    const seed = mnemonicToSeedSync(m);
    const seedHex = toHex(seed);
    const hd = HDKey.fromMasterSeed(seed);

    const out: ExportedKey[] = [];
    /** Run one chain's derivation; emit as soon as it lands, never throw. */
    const task = async (label: string, run: () => ExportedKey[] | Promise<ExportedKey[]>) => {
        try {
            for (const key of await run()) {
                out.push(key);
                onKey?.(key);
            }
        } catch (e) {
            console.warn(`[Export] ${label} key failed`, e);
        }
    };

    // The EVM key is plain BIP32 (~10ms) and Injective reuses it, so derive it
    // up front rather than making one task depend on another.
    const evmPk = hd.derive("m/44'/60'/0'/0/0").privateKey;
    const evmKey = evmPk ? `0x${toHex(evmPk)}` : undefined;

    await Promise.all([
        // EVM - secp256k1 m/44'/60'/0'/0/0. Imports into MetaMask/Rabby/Trust
        // and signs on every EVM network.
        task('EVM', () => evmKey ? [{
            id: 'ETH', label: 'Ethereum (EVM)', symbol: 'ETH', format: 'Hex',
            path: "m/44'/60'/0'/0/0", privateKey: evmKey,
            covers: 'Ethereum, BNB Chain, Polygon, Arbitrum, Base, Optimism, Avalanche, Linea, zkSync, Scroll, Sei & every other EVM network',
        }] : []),

        // Injective - a Cosmos-SDK chain (inj1… addresses) that signs with
        // Ethereum's eth_secp256k1 curve, so its private key IS the EVM key -
        // NOT the m/44'/118' Cosmos key. Listed under its own name so users
        // find it.
        task('Injective', () => evmKey ? [{
            id: 'INJECTIVE', label: 'Injective', symbol: 'INJ', format: 'Hex',
            path: "m/44'/60'/0'/0/0", privateKey: evmKey,
            covers: 'Same key as your Ethereum (EVM) wallet',
        }] : []),

        // Tron - secp256k1 m/44'/195'/0'/0/0. 64-char hex (TronLink format).
        task('Tron', () => {
            const pk = hd.derive("m/44'/195'/0'/0/0").privateKey;
            return pk ? [{
                id: 'TRON', label: 'Tron', symbol: 'TRX', format: 'Hex',
                path: "m/44'/195'/0'/0/0", privateKey: toHex(pk),
            }] : [];
        }),

        // Cosmos - secp256k1 m/44'/118'/0'/0/0. One key for the whole family.
        task('Cosmos', () => {
            const pk = hd.derive("m/44'/118'/0'/0/0").privateKey;
            return pk ? [{
                id: 'COSMOS', label: 'Cosmos', symbol: 'ATOM', format: 'Hex',
                path: "m/44'/118'/0'/0/0", privateKey: toHex(pk),
                covers: 'Cosmos Hub, Osmosis, Juno, Celestia, THORChain, Stride, dYdX, Kujira, Secret, Archway, Saga, Neutron & Nibiru',
            }] : [];
        }),

        // Stacks - secp256k1 m/44'/5757'/0'/0/0. Hiro Wallet expects the
        // compressed form: 32-byte key with a trailing 0x01 marker.
        task('Stacks', () => {
            const pk = hd.derive("m/44'/5757'/0'/0/0").privateKey;
            return pk ? [{
                id: 'STACKS', label: 'Stacks', symbol: 'STX', format: 'Hex (compressed)',
                path: "m/44'/5757'/0'/0/0", privateKey: `${toHex(pk)}01`,
            }] : [];
        }),

        // Solana - ed25519 m/44'/501'/0'/0'. Base58 of the 64-byte secret key
        // (the exact string Phantom/Solflare import).
        task('Solana', async () => {
            const [{ Keypair }, { derivePath }, bs58] = await Promise.all([
                import('@solana/web3.js'),
                import('ed25519-hd-key'),
                import('bs58'),
            ]);
            const kp = Keypair.fromSeed(derivePath("m/44'/501'/0'/0'", seedHex).key);
            return [{
                id: 'SOLANA', label: 'Solana', symbol: 'SOL', format: 'Base58',
                path: "m/44'/501'/0'/0'", privateKey: bs58Encode(bs58, kp.secretKey),
            }];
        }),

        // TON - ed25519 SLIP-0010 m/44'/607'/0'. Raw 64-byte secret key as hex.
        task('TON', async () => {
            const { secretKey } = await tonKeyPairFromBip39(m);
            return [{
                id: 'TON', label: 'TON', symbol: 'TON', format: 'Hex (64-byte secret)',
                path: "m/44'/607'/0'", privateKey: toHex(secretKey),
            }];
        }),

        // Sui and Aptos - both plain SLIP-0010 ed25519 seeds. Their SDKs cost
        // ~600ms and ~750ms to initialise for what is a 32-byte derivation and
        // an encoding step, which was most of this screen's load time. Derived
        // from primitives instead; `scripts/verify-exported-keys.mjs` re-derives
        // the addresses WITH the SDKs, so any drift fails the check.
        task('Sui & Aptos', async () => {
            const { derivePath } = await import('ed25519-hd-key');
            const keys: ExportedKey[] = [];

            // Sui - `suiprivkey1…`: bech32 of [scheme flag 0x00, …32-byte seed].
            const suiSeed = derivePath("m/44'/784'/0'/0'/0'", seedHex).key;
            const bech32mod: any = await import('bech32');
            const bech32 = bech32mod.bech32 ?? bech32mod.default?.bech32 ?? bech32mod.default;
            keys.push({
                id: 'SUI', label: 'Sui', symbol: 'SUI', format: 'suiprivkey',
                path: "m/44'/784'/0'/0'/0'",
                privateKey: bech32.encode('suiprivkey', bech32.toWords(new Uint8Array([0, ...suiSeed]))),
            });

            // Aptos - `0x…` hex of the 32-byte seed (Petra import format).
            keys.push({
                id: 'APTOS', label: 'Aptos', symbol: 'APT', format: 'Hex',
                path: "m/44'/637'/0'/0'/0'",
                privateKey: `0x${toHex(derivePath("m/44'/637'/0'/0'/0'", seedHex).key)}`,
            });

            return keys;
        }),

        // Bitcoin family - WIF, the format Electrum/Core/Litecoin Core import.
        // Each is a separate BIP44/84 account, so each gets its own key. They
        // share one module load, so they stay in a single task.
        task('Bitcoin family', async () => {
            const btc = await import('@scure/btc-signer');
            const utxo: [string, string, string, string, any, string][] = [
                ['BITCOIN', 'Bitcoin', 'BTC', "m/84'/0'/0'/0/0", undefined, 'Native SegWit (bc1…)'],
                ['LITECOIN', 'Litecoin', 'LTC', "m/84'/2'/0'/0/0", LITECOIN_NETWORK, 'Native SegWit (ltc1…)'],
                ['DOGECOIN', 'Dogecoin', 'DOGE', "m/44'/3'/0'/0/0", DOGECOIN_NETWORK, 'Legacy (D…)'],
                ['BITCOINCASH', 'Bitcoin Cash', 'BCH', "m/44'/145'/0'/0/0", undefined, 'Legacy (1…)'],
            ];
            const keys: ExportedKey[] = [];
            for (const [id, label, symbol, path, network, covers] of utxo) {
                const pk = hd.derive(path).privateKey;
                if (!pk) continue;
                keys.push({
                    id, label, symbol, format: 'WIF', path,
                    privateKey: btc.WIF(network ?? btc.NETWORK).encode(pk), covers,
                });
            }
            return keys;
        }),

        // Starknet - the GROUND key, not the raw BIP32 child. Argent/Braavos
        // expect the grinded stark key, which the address was derived from.
        task('Starknet', async () => {
            const pk = hd.derive("m/44'/9004'/0'/0/0").privateKey;
            if (!pk) return [];
            const { ec } = await import('starknet');
            return [{
                id: 'STARKNET', label: 'Starknet', symbol: 'STRK', format: 'Hex (stark curve)',
                path: "m/44'/9004'/0'/0/0",
                privateKey: `0x${ec.starkCurve.grindKey(`0x${toHex(pk)}`)}`,
            }];
        }),

        // Polkadot - sr25519. polkadot.js imports the 32-byte "raw seed", which
        // for this scheme is the substrate mini-secret (see derivePolkadotAddress).
        task('Polkadot', async () => {
            const { mnemonicToEntropy } = await import('@scure/bip39');
            const { wordlist } = await import('@scure/bip39/wordlists/english.js');
            const { pbkdf2 } = await import('@noble/hashes/pbkdf2');
            const { sha512 } = await import('@noble/hashes/sha512');
            const miniSecret = pbkdf2(
                sha512,
                mnemonicToEntropy(m, wordlist),
                new TextEncoder().encode('mnemonic'),
                { c: 2048, dkLen: 64 },
            ).slice(0, 32);
            return [{
                id: 'POLKADOT', label: 'Polkadot', symbol: 'DOT', format: 'Hex (raw seed)',
                path: 'sr25519 mini-secret', privateKey: `0x${toHex(miniSecret)}`,
            }];
        }),
    ]);

    return out.sort((a, b) => displayOrder(a.id) - displayOrder(b.id));
}
