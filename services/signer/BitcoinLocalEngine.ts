import { getSecureMnemonic } from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { Buffer } from 'buffer';
import { ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';

/**
 * BitcoinLocalEngine — native BTC send for in-app (mnemonic) wallets.
 *
 * Native SegWit (BIP84, bc1q…, m/84'/0'/0'/0/0). Fetches UTXOs + fee rate from
 * mempool.space, does accumulative (largest-first) coin selection for a single
 * recipient + change, signs with @scure/btc-signer, and broadcasts. Ported from
 * the web multi-send-bitcoin.ts (single-recipient case). Canonical chainId 8332.
 */
const BTC_DERIVATION_PATH = "m/84'/0'/0'/0/0";
const MEMPOOL_API = 'https://mempool.space/api';
const DUST_SATS = BigInt(330);

type Utxo = { txid: string; vout: number; value: number };

async function fetchUtxos(address: string): Promise<Utxo[]> {
    const res = await fetch(`${MEMPOOL_API}/address/${address}/utxo`);
    if (!res.ok) throw new Error(`UTXO fetch failed (${res.status})`);
    return (await res.json()) as Utxo[];
}

async function fetchFeeRate(): Promise<number> {
    try {
        const res = await fetch(`${MEMPOOL_API}/v1/fees/recommended`);
        if (!res.ok) throw new Error(String(res.status));
        const fees = await res.json();
        return Math.max(1, Math.ceil(fees.halfHourFee || fees.hourFee || 5));
    } catch {
        return 10; // conservative fallback sat/vB
    }
}

async function broadcastRaw(rawHex: string): Promise<string> {
    const res = await fetch(`${MEMPOOL_API}/tx`, { method: 'POST', body: rawHex });
    const text = await res.text();
    if (!res.ok) throw new Error(`Broadcast failed: ${text}`);
    return text.trim(); // txid
}

export class BitcoinLocalEngine implements SignerEngine {
    private async authenticate() {
        const securityStore = useSecurityStore.getState();
        if (securityStore.isBiometricsEnabled) {
            try {
                await securityStore.authenticateBiometrics('Confirm Bitcoin Transaction');
            } catch {
                console.warn('[BitcoinLocalEngine] Biometric error, proceeding with passcode auth');
            }
        }
    }

    private async getMnemonic(address?: string): Promise<string> {
        const { walletGroups, activeGroupId } = useWalletStore.getState();
        const lowered = address?.toLowerCase();
        const group = (lowered
            ? walletGroups.find(g => Object.values(g.addresses).some(a => a?.toLowerCase() === lowered))
            : undefined) ?? walletGroups.find(g => g.id === activeGroupId);

        if (!group?.addresses?.EVM) throw new Error('No mnemonic found for this Bitcoin wallet');
        const mnemonic = await getSecureMnemonic(group.addresses.EVM);
        if (!mnemonic) throw new Error('Mnemonic not found for Bitcoin key derivation');
        return mnemonic.trim();
    }

    async signTransaction(): Promise<string> {
        throw new Error('Bitcoin signTransaction is not supported; use sendTransaction');
    }

    async sendTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        try {
            if (!options?.skipAuthorize) await this.authenticate();

            const mnemonic = await this.getMnemonic(address);
            const btc = await import('@scure/btc-signer');
            const { HDKey } = await import('@scure/bip32');
            const { mnemonicToSeedSync } = await import('@scure/bip39');

            const seed = mnemonicToSeedSync(mnemonic);
            const child = HDKey.fromMasterSeed(seed).derive(BTC_DERIVATION_PATH);
            if (!child.privateKey || !child.publicKey) throw new Error('Could not derive a Bitcoin key from the wallet');

            const p2wpkh = btc.p2wpkh(child.publicKey, btc.NETWORK);
            const myAddress = p2wpkh.address!;

            const [utxos, feeRate] = await Promise.all([fetchUtxos(myAddress), fetchFeeRate()]);
            if (utxos.length === 0) throw new Error('No spendable BTC (no UTXOs)');

            const totalOut = BigInt(tx.value || '0');

            // Accumulative coin selection (largest first): recipient + change = 2 outputs.
            const sorted = [...utxos].sort((a, b) => b.value - a.value);
            const selected: Utxo[] = [];
            let totalIn = BigInt(0);
            let fee = BigInt(0);
            const numOutputs = 2;
            let covered = false;
            for (const u of sorted) {
                selected.push(u);
                totalIn += BigInt(u.value);
                const vsize = selected.length * 68 + numOutputs * 31 + 11;
                fee = BigInt(Math.ceil(vsize * feeRate));
                if (totalIn >= totalOut + fee) { covered = true; break; }
            }
            if (!covered) throw new Error(`Insufficient BTC: need ${totalOut + fee} sats (incl. fee), have ${totalIn}`);

            const btcTx = new btc.Transaction();
            for (const u of selected) {
                btcTx.addInput({
                    txid: Uint8Array.from(Buffer.from(u.txid, 'hex')),
                    index: u.vout,
                    witnessUtxo: { script: p2wpkh.script, amount: BigInt(u.value) },
                });
            }
            btcTx.addOutputAddress(tx.to, totalOut, btc.NETWORK);
            const change = totalIn - totalOut - fee;
            if (change > DUST_SATS) btcTx.addOutputAddress(myAddress, change, btc.NETWORK);

            btcTx.sign(child.privateKey);
            btcTx.finalize();
            const rawHex = Buffer.from(btcTx.extract()).toString('hex');

            const txid = await broadcastRaw(rawHex);
            return { hash: txid, status: 'success' };
        } catch (error: any) {
            console.warn('[BitcoinLocalEngine] Execution failed:', error?.message);
            return { hash: '', status: 'failed', error: error?.message || 'Bitcoin transaction failed' };
        }
    }
}
