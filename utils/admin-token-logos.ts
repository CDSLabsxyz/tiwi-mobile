import { TIWI_API_BASE_URL } from '@/lib/mobile/api-client';

export interface AdminTokenLogoInput {
    address?: string | null;
    chainId?: number | string | null;
    logo?: string | null;
    logoURI?: string | null;
    icon?: string | null;
}

const ADMIN_TOKEN_LOGOS = new Map<string, string>();

let hasFetchedAdminLogos = false;
let fetchStartedAt = 0;
let fetchPromise: Promise<void> | null = null;

const RETRY_AFTER_MS = 60 * 1000;

function normalizeAddress(address?: string | null): string {
    return address?.trim().toLowerCase() || '';
}

function normalizeChainId(chainId?: number | string | null): number | null {
    if (chainId === null || chainId === undefined || chainId === '') return null;
    const parsed = Number(chainId);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function logoKeyFor(address?: string | null, chainId?: number | string | null): string | null {
    const normalizedChainId = normalizeChainId(chainId);
    const normalizedAddress = normalizeAddress(address);
    if (!normalizedChainId || !normalizedAddress) return null;
    return `${normalizedChainId}:${normalizedAddress}`;
}

function readLogo(input: AdminTokenLogoInput): string {
    const value =
        typeof input.logoURI === 'string' ? input.logoURI :
        typeof input.logo === 'string' ? input.logo :
        typeof input.icon === 'string' ? input.icon :
        '';
    return value.trim();
}

export function normalizeTokenLogoUrl(url?: string | null): string | undefined {
    const trimmed = (url || '').trim();
    if (!trimmed) return undefined;
    if (trimmed.includes('undefined') || trimmed.includes('null') || /\s/.test(trimmed)) return undefined;
    if (trimmed.startsWith('data:image/')) return trimmed;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) {
        return `${TIWI_API_BASE_URL.replace(/\/+$/, '')}${trimmed}`;
    }
    if (/^(uploads|assets|api)\//i.test(trimmed)) {
        return `${TIWI_API_BASE_URL.replace(/\/+$/, '')}/${trimmed}`;
    }
    return undefined;
}

function applyLogoMap(logos: Record<string, string> | null | undefined, replace: boolean): void {
    const nextEntries: Array<[string, string]> = [];
    for (const [rawKey, rawLogo] of Object.entries(logos || {})) {
        const [chainPart, addressPart] = String(rawKey).split(':');
        const key = logoKeyFor(addressPart, chainPart);
        const logo = normalizeTokenLogoUrl(rawLogo);
        if (!key || !logo) continue;
        nextEntries.push([key, logo]);
    }

    if (replace) ADMIN_TOKEN_LOGOS.clear();
    for (const [key, logo] of nextEntries) {
        ADMIN_TOKEN_LOGOS.set(key, logo);
    }
}

export function setAdminTokenLogos(logos: Record<string, string> | null | undefined): void {
    applyLogoMap(logos, true);
}

export function mergeAdminTokenLogos(logos: Record<string, string> | null | undefined): void {
    applyLogoMap(logos, false);
}

export function registerAdminTokenLogoOverride(input: AdminTokenLogoInput): void {
    const key = logoKeyFor(input.address, input.chainId);
    const logo = normalizeTokenLogoUrl(readLogo(input));
    if (!key || !logo) return;
    ADMIN_TOKEN_LOGOS.set(key, logo);
}

export function registerAdminTokenLogoOverrides(tokens: AdminTokenLogoInput[] | null | undefined): void {
    for (const token of tokens || []) {
        registerAdminTokenLogoOverride(token);
    }
}

export function getAdminTokenLogo(
    address?: string | null,
    chainId?: number | string | null,
): string | undefined {
    const key = logoKeyFor(address, chainId);
    return key ? ADMIN_TOKEN_LOGOS.get(key) : undefined;
}

export function resolveTokenLogo(input: AdminTokenLogoInput): string | undefined {
    const override = getAdminTokenLogo(input.address, input.chainId);
    if (override) return override;
    return normalizeTokenLogoUrl(readLogo(input));
}

export function prefetchAdminTokenLogoOverrides(): void {
    ensureAdminTokenLogoOverrides().catch(() => {});
}

export async function ensureAdminTokenLogoOverrides(signal?: AbortSignal): Promise<void> {
    if (hasFetchedAdminLogos) return;
    if (fetchPromise) return fetchPromise;
    if (fetchStartedAt && Date.now() - fetchStartedAt < RETRY_AFTER_MS) return;

    fetchStartedAt = Date.now();
    fetchPromise = (async () => {
        try {
            const url = `${TIWI_API_BASE_URL.replace(/\/+$/, '')}/api/v1/token-logos`;
            const res = await fetch(url, { signal });
            if (!res.ok) return;
            const data = await res.json().catch(() => ({}));
            setAdminTokenLogos(data?.logos || {});
            hasFetchedAdminLogos = true;
        } catch {
            // Non-fatal: every caller still falls through to its existing logo.
        } finally {
            fetchPromise = null;
        }
    })();

    return fetchPromise;
}
