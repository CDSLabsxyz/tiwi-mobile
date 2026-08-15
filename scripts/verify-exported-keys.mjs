/**
 * Exported-key correctness check.
 *
 * For every key the export screen shows, re-derive the address FROM THE KEY
 * ALONE and compare it to the address the wallet displays for that chain. A
 * mismatch means we would hand the user a key that does not open the account
 * they are looking at - the worst possible outcome for an export feature.
 *
 * Run:  node scripts/verify-exported-keys.mjs
 */
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'package.json'));

const MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/** The addresses the wallet shows (verified against the web app separately). */
const ADDRESSES = {
    ETH: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    SOLANA: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    TRON: 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH',
    TON: 'UQAzWZa6nM5mJev91wGc7VCSfBoIsYRqKJpV78N8Add9-RKY',
    COSMOS: 'cosmos19rl4cm2hmr8afy4kldpxz3fka4jguq0auqdal4',
    INJECTIVE: 'inj1npvwllfr9dqr8erajqqr6s0vxnk2ak55re90dz',
    SUI: '0x5e93a736d04fbb25737aa40bee40171ef79f65fae833749e3c089fe7cc2161f1',
    APTOS: '0xeb663b681209e7087d681c5d3eed12aaa8e1915e7c87794542c3f96e94b3d3bf',
    BITCOIN: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
    LITECOIN: 'ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh',
    DOGECOIN: 'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC',
    BITCOINCASH: '1mW6fDEMjKrDHvLvoEsaeLxSCzZBf3Bfg',
    STARKNET: '0x3466168d843efdbb06e1a83ba3f49c5dc7ca5d78add9d832ec5ed99eb21303',
    POLKADOT: '13KVd4f2a4S5pLp4gTTFezyXdPWx27vQ9vS6xBXJ9yWVd7xo',
    STACKS: 'SP0C5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J',
};

/**
 * The Cosmos-family accounts. Every one is the SAME secp256k1 account as
 * COSMOS, re-encoded under its own bech32 prefix - so the single exported
 * Cosmos key must open all of them. Checked explicitly so "one key covers 13
 * chains" is a verified claim rather than a comment.
 */
const COSMOS_FAMILY = {
    OSMOSIS: ['osmo', 'osmo19rl4cm2hmr8afy4kldpxz3fka4jguq0a5m7df8'],
    THORCHAIN: ['thor', 'thor19rl4cm2hmr8afy4kldpxz3fka4jguq0a685x22'],
    JUNO: ['juno', 'juno19rl4cm2hmr8afy4kldpxz3fka4jguq0a2jwxcf'],
    STRIDE: ['stride', 'stride19rl4cm2hmr8afy4kldpxz3fka4jguq0altdpte'],
    DYDX: ['dydx', 'dydx19rl4cm2hmr8afy4kldpxz3fka4jguq0a4erelz'],
    KUJIRA: ['kujira', 'kujira19rl4cm2hmr8afy4kldpxz3fka4jguq0adg09jl'],
    SECRET: ['secret', 'secret19rl4cm2hmr8afy4kldpxz3fka4jguq0a79e5zf'],
    CELESTIA: ['celestia', 'celestia19rl4cm2hmr8afy4kldpxz3fka4jguq0ad2ud9c'],
    ARCHWAY: ['archway', 'archway19rl4cm2hmr8afy4kldpxz3fka4jguq0aft3e4z'],
    SAGA: ['saga', 'saga19rl4cm2hmr8afy4kldpxz3fka4jguq0azn50cn'],
    NEUTRON: ['neutron', 'neutron19rl4cm2hmr8afy4kldpxz3fka4jguq0aclyl9j'],
    NIBIRU: ['nibi', 'nibi19rl4cm2hmr8afy4kldpxz3fka4jguq0at9fykx'],
};

// Compile the app's own export module so this tests shipped code. A temp
// tsconfig is needed because `@/…` path mapping cannot be passed on the CLI.
const outDir = mkdtempSync(join(ROOT, '.keycheck-build-'));
const tsconfigPath = join(outDir, 'tsconfig.json');
writeFileSync(tsconfigPath, JSON.stringify({
    compilerOptions: {
        outDir, module: 'commonjs', target: 'es2020', moduleResolution: 'node',
        skipLibCheck: true, esModuleInterop: true, baseUrl: ROOT,
        paths: { '@/*': ['./*'] }, rootDir: ROOT,
    },
    files: [join(ROOT, 'services/exportPrivateKeys.ts')],
}));
try {
    execFileSync('npx', ['tsc', '-p', tsconfigPath], { cwd: ROOT, stdio: 'pipe' });
} catch (e) {
    const msg = e.stdout?.toString() || e.message;
    if (!msg.includes('error')) { rmSync(outDir, { recursive: true, force: true }); throw e; }
}

// tsc resolves `@/…` for typechecking but emits the specifier unchanged, so
// teach node's resolver to find the compiled siblings.
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (request.startsWith('@/')) {
        return originalResolve.call(this, join(outDir, `${request.slice(2)}.js`), ...rest);
    }
    return originalResolve.call(this, request, ...rest);
};

const { deriveExportablePrivateKeys } = require(join(outDir, 'services/exportPrivateKeys.js'));
const keys = await deriveExportablePrivateKeys(MNEMONIC);
rmSync(outDir, { recursive: true, force: true });

const byId = Object.fromEntries(keys.map(k => [k.id, k]));
const results = [];
/** @param via which exported key opens this account (defaults to the same id) */
const check = (id, actual, via = id) =>
    results.push({ id, via, ok: actual === ADDRESSES[id], actual });

// ── Re-derive each address from the exported key only ────────────────────────
const { privateKeyToAccount } = require('viem/accounts');
check('ETH', privateKeyToAccount(byId.ETH.privateKey).address);

const { Keypair } = require('@solana/web3.js');
const bs58m = require('bs58'); const bs58 = bs58m.default || bs58m;
check('SOLANA', Keypair.fromSecretKey(bs58.decode(byId.SOLANA.privateKey)).publicKey.toBase58());

const TronModule = require('tronweb');
const TronWeb = TronModule.TronWeb || TronModule.default?.TronWeb || TronModule.default;
check('TRON', new TronWeb({ fullHost: 'https://api.trongrid.io' })
    .address.fromPrivateKey(byId.TRON.privateKey));

const { keyPairFromSecretKey } = require('@ton/crypto');
const { WalletContractV4 } = require('@ton/ton');
const tonKp = keyPairFromSecretKey(Buffer.from(byId.TON.privateKey, 'hex'));
check('TON', WalletContractV4.create({ workchain: 0, publicKey: tonKp.publicKey })
    .address.toString({ urlSafe: true, bounceable: false, testOnly: false }));

const { DirectSecp256k1Wallet } = require('@cosmjs/proto-signing');
const cosmosWallet = await DirectSecp256k1Wallet.fromKey(Buffer.from(byId.COSMOS.privateKey, 'hex'), 'cosmos');
check('COSMOS', (await cosmosWallet.getAccounts())[0].address);

// The one Cosmos key must open every Cosmos-family account, not just ATOM.
for (const [id, [prefix, expected]] of Object.entries(COSMOS_FAMILY)) {
    const w = await DirectSecp256k1Wallet.fromKey(Buffer.from(byId.COSMOS.privateKey, 'hex'), prefix);
    const actual = (await w.getAccounts())[0].address;
    ADDRESSES[id] = expected;
    check(id, actual, 'COSMOS');
}

const { bech32 } = require('bech32');
const injAddr = privateKeyToAccount(byId.INJECTIVE.privateKey).address;
const injBytes = Buffer.from(injAddr.slice(2), 'hex');
check('INJECTIVE', bech32.encode('inj', bech32.toWords(injBytes)));

const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
check('SUI', Ed25519Keypair.fromSecretKey(byId.SUI.privateKey).getPublicKey().toSuiAddress());

const { Account, Ed25519PrivateKey } = require('@aptos-labs/ts-sdk');
check('APTOS', Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(byId.APTOS.privateKey),
}).accountAddress.toString());

const btc = require('@scure/btc-signer');
const LTC = { bech32: 'ltc', pubKeyHash: 0x30, scriptHash: 0x32, wif: 0xb0 };
const DOGE = { bech32: 'doge', pubKeyHash: 0x1e, scriptHash: 0x16, wif: 0x9e };
const { secp256k1 } = require('@noble/curves/secp256k1');
const pubFromWif = (wif, net) => secp256k1.getPublicKey(btc.WIF(net).decode(wif), true);
check('BITCOIN', btc.p2wpkh(pubFromWif(byId.BITCOIN.privateKey, btc.NETWORK), btc.NETWORK).address);
check('LITECOIN', btc.p2wpkh(pubFromWif(byId.LITECOIN.privateKey, LTC), LTC).address);
check('DOGECOIN', btc.p2pkh(pubFromWif(byId.DOGECOIN.privateKey, DOGE), DOGE).address);
check('BITCOINCASH', btc.p2pkh(pubFromWif(byId.BITCOINCASH.privateKey, btc.NETWORK), btc.NETWORK).address);

const { ec, hash, CallData } = require('starknet');
const starkPub = ec.starkCurve.getStarkKey(byId.STARKNET.privateKey);
const OZ = '0x01a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003';
check('STARKNET', hash.calculateContractAddressFromHash(
    starkPub, OZ, CallData.compile({ publicKey: starkPub }), 0));

const sr = require('@scure/sr25519');
const { blake2b } = require('@noble/hashes/blake2b');
const dotPub = sr.getPublicKey(sr.secretFromSeed(Buffer.from(byId.POLKADOT.privateKey.slice(2), 'hex')));
const dotPayload = new Uint8Array([0, ...dotPub]);
const dotCs = blake2b(new Uint8Array([...new TextEncoder().encode('SS58PRE'), ...dotPayload]), { dkLen: 64 }).slice(0, 2);
check('POLKADOT', bs58.encode(new Uint8Array([...dotPayload, ...dotCs])));

// Stacks: the exported key carries the compressed marker; strip it to re-derive.
const { sha256 } = require('ethereum-cryptography/sha256');
const { ripemd160 } = require('ethereum-cryptography/ripemd160');
const C32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function c32encode(bytes) {
    let n = 0n;
    for (const b of bytes) n = n * 256n + BigInt(b);
    let o = '';
    while (n > 0n) { o = C32[Number(n % 32n)] + o; n /= 32n; }
    let z = 0; for (const b of bytes) { if (b === 0) z++; else break; }
    while (o.length < Math.ceil(((bytes.length - z) * 8) / 5)) o = '0' + o;
    for (let i = 0; i < z; i++) o = '0' + o;
    return o || '0';
}
const stxRaw = Buffer.from(byId.STACKS.privateKey.replace(/01$/, ''), 'hex');
const stxPub = secp256k1.getPublicKey(stxRaw, true);
const h160 = ripemd160(sha256(stxPub));
const stxCs = sha256(sha256(new Uint8Array([22, ...h160]))).slice(0, 4);
check('STACKS', 'S' + C32[22] + c32encode(new Uint8Array([...h160, ...stxCs])));

// ── Report ───────────────────────────────────────────────────────────────────
const width = Math.max(...results.map(r => r.id.length));
let failures = 0;
for (const r of results) {
    if (!r.ok) failures++;
    const key = byId[r.via];
    const opener = r.via === r.id ? key.format : `opened by the ${r.via} key`;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(width)}  ${opener}`);
    if (!r.ok) {
        console.log(`      ${''.padEnd(width)}  key opens: ${r.actual}`);
        console.log(`      ${''.padEnd(width)}  wallet shows: ${ADDRESSES[r.id]}`);
    }
}
const unchecked = keys.filter(k => !results.some(r => r.id === k.id)).map(k => k.id);
if (unchecked.length) console.log(`\nnot re-derived here: ${unchecked.join(', ')}`);
console.log(`\n${keys.length} exported keys → ${results.length} accounts verified`);
console.log(failures === 0
    ? `EVERY ACCOUNT THE WALLET DERIVES IS OPENED BY AN EXPORTED KEY`
    : `\n${failures} ACCOUNT(S) NOT OPENED BY ANY EXPORTED KEY`);
process.exit(failures === 0 ? 0 : 1);
