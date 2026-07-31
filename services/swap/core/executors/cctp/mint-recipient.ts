/**
 * Resolve the relayer's mintRecipient ON the destination chain, in that chain's own address form.
 *
 * The EVM source burn sets depositForBurn.mintRecipient to this (encoded to bytes32 via the dest
 * VM's encoder). It must be the relayer's address on the DESTINATION chain:
 *   - EVM dest  → the relayer's EVM address.
 *   - SVM dest  → the relayer's USDC ATA (Solana CCTP mints into a token account, not a wallet).
 */
import type { CctpVm } from '@/services/swap/core/contracts/cctp';
import { getCctpRelayerAddress, getCctpRelayerSolanaAddress } from '@/services/swap/core/contracts/cctp';
import { svmUsdcAta } from '@/services/swap/core/contracts/cctp-svm';

export function resolveCctpMintRecipient(destVm: CctpVm): string | undefined {
  switch (destVm) {
    case 'evm':
      return getCctpRelayerAddress();
    case 'svm': {
      const wallet = getCctpRelayerSolanaAddress();
      return wallet ? svmUsdcAta(wallet) : undefined;
    }
    default:
      return undefined; // cosmos/move/cairo/stellar land as their relayer identities are added
  }
}
