/**
 * Localization Hooks
 * 
 * useTranslation: For text strings
 * usePrice: For reactive currency conversion
 */

import { useMemo } from 'react';
import { TRANSLATIONS, TranslationKey } from '../constants/translations';
import { currencyService } from '../services/currencyService';
import { useLocaleStore } from '../store/localeStore';

export function useTranslation() {
    const { language } = useLocaleStore();

    const t = (key: TranslationKey): string => {
        // Fallback to English if key doesn't exist in target language
        return TRANSLATIONS[language]?.[key] || TRANSLATIONS['en'][key] || key;
    };

    return { t, language };
}

export function usePrice(usdAmount: number | string | undefined) {
    const { currency } = useLocaleStore();

    const formattedPrice = useMemo(() => {
        if (usdAmount === undefined) return '...';

        const numAmount = typeof usdAmount === 'string' ? parseFloat(usdAmount) : usdAmount;
        if (isNaN(numAmount)) return '...';

        const converted = currencyService.convert(numAmount, currency);
        return currencyService.format(converted, currency);
    }, [usdAmount, currency]);

    return formattedPrice;
}
