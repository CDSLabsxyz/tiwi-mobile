// Supabase Edge Function: announcement-push-cron
//
// Polls the TIWI backend for live admin announcements, dedupes against
// announcement_push_log, and fans out any new ones to every active row
// in user_push_tokens via the Expo push relay.
//
// Schema: supabase/announcement_push_schema.sql
// Deploy: supabase/functions/announcement-push-cron/README.md

// @ts-ignore — resolved at runtime by Supabase Edge Runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// @ts-ignore
const TIWI_BACKEND_URL = Deno.env.get('TIWI_BACKEND_URL') ?? 'https://app.tiwiprotocol.xyz';

interface Announcement {
    id: string;
    title?: string;
    messageBody?: string;
    message?: string;
    priority?: 'critical' | 'important' | string;
    createdAt?: string;
}

// ─── TIWI BACKEND ─────────────────────────────────────────────────────────

async function fetchLiveAnnouncements(): Promise<Announcement[]> {
    try {
        const res = await fetch(
            `${TIWI_BACKEND_URL}/api/v1/notifications?status=live`,
            { headers: { 'Accept': 'application/json' } },
        );
        if (!res.ok) {
            console.warn('[announcement-push-cron] backend HTTP', res.status);
            return [];
        }
        const json = await res.json();
        const list: any[] = Array.isArray(json?.notifications) ? json.notifications : [];
        return list.filter(n => n && n.id);
    } catch (e) {
        console.warn('[announcement-push-cron] backend fetch failed:', e);
        return [];
    }
}

// ─── EXPO PUSH ────────────────────────────────────────────────────────────

async function sendExpoPush(messages: any[]): Promise<void> {
    const CHUNK = 100;
    for (let i = 0; i < messages.length; i += CHUNK) {
        const chunk = messages.slice(i, i + CHUNK);
        try {
            const res = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                },
                body: JSON.stringify(chunk),
            });
            if (!res.ok) {
                console.warn('[announcement-push-cron] Expo push HTTP', res.status, await res.text());
            }
        } catch (e) {
            console.warn('[announcement-push-cron] Expo push failed:', e);
        }
    }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────

// @ts-ignore — Deno.serve is the Supabase Edge Function entrypoint.
Deno.serve(async (_req: Request) => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Pull every live announcement from the backend.
    const announcements = await fetchLiveAnnouncements();
    if (announcements.length === 0) {
        return new Response(JSON.stringify({ ok: true, fetched: 0, pushed: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 2. Claim unseen announcement IDs atomically. `ignoreDuplicates: true`
    //    behaves like INSERT ... ON CONFLICT DO NOTHING, and the returned
    //    rows are ONLY the ones we just inserted. Any row already in the
    //    log was claimed by a previous run and we skip it.
    const rowsToInsert = announcements.map(a => ({
        announcement_id: a.id,
        title: a.title ?? null,
    }));

    const { data: claimed, error: claimErr } = await supabase
        .from('announcement_push_log')
        .upsert(rowsToInsert, {
            onConflict: 'announcement_id',
            ignoreDuplicates: true,
        })
        .select('announcement_id');

    if (claimErr) {
        return new Response(JSON.stringify({ error: claimErr.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const claimedIds = new Set((claimed ?? []).map((r: any) => r.announcement_id));
    const freshAnnouncements = announcements.filter(a => claimedIds.has(a.id));

    if (freshAnnouncements.length === 0) {
        return new Response(
            JSON.stringify({ ok: true, fetched: announcements.length, pushed: 0 }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
    }

    // 3. Load every active Expo push token.
    const { data: pushTokens, error: ptErr } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('is_active', true);

    if (ptErr) {
        return new Response(JSON.stringify({ error: ptErr.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const tokens = Array.from(
        new Set((pushTokens ?? []).map((r: any) => r.push_token).filter(Boolean)),
    );

    if (tokens.length === 0) {
        return new Response(
            JSON.stringify({
                ok: true,
                fetched: announcements.length,
                pushed: 0,
                note: 'no active push tokens',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
    }

    // 4. Build one Expo push message per (announcement × token).
    const messages: any[] = [];
    for (const a of freshAnnouncements) {
        const body = a.messageBody || a.message || '';
        const priority =
            a.priority === 'critical' || a.priority === 'important' ? 'high' : 'default';

        for (const t of tokens) {
            messages.push({
                to: t,
                sound: 'default',
                title: a.title || 'TIWI Protocol',
                body,
                data: {
                    type: 'announcement',
                    notificationId: a.id,
                    priority: a.priority ?? 'normal',
                },
                channelId: 'default',
                priority,
            });
        }
    }

    await sendExpoPush(messages);

    // 5. Record the actual token count on each log row so we have an audit
    //    trail of "how wide did this announcement reach".
    for (const a of freshAnnouncements) {
        await supabase
            .from('announcement_push_log')
            .update({ token_count: tokens.length })
            .eq('announcement_id', a.id);
    }

    return new Response(
        JSON.stringify({
            ok: true,
            fetched: announcements.length,
            fresh: freshAnnouncements.length,
            tokens: tokens.length,
            pushed: messages.length,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
});
