/**
 * Signer material for the swap engine (React Native).
 *
 * The ported executors accept their signing capability through ONE seam:
 * `SwapExecutionParams.walletClient`. On the web that value is either a viem
 * WalletClient (EVM) or a small "internal wallet" object for the chains viem
 * can't sign (see lib/wallet/utils/internal-*-signer.ts). This module builds
 * exactly those same shapes from the keys held on device, so every executor
 * runs unmodified.
 *
 *   EVM        → viem WalletClient (local private key)
 *   Solana     → { publicKey, signTransaction, isConnected }  (adapter shape)
 *   Sui        → { suiKeypair, suiAddress }
 *   TON        → { tonKeypair, tonAddress }
 *   TRON       → { tronWeb }
 *   Injective  → { injective: true, injectivePrivateKey, injectiveAddress }
 *   Cosmos     → { cosmosSigner, cosmosAddress, cosmosChainId, injectiveAddress? }
 *
 * All of it runs with `skipAuthorize`-equivalent semantics: the swap screen
 * gates the whole flow behind one biometric/passcode prompt, so a multi-leg
 * swap doesn't re-prompt per signature.
 */

import { createWalletClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { COSMOS_CHAIN_CONFIG } from '@/constants/cosmosChains';
import { getCosmosConfig } from '@/constants/cosmosChains';
import {
    createTronWeb,
    sameTonAddress,
    tonAddressFromPublicKey,
    tonKeyPairFromBip39,
} from '@/services/chainKeys';
import { getCosmosSigner, getTonKeyPair, getTronPrivateKey } from '@/services/signer/chainSecrets';
import {
    createSigningTransport,
    getChainForId,
    getPollingInterval,
} from '@/services/swap/core/platform/viem-clients';
import {
    getActiveMnemonic,
    getAddressForChain,
    getEvmPrivateKey,
    getWalletGroupForAddress,
} from '@/services/swap/core/platform/wallet-context';
import { isCosmosChain, isSolanaChain, isTONChain, isTRONChain } from '@/services/swap/core/utils/chain-helpers';
import { SwapErrorCode, SwapExecutionError } from '@/services/swap/core/types';

export const SUI_CANONICAL_CHAIN_ID = 101;
export const TON_CANONICAL_CHAIN_ID = 1100;
export const TRON_CHAIN_ID = 728126428;
export const INJECTIVE_CHAIN_ID = 8000001;
const SUI_TON_TRON_INJ = new Set([
    SUI_CANONICAL_CHAIN_ID,
    TON_CANONICAL_CHAIN_ID,
    TRON_CHAIN_ID,
    INJECTIVE_CHAIN_ID,
]);

// ============================================================================
// EVM
// ============================================================================

const evmClientCache = new Map<string, WalletClient>();

/**
 * viem WalletClient backed by the device's EVM private key.
 *
 * Uses `getChainForId` (registry-backed) rather than the app's older
 * `SignerUtils.getChainById`, which silently returns mainnet for unknown ids -
 * that would sign a swap with the wrong EIP-155 chainId and it would either
 * revert or be replayable on Ethereum.
 */
export async function createEvmWalletClient(chainId: number, address?: string): Promise<WalletClient> {
    const chain = getChainForId(chainId);
    const key = await getEvmPrivateKey(address);
    const cacheKey = `${chainId}:${key.slice(-8)}`;

    const cached = evmClientCache.get(cacheKey);
    if (cached) return cached;

    const localAccount = privateKeyToAccount(key);

    const client = createWalletClient({
        account: localAccount,
        chain,
        // Multi-endpoint ordered failover, so one slow or rate-limited
        // provider can't throttle every signature. (Request batching would cut
        // more latency but is unsafe across these public endpoints - see the
        // note in viem-clients.ts.)
        transport: createSigningTransport(chainId),
        pollingInterval: getPollingInterval(chainId),
    });

    const patched = withLocalSigner(client, localAccount);
    evmClientCache.set(cacheKey, patched);
    return patched;
}

/**
 * Force every write through the LOCAL signer.
 *
 * The ported executors routinely pass `account` as a bare address string, e.g.
 * `walletClient.sendTransaction({ to, data, account: owner, chain: bsc })`.
 * viem parses a hex string into a `json-rpc` account, which means "ask the
 * provider to sign and send" - `wallet_sendTransaction` / `eth_sendTransaction`
 * / `eth_signTypedData_v4`.
 *
 * On web that is correct: the transport IS the browser wallet. On mobile the
 * transport is a plain RPC node that cannot sign for anyone, so those calls die
 * with `RPC Request failed … wallet_sendTransaction`. (It surfaced as a
 * TiwiDEX approval failure; the engine then fell through to another executor,
 * so the swap still completed - just slower, and via a different route than
 * the user was quoted.)
 *
 * Rather than edit ~17 call sites across 11 executors and drift from the web
 * source, normalise it here: a string (or missing) `account` is replaced with
 * the real local account object, so viem signs on-device and broadcasts with
 * `eth_sendRawTransaction`. An explicitly-passed account OBJECT is left alone.
 */
function withLocalSigner(client: any, localAccount: any): WalletClient {
    const useLocal = (args: any) =>
        !args || typeof args !== 'object'
            ? args
            : !args.account || typeof args.account === 'string'
                ? { ...args, account: localAccount }
                : args;

    // Methods that take an `account` and would otherwise be delegated to a
    // provider that doesn't exist here.
    const SIGNING_METHODS = [
        'sendTransaction',
        'writeContract',
        'signTransaction',
        'signTypedData',
        'signMessage',
        'prepareTransactionRequest',
        'deployContract',
    ] as const;

    const patched: any = Object.create(Object.getPrototypeOf(client));
    Object.assign(patched, client);

    for (const method of SIGNING_METHODS) {
        const original = client[method];
        if (typeof original !== 'function') continue;
        patched[method] = (args: any) => original.call(client, useLocal(args));
    }

    return patched as WalletClient;
}

/** Drop cached wallet clients (call on wallet switch / lock). */
export function clearSignerMaterialCache(): void {
    evmClientCache.clear();
}

// ============================================================================
// Solana
// ============================================================================

/**
 * Wallet-adapter-shaped object over the device's Solana keypair.
 * Matches what jupiter-executor / rubic-executor read off `getSolanaWallet()`:
 * `publicKey`, `signTransaction(tx)`, `isConnected`.
 */
export async function createSolanaWalletAdapter(address?: string): Promise<any> {
    const solAddress = address || getAddressForChain(7565164);
    if (!solAddress) {
        throw new SwapExecutionError(
            'This wallet has no Solana address. Create or import a multi-chain wallet to swap on Solana.',
            SwapErrorCode.WALLET_NOT_CONNECTED,
        );
    }

    const { SolanaLocalEngine } = await import('@/services/signer/SolanaLocalEngine');
    const engine = new SolanaLocalEngine();
    const keypair = await engine.getKeypairForAddress(solAddress);

    return {
        publicKey: keypair.publicKey,
        isConnected: true,
        signTransaction: async (tx: any) => {
            // VersionedTransaction uses sign([kp]); legacy Transaction uses partialSign(kp).
            if (typeof tx?.sign === 'function' && Array.isArray(tx?.signatures) && tx?.message) {
                tx.sign([keypair]);
            } else if (typeof tx?.partialSign === 'function') {
                tx.partialSign(keypair);
            } else if (typeof tx?.sign === 'function') {
                tx.sign(keypair);
            } else {
                throw new Error('Unrecognised Solana transaction shape');
            }
            return tx;
        },
        signAllTransactions: async (txs: any[]) => {
            for (const tx of txs) {
                if (typeof tx?.partialSign === 'function') tx.partialSign(keypair);
                else tx.sign([keypair]);
            }
            return txs;
        },
    };
}

// ============================================================================
// Sui
// ============================================================================

export async function createSuiSignerMaterial(address?: string): Promise<{ suiKeypair: any; suiAddress: string }> {
    const mnemonic = await getActiveMnemonic(address);
    const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
    const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
    const derived = keypair.getPublicKey().toSuiAddress();

    const stored = address || getAddressForChain(SUI_CANONICAL_CHAIN_ID);
    if (stored && stored.toLowerCase() !== derived.toLowerCase()) {
        throw new SwapExecutionError(
            `Derived Sui address (${derived}) does not match the active wallet (${stored}). ` +
            'Aborting to avoid signing from the wrong account.',
            SwapErrorCode.WALLET_NOT_CONNECTED,
        );
    }

    return { suiKeypair: keypair, suiAddress: derived };
}

// ============================================================================
// TON
// ============================================================================

/**
 * TON ed25519 keypair at SLIP-0010 m/44'/607'/0' - the scheme Trust Wallet uses
 * for BIP39 phrases, and the one the web app settled on (lib/wallet/utils/
 * ton-keys.ts). Wallet creation derives the displayed address through the same
 * helper, so the two can no longer disagree.
 */
export async function deriveTonKeypair(mnemonic: string): Promise<any> {
    return tonKeyPairFromBip39(mnemonic);
}

export async function createTonSignerMaterial(address?: string): Promise<{ tonKeypair: any; tonAddress: string }> {
    // Covers all three TON wallet shapes: BIP39 multi-chain, raw ed25519 key,
    // and a native 24-word TON phrase.
    const keypair = await getTonKeyPair(address);
    const derived = await tonAddressFromPublicKey(keypair.publicKey);

    const stored = address || getAddressForChain(TON_CANONICAL_CHAIN_ID);
    if (stored && !sameTonAddress(stored, derived)) {
        throw new SwapExecutionError(
            `Derived TON address (${derived}) does not match this wallet's stored TON address (${stored}). ` +
            'Aborting to avoid signing from the wrong account.',
            SwapErrorCode.WALLET_NOT_CONNECTED,
        );
    }

    return { tonKeypair: keypair, tonAddress: derived };
}

// ============================================================================
// TRON
// ============================================================================

export async function createTronSignerMaterial(address?: string): Promise<{ tronWeb: any }> {
    // Resolves a mnemonic-derived key OR a directly-imported TRON private key.
    const privateKeyHex = await getTronPrivateKey(address);
    const tronWeb = await createTronWeb(privateKeyHex);

    const derived = tronWeb.address.fromPrivateKey(privateKeyHex);
    const stored = address || getAddressForChain(TRON_CHAIN_ID);
    if (stored && stored !== derived) {
        throw new SwapExecutionError(
            `Derived TRON address (${derived}) does not match the active wallet (${stored}).`,
            SwapErrorCode.WALLET_NOT_CONNECTED,
        );
    }

    return { tronWeb };
}

// ============================================================================
// Injective (eth_secp256k1 - the EVM key, NOT the m/44'/118' cosmos key)
// ============================================================================

export async function createInjectiveSignerMaterial(address?: string): Promise<{
    injective: true;
    injectivePrivateKey: string;
    injectiveAddress: string;
}> {
    const mnemonic = await getActiveMnemonic(address);
    const { PrivateKey } = await import('@injectivelabs/sdk-ts');

    const pk = PrivateKey.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0");
    return {
        injective: true,
        injectivePrivateKey: pk.toPrivateKeyHex().replace(/^0x/, ''),
        injectiveAddress: pk.toBech32(),
    };
}

/** The wallet's inj1… address, used as a *recipient* on Cosmos-sourced routes. */
export async function deriveInjectiveAddress(address?: string): Promise<string | undefined> {
    try {
        const { injectiveAddress } = await createInjectiveSignerMaterial(address);
        return injectiveAddress;
    } catch {
        return undefined;
    }
}

// ============================================================================
// Cosmos (standard secp256k1, m/44'/118')
// ============================================================================

export async function createCosmosSignerMaterial(
    chainId: number,
    address?: string,
): Promise<{
    cosmosSigner: any;
    cosmosAddress: string;
    cosmosChainId: number;
    injectiveAddress?: string;
}> {
    const cfg = getCosmosConfig(chainId) ?? COSMOS_CHAIN_CONFIG[118];
    if (!cfg) throw new Error(`Cosmos chain ${chainId} is not supported for signing yet.`);

    // Mnemonic-derived or raw-key import - both resolve to a cosmjs signer.
    const wallet = await getCosmosSigner(cfg.prefix, address, cfg.addressKey);
    const accounts = await wallet.getAccounts();
    if (!accounts.length) throw new Error('Could not derive a Cosmos account from this wallet.');

    return {
        cosmosSigner: wallet,
        cosmosAddress: accounts[0].address,
        cosmosChainId: chainId,
        // A Cosmos-sourced route can hop through / land on Injective, whose
        // recipient can't be re-encoded from a cosmos address (different curve).
        injectiveAddress: await deriveInjectiveAddress(address),
    };
}

// ============================================================================
// Dispatcher
// ============================================================================

/**
 * Build the signing material for a swap whose SOURCE chain is `chainId`.
 * This is what the mobile swap runner passes as `params.walletClient`.
 */
export async function buildSignerMaterial(chainId: number, address?: string): Promise<any> {
    const group = getWalletGroupForAddress(address);
    if (group && group.source !== 'internal' && group.source !== 'imported') {
        throw new SwapExecutionError(
            'Swaps from an externally-connected wallet are not supported in the app yet. Switch to an in-app wallet.',
            SwapErrorCode.WALLET_NOT_CONNECTED,
        );
    }

    if (chainId === SUI_CANONICAL_CHAIN_ID) return createSuiSignerMaterial(address);
    if (chainId === TON_CANONICAL_CHAIN_ID || isTONChain(chainId)) return createTonSignerMaterial(address);
    if (chainId === TRON_CHAIN_ID || isTRONChain(chainId)) return createTronSignerMaterial(address);
    if (chainId === INJECTIVE_CHAIN_ID) return createInjectiveSignerMaterial(address);
    if (isCosmosChain(chainId) && !SUI_TON_TRON_INJ.has(chainId)) return createCosmosSignerMaterial(chainId, address);
    if (isSolanaChain(chainId)) return createSolanaWalletAdapter(address);

    // Everything else is EVM - the executors read `.sendTransaction` /
    // `.signTypedData` straight off this client.
    return createEvmWalletClient(chainId, address);
}
