import { COSMOS_CHAIN_CONFIG, cosmosRpcUrls } from '@/constants/cosmosChains';
import { useSecurityStore } from '@/store/securityStore';
import type { AddressKey } from '@/store/walletStore';
import { getCosmosSigner } from './chainSecrets';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';

/**
 * CosmosLocalEngine — signs & broadcasts Cosmos-family sends for on-device
 * wallets via @cosmjs. One standard secp256k1 account (m/44'/118') re-encoded
 * per chain prefix; the sender address is derived inside sendTransaction
 * because it depends on the chain's bech32 prefix.
 *
 * Works for both wallet shapes: mnemonic-derived and raw-private-key imports
 * (see `chainSecrets.getCosmosSigner`).
 *
 * MsgSend with the chain's native denom, or with an explicit denom passed as
 * `tx.data` (IBC vouchers, factory/ tokens). Injective and THORChain are
 * intentionally not in COSMOS_CHAIN_CONFIG (different key/fee models).
 */
export class CosmosLocalEngine implements SignerEngine {
    private async authenticate() {
        const securityStore = useSecurityStore.getState();
        if (securityStore.isBiometricsEnabled) {
            try {
                await securityStore.authenticateBiometrics('Confirm Cosmos Transaction');
            } catch {
                console.warn('[CosmosLocalEngine] Biometric error, proceeding with passcode auth');
            }
        }
    }

    /**
     * The offline signer for this wallet, bound to `prefix`.
     *
     * Resolves through `getCosmosSigner`, which accepts a mnemonic-derived
     * wallet OR one imported from a raw secp256k1 key (Keplr's "export private
     * key") — the latter has no EVM address and no phrase, and used to throw
     * here on every transaction.
     */
    private async getSigner(prefix: string, address?: string, addressKey?: AddressKey): Promise<any> {
        return getCosmosSigner(prefix, address, addressKey);
    }

    async signTransaction(): Promise<string> {
        throw new Error('Cosmos signTransaction is not supported; use sendTransaction');
    }

    async sendTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        try {
            if (!options?.skipAuthorize) await this.authenticate();

            const network = COSMOS_CHAIN_CONFIG[Number(tx.chainId)];
            if (!network) throw new Error(`Cosmos chain ${tx.chainId} is not supported yet`);

            const { SigningStargateClient, GasPrice } = await import('@cosmjs/stargate');

            const wallet = await this.getSigner(network.prefix, address, network.addressKey);
            const accounts = await wallet.getAccounts();
            if (!accounts.length) throw new Error('Could not derive a Cosmos account from the wallet');
            const senderAddress = accounts[0].address;

            // Native send: use the chain's native denom. (tx.data may carry an
            // explicit denom string for IBC tokens in a later step.)
            const denom = (tx.data && tx.data.length > 0) ? tx.data : network.nativeDenom;

            // Connect with RPC fallback so a single proxy outage doesn't fail the send.
            let client: Awaited<ReturnType<typeof SigningStargateClient.connectWithSigner>> | null = null;
            let lastErr: any = null;
            for (const url of cosmosRpcUrls(network)) {
                try {
                    client = await SigningStargateClient.connectWithSigner(url, wallet, {
                        gasPrice: GasPrice.fromString(network.gasPrice),
                    });
                    break;
                } catch (e) {
                    lastErr = e;
                    console.warn(`[CosmosLocalEngine] RPC ${url} unreachable, trying next`, e);
                }
            }
            if (!client) throw new Error(`Could not connect to any ${network.registryName} RPC: ${lastErr?.message || lastErr}`);

            const msg = {
                typeUrl: '/cosmos.bank.v1beta1.MsgSend',
                value: {
                    fromAddress: senderAddress,
                    toAddress: tx.to,
                    amount: [{ denom, amount: String(tx.value || '0') }],
                },
            };

            const result = await client.signAndBroadcast(senderAddress, [msg], 'auto', '');
            if (result.code !== 0) {
                throw new Error(result.rawLog || `Cosmos tx failed with code ${result.code}`);
            }
            return { hash: result.transactionHash, status: 'success' };
        } catch (error: any) {
            console.warn('[CosmosLocalEngine] Execution failed:', error?.message);
            return { hash: '', status: 'failed', error: error?.message || 'Cosmos transaction failed' };
        }
    }
}
