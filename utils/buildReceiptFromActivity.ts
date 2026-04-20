import type { TransactionReceipt } from '@/components/sections/Send/TransactionReceiptCard';
import type { UnifiedActivity } from '@/hooks/useUnifiedActivities';

type ChainLike = { id: number | string; name: string };

/**
 * Build a `TransactionReceipt` from a past `UnifiedActivity` so the existing
 * receipt card can be shown for historical Sent transactions (not just
 * immediately after a send). Returns null if we don't have enough data
 * to render something useful (no tx hash).
 */
export function buildReceiptFromActivity(
    activity: UnifiedActivity,
    walletAddress: string | null | undefined,
    chains: ChainLike[] | undefined,
): TransactionReceipt | null {
    if (!activity.hash) return null;

    const meta: any = activity.metadata || {};
    const recipient: string =
        meta.recipientAddress ||
        meta.recipient_address ||
        meta.to ||
        meta.to_address ||
        meta.toAddress ||
        '';

    // Local rows always carry the wallet that sent them; global rows don't,
    // so fall back to the active wallet address (which is correct for any
    // "Sent" row by definition).
    const sender: string =
        meta.senderAddress ||
        meta.sender_address ||
        meta.from ||
        meta.from_address ||
        walletAddress ||
        '';

    const chain = chains?.find((c) => Number(c.id) === Number(activity.chainId));
    const network = chain?.name || (activity.chainId ? `Chain ${activity.chainId}` : 'Unknown');

    // Amount fields come in a few shapes ("1000000", "1000000 TWC",
    // "1000000 TWC TWC"). Pull out the leading numeric portion.
    const numericMatch = String(activity.amount ?? '').match(/^\s*([0-9]+(?:\.[0-9]+)?)/);
    const amount = numericMatch ? numericMatch[1] : '0';

    return {
        txHash: activity.hash,
        amount,
        symbol: activity.tokenSymbol || '',
        network,
        sender,
        recipient,
        recipientCount: 1,
        completedAt: new Date(activity.timestamp || Date.now()).toISOString(),
        isMulti: false,
    };
}
