import { getSecureMnemonic } from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { Buffer } from 'buffer';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';

/**
 * StarknetLocalEngine - native STRK send for in-app (mnemonic) wallets.
 *
 * Stark-curve key ground from the mnemonic (m/44'/9004'/0'/0/0); the account
 * ADDRESS is the counterfactual OpenZeppelin deployment (matches deriveStarknet-
 * Address). Every Starknet transfer goes through a token contract's
 * `transfer(recipient, uint256)`, so native STRK uses the STRK contract.
 *
 * CAVEAT: the account must be DEPLOYED before it can execute. If it isn't, the
 * send fails with the derived address so it can be funded + deployed first.
 * Ported from web multi-send-starknet.ts (single-recipient). NOT live-tested.
 */
const STARKNET_DERIVATION_PATH = "m/44'/9004'/0'/0/0";
const STARKNET_RPC =
    process.env.EXPO_PUBLIC_STARKNET_RPC || 'https://starknet-mainnet.public.blastapi.io/rpc/v0_7';
const STRK_CONTRACT = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const OZ_ACCOUNT_CLASS_HASH =
    process.env.EXPO_PUBLIC_STARKNET_OZ_CLASS_HASH ||
    '0x01a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003';

export class StarknetLocalEngine implements SignerEngine {
    private async authenticate() {
        const securityStore = useSecurityStore.getState();
        if (securityStore.isBiometricsEnabled) {
            try {
                await securityStore.authenticateBiometrics('Confirm Starknet Transaction');
            } catch {
                console.warn('[StarknetLocalEngine] Biometric error, proceeding with passcode auth');
            }
        }
    }

    private async getMnemonic(address?: string): Promise<string> {
        const { walletGroups, activeGroupId } = useWalletStore.getState();
        const lowered = address?.toLowerCase();
        const group = (lowered
            ? walletGroups.find(g => Object.values(g.addresses).some(a => a?.toLowerCase() === lowered))
            : undefined) ?? walletGroups.find(g => g.id === activeGroupId);

        if (!group?.addresses?.EVM) throw new Error('No mnemonic found for this Starknet wallet');
        const mnemonic = await getSecureMnemonic(group.addresses.EVM);
        if (!mnemonic) throw new Error('Mnemonic not found for Starknet key derivation');
        return mnemonic.trim();
    }

    async signTransaction(): Promise<string> {
        throw new Error('Starknet signTransaction is not supported; use sendTransaction');
    }

    async sendTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        try {
            if (!options?.skipAuthorize) await this.authenticate();

            const mnemonic = await this.getMnemonic(address);
            const { RpcProvider, Account, CallData, cairo, ec, hash } = await import('starknet');
            const { HDKey } = await import('@scure/bip32');
            const { mnemonicToSeedSync } = await import('@scure/bip39');

            const seed = mnemonicToSeedSync(mnemonic);
            const child = HDKey.fromMasterSeed(seed).derive(STARKNET_DERIVATION_PATH);
            if (!child.privateKey) throw new Error('Could not derive a Starknet key from the wallet');

            const ground = ec.starkCurve.grindKey('0x' + Buffer.from(child.privateKey).toString('hex'));
            const privateKey = '0x' + ground;
            const publicKey = ec.starkCurve.getStarkKey(privateKey);
            const constructorCalldata = CallData.compile({ publicKey });
            const accountAddress = hash.calculateContractAddressFromHash(publicKey, OZ_ACCOUNT_CLASS_HASH, constructorCalldata, 0);

            const provider = new RpcProvider({ nodeUrl: STARKNET_RPC });

            // The account must be deployed before it can execute anything.
            let deployed = false;
            try { await provider.getClassHashAt(accountAddress); deployed = true; } catch { deployed = false; }
            if (!deployed) {
                throw new Error(`Starknet account not deployed. Fund and deploy the account at ${accountAddress} before sending.`);
            }

            const account = new Account({ provider, address: accountAddress, signer: privateKey });
            const call = {
                contractAddress: STRK_CONTRACT,
                entrypoint: 'transfer',
                calldata: CallData.compile([tx.to, cairo.uint256(BigInt(tx.value || '0'))]),
            };
            const { transaction_hash } = await account.execute([call]);
            await provider.waitForTransaction(transaction_hash);
            return { hash: transaction_hash, status: 'success' };
        } catch (error: any) {
            console.warn('[StarknetLocalEngine] Execution failed:', error?.message);
            return { hash: '', status: 'failed', error: error?.message || 'Starknet transaction failed' };
        }
    }
}
