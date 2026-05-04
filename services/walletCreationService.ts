/**
 * Secure Wallet Creation Utility for React Native
 * 
 * Implements robust wallet generation and secure storage using:
 * - @scure/bip39: Secure mnemonic generation
 * - viem: Account and address derivation
 * - expo-secure-store: Hardware-backed secure storage for private keys
 */

import { ChainType } from '@/store/walletStore';
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
        [key in ChainType]?: string;
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
    TON: "m/44'/607'/0'/0'/0'",
    COSMOS: "m/44'/118'/0'/0/0",
    OSMOSIS: "m/44'/118'/0'/0/0",
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
export async function deriveMultiChainAddressesFromMnemonic(mnemonic: string): Promise<Record<ChainType, string>> {
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
        const { HDKey: EthHDKey } = await import('ethereum-cryptography/hdkey');
        const hd = EthHDKey.fromMasterSeed(seed);
        const tronChild = hd.derive(DERIVATION_PATHS.TRON);
        if (tronChild.privateKey) {
            const privateKeyBuffer = Buffer.from(tronChild.privateKey);
            const tronPrivateKeyHex = Array.from(privateKeyBuffer)
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
            
            const TronModule = await import('tronweb');
            // Support both { TronWeb } and { default: { TronWeb } } and { default: TronWeb }
            const TronWebConstructor = TronModule.TronWeb || (TronModule.default && TronModule.default.TronWeb) || TronModule.default;
            
            if (typeof TronWebConstructor !== 'function') {
                console.error('[WalletService] TronWeb constructor not found', TronModule);
            } else {
                const tronWebInstance = new TronWebConstructor({ fullHost: 'https://api.trongrid.io' });
                addresses.TRON = tronWebInstance.address.fromPrivateKey(tronPrivateKeyHex);
            }
        }
    } catch (e) {
        console.error('[WalletService] Tron derivation failed:', e);
    }
    await yieldToUI();

    // 4. TON (m/44'/607'/0'/0'/0')
    try {
        const { HDKey: TonHDKey } = await import('@scure/bip32');
        const tonSeed = mnemonicToSeedSync(trimmedMnemonic);
        const tonHd = TonHDKey.fromMasterSeed(tonSeed);
        const tonChild = tonHd.derive(DERIVATION_PATHS.TON);
        
        const { WalletContractV4 } = await import('@ton/ton');
        
        if (tonChild.publicKey) {
            const tonWallet = WalletContractV4.create({
                workchain: 0,
                publicKey: Buffer.from(tonChild.publicKey)
            });
            
            // Using non-bounceable user-friendly address (standard for user wallets)
            addresses.TON = tonWallet.address.toString({ bounceable: false, testOnly: false });
            console.log('[WalletService] Derived TON address:', addresses.TON);
        }
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
        const TronModule = await import('tronweb');
        const TronWebConstructor =
            (TronModule as any).TronWeb ||
            ((TronModule as any).default && (TronModule as any).default.TronWeb) ||
            (TronModule as any).default;
        const tronInstance = new TronWebConstructor({ fullHost: 'https://api.trongrid.io' });
        return tronInstance.address.fromPrivateKey(hexKey);
    }
    if (chain === 'COSMOS' || chain === 'OSMOSIS') {
        const { secp256k1 } = await import('@noble/curves/secp256k1');
        const { ripemd160 } = await import('@noble/hashes/ripemd160');
        const { sha256 } = await import('@noble/hashes/sha2');
        const bech32mod: any = await import('bech32');
        const bech32 = bech32mod.bech32 || bech32mod.default || bech32mod;
        const pubkey = secp256k1.getPublicKey(hexKey, true);
        const ripe = ripemd160(sha256(pubkey));
        const words = bech32.toWords(ripe);
        return bech32.encode(chain === 'COSMOS' ? 'cosmos' : 'osmo', words);
    }
    if (chain === 'TON') {
        const { WalletContractV4 } = await import('@ton/ton');
        const { default: nacl } = await import('tweetnacl');
        const seed = Uint8Array.from(hexKey.match(/.{2}/g)!.map(b => parseInt(b, 16)));
        const keypair = nacl.sign.keyPair.fromSeed(seed);
        const tonWallet = WalletContractV4.create({
            workchain: 0,
            publicKey: Buffer.from(keypair.publicKey),
        });
        return tonWallet.address.toString({ bounceable: false, testOnly: false });
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

    return {
        address,
        addresses: { [chain]: address },
        mnemonic: '',
    };
}
