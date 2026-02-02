import { getSecurePrivateKey } from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { Connection, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';

/**
 * SolanaLocalEngine handles signing and execution for Solana transactions
 * using locally stored private keys.
 */
export class SolanaLocalEngine implements SignerEngine {
    private connection: Connection;

    constructor(rpcUrl = 'https://api.mainnet-beta.solana.com') {
        this.connection = new Connection(rpcUrl, 'confirmed');
    }

    private async authenticate() {
        const securityStore = useSecurityStore.getState();
        const isAuthorized = await securityStore.authenticateBiometrics('Confirm Transaction');
        if (!isAuthorized) throw new Error('User authentication failed');
    }

    async signTransaction(tx: TransactionRequest, address: string): Promise<string> {
        // Enforce Biometrics
        await this.authenticate();

        const privateKeyB58 = await getSecurePrivateKey(address);
        if (!privateKeyB58) throw new Error('Local key not found');

        const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyB58));

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
