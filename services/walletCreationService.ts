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
 * Detect compatible chains for a given input (private key or mnemonic)
 */
export function getCompatibleChains(input: string): ChainType[] {
    const text = input.trim();
    if (!text) return [];

    // 1. Check if it's a mnemonic
    if (validateMnemonic(text)) {
        return ['EVM', 'SOLANA'];
    }

    const compatible: ChainType[] = [];

    // 2. Check for EVM (64-char Hex)
    if (validatePrivateKey(text, 'EVM')) {
        compatible.push('EVM');
    }

    // 3. Check for Solana (Base58)
    if (validatePrivateKey(text, 'SOLANA')) {
        compatible.push('SOLANA');
    }

    return compatible;
}

/**
 * Validate if a string is a valid private key
 */
export function validatePrivateKey(key: string, chain: ChainType = 'EVM'): boolean {
    const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
    if (chain === 'SOLANA') {
        try {
            const decoded = (bs58 as any).decode ? (bs58 as any).decode(key) : (bs58 as any).default.decode(key);
            return !!decoded;
        } catch {
            return false;
        }
    }
    // Default to HEX/EVM/TRON style
    return /^[0-9a-fA-F]{64}$/.test(cleanKey);
}

/**
 * Import wallet using mnemonic
 */
export async function importWalletByMnemonic(mnemonic: string): Promise<CreatedWallet> {
    if (!validateMnemonic(mnemonic)) throw new Error('Invalid mnemonic');

    const addresses = await deriveMultiChainAddressesFromMnemonic(mnemonic);
    const primaryAddress = addresses.EVM!;

    // Save EVM private key by default
    const privateKey = derivePrivateKeyFromMnemonic(mnemonic, 'EVM');
    await saveSecureWallet(primaryAddress, privateKey, 'EVM');

    // Save full mnemonic tied to the group identifier (primary address)
    await saveSecureMnemonic(primaryAddress, mnemonic);

    return {
        address: primaryAddress,
        addresses,
        mnemonic: mnemonic,
    };
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
        const decoded = bs58.default.decode(privateKey);
        const keypair = Keypair.fromSecretKey(decoded);
        address = keypair.publicKey.toBase58();
    } else {
        const hex = privateKey.startsWith('0x') ? (privateKey as `0x${string}`) : (`0x${privateKey}` as `0x${string}`);
        const account = privateKeyToAccount(hex);
        address = account.address;
        finalKey = hex;
    }

    await saveSecureWallet(address, finalKey, chain);

    return {
        address,
        addresses: { [chain]: address },
        mnemonic: '', // No mnemonic for PK import
    };
}
