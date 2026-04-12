# announcement-push-cron

Supabase Edge Function that fans out admin announcements from the TIWI
backend as real Expo push notifications to every active device.

Runs every ~5 minutes. For each live announcement returned by
`GET /api/v1/notifications?status=live`:

1. Claim the `announcement_id` in `announcement_push_log` atomically
   (`ON CONFLICT DO NOTHING`). Overlapping cron runs can't double-push.
2. If the claim succeeded (i.e. the announcement is new), load every
   active row from `user_push_tokens`.
3. POST one message per device to `https://exp.host/--/api/v2/push/send`
   with `data.type = 'announcement'` so the existing tap handler in
   [app/_layout.tsx](../../../app/_layout.tsx) deep-links to `/notifications`.
4. Stamp the log row with the reached token count for the audit trail.

## One-time setup

### 1. Apply schema

Run [`supabase/announcement_push_schema.sql`](../../announcement_push_schema.sql)
in the Supabase SQL editor. This creates `announcement_push_log` with a
dedup-safe primary key on `announcement_id`.

`notifications_schema.sql` must already be applied (the function reads
`user_push_tokens` from it). `pg_cron` and `pg_net` should already be
enabled from the price-alert deploy.

### 2. Secrets

`TIWI_BACKEND_URL` was already set during the price-alert deploy — the
same secret is reused here, no action needed. To override:

```bash
supabase secrets set TIWI_BACKEND_URL=https://app.tiwiprotocol.xyz
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 3. Deploy

```bash
supabase functions deploy announcement-push-cron --no-verify-jwt
```

### 4. Schedule the cron

In the SQL editor, replace the two placeholders and run:

```sql
SELECT cron.schedule(
    'announcement-push-cron',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/announcement-push-cron',
        headers := jsonb_build_object(
            'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    ) AS request_id;
    $$
);
```

To unschedule:

```sql
SELECT cron.unschedule('announcement-push-cron');
```

## Manual smoke test

```bash
curl -i -X POST \
    "https://<PROJECT_REF>.supabase.co/functions/v1/announcement-push-cron" \
    -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
    -H "Content-Type: application/json" \
    -d '{}'
```

Expected response (first run):

```json
{
  "ok": true,
  "fetched": 1,
  "fresh": 1,
  "tokens": 12,
  "pushed": 12
}
```

Second run (nothing new):

```json
{"ok":true,"fetched":1,"pushed":0}
```

## First-deploy gotcha

The first time this cron runs, every currently-live announcement gets
pushed at once — even ones that are days old — because none of them are
in `announcement_push_log` yet. That's usually not what you want.

**To backfill silently** (mark existing announcements as "already
pushed" without actually pushing them), run this in the SQL editor
**before scheduling the cron**:

```sql
-- Replace the JSON with the ids you don't want to re-push. You can get
-- them from the backend endpoint directly:
--   curl https://app.tiwiprotocol.xyz/api/v1/notifications?status=live
INSERT INTO announcement_push_log (announcement_id, title, token_count)
SELECT id, title, 0
FROM jsonb_to_recordset(
    '[{"id":"abc123","title":"Download and Update!"}]'::jsonb
) AS t(id text, title text)
ON CONFLICT (announcement_id) DO NOTHING;
```

After that, only brand-new announcements will trigger pushes.

## Tap handler

When a user taps the push, [app/_layout.tsx:109-111](../../../app/_layout.tsx)
already deep-links `data.type === 'announcement'` payloads to
`/notifications`, so nothing to wire on the client side.

## Why poll and not webhook?

The admin panel lives in a separate repo (`tiwi-super-app`) and writes
announcements to the TIWI backend's own `notifications` table — not into
Supabase. A webhook would require changes there. Polling from an Edge
Function keeps the fan-out logic entirely inside the mobile/Supabase
stack, at the cost of a ~5-minute worst-case delay between publishing
and delivery. Acceptable for announcements.
