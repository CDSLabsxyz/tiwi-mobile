import { signerController } from '../signer/SignerController';

/**
 * Initialize LiFi SDK with our SignerController
 */
export async function initializeLiFi() {
    const { createConfig, EVM } = await import('@lifi/sdk');

    createConfig({
        integrator: 'Tiwi-Protocol',
        providers: [
            EVM({
                getWalletClient: async (chainId?: number) => {
                    // This is the "magic" bridge. 
                    // LiFi calls this, and we use our SignerController to provide a client
                    // that knows how to sign with the user's private key.
                    // Note: We need the address here. Since LiFi doesn't pass it, 
                    // we'll need to handle the currently active address logic.
                    const walletStore = (await import('@/store/walletStore')).useWalletStore.getState();
                    const address = walletStore.address;

                    if (!address) throw new Error('No wallet connected');

                    console.log(`[LiFi] Requesting WalletClient for chain ${chainId} and address ${address}`);
                    return await signerController.getWalletClient(chainId || 56, address, { skipAuthorize: true });
                },
                switchChain: async (chainId: number) => {
                    // In a mobile app with a local signer, "switching chains" 
                    // just means creating a client for the new chain ID.
                    const walletStore = (await import('@/store/walletStore')).useWalletStore.getState();
                    const address = walletStore.address;
                    if (!address) throw new Error('No wallet connected');

                    return await signerController.getWalletClient(chainId, address);
                },
            }),
        ],
    });
    console.log('[LiFi] SDK Initialized with Tiwi SignerController');
}
