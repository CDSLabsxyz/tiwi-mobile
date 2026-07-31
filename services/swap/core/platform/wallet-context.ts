/**
 * Wallet context for the swap engine (React Native).
 *
 * The web executors assume a browser wallet they can query at any time. On
 * mobile the equivalent is the active `WalletGroup` in the Zustand wallet store,
 * whose `addresses` map already holds one address per chain family. This module
 * is the single place that translates a canonical chainId into "which address
 * signs this, and what secret material do we need to load".
 *
 * Nothing here prompts the user — biometric/passcode gating happens once in the
 * swap screen before execution starts, then the signer engines run with
 * `skipAuthorize` so a 3-leg swap doesn't ask three times.
 */

import { getSecureMnemonic, getSecurePrivateKey } from '@/services/walletCreationService';
import { useWalletStore, type WalletGroup } from '@/store/walletStore';

/**
 * Canonical chainId → the `addresses` key it is stored under.
 *
 * Mirrors the mapping the swap screen uses. Kept here so executors, the balance
 * layer and the screen can't drift apart — a wrong key silently signs with the
 * wrong account.
 */
export function addressKeyForChain(chainId: number | string | undefined): string {
    const id = Number(chainId);
    if (!Number.isFinite(id)) return 'EVM';
    if (id === 7565164 || id === 1399811149 || id === 501 || id === 103) return 'SOLANA';
    if (id === 728126428) return 'TRON';
    if (id === 1100 || id === 99999) return 'TON';
    if (id === 118 || id === 99998) return 'COSMOS';
    if (id === 249339) return 'OSMOSIS';
    if (id === 8000001) return 'INJECTIVE';
    if (id === 8000003) return 'JUNO';
    if (id === 8000004) return 'STRIDE';
    if (id === 8000005) return 'DYDX';
    if (id === 8000006) return 'KUJIRA';
    if (id === 8000007) return 'SECRET';
    if (id === 8000008) return 'CELESTIA';
    if (id === 8000009) return 'ARCHWAY';
    if (id === 8000010) return 'SAGA';
    if (id === 8000011) return 'NEUTRON';
    if (id === 8000012) return 'NIBIRU';
    if (id === 101) return 'SUI';
    if (id === 637) return 'APTOS';
    if (id === 8332) return 'BITCOIN';
    if (id === 23448594291968334) return 'STARKNET';
    return 'EVM';
}

export function getActiveWalletGroup(): WalletGroup | undefined {
    const { walletGroups, activeGroupId } = useWalletStore.getState();
    return walletGroups.find((g) => g.id === activeGroupId) ?? walletGroups[0];
}

/** The wallet group that owns `address` (any chain), else the active group. */
export function getWalletGroupForAddress(address?: string): WalletGroup | undefined {
    if (!address) return getActiveWalletGroup();
    const lowered = address.toLowerCase();
    const { walletGroups } = useWalletStore.getState();
    return (
        walletGroups.find((g) =>
            Object.values(g.addresses).some((a) => a?.toLowerCase() === lowered),
        ) ?? getActiveWalletGroup()
    );
}

/** The active wallet's address on `chainId`, or '' when it has none. */
export function getAddressForChain(chainId: number | string | undefined): string {
    const group = getActiveWalletGroup();
    if (!group) return useWalletStore.getState().address || '';
    const key = addressKeyForChain(chainId);
    return (group.addresses as Record<string, string | undefined>)[key]
        || group.addresses.EVM
        || useWalletStore.getState().address
        || '';
}

/** The active wallet's EVM address — the key every derived chain hangs off. */
export function getEvmAddress(): string {
    const group = getActiveWalletGroup();
    return group?.addresses?.EVM || useWalletStore.getState().address || '';
}

/**
 * True when the active wallet holds its keys on-device. External (WalletConnect)
 * wallets can't be driven by the local executors, so the swap engine refuses
 * rather than half-signing.
 */
export function isLocalWallet(address?: string): boolean {
    const group = getWalletGroupForAddress(address);
    return group?.source === 'internal' || group?.source === 'imported';
}

/** The active wallet's recovery phrase. Throws when the wallet is key-only. */
export async function getActiveMnemonic(address?: string): Promise<string> {
    const group = getWalletGroupForAddress(address);
    if (!group?.addresses?.EVM) {
        throw new Error('This wallet has no recovery phrase available for signing.');
    }
    const mnemonic = await getSecureMnemonic(group.addresses.EVM);
    if (!mnemonic) {
        throw new Error('Recovery phrase not found for this wallet.');
    }
    return mnemonic.trim();
}

/** Raw EVM private key for the active wallet (hex, 0x-prefixed). */
export async function getEvmPrivateKey(address?: string): Promise<`0x${string}`> {
    const group = getWalletGroupForAddress(address);
    const evm = address && address.startsWith('0x') ? address : group?.addresses?.EVM;
    if (!evm) throw new Error('No EVM address found for this wallet.');

    const key = (await getSecurePrivateKey(evm, 'EVM')) || (await getSecurePrivateKey(evm));
    if (!key) throw new Error('Private key not found for this wallet.');
    return (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`;
}
