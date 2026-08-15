import { getSecureMnemonic } from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';

/**
 * InjectiveLocalEngine - native INJ send for in-app (mnemonic) wallets.
 *
 * Injective is eth_secp256k1 (Ethermint): its account is derived from the
 * ETHEREUM path m/44'/60'/0'/0/0 - the SAME key as the wallet's EVM address -
 * NOT the standard Cosmos m/44'/118' key. That's why it can't go through
 * CosmosLocalEngine and gets its own engine using @injectivelabs/sdk-ts.
 *
 * Native INJ only (MsgSend). Canonical chainId 8000001, denom 'inj', 18 decimals.
 */
const INJECTIVE_ETH_PATH = "m/44'/60'/0'/0/0";

export class InjectiveLocalEngine implements SignerEngine {
    private async authenticate() {
        const securityStore = useSecurityStore.getState();
        if (securityStore.isBiometricsEnabled) {
            try {
                await securityStore.authenticateBiometrics('Confirm Injective Transaction');
            } catch {
                console.warn('[InjectiveLocalEngine] Biometric error, proceeding with passcode auth');
            }
        }
    }

    private async getMnemonic(address?: string): Promise<string> {
        const { walletGroups, activeGroupId } = useWalletStore.getState();
        const lowered = address?.toLowerCase();
        const group = (lowered
            ? walletGroups.find(g => Object.values(g.addresses).some(a => a?.toLowerCase() === lowered))
            : undefined) ?? walletGroups.find(g => g.id === activeGroupId);

        if (!group?.addresses?.EVM) throw new Error('No mnemonic found for this Injective wallet');
        const mnemonic = await getSecureMnemonic(group.addresses.EVM);
        if (!mnemonic) throw new Error('Mnemonic not found for Injective key derivation');
        return mnemonic.trim();
    }

    async signTransaction(): Promise<string> {
        throw new Error('Injective signTransaction is not supported; use sendTransaction');
    }

    async sendTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        try {
            if (!options?.skipAuthorize) await this.authenticate();

            const mnemonic = await this.getMnemonic(address);
            const { PrivateKey, MsgSend, MsgBroadcasterWithPk } = await import('@injectivelabs/sdk-ts');
            const { Network } = await import('@injectivelabs/networks');

            // eth_secp256k1 key at the Ethereum path - same account as the EVM address.
            const pk = PrivateKey.fromMnemonic(mnemonic, INJECTIVE_ETH_PATH);
            const srcInjectiveAddress = pk.toBech32();
            const privateKeyHex = pk.toPrivateKeyHex().replace(/^0x/, '');

            const msg = MsgSend.fromJSON({
                amount: { denom: 'inj', amount: String(tx.value || '0') },
                srcInjectiveAddress,
                dstInjectiveAddress: tx.to,
            });

            const broadcaster = new MsgBroadcasterWithPk({
                privateKey: privateKeyHex,
                network: Network.Mainnet,
                simulateTx: true, // gas estimation (equivalent to fee 'auto')
            });
            const res = await broadcaster.broadcast({ msgs: msg });
            if (res.code !== 0) {
                throw new Error(res.rawLog || `Injective tx failed (code ${res.code})`);
            }
            return { hash: res.txHash, status: 'success' };
        } catch (error: any) {
            console.warn('[InjectiveLocalEngine] Execution failed:', error?.message);
            return { hash: '', status: 'failed', error: error?.message || 'Injective transaction failed' };
        }
    }
}
