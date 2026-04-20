/**
 * Country ISO-2 code → primary official language code mapping.
 *
 * Used by the frontend to auto-switch TIWI's interface language based on the
 * visitor's detected IP location. Covers all UN-recognized countries; the
 * language code matches our LANGUAGES constant list (ISO 639-1 primarily,
 * with a few BCP-47 variants like `zh-Hans`, `pt-BR`, `es-MX`).
 *
 * Source: each country's official primary language. When multiple official
 * languages exist, we pick the one most commonly spoken online.
 */

export const COUNTRY_TO_LANGUAGE: Record<string, string> = {
    // ── Anglosphere ──
    US: 'en', GB: 'en', AU: 'en', NZ: 'en', CA: 'en', IE: 'en', ZA: 'en',
    NG: 'en', KE: 'en', UG: 'en', TZ: 'en', GH: 'en', ZM: 'en', ZW: 'en',
    BW: 'en', MT: 'en', SG: 'en', PH: 'en', IN: 'en', PK: 'en', BD: 'en',
    LK: 'en', MY: 'en', JM: 'en', TT: 'en', BS: 'en', BB: 'en',

    // ── Spanish ──
    ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', VE: 'es', CL: 'es',
    EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
    SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', PR: 'es', GQ: 'es',

    // ── Portuguese ──
    PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt', TL: 'pt',

    // ── French ──
    FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', CH: 'fr', SN: 'fr', CI: 'fr',
    CM: 'fr', BF: 'fr', ML: 'fr', NE: 'fr', GN: 'fr', BJ: 'fr', TG: 'fr',
    MG: 'fr', CD: 'fr', CG: 'fr', GA: 'fr', TD: 'fr', DJ: 'fr', KM: 'fr',
    HT: 'fr', RW: 'fr', BI: 'fr', CF: 'fr', VU: 'fr',

    // ── German ──
    DE: 'de', AT: 'de', LI: 'de',

    // ── Chinese ──
    CN: 'zh-Hans', HK: 'zh-Hant', TW: 'zh-Hant', MO: 'zh-Hant',

    // ── Japanese / Korean ──
    JP: 'ja',
    KR: 'ko', KP: 'ko',

    // ── Arabic ──
    SA: 'ar', EG: 'ar', AE: 'ar', QA: 'ar', KW: 'ar', BH: 'ar', OM: 'ar',
    JO: 'ar', LB: 'ar', SY: 'ar', IQ: 'ar', PS: 'ar', YE: 'ar', LY: 'ar',
    DZ: 'ar', TN: 'ar', MA: 'ar', SD: 'ar', SO: 'ar', MR: 'ar', ER: 'ar',

    // ── Slavic ──
    RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru', TJ: 'ru',
    UA: 'uk',
    PL: 'pl',
    CZ: 'cs', SK: 'sk',
    BG: 'bg',
    HR: 'hr', BA: 'bs', RS: 'sr', ME: 'sr', MK: 'mk', SI: 'sl',

    // ── Nordic ──
    SE: 'sv', NO: 'no', DK: 'da', FI: 'fi', IS: 'is',

    // ── Other Europe ──
    IT: 'it', SM: 'it', VA: 'it',
    NL: 'nl', AW: 'nl', SR: 'nl',
    HU: 'hu', RO: 'ro', MD: 'ro', GR: 'el', CY: 'el',
    AL: 'sq', EE: 'et', LV: 'lv', LT: 'lt',
    TR: 'tr',

    // ── South Asia ──
    NP: 'ne', BT: 'dz',
    AF: 'fa', IR: 'fa',

    // ── South-East Asia ──
    TH: 'th', VN: 'vi', ID: 'id', LA: 'lo', KH: 'km', MM: 'my',

    // ── Central Asia / Caucasus ──
    UZ: 'uz', TM: 'tk', AZ: 'az', AM: 'hy', GE: 'ka',

    // ── Israel ──
    IL: 'he',

    // ── Fallback Africa (Swahili / other) ──
    ET: 'am', MW: 'ny', LS: 'st', SZ: 'ss',

    // ── Oceania ──
    FJ: 'en', PG: 'en', WS: 'sm', TO: 'to',
};

/**
 * Resolve a language code from an ISO-2 country code.
 * Falls back to `'en'` for any unknown country.
 */
export function countryToLanguage(countryCode?: string | null): string {
    if (!countryCode) return 'en';
    return COUNTRY_TO_LANGUAGE[countryCode.toUpperCase()] || 'en';
}

/**
 * Country ISO-2 → display name (short form used for FAB tooltip).
 * Only the common ones; IP geo APIs return the full name separately anyway.
 */
export const COUNTRY_NAMES: Record<string, string> = {
    US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia',
    NG: 'Nigeria', IN: 'India', CN: 'China', JP: 'Japan', KR: 'Korea',
    BR: 'Brazil', MX: 'Mexico', ES: 'Spain', FR: 'France', DE: 'Germany',
    IT: 'Italy', RU: 'Russia', TR: 'Turkey', AE: 'United Arab Emirates',
    SA: 'Saudi Arabia', EG: 'Egypt', ZA: 'South Africa', KE: 'Kenya',
    GH: 'Ghana', PK: 'Pakistan', BD: 'Bangladesh', ID: 'Indonesia',
    PH: 'Philippines', TH: 'Thailand', VN: 'Vietnam', MY: 'Malaysia',
    SG: 'Singapore', HK: 'Hong Kong', TW: 'Taiwan', NL: 'Netherlands',
    SE: 'Sweden', NO: 'Norway', FI: 'Finland', DK: 'Denmark',
    PL: 'Poland', UA: 'Ukraine', AR: 'Argentina', CO: 'Colombia',
    CL: 'Chile', PE: 'Peru', VE: 'Venezuela',
};
