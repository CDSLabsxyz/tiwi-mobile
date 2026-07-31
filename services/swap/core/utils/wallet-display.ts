/**
 * Address ↔ chain compatibility.
 *
 * Port of the web app's `lib/frontend/utils/wallet-display.isAddressChainCompatible`.
 * Used in exactly the two places the web uses it, and it MUST stay in both:
 *
 *   1. Quoting — an address that isn't valid on the token's chain is dropped
 *      from the route request rather than sent as a bogus fromAddress/recipient.
 *   2. Execution — the cross-VM fund-safety guard. Without a recipient valid on
 *      the destination chain, executors fall back to the source-VM address and
 *      funds land somewhere that cannot exist on the destination (unrecoverable).
 */

import { isAddressForChain } from './address-validation';

export function isAddressChainCompatible(
    address: string | null | undefined,
    tokenChainId?: number,
): boolean {
    if (!address) return false;
    // Unknown chain — can't judge, so don't block.
    if (!tokenChainId) return true;
    return isAddressForChain(address, tokenChainId);
}
