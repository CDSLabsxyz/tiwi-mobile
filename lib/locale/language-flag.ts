/**
 * Language code → country flag emoji.
 *
 * Used to render a country flag next to the language label in the language
 * switcher and in the Floating Action Button (instead of the raw ISO code).
 *
 * Returns a Unicode regional indicator pair (🇺🇸, 🇬🇧, 🇨🇳, etc.) which all
 * modern browsers render natively, so we avoid bundling flag images.
 *
 * For ambiguous languages (English = US or UK?) we pick the most commonly
 * associated country for global crypto-product users.
 */

/**
 * Convert a 2-letter ISO country code to the corresponding flag emoji.
 * Works by offsetting each letter into the Regional Indicator Symbol block.
 */
export function countryCodeToFlag(countryCode?: string | null): string {
    if (!countryCode) return '🌐';
    const upper = countryCode.toUpperCase();
    if (!/^[A-Z]{2}$/.test(upper)) return '🌐';
    const A = 0x1f1e6; // Regional Indicator Symbol Letter A
    return String.fromCodePoint(A + (upper.charCodeAt(0) - 65)) +
           String.fromCodePoint(A + (upper.charCodeAt(1) - 65));
}

/**
 * Default country code for each supported language. When a language is
 * picked via the switcher, this mapping decides which flag to show.
 */
export const LANGUAGE_TO_COUNTRY: Record<string, string> = {
    // ── Major world languages ──
    en: 'GB',           // English → UK (as requested: UK flag for English)
    'en-US': 'US',
    'en-GB': 'GB',
    es: 'ES', 'es-MX': 'MX', 'es-AR': 'AR',
    pt: 'PT', 'pt-BR': 'BR',
    fr: 'FR',
    de: 'DE',
    it: 'IT',
    nl: 'NL',
    ru: 'RU',
    uk: 'UA',
    pl: 'PL',
    cs: 'CZ',
    sk: 'SK',
    hu: 'HU',
    ro: 'RO',
    bg: 'BG',
    hr: 'HR',
    sr: 'RS',
    sl: 'SI',
    bs: 'BA',
    mk: 'MK',
    sq: 'AL',
    tr: 'TR',
    el: 'GR',
    sv: 'SE',
    no: 'NO',
    da: 'DK',
    fi: 'FI',
    is: 'IS',
    et: 'EE',
    lv: 'LV',
    lt: 'LT',

    // ── Asian ──
    zh: 'CN',
    'zh-Hans': 'CN',
    'zh-Hant': 'TW',
    yue: 'HK',          // Cantonese → Hong Kong
    ja: 'JP',
    ko: 'KR',
    vi: 'VN',
    th: 'TH',
    id: 'ID',
    ms: 'MY',
    tl: 'PH',
    my: 'MM',
    km: 'KH',
    lo: 'LA',
    hi: 'IN',
    bn: 'BD',
    ur: 'PK',
    ta: 'IN',
    te: 'IN',
    ml: 'IN',
    kn: 'IN',
    gu: 'IN',
    mr: 'IN',
    pa: 'IN',
    ne: 'NP',
    si: 'LK',
    dz: 'BT',

    // ── Middle East ──
    ar: 'SA',
    fa: 'IR',
    he: 'IL',
    ku: 'IQ',

    // ── African ──
    sw: 'KE',
    am: 'ET',
    ha: 'NG',
    yo: 'NG',
    ig: 'NG',
    zu: 'ZA',
    xh: 'ZA',
    af: 'ZA',
    so: 'SO',
    rw: 'RW',
    ny: 'MW',
    st: 'LS',
    ss: 'SZ',
    sm: 'WS',

    // ── Caucasus / Central Asia ──
    az: 'AZ',
    hy: 'AM',
    ka: 'GE',
    uz: 'UZ',
    tk: 'TM',
    kk: 'KZ',
    ky: 'KG',
    mn: 'MN',
    tg: 'TJ',

    // ── Additional coverage for the full 200+ LANGUAGES list ──
    aa: 'DJ',           // Afar → Djibouti
    ab: 'GE',           // Abkhazian → Georgia (Abkhazia autonomous region)
    ace: 'ID',          // Acehnese
    ach: 'UG',          // Acholi
    ak: 'GH',           // Akan
    aln: 'UG',          // Alur
    as: 'IN',           // Assamese
    av: 'RU',           // Avar (Dagestan)
    ay: 'BO',           // Aymara (Bolivia)
    ba: 'RU',           // Bashkir
    bal: 'PK',          // Balochi
    ban: 'ID',          // Balinese
    bax: 'ML',          // Bambara (Mali)
    bci: 'CI',          // Baoulé (Ivory Coast)
    be: 'BY',           // Belarusian
    bem: 'ZM',          // Bemba (Zambia)
    ber: 'MA',          // Berber (Morocco)
    bew: 'ID',          // Betawi
    bh: 'IN',           // Bihari
    bho: 'IN',          // Bhojpuri
    bcl: 'PH',          // Bicol
    br: 'FR',           // Breton
    bua: 'RU',          // Buryat
    ca: 'ES',           // Catalan (Catalonia)
    ce: 'RU',           // Chechen
    ceb: 'PH',          // Cebuano
    chr: 'US',          // Cherokee
    ch: 'GU',           // Chamorro (Guam)
    co: 'FR',           // Corsican
    dv: 'MV',           // Dhivehi (Maldives)
    ee: 'GH',           // Ewe (Ghana / Togo)
    fil: 'PH',          // Filipino
    fy: 'NL',           // Western Frisian
    ff: 'SN',           // Fulah
    gd: 'GB',           // Scottish Gaelic
    gl: 'ES',           // Galician
    lg: 'UG',           // Ganda
    gn: 'PY',           // Guarani (Paraguay)
    ht: 'HT',           // Haitian Creole
    haw: 'US',          // Hawaiian
    hz: 'NA',           // Herero (Namibia)
    ho: 'PG',           // Hiri Motu (Papua New Guinea)
    iu: 'CA',           // Inuktitut
    ik: 'US',           // Inupiaq (Alaska)
    ga: 'IE',           // Irish
    jv: 'ID',           // Javanese
    kl: 'GL',           // Kalaallisut (Greenland)
    kr: 'NG',           // Kanuri
    ks: 'IN',           // Kashmiri
    kv: 'RU',           // Komi
    kg: 'CD',           // Kongo
    kj: 'NA',           // Kuanyama (Namibia)
    la: 'VA',           // Latin (Vatican)
    li: 'NL',           // Limburgish
    ln: 'CD',           // Lingala
    lu: 'CD',           // Luba-Katanga
    lb: 'LU',           // Luxembourgish
    mg: 'MG',           // Malagasy
    mt: 'MT',           // Maltese
    gv: 'IM',           // Manx (Isle of Man)
    mi: 'NZ',           // Māori
    mh: 'MH',           // Marshallese
    na: 'NR',           // Nauruan
    nv: 'US',           // Navajo
    ng: 'NA',           // Ndonga (Namibia)
    nd: 'ZW',           // Northern Ndebele (Zimbabwe)
    se: 'NO',           // Northern Sami
    nb: 'NO',           // Norwegian Bokmål
    nn: 'NO',           // Norwegian Nynorsk
    ii: 'CN',           // Nuosu
    oc: 'FR',           // Occitan
    oj: 'CA',           // Ojibwa
    or: 'IN',           // Odia
    om: 'ET',           // Oromo
    os: 'GE',           // Ossetian (South Ossetia)
    pi: 'IN',           // Pali (historical)
    ps: 'AF',           // Pashto
    qu: 'PE',           // Quechua
    rm: 'CH',           // Romansh
    rn: 'BI',           // Kirundi (Burundi)
    sg: 'CF',           // Sango (Central African Republic)
    sa: 'IN',           // Sanskrit
    sc: 'IT',           // Sardinian
    sn: 'ZW',           // Shona (Zimbabwe)
    sd: 'PK',           // Sindhi
    su: 'ID',           // Sundanese
    ty: 'PF',           // Tahitian (French Polynesia)
    tt: 'RU',           // Tatar
    bo: 'CN',           // Tibetan
    ti: 'ER',           // Tigrinya (Eritrea)
    to: 'TO',           // Tongan
    ts: 'ZA',           // Tsonga
    tn: 'BW',           // Tswana (Botswana)
    tw: 'GH',           // Twi
    ug: 'CN',           // Uyghur (Xinjiang)
    ve: 'ZA',           // Venda
    wa: 'BE',           // Walloon
    cy: 'GB',           // Welsh
    wo: 'SN',           // Wolof (Senegal)
    yi: 'IL',           // Yiddish
    za: 'CN',           // Zhuang
    // Constructed / auxiliary languages keep the 🌐 fallback: eo, io, ia, ie, vo.
};

/**
 * Get the flag emoji for a language code.
 * Returns a world globe emoji for unknown languages.
 */
export function languageToFlag(languageCode?: string | null): string {
    if (!languageCode) return '🌐';
    const country = LANGUAGE_TO_COUNTRY[languageCode] || LANGUAGE_TO_COUNTRY[languageCode.split('-')[0]];
    return country ? countryCodeToFlag(country) : '🌐';
}

/**
 * Get the ISO country code for a language (used when we want an `<Image>`
 * flag instead of the Unicode emoji).
 */
export function languageToCountry(languageCode?: string | null): string {
    if (!languageCode) return 'GB';
    return LANGUAGE_TO_COUNTRY[languageCode] || LANGUAGE_TO_COUNTRY[languageCode.split('-')[0]] || 'GB';
}
