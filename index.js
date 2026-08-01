/**
 * App entry point.
 *
 * This file exists so the crypto/Web3 polyfills are guaranteed to run before
 * ANY application module. Importing them from `app/_layout.tsx` was not enough:
 * expo-router builds its route tree by requiring every route module, and a
 * screen with a heavy dependency graph (app/swap.tsx pulls in the Solana,
 * Cosmos and ethers stacks) can evaluate before the layout does. Modules like
 * `@noble/hashes/crypto` snapshot `globalThis.crypto` the moment they load, so
 * losing that race left the PRNG permanently undefined and Solana swaps failed
 * with "crypto.getRandomValues must be defined".
 *
 * Keep `expo-router/entry` last.
 */

import './utils/install-crypto';
import './utils/polyfills';

import 'expo-router/entry';
