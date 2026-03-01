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
import * as SecureStore from 'expo-secure-store';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';

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
};

/**
 * Generate a new wallet with a 12-word mnemonic phrase.
 * Uses 128-bits of entropy.
 */
export function generateNewWallet(): CreatedWallet {
    try {
        // 1. Generate Mnemonic (128 bits = 12 words)
        const mnemonic = generateMnemonic(wordlist, 128);

        // 2. Derive all addresses
        const addresses = deriveMultiChainAddressesFromMnemonic(mnemonic);

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
export function deriveMultiChainAddressesFromMnemonic(mnemonic: string): Record<ChainType, string> {
    const addresses: any = {};

    // 1. EVM (Standard ETH)
    const ethAccount = mnemonicToAccount(mnemonic);
    addresses.EVM = ethAccount.address;

    // 2. SOLANA
    const seed = mnemonicToSeedSync(mnemonic);
    const solanaKeypair = Keypair.fromSeed(seed.slice(0, 32)); // Standard Solana derivation from seed
    addresses.SOLANA = solanaKeypair.publicKey.toBase58();

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
            bs58.default.decode(key);
            return true;
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

    const addresses = deriveMultiChainAddressesFromMnemonic(mnemonic);
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
