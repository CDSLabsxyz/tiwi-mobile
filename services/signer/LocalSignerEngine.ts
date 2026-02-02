import { getSecurePrivateKey } from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';
import { getChainById } from './SignerUtils';

/**
 * LocalSignerEngine handles transaction signing and execution for wallets
 * where the private key is stored locally in SecureStore.
 */
export class LocalSignerEngine implements SignerEngine {

    /**
     * Helper to create a secure account wrapper that enforces biometrics
     * before every single signature.
     */
    private async createSecureAccount(address: string) {
        const privateKey = await getSecurePrivateKey(address);
        if (!privateKey) throw new Error('Private key not found locally');

        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const securityStore = useSecurityStore.getState();

        // Wrap the account to intercept signing/sending calls
        const secureAccount = {
            ...account,
            signTransaction: async (tx: any) => {
                const isAuthorized = await securityStore.authenticateBiometrics('Confirm Transaction');
                if (!isAuthorized) throw new Error('User authentication failed');
                return account.signTransaction(tx);
            },
            sendTransaction: async (tx: any) => {
                console.log("🚀 ~ LocalSignerEngine ~ createSecureAccount ~ tx:", tx)
                const isAuthorized = await securityStore.authenticateBiometrics('Confirm Transaction');
                if (!isAuthorized) throw new Error('User authentication failed');
                return account.sendTransaction(tx);
            },
            signTypedData: async (data: any) => {
                const isAuthorized = await securityStore.authenticateBiometrics('Confirm Sign Message');
                if (!isAuthorized) throw new Error('User authentication failed');
                return account.signTypedData(data);
            },
            signMessage: async (msg: any) => {
                const isAuthorized = await securityStore.authenticateBiometrics('Confirm Sign Message');
                if (!isAuthorized) throw new Error('User authentication failed');
                return account.signMessage(msg);
            }
        };

        return secureAccount as typeof account;
    }

    async signTransaction(tx: TransactionRequest, address: string): Promise<string> {
        const account = await this.createSecureAccount(address);
        const chain = getChainById(Number(tx.chainId) || 1);

        const walletClient = createWalletClient({
            account,
            chain,
            transport: http()
        });

        return await walletClient.signTransaction({
            to: tx.to as `0x${string}`,
            value: tx.value ? BigInt(tx.value) : undefined,
            data: tx.data as `0x${string}`,
            chainId: Number(tx.chainId)
        } as any);
    }

    async sendTransaction(tx: TransactionRequest, address: string): Promise<ExecutionResult> {
        try {
            const account = await this.createSecureAccount(address);
            const chain = getChainById(Number(tx.chainId) || 1);

            const walletClient = createWalletClient({
                account,
                chain,
                transport: http()
            });

            console.log(`[LocalSignerEngine] Executing transaction on chain ${tx.chainId}`);

            const hash = await walletClient.sendTransaction({
                to: tx.to as `0x${string}`,
                value: tx.value ? BigInt(tx.value) : undefined,
                data: (tx.data && tx.data.startsWith('0x')) ? (tx.data as `0x${string}`) : undefined,
                chainId: Number(tx.chainId)
            } as any);

            return { hash, status: 'success' };
        } catch (error: any) {
            console.error('[LocalSignerEngine] Transaction failed', error);
            return {
                hash: '',
                status: 'failed',
                error: error.message || 'Unknown execution error'
            };
        }
    }

    /**
     * Exposes a WalletClient for use by external SDKs (like LI.FI).
     * The account inside this client is wrapped with biometric security.
     */
    async getWalletClient(chainId: number, address: string) {
        const account = await this.createSecureAccount(address);
        const chain = getChainById(Number(chainId) || 1);

        return createWalletClient({
            account,
            chain,
            transport: http()
        });
    }
}
