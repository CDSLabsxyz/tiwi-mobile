/**
 * External Sui wallet — mobile stand-in.
 *
 * On web this resolves a Wallet-Standard Sui wallet (Slush/Suiet/…) injected
 * into the page. There is no such thing in the Expo app: a Sui swap is always
 * signed by the in-app ed25519 key, which the executors receive as
 * `{ suiKeypair, suiAddress }` on `params.walletClient`.
 *
 * Reaching this function therefore means the signer material was never built —
 * usually an externally-connected (WalletConnect) wallet, which has no Sui key.
 * Fail with that, rather than a confusing "no wallet found".
 */

import { SwapErrorCode, SwapExecutionError } from '@/services/swap/core/types';

export async function getExternalSuiSigner(_suiAddress: string): Promise<never> {
    throw new SwapExecutionError(
        'Sui swaps require an in-app wallet with a recovery phrase. Connected external wallets cannot sign Sui transactions here.',
        SwapErrorCode.WALLET_NOT_CONNECTED,
    );
}
