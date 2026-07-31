import { createTronWeb } from '@/services/chainKeys';
import { useSecurityStore } from '@/store/securityStore';
import { Buffer } from 'buffer';
import { getTronPrivateKey } from './chainSecrets';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';

/**
 * TronLocalEngine — signs & broadcasts TRON transfers for on-device wallets.
 *
 * Handles both native TRX and TRC-20 tokens. The key comes from
 * `getTronPrivateKey`, so it works for a mnemonic wallet (derived at
 * m/44'/195'/0'/0/0) *and* for a wallet imported from a raw TRON private key.
 *
 * Transfer shape follows `TransactionRequest`:
 *   native TRX  → { to, value: sun }                 (data empty)
 *   TRC-20      → { to, value: base units, data: <contract address> }
 *
 * TronWeb signs and broadcasts in one call; the returned `txid` is the hash.
 */
export class TronLocalEngine implements SignerEngine {
    private async authenticate() {
        const securityStore = useSecurityStore.getState();
        if (securityStore.isBiometricsEnabled) {
            try {
                await securityStore.authenticateBiometrics('Confirm TRON Transaction');
            } catch {
                console.warn('[TronLocalEngine] Biometric error, proceeding with passcode auth');
            }
        }
    }

    /** A TronWeb bound to this wallet's key, ready to sign. */
    async getTronWeb(address?: string): Promise<any> {
        const privateKey = await getTronPrivateKey(address);
        const tronWeb = await createTronWeb(privateKey);

        // Guard against signing from a different account than the UI showed.
        const derived = tronWeb.address.fromPrivateKey(privateKey);
        if (address && derived && derived !== address) {
            throw new Error(
                `Derived TRON address (${derived}) does not match the selected wallet (${address}).`,
            );
        }
        return tronWeb;
    }

    async signTransaction(tx: TransactionRequest, address: string): Promise<string> {
        await this.authenticate();
        const tronWeb = await this.getTronWeb(address);
        const unsigned = await this.buildTransaction(tronWeb, tx, address);
        const signed = await tronWeb.trx.sign(unsigned);
        return JSON.stringify(signed);
    }

    /** Build the unsigned tx — native transfer or TRC-20 `transfer(address,uint256)`. */
    private async buildTransaction(tronWeb: any, tx: TransactionRequest, from: string): Promise<any> {
        const amount = tx.value || '0';
        const contract = (tx.data || '').trim();

        if (!contract) {
            // Native TRX. Amounts are already in sun (6 decimals).
            return tronWeb.transactionBuilder.sendTrx(tx.to, Number(amount), from);
        }

        // TRC-20 transfer. `triggerSmartContract` keeps the fee limit explicit
        // rather than relying on tronweb's contract() default.
        const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
            contract,
            'transfer(address,uint256)',
            { feeLimit: 100_000_000, callValue: 0 },
            [
                { type: 'address', value: tx.to },
                { type: 'uint256', value: amount },
            ],
            from,
        );
        if (!transaction) throw new Error('Could not build the TRC-20 transfer.');
        return transaction;
    }

    async sendTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        try {
            if (!options?.skipAuthorize) await this.authenticate();

            const tronWeb = await this.getTronWeb(address);
            const unsigned = await this.buildTransaction(tronWeb, tx, address);
            const signed = await tronWeb.trx.sign(unsigned);
            const receipt = await tronWeb.trx.sendRawTransaction(signed);

            const hash = receipt?.txid || receipt?.transaction?.txID || signed?.txID;
            if (!hash || receipt?.result === false) {
                // TronGrid returns the reason as base64-ish hex in `message`.
                const reason = receipt?.message
                    ? Buffer.from(receipt.message, 'hex').toString('utf8')
                    : receipt?.code || 'TRON broadcast rejected';
                throw new Error(String(reason));
            }

            return { hash, status: 'success' };
        } catch (error: any) {
            console.warn('[TronLocalEngine] Execution failed:', error?.message);
            return {
                hash: '',
                status: 'failed',
                error: error?.message || 'TRON transaction failed',
            };
        }
    }
}
