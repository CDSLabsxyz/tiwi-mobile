import { getSecurePrivateKey } from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';
import { getChainById } from './SignerUtils';

/**
 * LocalSignerEngine handles transaction signing and execution for wallets
 * where the private key is stored locally in SecureStore.
 */
export class LocalSignerEngine implements SignerEngine {
    private async getRawAccount(address: string) {
        const privateKey = await getSecurePrivateKey(address);
        if (!privateKey) throw new Error('Private key not found locally');
        return privateKeyToAccount(privateKey as `0x${string}`);
    }

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

    async signTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<string> {
        const account = options?.skipAuthorize
            ? await this.getRawAccount(address)
            : await this.createSecureAccount(address);
        const chain = getChainById(Number(tx.chainId) || 1);

        const isNative = !tx.data || tx.data === '0x' || tx.data === '';

        const walletClient = createWalletClient({
            account,
            chain,
            transport: http()
        });

        const signArgs: any = {
            to: tx.to as `0x${string}`,
            value: tx.value ? BigInt(tx.value) : 0n,
            chain: chain,
        };

        if (!isNative) {
            signArgs.data = tx.data as `0x${string}`;
        }

        return await walletClient.signTransaction(signArgs);
    }

    async sendTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        try {
            const account = options?.skipAuthorize
                ? await this.getRawAccount(address)
                : await this.createSecureAccount(address);
            const chain = getChainById(Number(tx.chainId) || 1);
            const isNative = !tx.data || tx.data === '0x' || tx.data === '';

            const walletClient = createWalletClient({
                account,
                chain,
                transport: http()
            });

            // Standardize txArgs to match viem's SendTransactionParameters
            const txArgs: any = {
                to: tx.to as `0x${string}`,
                value: tx.value ? BigInt(tx.value) : 0n,
                chain: chain, // Use full chain object to fix TS error
            };

            // Only add data if it's a real contract call (ERC20, Disperse, etc.)
            if (!isNative) {
                txArgs.data = tx.data as `0x${string}`;
            }

            // Standard Engineering Safety: Silent gas buffering for high reliability
            // We apply a 20% price premium and 30% limit buffer.
            try {
                const publicClient = await this.getPublicClient(Number(tx.chainId) || 1);

                // 1. Gas Price Buffer (20% above network base)
                const networkPrice = await publicClient.getGasPrice();
                txArgs.gasPrice = (networkPrice * 120n) / 100n;

                // 2. Gas Limit Buffer
                if (isNative) {
                    // Simple native transfers are always 21,000 gas. 
                    // We use 21,000 with a buffer to ensure it stays a 'Transfer' on explorers.
                    txArgs.gas = 21000n;
                } else {
                    const estimate = await publicClient.estimateGas({
                        account: walletClient.account!,
                        to: txArgs.to,
                        data: txArgs.data,
                        value: txArgs.value,
                    });
                    txArgs.gas = (estimate * 130n) / 100n;
                }
            } catch (estError) {
                console.warn("[SmartSigner] Estimation failed, allowing provider to handle gas defaults.");
            }

            const hash = await walletClient.sendTransaction(txArgs);

            return { hash, status: 'success'};
        } catch (error: any) {
            console.error('[LocalSignerEngine] Transaction failed', error);
            return {
                hash: '',
                status: 'failed',
                error: error.message || 'Unknown execution error'
            };
        }
    }

    async getPublicClient(chainId: number) {
        const chain = getChainById(chainId);
        return createPublicClient({
            chain,
            transport: http()
        });
    }

    async getWalletClient(chainId: number, address: string, options?: { skipAuthorize?: boolean }) {
        const account = options?.skipAuthorize
            ? await this.getRawAccount(address)
            : await this.createSecureAccount(address);

        const chain = getChainById(chainId);
        return createWalletClient({
            account,
            chain,
            transport: http()
        });
    }
}
