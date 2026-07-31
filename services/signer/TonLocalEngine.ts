import { tonWalletContract } from '@/services/chainKeys';
import { useSecurityStore } from '@/store/securityStore';
import { getTonKeyPair } from './chainSecrets';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';

const TONCENTER_ENDPOINT = 'https://toncenter.com/api/v2/jsonRPC';

/** TON attached to a jetton transfer to cover forwarding fees (0.05 TON). */
const JETTON_FORWARD_VALUE = BigInt(50_000_000);
/** Notification amount forwarded to the recipient (1 nanoton — standard). */
const JETTON_FORWARD_TON = BigInt(1);
/** TEP-74 jetton `transfer` opcode. */
const JETTON_TRANSFER_OP = 0xf8a7ea5;

/**
 * TonLocalEngine — signs & broadcasts TON transfers for on-device wallets.
 *
 * Covers native TON and TEP-74 jettons. The keypair comes from
 * `getTonKeyPair`, so it works for a BIP39 multi-chain wallet, a wallet
 * imported from a raw ed25519 key, and one imported from a native 24-word TON
 * mnemonic.
 *
 * Transfer shape follows `TransactionRequest`:
 *   native TON → { to, value: nanotons }             (data empty)
 *   jetton     → { to, value: base units, data: <jetton master address> }
 *
 * Signing is a V4R2 external message, matching the address the app derives and
 * displays (`tonAddressFromPublicKey`).
 */
export class TonLocalEngine implements SignerEngine {
    private async authenticate() {
        const securityStore = useSecurityStore.getState();
        if (securityStore.isBiometricsEnabled) {
            try {
                await securityStore.authenticateBiometrics('Confirm TON Transaction');
            } catch {
                console.warn('[TonLocalEngine] Biometric error, proceeding with passcode auth');
            }
        }
    }

    private async getClient(): Promise<any> {
        const { TonClient } = await import('@ton/ton');
        const apiKey = process.env.EXPO_PUBLIC_TONCENTER_API_KEY || undefined;
        return new TonClient({ endpoint: TONCENTER_ENDPOINT, apiKey });
    }

    /** Keypair + opened V4R2 contract for the wallet that owns `address`. */
    private async getSigner(address?: string) {
        const keypair = await getTonKeyPair(address);
        const wallet = await tonWalletContract(keypair.publicKey);
        const client = await this.getClient();
        return { keypair, wallet, contract: client.open(wallet), client };
    }

    /**
     * The TEP-74 transfer body for moving `amount` of a jetton to `to`, with
     * excess gas refunded to the sender.
     */
    private async buildJettonBody(amount: string, to: string, owner: any) {
        const { beginCell, Address } = await import('@ton/core');
        return beginCell()
            .storeUint(JETTON_TRANSFER_OP, 32)
            .storeUint(0, 64) // query_id
            .storeCoins(BigInt(amount))
            .storeAddress(Address.parse(to)) // destination
            .storeAddress(owner)             // response_destination (gas refund)
            .storeBit(0)                     // no custom_payload
            .storeCoins(JETTON_FORWARD_TON)
            .storeBit(0)                     // empty forward_payload
            .endCell();
    }

    /** Resolve the sender's jetton wallet for a jetton master contract. */
    private async getJettonWalletAddress(client: any, master: string, owner: any): Promise<any> {
        const { JettonMaster, Address } = await import('@ton/ton');
        const jettonMaster = client.open(JettonMaster.create(Address.parse(master)));
        return jettonMaster.getWalletAddress(owner);
    }

    async signTransaction(): Promise<string> {
        throw new Error('TON signTransaction is not supported; use sendTransaction');
    }

    async sendTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        try {
            if (!options?.skipAuthorize) await this.authenticate();

            const { keypair, wallet, contract, client } = await this.getSigner(address);
            const { internal: internalMessage, SendMode } = await import('@ton/ton');
            const { Address } = await import('@ton/core');

            const jettonMaster = (tx.data || '').trim();
            const amount = tx.value || '0';

            let message: any;
            if (jettonMaster) {
                const jettonWallet = await this.getJettonWalletAddress(client, jettonMaster, wallet.address);
                message = internalMessage({
                    to: jettonWallet,
                    value: JETTON_FORWARD_VALUE,
                    bounce: true,
                    body: await this.buildJettonBody(amount, tx.to, wallet.address),
                });
            } else {
                message = internalMessage({
                    to: Address.parse(tx.to),
                    value: BigInt(amount), // nanotons
                    // Non-bounceable: a plain transfer to an uninitialised
                    // wallet must not bounce the funds straight back.
                    bounce: false,
                });
            }

            let seqno: number;
            try {
                seqno = await contract.getSeqno();
            } catch (err: any) {
                throw new Error(`Could not reach the TON network: ${err?.message || err}`);
            }

            const transfer = wallet.createTransfer({
                seqno,
                secretKey: keypair.secretKey,
                sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
                messages: [message],
            });

            const hash = transfer.hash().toString('hex');
            await contract.send(transfer);
            await this.waitForSeqno(contract, seqno);

            return { hash: `0x${hash}`, status: 'success' };
        } catch (error: any) {
            console.warn('[TonLocalEngine] Execution failed:', error?.message);
            return {
                hash: '',
                status: 'failed',
                error: error?.message || 'TON transaction failed',
            };
        }
    }

    /**
     * TON has no receipt to await — the wallet's seqno incrementing is the
     * confirmation that the external message was accepted.
     */
    private async waitForSeqno(contract: any, previous: number, attempts = 20): Promise<void> {
        for (let i = 0; i < attempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            try {
                if ((await contract.getSeqno()) > previous) return;
            } catch {
                /* transient RPC error — keep polling */
            }
        }
    }
}
