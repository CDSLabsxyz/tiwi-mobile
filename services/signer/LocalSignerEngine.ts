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

    async sendTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        try {
            const account = options?.skipAuthorize
                ? await this.getRawAccount(address)
                : await this.createSecureAccount(address);
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

            // --- GAS ESTIMATION WITH BUFFER ---
            try {
                const publicClient = createPublicClient({ chain, transport: http() });
                let estimate = await publicClient.estimateGas({
                    account,
                    to: txArgs.to,
                    data: txArgs.data,
                    value: txArgs.value,
                });

                const isBsc = chain.id === 56;
                const bufferPercent = isBsc ? 140n : 120n; // 40% for BSC, 20% others
                txArgs.gas = (estimate * bufferPercent) / 100n;

                // On BSC, swaps often fail if gas limit is too tight. Ensure a floor for data txs.
                if (isBsc && txArgs.data && txArgs.data !== '0x' && txArgs.gas < 250000n) {
                    txArgs.gas = 250000n;
                }

                // Force legacy gas price for BSC to avoid EIP-1559 simulation issues
                if (isBsc) {
                    const gasPrice = await publicClient.getGasPrice();
                    txArgs.gasPrice = (gasPrice * 110n) / 100n; // 10% premium on gas price too
                }

                console.log(`[LocalSignerEngine] Chain: ${chain.id}, Estimated: ${estimate.toString()} -> Final: ${txArgs.gas.toString()}`);
            } catch (estError: any) {
                console.warn('[LocalSignerEngine] Gas estimation failed, allowing default:', estError.message);
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
     * The account inside this client is wrapped with biometric security by default.
     */
    async getWalletClient(chainId: number, address: string, options?: { skipAuthorize?: boolean }) {
        const account = options?.skipAuthorize
            ? await this.getRawAccount(address)
            : await this.createSecureAccount(address);

        const chain = getChainById(Number(chainId) || 1);

        const walletClient = createWalletClient({
            account,
            chain,
            transport: http()
        });

        // Wrap the walletClient to add an AGGRESSIVE gas buffer strategy 
        const baseSend = walletClient.sendTransaction.bind(walletClient);
        const wrappedSend: any = async (args: any) => {
            console.log(`[SignerEngine] Intercepted sendTransaction on chain ${chain.id}`);
            const isBsc = chain.id === 56;
            const isPoly = chain.id === 137;

            // 1. If gas is ALREADY provided, we still buffer it
            if (args.gas) {
                const buffer = isBsc ? 200n : 130n; 
                args.gas = (BigInt(args.gas) * buffer) / 100n;
                console.log(`[SignerEngine] Buffering PROVIDED gas: ${args.gas.toString()}`);
            }

            // 2. If gas is NOT provided, perform our custom estimation
            if (!args.gas) {
                try {
                    const pc = createPublicClient({ chain, transport: http() });
                    const estimate = await pc.estimateGas({
                        account: args.account || account,
                        to: args.to,
                        data: args.data,
                        value: args.value,
                    });
                    
                    const bufferPercent = isBsc ? 250n : 150n; // 2.5x for BSC, 1.5x others
                    args.gas = (estimate * bufferPercent) / 100n;
                } catch (e: any) {
                    console.warn('[SignerEngine] Estimation failed, using extreme fallback:', e.message);
                    args.gas = isBsc ? 1000000n : 500000n; // 1M for BSC fallback
                }
            }

            // 3. Enforce Strong Floors for BSC/Poly Swap/Contract calls
            if ((isBsc || isPoly) && args.data && args.data !== '0x') {
                const floor = isBsc ? 600000n : 400000n; // 600k floor for BSC
                if (BigInt(args.gas) < floor) {
                    args.gas = floor;
                }
            }

            // 4. Force High Priority Gas Price with 70% premium
            if (isBsc || isPoly) {
                try {
                    const pc = createPublicClient({ chain, transport: http() });
                    const gp = await pc.getGasPrice();
                    args.gasPrice = (gp * 170n) / 100n; // 70% premium
                    console.log(`[SignerEngine] Priority GasPrice: ${args.gasPrice.toString()}`);
                    
                    // Clear EIP-1559 fields to ensure legacy usage
                    delete args.maxFeePerGas;
                    delete args.maxPriorityFeePerGas;
                } catch (e) {
                    console.warn('[SignerEngine] Failed to set priority gas price');
                }
            }

            console.log(`[SignerEngine] FINAL TX: To=${args.to}, Value=${args.value || 0}, Gas=${args.gas}`);
            return baseSend(args);
        };

        walletClient.sendTransaction = wrappedSend;

        // Also wrap writeContract just in case SDK uses it directly
        if ((walletClient as any).writeContract) {
            const baseWrite = (walletClient as any).writeContract.bind(walletClient);
            (walletClient as any).writeContract = async (args: any) => {
                console.log(`[SignerEngine] Intercepted writeContract`);
                return baseWrite(args);
            };
        }

        return walletClient;
    }
}
