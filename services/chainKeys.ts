/**
 * Pure key/address derivation for the non-EVM chains the app signs for
 * (TRON, TON, Cosmos-family).
 *
 * This module deliberately has NO dependency on the wallet store or on
 * SecureStore — it only turns a secret (mnemonic or raw private key) into a
 * usable signing object. `services/signer/chainSecrets.ts` is the layer that
 * decides *which* secret a wallet holds; `walletCreationService` uses the same
 * helpers at import/creation time so a displayed address is always an address
 * we can actually sign for.
 *
 * That last point is the reason this file exists: TON addresses used to be
 * derived with @scure/bip32 (secp256k1, 33-byte pubkey) while signing derived
 * ed25519 — the two never matched, so every TON address the app showed was
 * unsignable. Both paths now go through `tonKeyPairFromBip39` here.
 *
 * Every heavy library is imported dynamically so nothing is pulled into the
 * startup bundle.
 */

import { Buffer } from 'buffer';

// ─────────────────────────────────────────────────────────────────────────────
// TRON  (secp256k1, m/44'/195'/0'/0/0)
// ─────────────────────────────────────────────────────────────────────────────

export const TRON_DERIVATION_PATH = "m/44'/195'/0'/0/0";

/** Resolve the TronWeb constructor across Metro's CJS/ESM interop shapes. */
export async function loadTronWeb(): Promise<any> {
    const mod: any = await import('tronweb');
    const TronWeb = mod.TronWeb || mod.default?.TronWeb || mod.default;
    if (typeof TronWeb !== 'function') throw new Error('TronWeb is unavailable in this build.');
    return TronWeb;
}

/** A TronWeb instance bound to `privateKeyHex` (signs + broadcasts). */
export async function createTronWeb(privateKeyHex?: string, fullHost = 'https://api.trongrid.io'): Promise<any> {
    const TronWeb = await loadTronWeb();
    return new TronWeb(privateKeyHex ? { fullHost, privateKey: privateKeyHex } : { fullHost });
}

export function normalizeHexKey(key: string): string {
    return key.trim().replace(/^0x/i, '').toLowerCase();
}

/** TRON private key (hex, no 0x) from a BIP39 phrase. */
export async function tronPrivateKeyFromMnemonic(mnemonic: string): Promise<string> {
    const { HDKey } = await import('ethereum-cryptography/hdkey');
    const { mnemonicToSeedSync } = await import('@scure/bip39');
    const seed = mnemonicToSeedSync(mnemonic.trim());
    const child = HDKey.fromMasterSeed(seed).derive(TRON_DERIVATION_PATH);
    if (!child.privateKey) throw new Error('Could not derive a TRON key from this wallet.');
    return Buffer.from(child.privateKey).toString('hex');
}

export async function tronAddressFromPrivateKey(privateKeyHex: string): Promise<string> {
    const tronWeb = await createTronWeb();
    return tronWeb.address.fromPrivateKey(normalizeHexKey(privateKeyHex));
}

// ─────────────────────────────────────────────────────────────────────────────
// TON  (ed25519)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SLIP-0010 ed25519 path for BIP39 phrases — the scheme Trust Wallet uses and
 * the one the swap engine's `deriveTonKeypair` already used. Wallet creation
 * now matches it (it previously used secp256k1, producing dead addresses).
 */
export const TON_BIP39_PATH = "m/44'/607'/0'";

export interface TonKeyPair { publicKey: Buffer; secretKey: Buffer }

/** ed25519 keypair from a standard BIP39 (12/24-word) phrase. */
export async function tonKeyPairFromBip39(mnemonic: string): Promise<TonKeyPair> {
    const { mnemonicToSeedSync } = await import('@scure/bip39');
    const { derivePath } = await import('ed25519-hd-key');
    const { keyPairFromSeed } = await import('@ton/crypto');
    const seedHex = Buffer.from(mnemonicToSeedSync(mnemonic.trim())).toString('hex');
    const { key } = derivePath(TON_BIP39_PATH, seedHex);
    return keyPairFromSeed(key) as TonKeyPair;
}

/** True when `words` is a native TON (Tonkeeper/TonHub) 24-word mnemonic. */
export async function isTonMnemonic(mnemonic: string): Promise<boolean> {
    try {
        const words = mnemonic.trim().toLowerCase().split(/\s+/);
        if (words.length !== 24) return false;
        const { mnemonicValidate } = await import('@ton/crypto');
        return await mnemonicValidate(words);
    } catch {
        return false;
    }
}

/** ed25519 keypair from a native TON 24-word mnemonic. */
export async function tonKeyPairFromTonMnemonic(mnemonic: string): Promise<TonKeyPair> {
    const { mnemonicToPrivateKey } = await import('@ton/crypto');
    return (await mnemonicToPrivateKey(mnemonic.trim().toLowerCase().split(/\s+/))) as TonKeyPair;
}

/**
 * ed25519 keypair from a raw hex secret: 32 bytes = ed25519 seed (what our own
 * private-key import stores), 64 bytes = full nacl secret key.
 */
export async function tonKeyPairFromSecretHex(hex: string): Promise<TonKeyPair> {
    const { keyPairFromSeed, keyPairFromSecretKey } = await import('@ton/crypto');
    const clean = normalizeHexKey(hex);
    const bytes = Buffer.from(clean, 'hex');
    if (bytes.length === 32) return keyPairFromSeed(bytes) as TonKeyPair;
    if (bytes.length === 64) return keyPairFromSecretKey(bytes) as TonKeyPair;
    throw new Error('A TON private key must be 32 or 64 bytes of hex.');
}

/**
 * Keypair from any TON secret shape, resolved in the order that can't be
 * ambiguous: a native TON mnemonic is checked first only when the wallet is
 * TON-only (`preferTonScheme`), because a multi-chain BIP39 wallet must always
 * use the BIP39 path or its other chains would disagree.
 */
export async function tonKeyPairFromMnemonic(mnemonic: string, preferTonScheme = false): Promise<TonKeyPair> {
    if (preferTonScheme && (await isTonMnemonic(mnemonic))) {
        return tonKeyPairFromTonMnemonic(mnemonic);
    }
    try {
        return await tonKeyPairFromBip39(mnemonic);
    } catch (e) {
        if (await isTonMnemonic(mnemonic)) return tonKeyPairFromTonMnemonic(mnemonic);
        throw e;
    }
}

/** The v4r2 wallet contract for a public key (the app's standard TON account). */
export async function tonWalletContract(publicKey: Buffer): Promise<any> {
    const { WalletContractV4 } = await import('@ton/ton');
    return WalletContractV4.create({ workchain: 0, publicKey });
}

/** Non-bounceable user-friendly address (UQ…) for a public key. */
export async function tonAddressFromPublicKey(publicKey: Buffer): Promise<string> {
    const wallet = await tonWalletContract(publicKey);
    return wallet.address.toString({ urlSafe: true, bounceable: false, testOnly: false });
}

/** Compare TON addresses by their raw (workchain:hash) identity. */
export function sameTonAddress(a?: string, b?: string): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    try {
        const { Address } = require('@ton/core');
        return Address.parse(a).equals(Address.parse(b));
    } catch {
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cosmos-family  (secp256k1, m/44'/118'/0'/0/0)
// ─────────────────────────────────────────────────────────────────────────────

export const COSMOS_DERIVATION_PATH = "m/44'/118'/0'/0/0";

/** cosmjs offline signer from a BIP39 phrase, bound to `prefix`. */
export async function cosmosWalletFromMnemonic(mnemonic: string, prefix: string): Promise<any> {
    const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing');
    return DirectSecp256k1HdWallet.fromMnemonic(mnemonic.trim(), { prefix });
}

/** cosmjs offline signer from a raw secp256k1 key (Keplr "export private key"). */
export async function cosmosWalletFromPrivateKeyHex(hex: string, prefix: string): Promise<any> {
    const { DirectSecp256k1Wallet } = await import('@cosmjs/proto-signing');
    const clean = normalizeHexKey(hex);
    if (!/^[0-9a-f]{64}$/.test(clean)) throw new Error('A Cosmos private key must be 32 bytes of hex.');
    return DirectSecp256k1Wallet.fromKey(Buffer.from(clean, 'hex'), prefix);
}

/** bech32 address for a raw secp256k1 key under `prefix`. */
export async function cosmosAddressFromPrivateKeyHex(hex: string, prefix: string): Promise<string> {
    const wallet = await cosmosWalletFromPrivateKeyHex(hex, prefix);
    const [account] = await wallet.getAccounts();
    if (!account) throw new Error('Could not derive a Cosmos account from this key.');
    return account.address;
}
