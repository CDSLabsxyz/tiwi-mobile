/**
 * Crypto global — MUST be installed before any other module is evaluated.
 *
 * Why this is its own file, and why it uses `require` instead of `import`:
 *
 * `@noble/hashes/crypto` (pulled in by the Solana, Starknet, Cosmos, BIP-39 and
 * ethers stacks) captures the crypto object ONCE, at module-evaluation time:
 *
 *     exports.crypto = 'crypto' in globalThis ? globalThis.crypto : undefined;
 *
 * If it evaluates before the polyfill runs, it captures `undefined` forever and
 * every later `randomBytes()` throws "crypto.getRandomValues must be defined" —
 * which is exactly what a Solana swap hit, because generating the temporary
 * account for a WSOL unwrap needs a random keypair.
 *
 * `react-native-get-random-values` MUTATES `global.crypto` when it already
 * exists, so establishing the object first means even a module that captured
 * the reference early ends up holding the same object the method lands on.
 *
 * ES `import`s are hoisted above statements, so ordering only holds with
 * `require` — do not "tidy" these into imports.
 */

/* eslint-disable @typescript-eslint/no-require-imports --
   `require` is load-bearing here: ES imports hoist above the statements below
   and would undo the ordering this whole file exists to guarantee. */

const g: any = globalThis as any;

// 1. The object first, so early capturers share this exact reference.
if (typeof g.crypto !== 'object' || g.crypto === null) {
  g.crypto = {};
}

// 2. The native-backed implementation.
require('react-native-get-random-values');

// 3. Last resort: Expo's native crypto, in case the module above could not
//    install itself (bridgeless/remote-debug edge cases). Never leave the app
//    with a silently missing PRNG — key material depends on it.
if (typeof g.crypto.getRandomValues !== 'function') {
  const expoCrypto = require('expo-crypto');
  g.crypto.getRandomValues = <T extends ArrayBufferView>(array: T): T =>
    expoCrypto.getRandomValues(array as any) as T;
}

if (typeof g.crypto.randomUUID !== 'function') {
  const expoCrypto = require('expo-crypto');
  g.crypto.randomUUID = () => expoCrypto.randomUUID();
}

export {};
