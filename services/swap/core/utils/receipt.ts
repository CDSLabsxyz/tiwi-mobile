/** Resilient receipt polling across fallback RPC endpoints. */

import type { Hash, PublicClient, TransactionReceipt } from 'viem';

export interface WaitForReceiptOptions {
  timeout?: number;
  pollInterval?: number;
}

export async function waitForReceiptResilient(
  client: PublicClient,
  hash: Hash,
  { timeout = 120_000, pollInterval }: WaitForReceiptOptions = {},
): Promise<TransactionReceipt | null> {
  const interval = pollInterval ?? client.pollingInterval ?? 1_000;
  const deadline = Date.now() + timeout;

  while (true) {
    try {
      return await client.getTransactionReceipt({ hash });
    } catch {
      // A receipt may still be pending, or this RPC endpoint may be unhealthy.
    }

    if (Date.now() + interval >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
