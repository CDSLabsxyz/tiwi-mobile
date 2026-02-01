import { getSecurePrivateKey } from '@/services/walletCreationService';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';
import { getChainById } from './SignerUtils';

export class LocalSignerEngine implements SignerEngine {

    async signTransaction(tx: TransactionRequest, address: string): Promise<string> {
        const privateKey = await getSecurePrivateKey(address);
        console.log("🚀 ~ LocalSignerEngine ~ signTransaction ~ privateKey:", privateKey)
        if (!privateKey) throw new Error('Private key not found locally');

        const account = privateKeyToAccount(privateKey as `0x${string}`);
        console.log("🚀 ~ LocalSignerEngine ~ signTransaction ~ account:", account)
        const chain = getChainById(tx.chainId || 1);

        const walletClient = createWalletClient({
            account,
            chain,
            transport: http()
        });
        console.log("🚀 ~ LocalSignerEngine ~ signTransaction ~ walletClient:", walletClient)

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
            console.log("🚀 ~ LocalSignerEngine ~ sendTransaction ~ privateKey:", privateKey)
            if (!privateKey) throw new Error('Private key not found locally');

            const account = privateKeyToAccount(privateKey as `0x${string}`);
            console.log("🚀 ~ LocalSignerEngine ~ sendTransaction ~ account:", account)
            const chain = getChainById(tx.chainId || 1);
            console.log("🚀 ~ LocalSignerEngine ~ sendTransaction ~ chain:", chain)

            // 1. Setup Client
            const walletClient = createWalletClient({
                account,
                chain,
                transport: http()
            });
            console.log("🚀 ~ LocalSignerEngine ~ sendTransaction ~ walletClient:", walletClient)
            console.log("am I growing or behind time", {tx})

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
