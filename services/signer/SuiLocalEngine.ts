import { getSecureMnemonic } from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';

/**
 * SuiLocalEngine - signs & broadcasts Sui transactions for in-app (mnemonic)
 * wallets. The keypair is re-derived from the group's stored mnemonic on demand
 * (ed25519, m/44'/784'/0'/0'/0'), matching deriveSuiAddress - no separate Sui
 * private key is persisted (mirrors SolanaLocalEngine).
 *
 * This tranche handles the NATIVE SUI transfer built from `tx.to` + `tx.value`
 * (value in MIST). Non-native Sui coins / server-built PTBs are a later step.
 */
export class SuiLocalEngine implements SignerEngine {
    private async authenticate() {
        const securityStore = useSecurityStore.getState();
        if (securityStore.isBiometricsEnabled) {
            try {
                await securityStore.authenticateBiometrics('Confirm Sui Transaction');
            } catch {
                console.warn('[SuiLocalEngine] Biometric error, proceeding with passcode auth');
            }
        }
    }

    private async getKeypair(suiAddress?: string) {
        const { walletGroups, activeGroupId } = useWalletStore.getState();
        const lowered = suiAddress?.toLowerCase();
        const group = (lowered
            ? walletGroups.find(g => Object.values(g.addresses).some(a => a?.toLowerCase() === lowered))
            : undefined) ?? walletGroups.find(g => g.id === activeGroupId);

        if (!group?.addresses?.EVM) {
            throw new Error('No mnemonic found for this Sui wallet');
        }
        const mnemonic = await getSecureMnemonic(group.addresses.EVM);
        if (!mnemonic) throw new Error('Mnemonic not found for Sui key derivation');

        const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
        return Ed25519Keypair.deriveKeypair(mnemonic.trim());
    }

    async signTransaction(): Promise<string> {
        throw new Error('Sui signTransaction is not supported; use sendTransaction');
    }

    async sendTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        try {
            if (!options?.skipAuthorize) await this.authenticate();

            const keypair = await this.getKeypair(address);
            const { SuiClient, getFullnodeUrl } = await import('@mysten/sui/client');
            const { Transaction } = await import('@mysten/sui/transactions');
            const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

            // Native SUI transfer: split from the gas coin and transfer to recipient.
            const txb = new Transaction();
            const [coin] = txb.splitCoins(txb.gas, [BigInt(tx.value || '0')]);
            txb.transferObjects([coin], txb.pure.address(tx.to));

            const res = await client.signAndExecuteTransaction({ signer: keypair, transaction: txb });
            if (!res?.digest) throw new Error('Sui transaction returned no digest');
            return { hash: res.digest, status: 'success' };
        } catch (error: any) {
            console.warn('[SuiLocalEngine] Execution failed:', error?.message);
            return { hash: '', status: 'failed', error: error?.message || 'Sui transaction failed' };
        }
    }
}
