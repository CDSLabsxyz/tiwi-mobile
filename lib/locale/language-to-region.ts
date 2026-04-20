/**
 * Language to region/currency/format mapping.
 * Auto-detects region, currency, and date format from language code.
 * Uses ISO 639 language codes to ISO 3166 country codes mapping.
 */

export type DateFormatType = "MM/DD/YY" | "DD/MM/YY" | "YYYY-MM-DD";

export interface LanguageLocaleInfo {
  languageCode: string;
  regionCode: string;
  currency: string;
  dateFormat: DateFormatType;
}

/**
 * Maps language codes to their primary region, currency, and date format.
 * Based on most common usage of each language.
 */
const LANGUAGE_TO_LOCALE: Record<string, Omit<LanguageLocaleInfo, "languageCode">> = {
  // English variants
  en: { regionCode: "US", currency: "USD", dateFormat: "MM/DD/YY" },
  // Spanish
  es: { regionCode: "ES", currency: "EUR", dateFormat: "DD/MM/YY" },
  // French
  fr: { regionCode: "FR", currency: "EUR", dateFormat: "DD/MM/YY" },
  // German
  de: { regionCode: "DE", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Portuguese
  pt: { regionCode: "BR", currency: "BRL", dateFormat: "DD/MM/YY" },
  // Chinese
  zh: { regionCode: "CN", currency: "CNY", dateFormat: "YYYY-MM-DD" },
  "zh-Hans": { regionCode: "CN", currency: "CNY", dateFormat: "YYYY-MM-DD" },
  "zh-Hant": { regionCode: "TW", currency: "TWD", dateFormat: "YYYY-MM-DD" },
  yue: { regionCode: "HK", currency: "HKD", dateFormat: "YYYY-MM-DD" }, // Cantonese
  // Japanese
  ja: { regionCode: "JP", currency: "JPY", dateFormat: "YYYY-MM-DD" },
  // Korean
  ko: { regionCode: "KR", currency: "KRW", dateFormat: "YYYY-MM-DD" },
  // Arabic
  ar: { regionCode: "SA", currency: "SAR", dateFormat: "DD/MM/YY" },
  // Hindi
  hi: { regionCode: "IN", currency: "INR", dateFormat: "DD/MM/YY" },
  // Russian
  ru: { regionCode: "RU", currency: "RUB", dateFormat: "DD/MM/YY" },
  // Italian
  it: { regionCode: "IT", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Dutch
  nl: { regionCode: "NL", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Polish
  pl: { regionCode: "PL", currency: "PLN", dateFormat: "DD/MM/YY" },
  // Turkish
  tr: { regionCode: "TR", currency: "TRY", dateFormat: "DD/MM/YY" },
  // Vietnamese
  vi: { regionCode: "VN", currency: "VND", dateFormat: "DD/MM/YY" },
  // Thai
  th: { regionCode: "TH", currency: "THB", dateFormat: "DD/MM/YY" },
  // Indonesian
  id: { regionCode: "ID", currency: "IDR", dateFormat: "DD/MM/YY" },
  // Filipino/Tagalog
  fil: { regionCode: "PH", currency: "PHP", dateFormat: "MM/DD/YY" },
  tl: { regionCode: "PH", currency: "PHP", dateFormat: "MM/DD/YY" },
  // Bengali
  bn: { regionCode: "BD", currency: "BDT", dateFormat: "DD/MM/YY" },
  // Urdu
  ur: { regionCode: "PK", currency: "PKR", dateFormat: "DD/MM/YY" },
  // Swahili
  sw: { regionCode: "KE", currency: "KES", dateFormat: "DD/MM/YY" },
  // Yoruba
  yo: { regionCode: "NG", currency: "NGN", dateFormat: "DD/MM/YY" },
  // Afrikaans
  af: { regionCode: "ZA", currency: "ZAR", dateFormat: "DD/MM/YY" },
  // Greek
  el: { regionCode: "GR", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Czech
  cs: { regionCode: "CZ", currency: "CZK", dateFormat: "DD/MM/YY" },
  // Romanian
  ro: { regionCode: "RO", currency: "RON", dateFormat: "DD/MM/YY" },
  // Hungarian
  hu: { regionCode: "HU", currency: "HUF", dateFormat: "YYYY-MM-DD" },
  // Swedish
  sv: { regionCode: "SE", currency: "SEK", dateFormat: "YYYY-MM-DD" },
  // Norwegian
  no: { regionCode: "NO", currency: "NOK", dateFormat: "DD/MM/YY" },
  nb: { regionCode: "NO", currency: "NOK", dateFormat: "DD/MM/YY" },
  nn: { regionCode: "NO", currency: "NOK", dateFormat: "DD/MM/YY" },
  // Danish
  da: { regionCode: "DK", currency: "DKK", dateFormat: "DD/MM/YY" },
  // Finnish
  fi: { regionCode: "FI", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Hebrew
  he: { regionCode: "IL", currency: "ILS", dateFormat: "DD/MM/YY" },
  // Persian/Farsi
  fa: { regionCode: "IR", currency: "IRR", dateFormat: "YYYY-MM-DD" },
  // Ukrainian
  uk: { regionCode: "UA", currency: "UAH", dateFormat: "DD/MM/YY" },
  // Bulgarian
  bg: { regionCode: "BG", currency: "BGN", dateFormat: "DD/MM/YY" },
  // Croatian
  hr: { regionCode: "HR", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Serbian
  sr: { regionCode: "RS", currency: "RSD", dateFormat: "DD/MM/YY" },
  // Slovak
  sk: { regionCode: "SK", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Slovenian
  sl: { regionCode: "SI", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Lithuanian
  lt: { regionCode: "LT", currency: "EUR", dateFormat: "YYYY-MM-DD" },
  // Latvian
  lv: { regionCode: "LV", currency: "EUR", dateFormat: "YYYY-MM-DD" },
  // Estonian
  et: { regionCode: "EE", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Georgian
  ka: { regionCode: "GE", currency: "GEL", dateFormat: "DD/MM/YY" },
  // Armenian
  hy: { regionCode: "AM", currency: "AMD", dateFormat: "DD/MM/YY" },
  // Azerbaijani
  az: { regionCode: "AZ", currency: "AZN", dateFormat: "DD/MM/YY" },
  // Kazakh
  kk: { regionCode: "KZ", currency: "KZT", dateFormat: "DD/MM/YY" },
  // Uzbek
  uz: { regionCode: "UZ", currency: "UZS", dateFormat: "DD/MM/YY" },
  // Mongolian
  mn: { regionCode: "MN", currency: "MNT", dateFormat: "YYYY-MM-DD" },
  // Marathi
  mr: { regionCode: "IN", currency: "INR", dateFormat: "DD/MM/YY" },
  // Tamil
  ta: { regionCode: "IN", currency: "INR", dateFormat: "DD/MM/YY" },
  // Telugu
  te: { regionCode: "IN", currency: "INR", dateFormat: "DD/MM/YY" },
  // Gujarati
  gu: { regionCode: "IN", currency: "INR", dateFormat: "DD/MM/YY" },
  // Kannada
  kn: { regionCode: "IN", currency: "INR", dateFormat: "DD/MM/YY" },
  // Malayalam
  ml: { regionCode: "IN", currency: "INR", dateFormat: "DD/MM/YY" },
  // Punjabi
  pa: { regionCode: "IN", currency: "INR", dateFormat: "DD/MM/YY" },
  // Malay
  ms: { regionCode: "MY", currency: "MYR", dateFormat: "DD/MM/YY" },
  // Burmese
  my: { regionCode: "MM", currency: "MMK", dateFormat: "YYYY-MM-DD" },
  // Khmer
  km: { regionCode: "KH", currency: "KHR", dateFormat: "DD/MM/YY" },
  // Lao
  lo: { regionCode: "LA", currency: "LAK", dateFormat: "DD/MM/YY" },
  // Sinhala
  si: { regionCode: "LK", currency: "LKR", dateFormat: "DD/MM/YY" },
  // Nepali
  ne: { regionCode: "NP", currency: "NPR", dateFormat: "DD/MM/YY" },
  // Amharic
  am: { regionCode: "ET", currency: "ETB", dateFormat: "DD/MM/YY" },
  // Hausa
  ha: { regionCode: "NG", currency: "NGN", dateFormat: "DD/MM/YY" },
  // Igbo
  ig: { regionCode: "NG", currency: "NGN", dateFormat: "DD/MM/YY" },
  // Xhosa
  xh: { regionCode: "ZA", currency: "ZAR", dateFormat: "DD/MM/YY" },
  // Zulu
  zu: { regionCode: "ZA", currency: "ZAR", dateFormat: "DD/MM/YY" },
  // Javanese
  jv: { regionCode: "ID", currency: "IDR", dateFormat: "DD/MM/YY" },
  // Catalan
  ca: { regionCode: "ES", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Basque
  eu: { regionCode: "ES", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Galician
  gl: { regionCode: "ES", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Welsh
  cy: { regionCode: "GB", currency: "GBP", dateFormat: "DD/MM/YY" },
  // Irish
  ga: { regionCode: "IE", currency: "EUR", dateFormat: "DD/MM/YY" },
  // Scottish Gaelic
  gd: { regionCode: "GB", currency: "GBP", dateFormat: "DD/MM/YY" },
  // Icelandic
  is: { regionCode: "IS", currency: "ISK", dateFormat: "DD/MM/YY" },
  // Belarusian
  be: { regionCode: "BY", currency: "BYN", dateFormat: "DD/MM/YY" },
  // Macedonian
  mk: { regionCode: "MK", currency: "MKD", dateFormat: "DD/MM/YY" },
  // Albanian
  sq: { regionCode: "AL", currency: "ALL", dateFormat: "DD/MM/YY" },
  // Bosnian
  bs: { regionCode: "BA", currency: "BAM", dateFormat: "DD/MM/YY" },
};

const DEFAULT_LOCALE: Omit<LanguageLocaleInfo, "languageCode"> = {
  regionCode: "US",
  currency: "USD",
  dateFormat: "MM/DD/YY",
};

/**
 * Gets region, currency, and date format for a language code.
 * Falls back to default (US/USD/MM-DD-YY) if language not found.
 * Returns normalized base language code (e.g., zh-Hans -> zh) for translation lookup.
 */
export function getLocaleFromLanguage(languageCode: string): LanguageLocaleInfo {
  // Normalize to base language code (e.g., zh-Hans -> zh, zh-Hant -> zh)
  // This ensures translation lookups work correctly
  const baseCode = languageCode.split("-")[0].toLowerCase();
  const locale = LANGUAGE_TO_LOCALE[languageCode] || LANGUAGE_TO_LOCALE[baseCode] || DEFAULT_LOCALE;
  
  return {
    languageCode: baseCode, // Always return base code for translation consistency
    ...locale,
  };
}
