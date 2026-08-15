/**
 * Solana native vs wrapped SOL.
 *
 * `So111…112` is the WRAPPED-SOL mint. Native SOL - the lamport balance every
 * other wallet simply calls "SOL" - belongs at the System Program address, and
 * that is what the routers and swap executors already treat as native SOL.
 *
 * Older backend builds report a lamport balance under the wrapped mint, which
 * makes a plain SOL holding render as "WSOL" and lets it collide with a real
 * WSOL token account on any `(chain, address)` key. This normalises balance
 * rows on the device so the label is right no matter which backend answers.
 */

export const SOLANA_CHAIN_IDS = [7565164, 1399811149];
export const SOLANA_NATIVE_ADDRESS = '11111111111111111111111111111111';
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

export function isSolanaChainId(chainId: unknown): boolean {
    return SOLANA_CHAIN_IDS.includes(Number(chainId));
}

/**
 * Rewrite a balance row that carries native SOL under the wrapped mint.
 *
 * The symbol is the discriminator, and it is the one the backend itself sets:
 * its Solana reader labels the lamport balance `SOL` and a wrapped token
 * account `WSOL`. So a row at the wrapped mint that does NOT say WSOL is a
 * native balance wearing the wrong address - move it to the native one.
 */
export function normalizeSolanaBalanceRow<T extends { chainId?: unknown; address?: string; symbol?: string; name?: string }>(
    row: T,
): T {
    if (!row || !isSolanaChainId(row.chainId)) return row;
    if ((row.address || '') !== WSOL_MINT) return row;
    if ((row.symbol || '').toUpperCase() === 'WSOL') return row; // genuinely wrapped

    return {
        ...row,
        address: SOLANA_NATIVE_ADDRESS,
        symbol: 'SOL',
        name: row.name && row.name.toLowerCase() !== 'wrapped sol' ? row.name : 'Solana',
    };
}
