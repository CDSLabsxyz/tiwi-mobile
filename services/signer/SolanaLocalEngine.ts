import { getSecureMnemonic, getSecurePrivateKey } from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { Connection, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';

// bs58 v6 ships as a CJS/ESM hybrid; Metro can hand us namespace, default,
// or hoisted shapes depending on bundler config. Mirror walletCreationService.
function bs58Decode(value: string): Uint8Array {
    const mod: any = bs58 as any;
    const decode =
        (typeof mod.decode === 'function' && mod.decode) ||
        (mod.default && typeof mod.default.decode === 'function' && mod.default.decode) ||
        (mod.default && mod.default.default && typeof mod.default.default.decode === 'function' && mod.default.default.decode);
    if (!decode) throw new Error('bs58 decode unavailable');
    return decode(value);
}

/**
 * SolanaLocalEngine handles signing and execution for Solana transactions
 * using locally stored mnemonics to derive Solana keypairs.
 */
export class SolanaLocalEngine implements SignerEngine {
    private connection: Connection;

    constructor(rpcUrl = 'https://api.mainnet-beta.solana.com') {
        this.connection = new Connection(rpcUrl, 'confirmed');
    }

    /**
     * The app's shared, probed Solana endpoint — the same one callers build
     * transactions against. Broadcasting on this engine's own hardcoded
     * `api.mainnet-beta.solana.com` while the caller fetched its blockhash from
     * the configured (Helius) endpoint meant preflight ran on a node that had
     * never seen that blockhash, which surfaces as a bare "Transaction
     * simulation failed" with no logs. Falls back to the constructor endpoint.
     */
    private async getConnection(): Promise<Connection> {
        try {
            const { getSolanaConnection } = await import('@/services/swap/core/utils/wallet-helpers');
            return await getSolanaConnection();
        } catch {
            return this.connection;
        }
    }

    private async authenticate() {
        const securityStore = useSecurityStore.getState();
        if (securityStore.isBiometricsEnabled) {
            try {
                const isAuthorized = await securityStore.authenticateBiometrics('Confirm Solana Transaction');
                if (!isAuthorized) {
                    console.warn('[SolanaLocalEngine] Biometric declined, proceeding with passcode auth');
                }
            } catch {
                console.warn('[SolanaLocalEngine] Biometric error, proceeding with passcode auth');
            }
        }
    }

    /**
     * Resolve a Solana keypair for `solAddress`. Three import paths exist and
     * each writes a different secret to SecureStore — try them in this order:
     *
     *   1. Direct SOL private-key import (e.g. user pasted a Phantom secret).
     *      Stored at `tiwi_wallet_priv_SOLANA_<addr>` as a base58 string,
     *      either a 32-byte seed or a 64-byte secret-key. NO mnemonic exists,
     *      and the wallet group has no EVM address — the previous EVM-only
     *      lookup threw "No EVM address found to derive Solana key" here.
     *
     *   2. Mnemonic-derived multi-chain wallet. The mnemonic is keyed by the
     *      group's EVM address; derive at m/44'/501'/0'/0' to match
     *      walletCreationService.deriveMultiChainAddressesFromMnemonic.
     *
     *   3. (Fallback) Active group by id, only used when no address is passed.
     */
    private async getKeypair(solAddress?: string): Promise<Keypair> {
        const { walletGroups, activeGroupId } = useWalletStore.getState();
        const lowered = solAddress?.toLowerCase();
        const group = (lowered
            ? walletGroups.find(g =>
                Object.values(g.addresses).some(a => a?.toLowerCase() === lowered))
            : undefined)
            ?? walletGroups.find(g => g.id === activeGroupId);

        // Path 1: imported SOL private key. Use the actual SOL address — the
        // wallet group may not even carry an EVM key for SOL-only imports.
        const senderAddr = solAddress ?? group?.addresses?.SOLANA;
        if (senderAddr) {
            try {
                const stored = await getSecurePrivateKey(senderAddr, 'SOLANA');
                if (stored) {
                    const decoded = bs58Decode(stored.trim());
                    return decoded.length === 32
                        ? Keypair.fromSeed(decoded)
                        : Keypair.fromSecretKey(decoded);
                }
            } catch (e) {
                console.warn('[SolanaLocalEngine] Stored SOL key load failed, falling back to mnemonic', e);
            }
        }

        // Path 2: mnemonic-derived. Needs the group's EVM address as the
        // SecureStore key — this is the standard path for in-app multichain
        // wallets created via "Generate Phrase".
        if (!group?.addresses?.EVM) {
            throw new Error('No private key or mnemonic found for this Solana wallet');
        }

        const mnemonic = await getSecureMnemonic(group.addresses.EVM);
        if (!mnemonic) {
            throw new Error('Mnemonic not found for Solana key derivation');
        }

        // Lazy require to avoid startup crash
        const { mnemonicToSeedSync } = require('@scure/bip39');
        const { derivePath } = require('ed25519-hd-key');

        const seed = mnemonicToSeedSync(mnemonic);
        const path = "m/44'/501'/0'/0'";
        const derived = derivePath(path, Buffer.from(seed).toString('hex'));

        return Keypair.fromSeed(derived.key);
    }

    /**
     * Public accessor for the derived keypair.
     *
     * The swap engine's Solana executors (Jupiter, Rubic) expect a wallet
     * *adapter* — `{ publicKey, signTransaction }` — rather than a fire-and-
     * forget send, because they build and partially sign multi-instruction
     * transactions (tax transfer + swap) before broadcasting. Reuses the exact
     * same three-path key resolution as `sendTransaction`.
     */
    async getKeypairForAddress(solAddress?: string): Promise<Keypair> {
        return this.getKeypair(solAddress);
    }

    async signTransaction(tx: TransactionRequest, address: string): Promise<string> {
        await this.authenticate();

        const keypair = await this.getKeypair(address);

        // Handle both Legacy and Versioned transactions
        try {
            const txBuffer = Buffer.from(tx.data || '', 'base64');
            const solanaTx = VersionedTransaction.deserialize(txBuffer);
            solanaTx.sign([keypair]);
            return Buffer.from(solanaTx.serialize()).toString('base64');
        } catch {
            // Fallback for legacy
            const solanaTx = Transaction.from(Buffer.from(tx.data || '', 'base64'));
            solanaTx.sign(keypair);
            return solanaTx.serialize().toString('base64');
        }
    }

    /**
     * Broadcast, translating web3.js's `SendTransactionError` into something a
     * user can act on. Its default message is just "Transaction simulation
     * failed" with an empty log array whenever preflight fails *before* any
     * program runs — an unfunded fee payer, an unknown blockhash — so pull the
     * real reason out of `getLogs()` / the error cause instead of showing that.
     */
    private async sendRaw(connection: Connection, raw: Uint8Array): Promise<string> {
        try {
            return await connection.sendRawTransaction(raw);
        } catch (error: any) {
            let detail = '';
            try {
                const logs = await error?.getLogs?.(connection);
                if (Array.isArray(logs) && logs.length) detail = logs[logs.length - 1];
            } catch {
                /* log fetch is best-effort */
            }
            const reason = String(error?.transactionError?.message || error?.message || '');
            if (!detail && /debit an account|insufficient lamports|insufficient funds/i.test(reason)) {
                detail = 'The wallet has no SOL to pay the network fee.';
            } else if (!detail && /blockhash not found/i.test(reason)) {
                detail = 'The transaction expired before it reached the network. Try again.';
            }
            throw new Error(detail ? `${reason || 'Transaction failed'} — ${detail}` : (reason || 'Transaction failed'));
        }
    }

    async sendTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        try {
            if (!options?.skipAuthorize) {
                await this.authenticate();
            }

            const keypair = await this.getKeypair(address);
            const connection = await this.getConnection();

            // If tx.data contains a serialized transaction, sign and send it
            if (tx.data && tx.data.length > 10) {
                const txBuffer = Buffer.from(tx.data, 'base64');

                // Parse first, THEN send. Wrapping the send in the same try as the
                // versioned parse meant a failed broadcast fell through to the
                // legacy branch and broadcast a second time — a double-send risk,
                // and the second failure masked the first one's reason.
                let raw: Uint8Array;
                try {
                    const vTx = VersionedTransaction.deserialize(txBuffer);
                    vTx.sign([keypair]);
                    raw = vTx.serialize();
                } catch {
                    const legacyTx = Transaction.from(txBuffer);
                    legacyTx.sign(keypair);
                    raw = legacyTx.serialize();
                }

                const signature = await this.sendRaw(connection, raw);
                return { hash: signature, status: 'success' };
            }

            // Simple SOL transfer
            const { Transaction: SolTransaction, SystemProgram, PublicKey } = require('@solana/web3.js');
            const transaction = new SolTransaction().add(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey,
                    toPubkey: new PublicKey(tx.to),
                    lamports: BigInt(tx.value || '0'),
                })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = keypair.publicKey;
            transaction.sign(keypair);

            const signature = await this.sendRaw(connection, transaction.serialize());
            return { hash: signature, status: 'success' };
        } catch (error: any) {
            console.warn('[SolanaLocalEngine] Execution failed:', error.message);
            return {
                hash: '',
                status: 'failed',
                error: error.message || 'Solana transaction failed'
            };
        }
    }
}
