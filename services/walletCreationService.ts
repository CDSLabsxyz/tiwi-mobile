/**
 * Secure Wallet Creation Utility for React Native
 * 
 * Implements robust wallet generation and secure storage using:
 * - @scure/bip39: Secure mnemonic generation
 * - viem: Account and address derivation
 * - expo-secure-store: Hardware-backed secure storage for private keys
 */

import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import * as SecureStore from 'expo-secure-store';
import { mnemonicToAccount } from 'viem/accounts';

export interface CreatedWallet {
    address: string;
    mnemonic: string; // Ephemeral: Only available immediately after creation
}

const SECURE_STORE_PREFIX = 'tiwi_wallet_priv_';
const MNEMONIC_PREFIX = 'tiwi_wallet_mnem_';

/**
 * Generate a new wallet with a 12-word mnemonic phrase.
 * Uses 128-bits of entropy.
 */
export function generateNewWallet(): CreatedWallet {
    try {
        // 1. Generate Mnemonic (128 bits = 12 words)
        const mnemonic = generateMnemonic(wordlist, 128);

        // 2. Derive Account (to get public address)
        const account = mnemonicToAccount(mnemonic);

        return {
            address: account.address,
            mnemonic: mnemonic,
        };
    } catch (error) {
        console.error('[WalletService] Generation failed', error);
        throw new Error('Failed to generate secure wallet');
    }
}

/**
 * Derive private key from mnemonic.
 * Path: m/44'/60'/0'/0/0 (Standard ETH)
 */
export function derivePrivateKeyFromMnemonic(
    mnemonic: string,
    derivationPath = "m/44'/60'/0'/0/0"
): string {
    const seed = mnemonicToSeedSync(mnemonic);
    const hd = HDKey.fromMasterSeed(seed);
    const child = hd.derive(derivationPath);

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
 * On iOS/Android, this uses the Keychain/Keystore system.
 * 
 * @param address Public address (used as lookup key)
 * @param privateKey Private key to store
 */
export async function saveSecureWallet(address: string, privateKey: string): Promise<void> {
    if (!address || !privateKey) throw new Error('Invalid address or key');

    const key = `${SECURE_STORE_PREFIX}${address.toLowerCase()}`;

    // requireAuthentication: true ensures device unlock is needed to access (biometrics/passcode)
    await SecureStore.setItemAsync(key, privateKey, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        requireAuthentication: false // Start with false for UX flow, can escalate to true for signing
    });
}

/**
 * Retrieve private key from SecureStore.
 */
export async function getSecurePrivateKey(address: string): Promise<string | null> {
    const key = `${SECURE_STORE_PREFIX}${address.toLowerCase()}`;
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

        // Basic wordlist check
        const allValid = words.every(w => wordlist.includes(w.toLowerCase()));
        if (!allValid) return false;

        // Checksum check via import attempt
        mnemonicToAccount(mnemonic);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate if a string is a valid ETH private key
 */
export function validatePrivateKey(key: string): boolean {
    const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
    return /^[0-9a-fA-F]{64}$/.test(cleanKey);
}

/**
 * Import wallet using mnemonic
 */
export async function importWalletByMnemonic(mnemonic: string): Promise<string> {
    if (!validateMnemonic(mnemonic)) throw new Error('Invalid mnemonic');

    const account = mnemonicToAccount(mnemonic);
    const privateKey = derivePrivateKeyFromMnemonic(mnemonic);

    await saveSecureWallet(account.address, privateKey);
    return account.address;
}

/**
 * Import wallet using private key
 */
export async function importWalletByPrivateKey(privateKey: string): Promise<string> {
    if (!validatePrivateKey(privateKey)) throw new Error('Invalid private key');

    const hex = privateKey.startsWith('0x') ? (privateKey as `0x${string}`) : (`0x${privateKey}` as `0x${string}`);
    const { privateKeyToAccount } = await import('viem/accounts');
    const account = privateKeyToAccount(hex);

    await saveSecureWallet(account.address, hex);
    return account.address;
}
