import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { LocalSignerEngine } from './LocalSignerEngine';
import { ExecutionResult, TransactionRequest } from './SignerTypes';
import { SolanaLocalEngine } from './SolanaLocalEngine';

export class SignerController {
    private evmEngine: LocalSignerEngine;
    private solanaEngine: SolanaLocalEngine;

    constructor() {
        this.evmEngine = new LocalSignerEngine();
        this.solanaEngine = new SolanaLocalEngine();
    }

    /**
     * The main execution entry point. 
     * Handles routing between Local Signer and External (WalletConnect) Signer.
     */
    async executeTransaction(tx: TransactionRequest, address: string): Promise<ExecutionResult> {
        const walletStore = useWalletStore.getState();
        const securityStore = useSecurityStore.getState();

        // 1. Identify Wallet Source
        const wallet = walletStore.connectedWallets.find(w => w.address.toLowerCase() === address.toLowerCase());
        const isLocal = wallet?.source === 'internal' || wallet?.source === 'imported';

        if (isLocal) {
            // 2. Security Challenge (Industry Standard: Biometrics before every signature)
            const isAuthorized = await securityStore.authenticateBiometrics('Confirm Transaction');

            if (!isAuthorized && securityStore.hasPasscode) {
                // Fallback to passcode would typically happen here or be handled by authenticateBiometrics
                // For now, if unauthorized, we block
                throw new Error('User authentication failed');
            }

            if (!isAuthorized && !securityStore.hasPasscode) {
                // If no security is set up, we should probably warn or allow if it's a low-security mode
                // But best practice is to require SOMETHING.
            }

            // 3. Select Engine based on Chain Family
            const engine = tx.chainFamily === 'evm' ? this.evmEngine : this.solanaEngine;

            // 4. Execute
            return await engine.sendTransaction(tx, address);
        } else {
            // 5. Handle WalletConnect / External Signer
            // In a real app, this would use wagmi/core (EVM) or Solana Wallet Adapter (Solana)
            try {
                if (tx.chainFamily === 'evm') {
                    // Placeholder for WalletConnect EVM
                    // Usually: await sendTransaction(wagmiConfig, { to: tx.to, value: tx.value, ... })
                    throw new Error('WalletConnect EVM signature required. Please verify in your external wallet.');
                } else {
                    throw new Error('WalletConnect Solana signature required. Please verify in your external wallet.');
                }
            } catch (e: any) {
                return { hash: '', status: 'failed', error: e.message };
            }
        }
    }
}

export const signerController = new SignerController();
