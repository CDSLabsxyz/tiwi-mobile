# price-alert-cron

Supabase Edge Function that fires price-movement push notifications to
TIWI wallet users — including when the app is fully closed.

Runs every ~5 minutes. For every row in `user_watched_tokens`, it:

1. Fetches the current USD price with a 3-tier fallback chain:
   **TIWI backend → DexScreener → CoinGecko**.
2. Compares the fresh price against the stored `baseline_price` to
   produce a delta percentage.
3. Honors each user's row in `price_alert_settings`
   (`enabled` / `threshold_percent` / `cooldown_minutes`).
4. Sends matching Expo push messages via `https://exp.host/--/api/v2/push/send`.
5. Resets the baseline and `last_alerted_at` on alerted rows so each
   alert represents a fresh move (same Trust-Wallet-style behavior the
   client uses when the app is open).

## One-time setup

### 1. Enable extensions

In the Supabase SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. Apply schema

Run [`supabase/price_alerts_schema.sql`](../../price_alerts_schema.sql)
in the SQL editor. This creates `price_alert_settings` and
`user_watched_tokens` with the RLS policies the mobile app needs.

Also make sure [`supabase/notifications_schema.sql`](../../notifications_schema.sql)
has already been applied — this function reads `user_push_tokens` from it.

### 3. Function secrets

```bash
supabase secrets set TIWI_BACKEND_URL=https://app.tiwiprotocol.xyz
supabase secrets set COINGECKO_KEY=<optional demo key>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically
by the Edge Runtime.

### 4. Deploy

```bash
supabase functions deploy price-alert-cron --no-verify-jwt
```

`--no-verify-jwt` is required because pg_cron calls the function with the
service-role key, not a user JWT.

### 5. Schedule the cron

In the SQL editor, replace the two placeholders below and run:

```sql
SELECT cron.schedule(
    'price-alert-cron',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/price-alert-cron',
        headers := jsonb_build_object(
            'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    ) AS request_id;
    $$
);
```

To stop it later:

```sql
SELECT cron.unschedule('price-alert-cron');
```

## Manual test

Once deployed, you can invoke the function manually:

```bash
curl -i -X POST \
    "https://<PROJECT_REF>.supabase.co/functions/v1/price-alert-cron" \
    -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
    -H "Content-Type: application/json" \
    -d '{}'
```

It responds with a small JSON summary:

```json
{
  "ok": true,
  "checked": 42,
  "uniqueTokens": 17,
  "priced": 17,
  "alerts": 3,
  "baselinesSeeded": 0
}
```

## How the client feeds it

- [`services/notificationService.ts`](../../../services/notificationService.ts) →
  `syncWatchedTokens()` upserts a row into `user_watched_tokens` every
  time wallet balances are refreshed. Stale rows (tokens the user no
  longer holds) are deleted in the same call.
- [`app/settings/notifications/price-alerts.tsx`](../../../app/settings/notifications/price-alerts.tsx) →
  writes `price_alert_settings` on every change and mirrors the values
  to AsyncStorage so the in-app `checkPriceAlerts` path picks them up
  immediately.

## Fallback behavior

A token resolves its price in this order:

| Priority | Provider    | Needs key | Notes |
|---------:|-------------|:---------:|-------|
| 1        | TIWI backend (`/api/v1/token-info/{chainId}/{address}`) | No  | Handles native tokens via the `0xeee…eee` sentinel. |
| 2        | DexScreener (`/latest/dex/tokens/{address}`)            | No  | ERC20-only. Picks the highest-USD-liquidity pair. |
| 3        | CoinGecko (`/simple/token_price` + `/simple/price`)    | Optional demo key via `COINGECKO_KEY` | Falls back to native `simple/price` when the row is a gas token. |

If all three return nothing, the token is silently skipped for this run
and retried on the next tick.
