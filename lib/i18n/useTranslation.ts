/**
 * Translation hook for React components.
 * Mirrors the web app's `lib/i18n/useTranslation.ts`.
 *
 * Static languages (en, es, fr, de, zh, ja, ar) are resolved from the built-in
 * dictionary. Other languages are fetched from the MyMemory API in the
 * background and cached in AsyncStorage; while the fetch is in flight we fall
 * back to English, then re-render when the translations arrive.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocaleStore } from '@/store/localeStore';
import { getEnglishText, getTranslation, type TranslationKey } from './translations';
import { getTranslationAsync } from './translation-service';

const translationCache = new Map<string, string>();

export function useTranslation() {
    const language = useLocaleStore((s) => s.language);
    const [translations, setTranslations] = useState<Map<string, string>>(new Map());

    const normalizedLang = language.split('-')[0].toLowerCase();

    useEffect(() => {
        if (normalizedLang === 'en') {
            setTranslations(new Map());
            return;
        }

        const hasStaticTranslations =
            normalizedLang === 'es' ||
            normalizedLang === 'fr' ||
            normalizedLang === 'de' ||
            normalizedLang === 'zh' ||
            normalizedLang === 'ja' ||
            normalizedLang === 'ar';

        if (hasStaticTranslations) {
            setTranslations(new Map());
            return;
        }

        let cancelled = false;

        const keys: TranslationKey[] = [
            'nav.home', 'nav.market', 'nav.swap', 'nav.pool', 'nav.earn', 'nav.portfolio',
            'nav.referral', 'nav.settings', 'nav.connect_wallet', 'nav.disconnect', 'nav.notifications',
            'common.apply', 'common.applied', 'common.save', 'common.cancel',
            'common.close', 'common.search', 'common.loading', 'common.error',
            'common.just_now', 'common.minutes_ago', 'common.hours_ago', 'common.days_ago',
            'status.active_chains', 'status.smart_markets',
            'sidebar.collapse', 'sidebar.quick_actions', 'sidebar.swap', 'sidebar.stake',
            'sidebar.history', 'sidebar.lend', 'sidebar.coming_soon', 'sidebar.download_app', 'sidebar.support_hub',
            'settings.language_region', 'settings.application_language',
            'settings.currency_display', 'settings.regional_format',
            'settings.auto_detected', 'settings.applies_sitewide', 'settings.notifications',
            'home.title', 'home.market', 'home.favourite',
            'home.hot', 'home.listing', 'home.gainers', 'home.losers',
            'home.top', 'home.spotlight',
            'wallet.connect_wallet', 'wallet.create_new_wallet', 'wallet.import_wallet',
            'wallet.my_wallets', 'wallet.create_description', 'wallet.import_description',
            'wallet.connect_external_wallets', 'wallet.edit_name', 'wallet.current_name',
            'wallet.new_name', 'wallet.enter_new_name', 'wallet.save',
            'notifications.title', 'notifications.close', 'notifications.loading', 'notifications.no_notifications',
            'account.settings', 'account.account_details', 'account.wallet_name', 'account.wallet_address',
            'account.account_type', 'account.networks_connected', 'account.my_wallets',
            'account.active_wallet_description', 'account.local_wallet', 'account.local_tiwi_wallet',
            'account.active', 'account.no_wallet_connected',
            'settings.account_details', 'settings.connected_devices', 'settings.support',
            'settings.add_new_wallet', 'settings.import_wallet', 'settings.go_back',
        ];

        (async () => {
            const newTranslations = new Map<string, string>();
            await Promise.all(
                keys.map(async (key) => {
                    const cacheKey = `${normalizedLang}_${key}`;
                    if (translationCache.has(cacheKey)) {
                        newTranslations.set(key, translationCache.get(cacheKey)!);
                        return;
                    }

                    const englishText = getEnglishText(key);
                    try {
                        const translated = await getTranslationAsync(key, normalizedLang, englishText);
                        newTranslations.set(key, translated);
                        translationCache.set(cacheKey, translated);
                    } catch {
                        newTranslations.set(key, englishText);
                    }
                }),
            );

            if (!cancelled) setTranslations(newTranslations);
        })();

        return () => {
            cancelled = true;
        };
    }, [normalizedLang]);

    const t = useCallback(
        (key: TranslationKey): string => {
            if (translations.has(key)) return translations.get(key)!;
            return getTranslation(key, language);
        },
        [language, translations],
    );

    return { t, language: normalizedLang };
}
