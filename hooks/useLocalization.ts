/**
 * Localization hooks.
 *
 * `useTranslation` is re-exported from the new `@/lib/i18n/useTranslation` so
 * every caller picks up the full super-app i18n system (200+ languages via
 * MyMemory) without needing to change its import path.
 *
 * `usePrice` stays here — it's a wallet-app concern, not part of the web i18n.
 */

import { useMemo } from 'react';
import { currencyService } from '../services/currencyService';
import { useLocaleStore } from '../store/localeStore';

export { useTranslation } from '@/lib/i18n/useTranslation';

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
