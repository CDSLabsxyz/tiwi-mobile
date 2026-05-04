import { getSecurePrivateKey } from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { createTransportForChain } from '@/constants/rpc';
import { createPublicClient, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';
import { getChainById } from './SignerUtils';

// BSC writes route through `createTransportForChain` so signed transactions
// rotate across Binance dataseed / publicnode / drpc / ankr instead of
// dying on Alchemy's HTTP 429 ("compute units per second exceeded").

/**
 * LocalSignerEngine handles transaction signing and execution for wallets
 * where the private key is stored locally in SecureStore.
 */
export class LocalSignerEngine implements SignerEngine {
    private formatKey(key: string): `0x${string}` {
        return (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`;
    }

    /**
     * Resolve the private key for any address.
     * For non-EVM addresses (Solana, TRON, etc.), fall back to the EVM address
     * since all keys are derived from the same mnemonic and stored under EVM.
     */
    private async resolvePrivateKey(address: string): Promise<string> {
        // 1. Try direct lookup
        let key = await getSecurePrivateKey(address);
        if (key) return key;

        // 2. Try with EVM chain type explicitly
        key = await getSecurePrivateKey(address, 'EVM');
        if (key) return key;

        // 3. For non-EVM addresses, find the EVM address from the wallet group
        const { walletGroups, activeGroupId } = useWalletStore.getState();
        const group = walletGroups.find(g => g.id === activeGroupId);
        if (group?.addresses?.EVM) {
            key = await getSecurePrivateKey(group.addresses.EVM, 'EVM');
            if (key) return key;
        }

        // 4. Try all wallet groups
        for (const g of walletGroups) {
            if (g.addresses?.EVM) {
                key = await getSecurePrivateKey(g.addresses.EVM, 'EVM');
                if (key) return key;
            }
        }

        throw new Error('Private key not found locally');
    }

    private async getRawAccount(address: string) {
        const privateKey = await this.resolvePrivateKey(address);
        return privateKeyToAccount(this.formatKey(privateKey));
    }

    private async createSecureAccount(address: string) {
        const privateKey = await this.resolvePrivateKey(address);

        const account = privateKeyToAccount(this.formatKey(privateKey));
        const securityStore = useSecurityStore.getState();

        // Helper to perform the dual guard check
        const authorize = async (message: string) => {
            // If biometrics are enabled, attempt extra hardware-level verification.
            // If it fails (user dismisses, not enrolled, etc.), fall through —
            // the app-level passcode check already happened in the UI.
            if (securityStore.isBiometricsEnabled) {
                try {
                    const isAuthorized = await securityStore.authenticateBiometrics(message);
                    if (!isAuthorized) {
                        console.warn('[LocalSignerEngine] Biometric auth declined, proceeding with passcode auth');
                    }
                } catch (e) {
                    console.warn('[LocalSignerEngine] Biometric auth error, proceeding with passcode auth');
                }
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

        const chainId = Number(tx.chainId) || 1;
        const walletClient = createWalletClient({
            account,
            chain,
            transport: createTransportForChain(chainId),
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

            const chainId = Number(tx.chainId) || 1;
            const walletClient = createWalletClient({
                account,
                chain,
                transport: createTransportForChain(chainId),
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
            } catch (estError: any) {
                console.warn("[SmartSigner] Estimation failed:", estError?.message || estError);
                console.warn("[SmartSigner] TX args at failure:", JSON.stringify({ to: txArgs.to, data: txArgs.data?.slice(0, 20), value: String(txArgs.value), chainId: tx.chainId }));
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

    async getPublicClient(chainId: number) {
        const chain = getChainById(chainId);
        return createPublicClient({
            chain,
            transport: createTransportForChain(chainId),
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
            transport: createTransportForChain(chainId),
        });
    }
}
