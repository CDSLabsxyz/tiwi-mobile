import { getSecurePrivateKey } from '@/services/walletCreationService';
import { Connection, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';

export class SolanaLocalEngine implements SignerEngine {
    private connection: Connection;

    constructor(rpcUrl = 'https://api.mainnet-beta.solana.com') {
        this.connection = new Connection(rpcUrl, 'confirmed');
    }

    async signTransaction(tx: TransactionRequest, address: string): Promise<string> {
        const privateKeyB58 = await getSecurePrivateKey(address);
        if (!privateKeyB58) throw new Error('Local key not found');

        const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyB58));

        if (tx.data?.startsWith('0x')) {
            // Probably should be base64 for Solana transactions anyway
            throw new Error('Invalid transaction data format for Solana');
        }

        // Handle both Legacy and Versioned transactions
        try {
            const txBuffer = Buffer.from(tx.data || '', 'base64');
            const solanaTx = VersionedTransaction.deserialize(txBuffer);
            solanaTx.sign([keypair]);
            return Buffer.from(solanaTx.serialize()).toString('base64');
        } catch (e) {
            // Fallback for legacy
            const solanaTx = Transaction.from(Buffer.from(tx.data || '', 'base64'));
            solanaTx.sign(keypair);
            return solanaTx.serialize().toString('base64');
        }
    }

    async sendTransaction(tx: TransactionRequest, address: string): Promise<ExecutionResult> {
        try {
            const signedRaw = await this.signTransaction(tx, address);
            const signature = await this.connection.sendRawTransaction(Buffer.from(signedRaw, 'base64'));

            return {
                hash: signature,
                status: 'success'
            };
        } catch (error: any) {
            console.error('[SolanaLocalEngine] Execution failed', error);
            return {
                hash: '',
                status: 'failed',
                error: error.message || 'Solana transaction failed'
            };
        }
    }
}
