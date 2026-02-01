import { getSecurePrivateKey } from '@/services/walletCreationService';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';
import { getChainById } from './SignerUtils';

export class LocalSignerEngine implements SignerEngine {

    async signTransaction(tx: TransactionRequest, address: string): Promise<string> {
        const privateKey = await getSecurePrivateKey(address);
        if (!privateKey) throw new Error('Private key not found locally');

        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const chain = getChainById(tx.chainId || 1);

        const walletClient = createWalletClient({
            account,
            chain,
            transport: http()
        });

        // Sign the transaction without sending
        return await walletClient.signTransaction({
            to: tx.to as `0x${string}`,
            value: tx.value ? BigInt(tx.value) : undefined,
            data: tx.data as `0x${string}`,
            chainId: tx.chainId
        } as any);
    }

    async sendTransaction(tx: TransactionRequest, address: string): Promise<ExecutionResult> {
        try {
            const privateKey = await getSecurePrivateKey(address);
            if (!privateKey) throw new Error('Private key not found locally');

            const account = privateKeyToAccount(privateKey as `0x${string}`);
            const chain = getChainById(tx.chainId || 1);

            // 1. Setup Client
            const walletClient = createWalletClient({
                account,
                chain,
                transport: http()
            });

            // 2. Execute
            const hash = await walletClient.sendTransaction({
                to: tx.to as `0x${string}`,
                value: tx.value ? BigInt(tx.value) : undefined,
                data: (tx.data && tx.data.startsWith('0x')) ? (tx.data as `0x${string}`) : undefined,
                chainId: tx.chainId,
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
}
