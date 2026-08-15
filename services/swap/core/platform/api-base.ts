/**
 * Backend origin for the swap engine.
 *
 * The web executors call same-origin routes (`fetch('/api/v1/gasless-swap')`).
 * React Native's fetch has no origin, so a relative path just fails - every one
 * of those call sites is rewritten to go through `apiUrl()`.
 *
 * The base is the same one the rest of the app uses: `lite.tiwiprotocol.xyz`,
 * where tiwi-user-app (which serves every /api/v1 route, including the relayer)
 * is deployed.
 */

import { TIWI_API_BASE_URL } from '@/lib/mobile/api-client';

export { TIWI_API_BASE_URL };

/** Absolute URL for a backend path (`/api/v1/...`). */
export function apiUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    return `${TIWI_API_BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Origin only - for call sites that build their own path from it. */
export function apiOrigin(): string {
    return TIWI_API_BASE_URL.replace(/\/$/, '');
}
