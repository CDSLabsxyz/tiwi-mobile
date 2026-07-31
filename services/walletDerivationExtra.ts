/**
 * Extra-chain address derivations (mobile)
 *
 * Ports the additional (non-core-6) chain derivations from the web app's
 * `lib/wallet/utils/wallet-creation.ts` so the mobile wallet derives the SAME
 * 27 addresses as the web app. These are used for balance discovery / display;
 * on-device signing still covers only the 6 ChainType chains.
 *
 * Every heavy library is imported dynamically and each derivation is wrapped by
 * the caller in try/catch, so a library that fails to load or run under Hermes
 * degrades that one address to `undefined` — it can never break the core 6.
 *
 * Re-encode chains (injective, cosmos-family) reuse keys already derived on the
 * device (the EVM / Cosmos accounts), so they carry no runtime risk.
 */

import { HDKey } from '@scure/bip32';

// ── bech32 re-encodes (no key derivation — reuse existing accounts) ───────────

/** Re-encode a bech32 address under a different human-readable prefix. */
export function reEncodeBech32(address: string, targetPrefix: string): string | null {
    try {
        const { decode, encode } = require('bech32').bech32;
        const { words } = decode(address);
        return encode(targetPrefix, words);
    } catch {
        return null;
    }
}

/**
 * Re-encode an EVM `0x…` address as an Injective `inj1…` address.
 * Injective uses eth_secp256k1 — its account is the SAME 20 bytes as the EVM
 * address, NOT the standard Cosmos key (so it derives off the EVM address).
 */
export function evmToInjectiveAddress(evmAddress: string): string | null {
    const m = /^0x([0-9a-fA-F]{40})$/.exec(evmAddress.trim());
    if (!m) return null;
    const hex = m[1];
    const bytes = new Uint8Array(20);
    for (let i = 0; i < 20; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    try {
        const { encode, toWords } = require('bech32').bech32;
        return encode('inj', toWords(bytes));
    } catch {
        return null;
    }
}

// ── ed25519 chains ───────────────────────────────────────────────────────────

/** Sui (ed25519, m/44'/784'/0'/0'/0'). */
export async function deriveSuiAddress(mnemonic: string): Promise<string> {
    const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
    return Ed25519Keypair.deriveKeypair(mnemonic.trim()).getPublicKey().toSuiAddress();
}

/** Aptos (ed25519, m/44'/637'/0'/0'/0'). */
export async function deriveAptosAddress(mnemonic: string): Promise<string> {
    const { Account } = await import('@aptos-labs/ts-sdk');
    const account = Account.fromDerivationPath({
        path: "m/44'/637'/0'/0'/0'",
        mnemonic: mnemonic.trim(),
    });
    return account.accountAddress.toString();
}

// ── Stacks (c32check, SIP-005) ───────────────────────────────────────────────

const C32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function c32encode(bytes: Uint8Array): string {
    const B256 = BigInt(256), B32 = BigInt(32), ZERO = BigInt(0);
    let n = ZERO;
    for (const b of bytes) n = n * B256 + BigInt(b);
    let out = '';
    while (n > ZERO) { out = C32_ALPHABET[Number(n % B32)] + out; n = n / B32; }
    let zeros = 0;
    for (const b of bytes) { if (b === 0) zeros++; else break; }
    while (out.length < Math.ceil(((bytes.length - zeros) * 8) / 5)) out = '0' + out;
    for (let i = 0; i < zeros; i++) out = '0' + out;
    return out || '0';
}

/** Stacks mainnet (SP…), BIP44 m/44'/5757'. */
export async function deriveStacksAddress(seed: Uint8Array): Promise<string> {
    const { sha256 } = await import('@noble/hashes/sha2');
    const { ripemd160 } = await import('@noble/hashes/ripemd160');
    const child = HDKey.fromMasterSeed(seed).derive("m/44'/5757'/0'/0/0");
    if (!child.publicKey) throw new Error('Failed to derive Stacks key');
    const hash160 = ripemd160(sha256(child.publicKey));
    const version = 22; // mainnet single-sig P2PKH
    const checksum = sha256(sha256(new Uint8Array([version, ...hash160]))).slice(0, 4);
    return 'S' + C32_ALPHABET[version] + c32encode(new Uint8Array([...hash160, ...checksum]));
}

// ── UTXO chains (@scure/btc-signer) ──────────────────────────────────────────

const LITECOIN_NETWORK = { bech32: 'ltc', pubKeyHash: 0x30, scriptHash: 0x32, wif: 0xb0 };
const DOGECOIN_NETWORK = { bech32: 'doge', pubKeyHash: 0x1e, scriptHash: 0x16, wif: 0x9e };

/** Bitcoin native SegWit (bc1…), BIP84 m/84'/0'. */
export async function deriveBitcoinAddress(seed: Uint8Array): Promise<string> {
    const btc = await import('@scure/btc-signer');
    const child = HDKey.fromMasterSeed(seed).derive("m/84'/0'/0'/0/0");
    if (!child.publicKey) throw new Error('Failed to derive Bitcoin key');
    return btc.p2wpkh(child.publicKey, btc.NETWORK).address!;
}

/** Litecoin native SegWit (ltc1…), BIP84 m/84'/2'. */
export async function deriveLitecoinAddress(seed: Uint8Array): Promise<string> {
    const btc = await import('@scure/btc-signer');
    const child = HDKey.fromMasterSeed(seed).derive("m/84'/2'/0'/0/0");
    if (!child.publicKey) throw new Error('Failed to derive Litecoin key');
    return btc.p2wpkh(child.publicKey, LITECOIN_NETWORK).address!;
}

/** Dogecoin legacy P2PKH (D…), BIP44 m/44'/3'. */
export async function deriveDogecoinAddress(seed: Uint8Array): Promise<string> {
    const btc = await import('@scure/btc-signer');
    const child = HDKey.fromMasterSeed(seed).derive("m/44'/3'/0'/0/0");
    if (!child.publicKey) throw new Error('Failed to derive Dogecoin key');
    return btc.p2pkh(child.publicKey, DOGECOIN_NETWORK).address!;
}

/** Bitcoin Cash legacy P2PKH (1…), BIP44 m/44'/145'. */
export async function deriveBitcoinCashAddress(seed: Uint8Array): Promise<string> {
    const btc = await import('@scure/btc-signer');
    const child = HDKey.fromMasterSeed(seed).derive("m/44'/145'/0'/0/0");
    if (!child.publicKey) throw new Error('Failed to derive Bitcoin Cash key');
    return btc.p2pkh(child.publicKey, btc.NETWORK).address!;
}

// ── Polkadot (sr25519 + SS58) ────────────────────────────────────────────────

/**
 * Polkadot mainnet address (1…), sr25519, SS58 format 0.
 *
 * The web app derives this with `@polkadot/keyring` + `@polkadot/util-crypto`,
 * which drag in a WASM crypto backend that is a poor fit for Hermes. This
 * reproduces the identical result from the substrate spec directly:
 *
 *   1. mini-secret = PBKDF2-SHA512(BIP39 *entropy*, "mnemonic", 2048)[0..32]
 *      — note it hashes the ENTROPY, not the phrase, so it is NOT the first
 *      32 bytes of the standard BIP39 seed.
 *   2. sr25519 keypair from that mini-secret.
 *   3. SS58 = base58(prefix ‖ pubkey ‖ blake2b("SS58PRE" ‖ payload)[0..2]).
 *
 * Verified byte-for-byte against `Keyring({type:'sr25519', ss58Format:0})
 * .addFromMnemonic(...)` — see scripts/verify-address-parity.mjs.
 */
export async function derivePolkadotAddress(mnemonic: string): Promise<string> {
    const [
        { mnemonicToEntropy },
        { wordlist },
        { pbkdf2 },
        { sha512 },
        { blake2b },
        sr,
    ] = await Promise.all([
        import('@scure/bip39'),
        import('@scure/bip39/wordlists/english.js'),
        import('@noble/hashes/pbkdf2'),
        import('@noble/hashes/sha512'),
        import('@noble/hashes/blake2b'),
        import('@scure/sr25519'),
    ]);

    const entropy = mnemonicToEntropy(mnemonic.trim(), wordlist);
    const miniSecret = pbkdf2(sha512, entropy, new TextEncoder().encode('mnemonic'), {
        c: 2048,
        dkLen: 64,
    }).slice(0, 32);

    const publicKey = sr.getPublicKey(sr.secretFromSeed(miniSecret));

    const SS58_PREFIX = 0; // Polkadot mainnet
    const payload = new Uint8Array([SS58_PREFIX, ...publicKey]);
    const checksum = blake2b(
        new Uint8Array([...new TextEncoder().encode('SS58PRE'), ...payload]),
        { dkLen: 64 },
    ).slice(0, 2);

    const bs58mod: any = await import('bs58');
    const encode = bs58mod.encode || bs58mod.default?.encode || bs58mod.default?.default?.encode;
    if (!encode) throw new Error('bs58 encode unavailable');
    return encode(new Uint8Array([...payload, ...checksum]));
}

// ── Starknet (Stark curve + OZ account) ──────────────────────────────────────

/** Starknet counterfactual OZ account address (0x…), signing key m/44'/9004'. */
export async function deriveStarknetAddress(seed: Uint8Array): Promise<string> {
    const { ec, hash, CallData } = await import('starknet');
    const child = HDKey.fromMasterSeed(seed).derive("m/44'/9004'/0'/0/0");
    if (!child.privateKey) throw new Error('Failed to derive Starknet key');
    const pkHex = '0x' + Array.from(child.privateKey).map((b) => b.toString(16).padStart(2, '0')).join('');
    const publicKey = ec.starkCurve.getStarkKey('0x' + ec.starkCurve.grindKey(pkHex));
    const ozClassHash =
        process.env.EXPO_PUBLIC_STARKNET_OZ_CLASS_HASH ||
        '0x01a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003';
    return hash.calculateContractAddressFromHash(publicKey, ozClassHash, CallData.compile({ publicKey }), 0);
}
