# Staking — backend integration

The backend at `https://app.tiwiprotocol.xyz` exposes `/api/v1/mobile/staking/*`
with everything this app needs: DB + on-chain enriched reads, unsigned tx
calldata, and post-confirmation bookkeeping. **No contract ABIs are needed on
the mobile side** — the server builds calldata.

The typed client lives in [`lib/mobile/api-client.ts`](lib/mobile/api-client.ts)
under `api.staking.*`. New methods:

| Method | What it does |
| --- | --- |
| `poolsMobile({ status, chainId, enrich })` | list pools, enriched with on-chain TVL/endTime/isExpired |
| `poolMobile(id)` | single pool with on-chain state |
| `positionsMobile({ userWallet, filter })` | wallet's stakes + live pending / per-second / effectiveStatus |
| `buildTx({ action, ... })` | returns unsigned `steps[]` with `to`, `data`, `value`, `chainId` |
| `record({ action, ..., txHash })` | persists a confirmed tx into `user_stakes` |

---

## Read flow

```ts
import { api, MobilePool, MobilePosition } from '@/lib/mobile/api-client';

// Pool list (Earn tab)
const { pools } = await api.staking.poolsMobile({ status: 'active' });
// → pools[i].onChain.totalStaked, .endTime, .rewardPerSecond
// → pools[i].isExpired (use instead of computing client-side)

// Position list (Active Positions / My Stakes)
const { positions } = await api.staking.positionsMobile({
  userWallet: activeAddress,
  filter: 'active',   // 'active' | 'history' | 'all'
});
// → positions[i].effectiveStatus ∈ 'active' | 'stopped' | 'completed' | 'withdrawn'
// → positions[i].onChain.pendingReward   (string, human units)
// → positions[i].onChain.userRewardPerSecond (use 0 when isPoolExpired)
```

`effectiveStatus`:
- **`active`** — still earning; green badge.
- **`stopped`** — pool expired but the user still holds principal; yellow badge + "please claim + unstake" banner.
- **`completed`** — DB-marked completed.
- **`withdrawn`** — fully exited; gray badge.

---

## Write flow — unsigned steps → existing signer → record

For every action, the API returns 1–2 `MobileTxStep` objects:

```ts
interface MobileTxStep {
  label: string;
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;    // wei as decimal string
  chainId: number;
}
```

`MobileTxStep` maps 1:1 to the existing `TransactionRequest` shape in
[`services/signer/SignerTypes.ts`](services/signer/SignerTypes.ts). Send each
step in order, wait for confirmation, then move on.

### Stake (external wallet via wagmi)

```ts
import { api } from '@/lib/mobile/api-client';
import { sendTransaction, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiAdapter } from '@/config/AppKitConfig';

const wagmiConfig = wagmiAdapter.wagmiConfig;

async function stakeExternal(
  poolId: string,
  userWallet: `0x${string}`,
  amount: string, // human units
) {
  const { steps } = await api.staking.buildTx({
    action: 'stake', poolId, userWallet, amount,
  });

  let lastHash: `0x${string}` = '0x';
  for (const step of steps) {
    const hash = await sendTransaction(wagmiConfig, {
      to: step.to,
      data: step.data,
      value: BigInt(step.value),
      chainId: step.chainId,
    });
    await waitForTransactionReceipt(wagmiConfig, { hash, chainId: step.chainId });
    lastHash = hash;
  }

  // Only the final step is the deposit — record it.
  await api.staking.record({
    action: 'stake',
    userWallet,
    poolId,
    amount: Number(amount),
    txHash: lastHash,
  });
}
```

### Stake (local wallet via `SignerController`)

```ts
import { api } from '@/lib/mobile/api-client';
import { signerController } from '@/services/signer/SignerController';

async function stakeLocal(
  poolId: string,
  userWallet: string,
  amount: string,
) {
  const { steps } = await api.staking.buildTx({
    action: 'stake', poolId, userWallet, amount,
  });

  let lastHash = '';
  for (const step of steps) {
    const result = await signerController.executeTransaction(
      {
        chainFamily: 'evm',
        to: step.to,
        data: step.data,
        value: step.value,
        chainId: step.chainId,
      },
      userWallet,
    );
    if (result.status !== 'success') throw new Error(result.error || 'tx failed');
    lastHash = result.hash;
  }

  await api.staking.record({
    action: 'stake',
    userWallet,
    poolId,
    amount: Number(amount),
    txHash: lastHash,
  });
}
```

### Claim

```ts
const { steps } = await api.staking.buildTx({
  action: 'claim',
  poolId: position.poolDbId,
  userWallet,
  percentage: 100, // or 25 / 50 / 75
});

// ...sign the single step, get hash...

await api.staking.record({
  action: 'claim',
  stakeId: position.id,
  amount: Number(position.onChain?.pendingReward ?? 0),
  txHash,
});
```

### Unstake (max / full exit)

```ts
const { steps } = await api.staking.buildTx({
  action: 'unstake',
  poolId: position.poolDbId,
  userWallet,
  amount: position.onChain?.stakedAmount ?? position.stakedAmount,
  harvestFirst: true,   // returns [claim, withdraw]
});

// Step 0 = claim, step 1 = withdraw. Sign & wait each in order.
// Capture the pending amount snapshot BEFORE the claim so we can report it:
const harvestedRewards = Number(position.onChain?.pendingReward ?? 0);

// ...after both confirm...
await api.staking.record({
  action: 'unstake',
  stakeId: position.id,
  txHash: withdrawHash,
  isFullExit: true,
  harvestedRewards,   // recorded into rewards_earned
});
```

### Partial unstake

```ts
const { steps } = await api.staking.buildTx({
  action: 'unstake',
  poolId: position.poolDbId,
  userWallet,
  amount: '50',        // partial
  harvestFirst: false, // single step: just withdraw
});
// ...sign the step...
await api.staking.record({
  action: 'unstake',
  stakeId: position.id,
  txHash,
  isFullExit: false,
});
```

---

## Chain switching

Every step carries its own `chainId`. Switch before submitting:

```ts
import { useSwitchChain } from 'wagmi';
const { switchChainAsync } = useSwitchChain();

if (step.chainId !== currentChainId) {
  await switchChainAsync({ chainId: step.chainId });
}
```

Local wallets: `signerController.executeTransaction` honours the `chainId` in
the `TransactionRequest`, so the engine routes to the right chain itself.

---

## Where to plug in

Suggested wiring into the existing codebase (non-destructive — both paths can
coexist while you migrate):

| File | Change |
| --- | --- |
| [`services/stakingService.ts`](services/stakingService.ts) | Replace the pool/position fetchers with `api.staking.poolsMobile()` / `.positionsMobile()`. Drop the on-chain enrichment code — the server already did it. |
| [`hooks/useStakingPool.ts`](hooks/useStakingPool.ts) | Replace the deposit/claim/unstake paths that call contract ABIs directly with `api.staking.buildTx()` + the signer loop above. Remove the ABI imports once migrated. |
| [`store/stakingStore.ts`](store/stakingStore.ts) | Store `MobilePool[]` / `MobilePosition[]` directly — they already carry `effectiveStatus`, `isPoolExpired`, and `onChain.*` in render-ready string form. |
| Earn screens under [`app/earn/`](app/earn/) | When rendering a `stopped` position, show a yellow banner: "Rewards have stopped — please claim and unstake." |

---

## Refresh cadence

`positionsMobile` does RPC reads on every call. Debounce to ~15 s when polling
to stay inside RPC rate limits. After any write, call `positionsMobile` once
immediately to refresh the UI — the record endpoint has already committed the
DB state by the time it resolves.

---

## CORS / env

The backend allowlists `https://app.tiwiprotocol.xyz`, `https://tiwiprotocol.xyz`,
and localhost origins. In React Native `fetch` runs native and isn't subject
to CORS — no action needed. For Expo web dev, add your origin via
`MOBILE_API_ALLOWED_ORIGINS=...` on the server if needed.

`EXPO_PUBLIC_TIWI_BACKEND_URL` in `.env` already points at
`https://app.tiwiprotocol.xyz` and `api` in `api-client.ts` picks it up.
