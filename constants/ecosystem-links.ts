/**
 * TIWI ecosystem apps that have no native screen yet — they open in the
 * in-app browser. Shared by the home quick-actions rows and the More page so
 * the two can't drift apart.
 */
export const ECOSYSTEM_LINKS = {
    campaigns: 'https://campaign.tiwiprotocol.xyz/',
    tiwiflix: 'https://app.tiwiflix.xyz',
    tiwilock: 'https://lock.tiwiprotocol.xyz',
} as const;

/** Route that opens `url` in the in-app browser. */
export const browserRoute = (url: string) => `/browser?url=${encodeURIComponent(url)}`;
