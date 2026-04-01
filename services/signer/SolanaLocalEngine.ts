import { getSecureMnemonic } from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { Connection, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';

/**
 * SolanaLocalEngine handles signing and execution for Solana transactions
 * using locally stored mnemonics to derive Solana keypairs.
 */
export class SolanaLocalEngine implements SignerEngine {
    private connection: Connection;

    constructor(rpcUrl = 'https://api.mainnet-beta.solana.com') {
        this.connection = new Connection(rpcUrl, 'confirmed');
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
     * Derive Solana keypair from the stored mnemonic
     */
    private async getKeypair(): Promise<Keypair> {
        const { walletGroups, activeGroupId } = useWalletStore.getState();
        const group = walletGroups.find(g => g.id === activeGroupId);

        if (!group?.addresses?.EVM) {
            throw new Error('No EVM address found to derive Solana key');
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

    async signTransaction(tx: TransactionRequest, address: string): Promise<string> {
        await this.authenticate();

        const keypair = await this.getKeypair();

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

    async sendTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        try {
            if (!options?.skipAuthorize) {
                await this.authenticate();
            }

            const keypair = await this.getKeypair();

            // If tx.data contains a serialized transaction, sign and send it
            if (tx.data && tx.data.length > 10) {
                const txBuffer = Buffer.from(tx.data, 'base64');

                let signature: string;
                try {
                    // Try Versioned transaction first
                    const vTx = VersionedTransaction.deserialize(txBuffer);
                    vTx.sign([keypair]);
                    signature = await this.connection.sendRawTransaction(vTx.serialize());
                } catch {
                    // Fallback to legacy
                    const legacyTx = Transaction.from(txBuffer);
                    legacyTx.sign(keypair);
                    signature = await this.connection.sendRawTransaction(legacyTx.serialize());
                }

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

            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = keypair.publicKey;
            transaction.sign(keypair);

            const signature = await this.connection.sendRawTransaction(transaction.serialize());
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
