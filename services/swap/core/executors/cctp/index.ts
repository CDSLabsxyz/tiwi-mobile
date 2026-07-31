/**
 * CCTP source-adapter registry (frontend). Picks the burn implementation by the source chain's VM.
 * Only 'evm' exists today; add svm/cosmos/… here as their adapters land.
 */
import type { CctpSourceAdapter } from '@/services/swap/core/contracts/cctp-adapters';
import type { CctpVm } from '@/services/swap/core/contracts/cctp';
import { evmCctpSourceAdapter } from './evm-source-adapter';

const SOURCE_ADAPTERS: Partial<Record<CctpVm, CctpSourceAdapter>> = {
  evm: evmCctpSourceAdapter,
};

export function cctpSourceAdapterFor(vm: CctpVm): CctpSourceAdapter {
  const adapter = SOURCE_ADAPTERS[vm];
  if (!adapter) throw new Error(`No CCTP source adapter for vm '${vm}' yet`);
  return adapter;
}
