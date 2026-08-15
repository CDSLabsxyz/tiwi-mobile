/**
 * Secret resolution for on-device wallets.
 *
 * A wallet reaches the app through one of three doors and each writes a
 * different secret to SecureStore:
 *
 *   1. "Generate phrase" / BIP39 seed import → mnemonic stored under the
 *      group's EVM address. Every chain derives from it.
 *   2. Chain-specific private-key import (TRON / TON / COSMOS / OSMOSIS /
 *      SOLANA / EVM) → raw key stored under `<CHAIN>_<address>`. There is NO
 *      mnemonic and NO EVM address on the group.
 *   3. Native TON 24-word mnemonic import → mnemonic stored under the TON
 *      address (it is not a BIP39 phrase and derives no other chain).
 *
 * Before this module existed every non-EVM engine went straight for
 * `getSecureMnemonic(group.addresses.EVM)`, so door 2 and door 3 wallets threw
 * "No mnemonic found" on every signature. `resolveChainSecret` tries all three
 * in a fixed order and the per-chain helpers below turn the result into a
 * ready-to-use signer.
 */

import {
    cosmosWalletFromMnemonic,
    cosmosWalletFromPrivateKeyHex,
    normalizeHexKey,
    tonKeyPairFromMnemonic,
    tonKeyPairFromSecretHex,
    tronPrivateKeyFromMnemonic,
    type TonKeyPair,
} from '@/services/chainKeys';
import { getSecureMnemonic, getSecurePrivateKey } from '@/services/walletCreationService';
import { useWalletStore, type AddressKey, type ChainType, type WalletGroup } from '@/store/walletStore';

export type ChainSecret =
    | { kind: 'privateKey'; privateKey: string; address: string; group?: WalletGroup; chainOnly: boolean }
    | { kind: 'mnemonic'; mnemonic: string; address?: string; group?: WalletGroup; chainOnly: boolean };

/** The wallet group that owns `address` (on any chain), else the active group. */
export function findWalletGroup(address?: string): WalletGroup | undefined {
    const { walletGroups, activeGroupId } = useWalletStore.getState();
    const lowered = address?.trim().toLowerCase();
    return (
        (lowered
            ? walletGroups.find(g => Object.values(g.addresses).some(a => a?.toLowerCase() === lowered))
            : undefined)
        ?? walletGroups.find(g => g.id === activeGroupId)
        ?? walletGroups[0]
    );
}

/**
 * The stored private-key slots to probe for `chain`. Cosmos-family chains all
 * share one secp256k1 account, so a key imported as COSMOS also signs for
 * OSMOSIS/JUNO/… and vice versa.
 */
function keySlotsFor(chain: ChainType): ChainType[] {
    if (chain === 'COSMOS' || chain === 'OSMOSIS') return ['COSMOS', 'OSMOSIS'];
    return [chain];
}

/** The `addresses` keys that can hold this chain's account. */
function addressKeysFor(chain: ChainType, addressKey?: AddressKey): AddressKey[] {
    const keys: AddressKey[] = addressKey ? [addressKey] : [];
    keys.push(chain);
    if (chain === 'COSMOS' || chain === 'OSMOSIS') keys.push('COSMOS', 'OSMOSIS');
    return Array.from(new Set(keys));
}

/**
 * Find the secret that signs for `chain`.
 *
 * @param address    the chain address being signed for, when known
 * @param addressKey the `addresses` key to read for cosmos-family chains whose
 *                   key differs from the ChainType (JUNO, CELESTIA, …)
 */
export async function resolveChainSecret(
    chain: ChainType,
    address?: string,
    addressKey?: AddressKey,
): Promise<ChainSecret> {
    const group = findWalletGroup(address);
    const chainOnly = !group?.addresses?.EVM;

    // Every address this chain's account could be stored under, most specific first.
    const candidates = Array.from(new Set([
        address?.trim(),
        ...addressKeysFor(chain, addressKey).map(k => group?.addresses?.[k]),
    ].filter(Boolean) as string[]));

    // Door 2 - a private key imported for this chain.
    for (const candidate of candidates) {
        for (const slot of keySlotsFor(chain)) {
            try {
                const stored = await getSecurePrivateKey(candidate, slot);
                if (stored) {
                    return { kind: 'privateKey', privateKey: stored.trim(), address: candidate, group, chainOnly };
                }
            } catch (e) {
                console.warn(`[chainSecrets] key lookup failed for ${slot}`, e);
            }
        }
    }

    // Door 1 / 3 - a mnemonic, keyed by the EVM address for multi-chain wallets
    // or by the chain address for a chain-only phrase import.
    const mnemonicAddresses = Array.from(new Set([
        group?.addresses?.EVM,
        ...candidates,
        group?.id,
    ].filter(Boolean) as string[]));

    for (const candidate of mnemonicAddresses) {
        try {
            const mnemonic = await getSecureMnemonic(candidate);
            if (mnemonic) {
                return {
                    kind: 'mnemonic',
                    mnemonic: mnemonic.trim(),
                    address: candidates[0],
                    group,
                    chainOnly,
                };
            }
        } catch (e) {
            console.warn('[chainSecrets] mnemonic lookup failed', e);
        }
    }

    throw new Error(
        `No recovery phrase or private key found for this ${chain} wallet. ` +
        'Re-import the wallet to restore signing.',
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-chain signers
// ─────────────────────────────────────────────────────────────────────────────

/** TRON private key (hex, no 0x) for `address`, from a key or a phrase. */
export async function getTronPrivateKey(address?: string): Promise<string> {
    const secret = await resolveChainSecret('TRON', address);
    return secret.kind === 'privateKey'
        ? normalizeHexKey(secret.privateKey)
        : tronPrivateKeyFromMnemonic(secret.mnemonic);
}

/** TON ed25519 keypair for `address`, from a key, a BIP39 phrase, or a TON phrase. */
export async function getTonKeyPair(address?: string): Promise<TonKeyPair> {
    const secret = await resolveChainSecret('TON', address);
    return secret.kind === 'privateKey'
        ? tonKeyPairFromSecretHex(secret.privateKey)
        // A TON-only wallet was imported with a native TON phrase; a multi-chain
        // wallet must stay on the BIP39 path or its other chains would disagree.
        : tonKeyPairFromMnemonic(secret.mnemonic, secret.chainOnly);
}

/** cosmjs offline signer bound to `prefix`, from a key or a phrase. */
export async function getCosmosSigner(
    prefix: string,
    address?: string,
    addressKey?: AddressKey,
): Promise<any> {
    const secret = await resolveChainSecret('COSMOS', address, addressKey);
    return secret.kind === 'privateKey'
        ? cosmosWalletFromPrivateKeyHex(secret.privateKey, prefix)
        : cosmosWalletFromMnemonic(secret.mnemonic, prefix);
}

/** True when this wallet can sign for `chain` at all (used to gate UI). */
export async function canSignChain(chain: ChainType, address?: string): Promise<boolean> {
    try {
        await resolveChainSecret(chain, address);
        return true;
    } catch {
        return false;
    }
}
