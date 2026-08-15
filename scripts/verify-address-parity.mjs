/**
 * Cross-app address-parity check.
 *
 * The mobile wallet and the web wallet (tiwi-user-app) must derive BYTE-IDENTICAL
 * addresses from the same recovery phrase - a user imports one phrase and expects
 * the same accounts in both. A drift means funds sent to an address shown by one
 * app are unreachable from the other.
 *
 * This derives all 27 chains here, using the SAME code the app ships
 * (services/walletDerivationExtra.ts, services/chainKeys.ts, and the inline
 * EVM/Solana/Cosmos paths from services/walletCreationService.ts), and compares
 * against a fixture captured from the web app's
 * `getMultiChainAddressesFromMnemonic`.
 *
 * Regenerate the fixture from the web repo with:
 *   npx vitest run <a test that dumps getMultiChainAddressesFromMnemonic>
 *
 * Run:  node scripts/verify-address-parity.mjs
 */
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'package.json'));

/** Web app output for the canonical BIP39 test vector. */
const MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const WEB = {
    EVM: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    SOLANA: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    TRON: 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH',
    TON: 'UQAzWZa6nM5mJev91wGc7VCSfBoIsYRqKJpV78N8Add9-RKY',
    COSMOS: 'cosmos19rl4cm2hmr8afy4kldpxz3fka4jguq0auqdal4',
    OSMOSIS: 'osmo19rl4cm2hmr8afy4kldpxz3fka4jguq0a5m7df8',
    INJECTIVE: 'inj1npvwllfr9dqr8erajqqr6s0vxnk2ak55re90dz',
    THORCHAIN: 'thor19rl4cm2hmr8afy4kldpxz3fka4jguq0a685x22',
    JUNO: 'juno19rl4cm2hmr8afy4kldpxz3fka4jguq0a2jwxcf',
    STRIDE: 'stride19rl4cm2hmr8afy4kldpxz3fka4jguq0altdpte',
    DYDX: 'dydx19rl4cm2hmr8afy4kldpxz3fka4jguq0a4erelz',
    KUJIRA: 'kujira19rl4cm2hmr8afy4kldpxz3fka4jguq0adg09jl',
    SECRET: 'secret19rl4cm2hmr8afy4kldpxz3fka4jguq0a79e5zf',
    CELESTIA: 'celestia19rl4cm2hmr8afy4kldpxz3fka4jguq0ad2ud9c',
    ARCHWAY: 'archway19rl4cm2hmr8afy4kldpxz3fka4jguq0aft3e4z',
    SAGA: 'saga19rl4cm2hmr8afy4kldpxz3fka4jguq0azn50cn',
    NEUTRON: 'neutron19rl4cm2hmr8afy4kldpxz3fka4jguq0aclyl9j',
    NIBIRU: 'nibi19rl4cm2hmr8afy4kldpxz3fka4jguq0at9fykx',
    BITCOIN: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
    POLKADOT: '13KVd4f2a4S5pLp4gTTFezyXdPWx27vQ9vS6xBXJ9yWVd7xo',
    STARKNET: '0x3466168d843efdbb06e1a83ba3f49c5dc7ca5d78add9d832ec5ed99eb21303',
    LITECOIN: 'ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh',
    DOGECOIN: 'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC',
    BITCOINCASH: '1mW6fDEMjKrDHvLvoEsaeLxSCzZBf3Bfg',
    STACKS: 'SP0C5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J',
    SUI: '0x5e93a736d04fbb25737aa40bee40171ef79f65fae833749e3c089fe7cc2161f1',
    APTOS: '0xeb663b681209e7087d681c5d3eed12aaa8e1915e7c87794542c3f96e94b3d3bf',
};

// ── Compile the app's own derivation modules and load them ───────────────────
// Using the shipped sources (rather than a re-implementation) is the point: this
// fails if someone edits a derivation path in the app.
// Emit INSIDE the project - the compiled modules require the app's own
// dependencies, which node can only resolve from a path under the project root.
const outDir = mkdtempSync(join(ROOT, '.parity-build-'));
try {
    execFileSync(
        'npx',
        [
            'tsc', 'services/walletDerivationExtra.ts', 'services/chainKeys.ts',
            '--outDir', outDir,
            '--module', 'commonjs', '--target', 'es2020',
            '--moduleResolution', 'node', '--skipLibCheck', '--esModuleInterop',
        ],
        { cwd: ROOT, stdio: 'pipe' },
    );
} catch (e) {
    // tsc exits non-zero on type errors it can still emit through; only bail if
    // the output is missing.
    const msg = e.stdout?.toString() || e.message;
    if (!msg.includes('error')) throw e;
}

const extra = require(join(outDir, 'walletDerivationExtra.js'));
const chainKeys = require(join(outDir, 'chainKeys.js'));

const { mnemonicToSeedSync } = require('@scure/bip39');
const { mnemonicToAccount } = require('viem/accounts');
const { Keypair } = require('@solana/web3.js');
const { derivePath } = require('ed25519-hd-key');
const { HDKey } = require('@scure/bip32');
const { bech32 } = require('bech32');
const { ripemd160 } = require('ethereum-cryptography/ripemd160');
const { sha256 } = require('ethereum-cryptography/sha256');

const COSMOS_FAMILY_PREFIXES = {
    COSMOS: 'cosmos', OSMOSIS: 'osmo', THORCHAIN: 'thor', JUNO: 'juno',
    STRIDE: 'stride', DYDX: 'dydx', KUJIRA: 'kujira', SECRET: 'secret',
    CELESTIA: 'celestia', ARCHWAY: 'archway', SAGA: 'saga',
    NEUTRON: 'neutron', NIBIRU: 'nibi',
};

async function derive() {
    const m = MNEMONIC.trim();
    const seed = mnemonicToSeedSync(m);
    const a = {};

    a.EVM = mnemonicToAccount(m).address;

    const seedHex = Buffer.from(seed).toString('hex');
    a.SOLANA = Keypair.fromSeed(derivePath("m/44'/501'/0'/0'", seedHex).key).publicKey.toBase58();

    a.TRON = await chainKeys.tronAddressFromPrivateKey(
        await chainKeys.tronPrivateKeyFromMnemonic(m),
    );

    a.TON = await chainKeys.tonAddressFromPublicKey((await chainKeys.tonKeyPairFromBip39(m)).publicKey);

    const child = HDKey.fromMasterSeed(seed).derive("m/44'/118'/0'/0/0");
    a.COSMOS = bech32.encode('cosmos', bech32.toWords(ripemd160(sha256(child.publicKey))));
    for (const [key, prefix] of Object.entries(COSMOS_FAMILY_PREFIXES)) {
        a[key] = extra.reEncodeBech32(a.COSMOS, prefix);
    }

    a.INJECTIVE = extra.evmToInjectiveAddress(a.EVM);
    a.BITCOIN = await extra.deriveBitcoinAddress(seed);
    a.LITECOIN = await extra.deriveLitecoinAddress(seed);
    a.DOGECOIN = await extra.deriveDogecoinAddress(seed);
    a.BITCOINCASH = await extra.deriveBitcoinCashAddress(seed);
    a.STACKS = await extra.deriveStacksAddress(seed);
    a.SUI = await extra.deriveSuiAddress(m);
    a.APTOS = await extra.deriveAptosAddress(m);
    a.STARKNET = await extra.deriveStarknetAddress(seed);
    a.POLKADOT = await extra.derivePolkadotAddress(m);
    return a;
}

const mobile = await derive();
rmSync(outDir, { recursive: true, force: true });

let failures = 0;
const width = Math.max(...Object.keys(WEB).map(k => k.length));
for (const [chain, expected] of Object.entries(WEB)) {
    const actual = mobile[chain];
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${chain.padEnd(width)}  ${actual ?? '(missing)'}`);
    if (!ok) console.log(`      ${''.padEnd(width)}  web: ${expected}`);
}

const missing = Object.keys(mobile).filter(k => !(k in WEB));
if (missing.length) console.log(`\nmobile-only keys (not in web fixture): ${missing.join(', ')}`);

console.log(
    failures === 0
        ? `\nALL ${Object.keys(WEB).length} CHAINS MATCH THE WEB APP`
        : `\n${failures} CHAIN(S) DIVERGE FROM THE WEB APP`,
);
process.exit(failures === 0 ? 0 : 1);
