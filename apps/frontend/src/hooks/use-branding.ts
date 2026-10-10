/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { useQuery } from '@tanstack/react-query';

import { trpc } from '@/main';

export const DEFAULT_BRAND_COLOR = '#522bff';
export const DEFAULT_APP_NAME = 'Insight';

export interface Branding {
	enabled: boolean;
	appName: string | null;
	tabTitle: string | null;
	brandColor: string | null;
	hasLogo: boolean;
	hasFavicon: boolean;
	updatedAt: number | null;
}

const NO_BRANDING: Branding = {
	enabled: false,
	appName: null,
	tabTitle: null,
	brandColor: null,
	hasLogo: false,
	hasFavicon: false,
	updatedAt: null,
};

export function useBranding(): Branding {
	const { data } = useQuery({ ...trpc.branding.get.queryOptions(), staleTime: 60_000 });
	return data ?? NO_BRANDING;
}

export function brandingAssetUrl(kind: 'logo' | 'favicon', updatedAt: number | null): string {
	return `/branding/${kind}?v=${updatedAt ?? 0}`;
}
