/**
 * Wallet Helper Utilities — React Native port.
 *
 * Same exported surface as the web original (lib/frontend/services/swap-executor/
 * utils/wallet-helpers.ts) so every copied executor compiles and behaves the
 * same. What changes is where the signing capability comes from: instead of an
 * injected browser provider + chain-switch dance, everything resolves to the
 * key held on device (see platform/signer-material.ts).
 *
 * `ensureCorrectChain` is a deliberate no-op: a local key signs for whatever
 * chainId we put in the transaction, so there is no "wrong network" state to
 * recover from — the chain comes from `getChainForId(chainId)`.
 */

import { type PublicClient, type WalletClient } from 'viem';
import { Connection } from '@solana/web3.js';
import { isEVMChain } from './chain-helpers';
import { SwapErrorCode, SwapExecutionError } from '../types';
import { getCachedPublicClient } from '@/services/swap/core/platform/viem-clients';
import { getRpcUrls } from '@/services/swap/core/config/rpc-config';
import {
    createEvmWalletClient,
    createSolanaWalletAdapter,
    createTonSignerMaterial,
    createTronSignerMaterial,
} from '@/services/swap/core/platform/signer-material';

/**
 * EVM wallet client for a chain.
 *
 * No chain switching: `createEvmWalletClient` resolves the viem Chain from the
 * canonical registry, so a swap on e.g. HyperEVM (999) signs with chainId 999
 * even though the app has no notion of a "currently selected network".
 */
export async function getEVMWalletClient(chainId: number): Promise<WalletClient> {
    if (!isEVMChain(chainId)) {
        throw new SwapExecutionError(
            `Chain ${chainId} is not an EVM chain`,
            SwapErrorCode.UNSUPPORTED_ROUTER,
        );
    }

    try {
        return await createEvmWalletClient(chainId);
    } catch (error: any) {
        if (error instanceof SwapExecutionError) throw error;
        throw new SwapExecutionError(
            `Failed to unlock the wallet for chain ${chainId}: ${error?.message || 'Unknown error'}`,
            SwapErrorCode.WALLET_NOT_CONNECTED,
        );
    }
}

/** EVM read client for a chain (cached, multi-endpoint fallback). */
export function getEVMPublicClient(chainId: number): PublicClient {
    if (!isEVMChain(chainId)) {
        throw new SwapExecutionError(
            `Chain ${chainId} is not an EVM chain`,
            SwapErrorCode.UNSUPPORTED_ROUTER,
        );
    }

    try {
        return getCachedPublicClient(chainId);
    } catch (error: any) {
        throw new SwapExecutionError(
            `Failed to get public client for chain ${chainId}: ${error?.message || 'Unknown error'}`,
            SwapErrorCode.NETWORK_ERROR,
        );
    }
}

/** Solana connection, probing each configured endpoint until one answers. */
let cachedSolanaConnection: Connection | null = null;

export async function getSolanaConnection(): Promise<Connection> {
    if (cachedSolanaConnection) return cachedSolanaConnection;

    const endpoints = [
        ...(process.env.EXPO_PUBLIC_SOLANA_RPC_URL || '')
            .split(',')
            .map((u) => u.trim())
            .filter(Boolean),
        ...(getRpcUrls(7565164) ?? []),
        'https://api.mainnet-beta.solana.com',
    ].filter((url, i, arr) => arr.indexOf(url) === i);

    let lastError: unknown;

    for (const rpcUrl of endpoints) {
        try {
            const connection = new Connection(rpcUrl, 'confirmed');
            // Liveness probe — a rate-limited provider should fall through
            // rather than fail the whole swap on the first real call.
            await connection.getVersion();
            cachedSolanaConnection = connection;
            return connection;
        } catch (error) {
            lastError = error;
        }
    }

    throw new SwapExecutionError(
        `Failed to connect to Solana RPC: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`,
        SwapErrorCode.NETWORK_ERROR,
    );
}

/** Solana signer in wallet-adapter shape (publicKey / signTransaction). */
export async function getSolanaWallet(): Promise<any> {
    return createSolanaWalletAdapter();
}

/**
 * TON signer. The web returns a TonConnect UI here for external wallets; on
 * mobile the executor's INTERNAL path is taken instead (it receives
 * `{ tonKeypair, tonAddress }` via params.walletClient), so this is only hit if
 * that material is missing — surface the real reason rather than "not found".
 */
export async function getTONWallet(): Promise<any> {
    const material = await createTonSignerMaterial();
    throw new SwapExecutionError(
        `No external TON wallet on mobile. The in-app TON key (${material.tonAddress}) should have been passed to the executor.`,
        SwapErrorCode.WALLET_NOT_CONNECTED,
    );
}

/** TronWeb instance signed by the device key. */
export async function getTRONWallet(): Promise<any> {
    const { tronWeb } = await createTronSignerMaterial();
    return tronWeb;
}

/**
 * Cosmos wallet. There is no Keplr/Leap on mobile — Cosmos routes go through
 * the internal `{ cosmosSigner, cosmosAddress }` path in skip-executor, so
 * reaching here means that material wasn't supplied.
 */
export async function getCosmosWallet(): Promise<any> {
    throw new SwapExecutionError(
        'No external Cosmos wallet on mobile. This route needs the in-app Cosmos signer.',
        SwapErrorCode.WALLET_NOT_CONNECTED,
    );
}

/**
 * No-op on mobile. A locally-held key signs for any chainId we ask it to, so
 * there is no wallet network to switch. Kept so copied executors compile.
 */
export async function ensureCorrectChain(_chainId: number): Promise<void> {
    return;
}
