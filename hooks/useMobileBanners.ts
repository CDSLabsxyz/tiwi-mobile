import { api, type AdvertItem } from '@/lib/mobile/api-client';
import type { NewsfeedItem } from '@/types';
import { useQuery } from '@tanstack/react-query';

export function useMobileBanners() {
    return useQuery<NewsfeedItem[]>({
        queryKey: ['mobileBanners'],
        queryFn: async () => {
            const response = await api.adverts.list({
                status: 'published',
                advertFormat: 'Mobile Banner',
                rasterizeSvg: true,
            });

            return (response.adverts || [])
                .filter(
                    (advert): advert is AdvertItem & { imageUrl: string } =>
                        advert.status === 'published' &&
                        advert.advertFormat === 'Mobile Banner' &&
                        Boolean(advert.imageUrl)
                )
                .map((advert) => ({
                    id: advert.id,
                    imageUrl: advert.imageUrl,
                    linkUrl: advert.linkUrl,
                }));
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });
}
