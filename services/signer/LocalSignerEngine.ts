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

    private async createSecureAccount(address: string) {
        const privateKey = await getSecurePrivateKey(address);
        if (!privateKey) throw new Error('Private key not found locally');

        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const securityStore = useSecurityStore.getState();

        // Helper to perform the dual guard check
        const authorize = async (message: string) => {
            // If biometrics are enabled, we perform the extra hardware-level verification.
            // If not, we assume the app-level passcode check (which happens in the UI component
            // before calling the signer) is sufficient.
            if (securityStore.isBiometricsEnabled) {
                const isAuthorized = await securityStore.authenticateBiometrics(message);
                if (!isAuthorized) throw new Error('User authentication failed');
            }
            return true;
        };

        // Wrap the account to intercept signing/sending calls
        const secureAccount = {
            ...account,
            signTransaction: async (tx: any) => {
                await authorize('Confirm Transaction');
                return account.signTransaction(tx);
            },
            sendTransaction: async (tx: any) => {
                await authorize('Confirm Transaction');
                return account.sendTransaction(tx);
            },
            signTypedData: async (data: any) => {
                await authorize('Confirm Sign Message');
                return account.signTypedData(data);
            },
            signMessage: async (msg: any) => {
                await authorize('Confirm Sign Message');
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

            const txArgs: any = {
                to: tx.to as `0x${string}`,
                value: tx.value ? BigInt(tx.value) : undefined,
                chainId: Number(tx.chainId)
            };

            if (tx.data && tx.data.startsWith('0x')) {
                txArgs.data = tx.data as `0x${string}`;
            }

            const hash = await walletClient.sendTransaction(txArgs);
            
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
