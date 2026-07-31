import { useWalletStore } from '@/store/walletStore';
import { AptosLocalEngine } from './AptosLocalEngine';
import { BitcoinLocalEngine } from './BitcoinLocalEngine';
import { CosmosLocalEngine } from './CosmosLocalEngine';
import { InjectiveLocalEngine } from './InjectiveLocalEngine';
import { LocalSignerEngine } from './LocalSignerEngine';
import { StarknetLocalEngine } from './StarknetLocalEngine';
import { ChainFamily, ExecutionResult, SignerEngine, TransactionRequest } from './SignerTypes';
import { SolanaLocalEngine } from './SolanaLocalEngine';
import { SuiLocalEngine } from './SuiLocalEngine';
import { TonLocalEngine } from './TonLocalEngine';
import { TronLocalEngine } from './TronLocalEngine';

/**
 * SignerController is the main entry point for all transaction signatures.
 * It routes requests to the appropriate engine (Local or External) and 
 * provides low-level provider access (WalletClient) for SDKs.
 */
export class SignerController {
    private evmEngine: LocalSignerEngine;
    private solanaEngine: SolanaLocalEngine;
    private suiEngine: SuiLocalEngine;
    private aptosEngine: AptosLocalEngine;
    private cosmosEngine: CosmosLocalEngine;
    private injectiveEngine: InjectiveLocalEngine;
    private bitcoinEngine: BitcoinLocalEngine;
    private starknetEngine: StarknetLocalEngine;
    private tronEngine: TronLocalEngine;
    private tonEngine: TonLocalEngine;
    /** Non-EVM engines keyed by chainFamily. EVM is handled separately (default). */
    private engines: Partial<Record<ChainFamily, SignerEngine>>;

    constructor() {
        this.evmEngine = new LocalSignerEngine();
        this.solanaEngine = new SolanaLocalEngine();
        this.suiEngine = new SuiLocalEngine();
        this.aptosEngine = new AptosLocalEngine();
        this.cosmosEngine = new CosmosLocalEngine();
        this.injectiveEngine = new InjectiveLocalEngine();
        this.bitcoinEngine = new BitcoinLocalEngine();
        this.starknetEngine = new StarknetLocalEngine();
        this.tronEngine = new TronLocalEngine();
        this.tonEngine = new TonLocalEngine();
        this.engines = {
            evm: this.evmEngine,
            solana: this.solanaEngine,
            sui: this.suiEngine,
            aptos: this.aptosEngine,
            cosmos: this.cosmosEngine,
            injective: this.injectiveEngine,
            bitcoin: this.bitcoinEngine,
            starknet: this.starknetEngine,
            tron: this.tronEngine,
            ton: this.tonEngine,
        };
    }

    /**
     * Executes a single transaction.
     * Biometric security is handled at the Engine level to ensure consistency.
     */
    async executeTransaction(tx: TransactionRequest, address: string, options?: { skipAuthorize?: boolean }): Promise<ExecutionResult> {
        const walletStore = useWalletStore.getState();

        // 1. Identify Wallet Source
        const walletGroup = walletStore.walletGroups.find(g => {
            return Object.values(g.addresses).some(addr => addr?.toLowerCase() === address.toLowerCase());
        }
        );
        const isLocal = walletGroup?.source === 'internal' || walletGroup?.source === 'imported';

        if (isLocal) {
            // 2. Select Engine based on Chain Family (defaults to EVM).
            const engine = this.engines[tx.chainFamily] ?? this.evmEngine;

            // 3. Execute (Engine will prompt for biometrics unless skipAuthorize is true)
            return await engine.sendTransaction(tx, address, options);
        } else {
            // 4. Handle External Signer
            try {
                if (tx.chainFamily === 'evm') {
                    // This is handled by Wagmi/AppKit UI usually
                    throw new Error('External signatures should be handled via the AppKit provider interface.');
                } else {
                    throw new Error('WalletConnect Solana signature required. Please verify in your external wallet.');
                }
            } catch (e: any) {
                return { hash: '', status: 'failed', error: e.message };
            }
        }
    }

    /**
     * Provides a viem WalletClient that can be injected into 3rd-party SDKs.
     * The internal account of this client is "securely wrapped" to prompt biometrics.
     */
    async getWalletClient(chainId: number, address: string, options?: { skipAuthorize?: boolean }) {
        // We only support EVM WalletClient for now
        return await this.evmEngine.getWalletClient(chainId, address, options);
    }

    async getPublicClient(chainId: number) {
        return await this.evmEngine.getPublicClient(chainId);
    }
}

export const signerController = new SignerController();
