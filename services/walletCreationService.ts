/**
 * Secure Wallet Creation Utility for React Native
 * 
 * Implements robust wallet generation and secure storage using:
 * - @scure/bip39: Secure mnemonic generation
 * - viem: Account and address derivation
 * - expo-secure-store: Hardware-backed secure storage for private keys
 */

import { AddressKey, ChainType } from '@/store/walletStore';
import {
    cosmosAddressFromPrivateKeyHex,
    isTonMnemonic,
    tonAddressFromPublicKey,
    tonKeyPairFromBip39,
    tonKeyPairFromSecretHex,
    tonKeyPairFromTonMnemonic,
    tronAddressFromPrivateKey,
    tronPrivateKeyFromMnemonic,
} from '@/services/chainKeys';
import {
    deriveAptosAddress,
    deriveBitcoinAddress,
    deriveBitcoinCashAddress,
    deriveDogecoinAddress,
    deriveLitecoinAddress,
    derivePolkadotAddress,
    deriveStacksAddress,
    deriveStarknetAddress,
    deriveSuiAddress,
    evmToInjectiveAddress,
    reEncodeBech32,
} from '@/services/walletDerivationExtra';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Keypair } from '@solana/web3.js';
import * as bs58 from "bs58";
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import { InteractionManager } from 'react-native';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
// ed25519-hd-key, tronweb, etc. are imported dynamically inside functions
// to ensure polyfills are fully initialized first.

/** Yield to the UI thread so animations/renders can proceed */
const yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/**
 * Resolve bs58 decode across the various module-interop shapes Metro may
 * produce for the bs58 v6 ESM/CJS package: namespace, default, or hoisted.
 */
function bs58Decode(value: string): Uint8Array {
    const mod: any = bs58 as any;
    const decode =
        (typeof mod.decode === 'function' && mod.decode) ||
        (mod.default && typeof mod.default.decode === 'function' && mod.default.decode) ||
        (mod.default && mod.default.default && typeof mod.default.default.decode === 'function' && mod.default.default.decode);
    if (!decode) throw new Error('bs58 decode unavailable');
    return decode(value);
}

export interface CreatedWallet {
    address: string; // Master/Primary (EVM)
    addresses: {
        [key in AddressKey]?: string;
    };
    mnemonic: string; // Ephemeral: Only available immediately after creation
}

const SECURE_STORE_PREFIX = 'tiwi_wallet_priv_';
const MNEMONIC_PREFIX = 'tiwi_wallet_mnem_';

/**
 * Derivation Paths for supported chains
 */
export const DERIVATION_PATHS: Record<ChainType, string> = {
    EVM: "m/44'/60'/0'/0/0",
    SOLANA: "m/44'/501'/0'/0'",
    TRON: "m/44'/195'/0'/0/0",
    // ed25519 (SLIP-0010) — see chainKeys.TON_BIP39_PATH. NEVER feed this to
    // derivePrivateKeyFromMnemonic, which is secp256k1 and would produce a key
    // that cannot sign for the TON address the app displays.
    TON: "m/44'/607'/0'",
    COSMOS: "m/44'/118'/0'/0/0",
    OSMOSIS: "m/44'/118'/0'/0/0",
    // ed25519 chains — signed by their own engines (SuiLocalEngine / AptosLocalEngine),
    // NOT via the secp256k1 derivePrivateKeyFromMnemonic path. Paths are informational
    // + match deriveMultiChainAddressesFromMnemonic.
    SUI: "m/44'/784'/0'/0'/0'",
    APTOS: "m/44'/637'/0'/0'/0'",
    // Injective shares the EVM key (eth path); Bitcoin BIP84; Starknet Stark curve.
    // Informational — signed by their own engines, not derivePrivateKeyFromMnemonic.
    INJECTIVE: "m/44'/60'/0'/0/0",
    BITCOIN: "m/84'/0'/0'/0/0",
    STARKNET: "m/44'/9004'/0'/0/0",
};

/**
 * Cosmos-family bech32 prefixes keyed by the `addresses` slot they fill.
 * All of them share ONE secp256k1 account (m/44'/118'), so an address for any
 * of them is the same account re-encoded — see `reEncodeBech32`.
 */
export const COSMOS_FAMILY_PREFIXES: Partial<Record<AddressKey, string>> = {
    COSMOS: 'cosmos',
    OSMOSIS: 'osmo',
    THORCHAIN: 'thor',
    JUNO: 'juno',
    STRIDE: 'stride',
    DYDX: 'dydx',
    KUJIRA: 'kujira',
    SECRET: 'secret',
    CELESTIA: 'celestia',
    ARCHWAY: 'archway',
    SAGA: 'saga',
    NEUTRON: 'neutron',
    NIBIRU: 'nibi',
};

/**
 * Generate a new wallet with a 12-word mnemonic phrase.
 * Uses 128-bits of entropy.
 */
export async function generateNewWallet(): Promise<CreatedWallet> {
    try {
        // Wait for UI interactions (overlay animation) to complete
        await new Promise<void>(resolve => InteractionManager.runAfterInteractions(() => resolve()));
        await yieldToUI();

        // 1. Generate Mnemonic (128 bits = 12 words)
        const mnemonic = generateMnemonic(wordlist, 128);
        await yieldToUI();

        // 2. Derive all addresses
        const addresses = await deriveMultiChainAddressesFromMnemonic(mnemonic);

        return {
            address: addresses.EVM!,
            addresses,
            mnemonic: mnemonic,
        };
    } catch (error) {
        console.error('[WalletService] Generation failed', error);
        throw new Error('Failed to generate secure wallet');
    }
}

/**
 * Derive addresses for all supported chains from a mnemonic.
 */
export async function deriveMultiChainAddressesFromMnemonic(mnemonic: string): Promise<Partial<Record<AddressKey, string>>> {
    const addresses: any = {};
    const trimmedMnemonic = mnemonic.trim();
    const seed = mnemonicToSeedSync(trimmedMnemonic);
    await yieldToUI();

    // 1. EVM (Standard ETH)
    const ethAccount = mnemonicToAccount(trimmedMnemonic);
    addresses.EVM = ethAccount.address;
    await yieldToUI();

    // 2. SOLANA (m/44'/501'/0'/0')
    try {
        const { derivePath } = await import('ed25519-hd-key');
        const seedHex = Array.from(seed).map(b => b.toString(16).padStart(2, '0')).join('');
        const solanaDerived = derivePath(DERIVATION_PATHS.SOLANA, seedHex);
        const solanaKeypair = Keypair.fromSeed(solanaDerived.key);
        addresses.SOLANA = solanaKeypair.publicKey.toBase58();
    } catch (e) {
        console.error('[WalletService] Solana derivation failed:', e);
    }
    await yieldToUI();

    // 3. TRON (m/44'/195'/0'/0/0)
    try {
        const tronPrivateKeyHex = await tronPrivateKeyFromMnemonic(trimmedMnemonic);
        addresses.TRON = await tronAddressFromPrivateKey(tronPrivateKeyHex);
    } catch (e) {
        console.error('[WalletService] Tron derivation failed:', e);
    }
    await yieldToUI();

    // 4. TON (ed25519, SLIP-0010 m/44'/607'/0')
    //
    // This MUST use the same ed25519 derivation the signer uses. It previously
    // used @scure/bip32 (secp256k1), feeding a 33-byte key to a contract that
    // needs a 32-byte ed25519 key — the address shown could never be signed for.
    try {
        const tonKeys = await tonKeyPairFromBip39(trimmedMnemonic);
        addresses.TON = await tonAddressFromPublicKey(tonKeys.publicKey);
    } catch (e) {
        console.error('[WalletService] TON derivation failed:', e);
    }
    await yieldToUI();

    // 5. COSMOS (m/44'/118'/0'/0/0) & 6. OSMOSIS
    try {
        const { bech32 } = await import('bech32');
        const { ripemd160 } = await import('ethereum-cryptography/ripemd160');
        const { sha256 } = await import('ethereum-cryptography/sha256');

        // Standard Cosmos derivation path
        const path = DERIVATION_PATHS.COSMOS;
        const hd = HDKey.fromMasterSeed(seed);
        const child = hd.derive(path);

        if (child.publicKey) {
            // Cosmos address calculation:
            // 1. SHA256 hash of the public key
            const sha256Hash = sha256(child.publicKey);
            // 2. RIPEMD160 hash of the result
            const ripemdHash = ripemd160(sha256Hash);
            
            // 3. Bech32 encode the RIPEMD160 hash
            const words = bech32.toWords(ripemdHash);
            
            addresses.COSMOS = bech32.encode('cosmos', words);
            addresses.OSMOSIS = bech32.encode('osmo', words);
            
            console.log('[WalletService] Derived COSMOS (manual):', addresses.COSMOS);
            console.log('[WalletService] Derived OSMOSIS (manual):', addresses.OSMOSIS);
        }
    } catch (e) {
        console.error('[WalletService] Cosmos/Osmosis manual derivation failed:', e);
    }
    await yieldToUI();

    // ── Extra chains (web parity — balance/display only, NOT signing) ─────────
    // Each is isolated: a library that fails to load/run under Hermes degrades
    // that one address to undefined and never breaks the core 6 above.

    // 7. Injective — the EVM address re-encoded as inj1… (eth_secp256k1).
    if (addresses.EVM) {
        const inj = evmToInjectiveAddress(addresses.EVM);
        if (inj) addresses.INJECTIVE = inj;
    }

    // 8. Standard-secp256k1 Cosmos-family — the COSMOS account re-encoded under
    //    each chain's bech32 prefix (same key, different prefix).
    if (addresses.COSMOS) {
        for (const [key, prefix] of Object.entries(COSMOS_FAMILY_PREFIXES) as [AddressKey, string][]) {
            addresses[key] = reEncodeBech32(addresses.COSMOS!, prefix) ?? undefined;
        }
    }
    await yieldToUI();

    // 9. Bitcoin (bc1…), BIP84.
    try { addresses.BITCOIN = await deriveBitcoinAddress(seed); }
    catch (e) { console.warn('[WalletService] Bitcoin derivation failed:', e); }
    await yieldToUI();

    // 10-12. Litecoin / Dogecoin / Bitcoin Cash (UTXO).
    try { addresses.LITECOIN = await deriveLitecoinAddress(seed); }
    catch (e) { console.warn('[WalletService] Litecoin derivation failed:', e); }
    try { addresses.DOGECOIN = await deriveDogecoinAddress(seed); }
    catch (e) { console.warn('[WalletService] Dogecoin derivation failed:', e); }
    try { addresses.BITCOINCASH = await deriveBitcoinCashAddress(seed); }
    catch (e) { console.warn('[WalletService] Bitcoin Cash derivation failed:', e); }
    await yieldToUI();

    // 13. Stacks (SP…).
    try { addresses.STACKS = await deriveStacksAddress(seed); }
    catch (e) { console.warn('[WalletService] Stacks derivation failed:', e); }
    await yieldToUI();

    // 13b. Polkadot (1…, sr25519 + SS58).
    try { addresses.POLKADOT = await derivePolkadotAddress(trimmedMnemonic); }
    catch (e) { console.warn('[WalletService] Polkadot derivation failed:', e); }
    await yieldToUI();

    // 14. Sui (0x…64-hex, ed25519).
    try { addresses.SUI = await deriveSuiAddress(trimmedMnemonic); }
    catch (e) { console.warn('[WalletService] Sui derivation failed:', e); }
    await yieldToUI();

    // 15. Aptos (0x…64-hex, ed25519).
    try { addresses.APTOS = await deriveAptosAddress(trimmedMnemonic); }
    catch (e) { console.warn('[WalletService] Aptos derivation failed:', e); }
    await yieldToUI();

    // 16. Starknet (0x…, Stark curve + OZ account).
    try { addresses.STARKNET = await deriveStarknetAddress(seed); }
    catch (e) { console.warn('[WalletService] Starknet derivation failed:', e); }
    await yieldToUI();

    return addresses;
}

/**
 * Derive private key from mnemonic.
 */
export function derivePrivateKeyFromMnemonic(
    mnemonic: string,
    chain: ChainType = 'EVM'
): string {
    const path = DERIVATION_PATHS[chain];
    const seed = mnemonicToSeedSync(mnemonic);
    const hd = HDKey.fromMasterSeed(seed);
    const child = hd.derive(path);

    if (!child.privateKey) {
        throw new Error('Failed to derive private key');
    }

    const hex = Array.from(child.privateKey)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    return hex;
}

/**
 * Save sensitive wallet data to SecureStore.
 */
export async function saveSecureWallet(
    address: string,
    privateKey: string,
    chain: ChainType = 'EVM'
): Promise<void> {
    if (!address || !privateKey) throw new Error('Invalid address or key');

    const key = `${SECURE_STORE_PREFIX}${chain}_${address.toLowerCase()}`;

    await SecureStore.setItemAsync(key, privateKey, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        requireAuthentication: false
    });
}

/**
 * Retrieve private key from SecureStore.
 */
export async function getSecurePrivateKey(
    address: string,
    chain: ChainType = 'EVM'
): Promise<string | null> {
    const key = `${SECURE_STORE_PREFIX}${chain}_${address.toLowerCase()}`;
    return await SecureStore.getItemAsync(key);
}

/**
 * Save mnemonic securely
 */
export async function saveSecureMnemonic(address: string, mnemonic: string): Promise<void> {
    if (!address || !mnemonic) return;
    const key = `${MNEMONIC_PREFIX}${address.toLowerCase()}`;
    await SecureStore.setItemAsync(key, mnemonic, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
}

/**
 * Retrieve mnemonic securely
 */
export async function getSecureMnemonic(address: string): Promise<string | null> {
    const key = `${MNEMONIC_PREFIX}${address.toLowerCase()}`;
    return await SecureStore.getItemAsync(key);
}

/**
 * Validate a mnemonic phrase
 */
export function validateMnemonic(mnemonic: string): boolean {
    try {
        if (!mnemonic) return false;
        const words = mnemonic.trim().split(/\s+/);
        if (words.length !== 12 && words.length !== 24) return false;

        const allValid = words.every(w => wordlist.includes(w.toLowerCase()));
        if (!allValid) return false;

        mnemonicToAccount(mnemonic);
        return true;
    } catch {
        return false;
    }
}

/**
 * Detect compatible chains for a given input (private key or mnemonic).
 * A 64-char hex secret can map to any of the secp256k1 chains
 * (EVM/Tron/Cosmos/Osmosis) and ed25519 raw seeds (TON).
 */
export function getCompatibleChains(input: string): ChainType[] {
    const text = input.trim();
    if (!text) return [];

    if (validateMnemonic(text)) {
        return ['EVM', 'SOLANA', 'TRON', 'TON', 'COSMOS', 'OSMOSIS'];
    }

    const compatible: ChainType[] = [];
    const cleanHex = text.replace(/^0x/i, '');
    if (/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
        compatible.push('EVM', 'TRON', 'COSMOS', 'OSMOSIS', 'TON');
    } else if (/^[0-9a-fA-F]{128}$/.test(cleanHex)) {
        // 64-byte ed25519 secret key — TON only.
        compatible.push('TON');
    }
    if (validatePrivateKey(text, 'SOLANA')) {
        compatible.push('SOLANA');
    }
    return compatible;
}

/**
 * Validate if a string is a valid private key.
 * Pass `chain` to check a specific format; omit it to accept any supported chain.
 */
export function validatePrivateKey(key: string, chain?: ChainType): boolean {
    if (!key) return false;
    const trimmed = key.trim();
    const cleanHex = trimmed.replace(/^0x/i, '');

    if (!chain) {
        return getCompatibleChains(trimmed).length > 0;
    }

    if (chain === 'SOLANA') {
        try {
            const decoded = bs58Decode(trimmed);
            return decoded?.length === 32 || decoded?.length === 64;
        } catch (e) {
            console.warn('[WalletService] bs58 decode failed:', e);
            return false;
        }
    }

    // TON accepts a 32-byte ed25519 seed or a full 64-byte secret key.
    if (chain === 'TON') {
        return /^[0-9a-fA-F]{64}$/.test(cleanHex) || /^[0-9a-fA-F]{128}$/.test(cleanHex);
    }

    return /^[0-9a-fA-F]{64}$/.test(cleanHex);
}

/**
 * Import wallet using mnemonic
 */
export async function importWalletByMnemonic(mnemonic: string): Promise<CreatedWallet> {
    if (!validateMnemonic(mnemonic)) throw new Error('Invalid mnemonic');

    const addresses = await deriveMultiChainAddressesFromMnemonic(mnemonic);
    const primaryAddress = addresses.EVM!;

    const privateKey = derivePrivateKeyFromMnemonic(mnemonic, 'EVM');
    await saveSecureWallet(primaryAddress, privateKey, 'EVM');
    await saveSecureMnemonic(primaryAddress, mnemonic);

    return {
        address: primaryAddress,
        addresses,
        mnemonic: mnemonic,
    };
}

/**
 * Derive an address for the given chain from a 64-char hex private key.
 */
async function addressFromHexKeyForChain(hexKey: string, chain: ChainType): Promise<string> {
    if (chain === 'EVM') {
        const hex = (`0x${hexKey}`) as `0x${string}`;
        return privateKeyToAccount(hex).address;
    }
    if (chain === 'TRON') {
        return tronAddressFromPrivateKey(hexKey);
    }
    if (chain === 'COSMOS' || chain === 'OSMOSIS') {
        // Derived through cosmjs (the same signer used to sign), so the address
        // shown can never disagree with the one that signs.
        return cosmosAddressFromPrivateKeyHex(hexKey, chain === 'COSMOS' ? 'cosmos' : 'osmo');
    }
    if (chain === 'TON') {
        const keypair = await tonKeyPairFromSecretHex(hexKey);
        return tonAddressFromPublicKey(keypair.publicKey);
    }
    throw new Error(`Unsupported chain for hex key import: ${chain}`);
}

/**
 * Import wallet using private key
 */
export async function importWalletByPrivateKey(
    privateKey: string,
    chain: ChainType = 'EVM'
): Promise<CreatedWallet> {
    if (!validatePrivateKey(privateKey, chain)) throw new Error('Invalid private key');

    let address = '';
    let finalKey = privateKey;

    if (chain === 'SOLANA') {
        const decoded = bs58Decode(privateKey.trim());
        const keypair = decoded.length === 32
            ? Keypair.fromSeed(decoded)
            : Keypair.fromSecretKey(decoded);
        address = keypair.publicKey.toBase58();
    } else {
        const cleanHex = privateKey.trim().replace(/^0x/i, '');
        finalKey = chain === 'EVM' ? `0x${cleanHex}` : cleanHex;
        address = await addressFromHexKeyForChain(cleanHex, chain);
    }

    await saveSecureWallet(address, finalKey, chain);

    const addresses: Partial<Record<AddressKey, string>> = { [chain]: address };

    // One Cosmos secp256k1 account is every Cosmos-family account — the same key
    // re-encoded under each chain's prefix. Fan it out so the imported wallet
    // shows (and can send from) Osmosis, Celestia, dYdX, … not just one row.
    if (chain === 'COSMOS' || chain === 'OSMOSIS') {
        for (const [key, prefix] of Object.entries(COSMOS_FAMILY_PREFIXES) as [AddressKey, string][]) {
            const encoded = reEncodeBech32(address, prefix);
            if (encoded) addresses[key] = encoded;
        }
    }

    return {
        address,
        addresses,
        mnemonic: '',
    };
}

/**
 * Import a native TON wallet from its 24-word TON mnemonic (Tonkeeper, TonHub,
 * MyTonWallet). This is NOT a BIP39 phrase — it has its own checksum and its own
 * key derivation — so it produces a TON-only wallet rather than a multi-chain one.
 */
export async function importWalletByTonMnemonic(mnemonic: string): Promise<CreatedWallet> {
    const trimmed = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!(await isTonMnemonic(trimmed))) throw new Error('Invalid TON recovery phrase');

    const keypair = await tonKeyPairFromTonMnemonic(trimmed);
    const address = await tonAddressFromPublicKey(keypair.publicKey);

    // Store BOTH: the phrase (so the user can still export it) and the derived
    // ed25519 seed, which is what the signer actually loads.
    await saveSecureMnemonic(address, trimmed);
    await saveSecureWallet(address, keypair.secretKey.toString('hex'), 'TON');

    return {
        address,
        addresses: { TON: address },
        mnemonic: trimmed,
    };
}
