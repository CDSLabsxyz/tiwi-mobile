import { getSecureMnemonic } from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';

/**
 * AptosLocalEngine - signs & broadcasts Aptos transactions for in-app (mnemonic)
 * wallets. The account is re-derived from the group's stored mnemonic on demand
 * (ed25519, m/44'/637'/0'/0'/0'), matching deriveAptosAddress.
 *
 * This tranche handles the NATIVE APT transfer built from `tx.to` + `tx.value`
 * (value in octas) via `0x1::aptos_account::transfer`. Fungible-asset transfers
 * are a later step.
 */
export class AptosLocalEngine implements SignerEngine {
    private async authenticate() {
        const securityStore = useSecurityStore.getState();
        if (securityStore.isBiometricsEnabled) {
            try {
                await securityStore.authenticateBiometrics('Confirm Aptos Transaction');
            } catch {
                console.warn('[AptosLocalEngine] Biometric error, proceeding with passcode auth');
            }
        }
    }

    private async getAccount(aptosAddress?: string) {
        const { walletGroups, activeGroupId } = useWalletStore.getState();
        const lowered = aptosAddress?.toLowerCase();
        const group = (lowered
            ? walletGroups.find(g => Object.values(g.addresses).some(a => a?.toLowerCase() === lowered))
            : undefined) ?? walletGroups.find(g => g.id === activeGroupId);

        if (!group?.addresses?.EVM) {
            throw new Error('No mnemonic found for this Aptos wallet');
        }
        const mnemonic = await getSecureMnemonic(group.addresses.EVM);
        if (!mnemonic) throw new Error('Mnemonic not found for Aptos key derivation');

        const { Account } = await import('@aptos-labs/ts-sdk');
        return Account.fromDerivationPath({ path: "m/44'/637'/0'/0'/0'", mnemonic: mnemonic.trim() });
    }

    async signTransaction(): Promise<string> {
        throw new Error('Aptos signTransaction is not supported; use sendTransaction');
    }

    async sendTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        try {
            if (!options?.skipAuthorize) await this.authenticate();

            const account = await this.getAccount(address);
            const { Aptos, AptosConfig, Network } = await import('@aptos-labs/ts-sdk');
            const aptos = new Aptos(new AptosConfig({ network: Network.MAINNET }));

            const txn = await aptos.transaction.build.simple({
                sender: account.accountAddress,
                data: {
                    function: '0x1::aptos_account::transfer',
                    functionArguments: [tx.to, BigInt(tx.value || '0')],
                },
            });
            const committed = await aptos.signAndSubmitTransaction({ signer: account, transaction: txn });
            await aptos.waitForTransaction({ transactionHash: committed.hash });
            return { hash: committed.hash, status: 'success' };
        } catch (error: any) {
            console.warn('[AptosLocalEngine] Execution failed:', error?.message);
            return { hash: '', status: 'failed', error: error?.message || 'Aptos transaction failed' };
        }
    }
}
