/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import type { BrandingAsset, BrandingAssetKind, BrandingSummary, BrandingValues } from '../queries/branding.queries';
import * as brandingQueries from '../queries/branding.queries';
import { logger } from '../utils/logger';
import { hasFeature } from './license.service';

export type { BrandingAsset, BrandingAssetKind, BrandingSummary, BrandingValues };

export const DEFAULT_APP_NAME = 'Insight';
export const DEFAULT_BRAND_COLOR = '#522bff';

const CACHE_TTL_MS = 60_000;
const WHITE_LABEL_FEATURE = 'white-label';

let summaryCache: { value: Promise<BrandingSummary | null>; expiresAt: number } | null = null;
const assetCache = new Map<BrandingAssetKind, { value: Promise<BrandingAsset | null>; expiresAt: number }>();

export function resolveAppName(branding: Pick<BrandingSummary, 'appName'> | null | undefined): string {
	return branding?.appName?.trim() || DEFAULT_APP_NAME;
}

export async function getAppName(): Promise<string> {
	return resolveAppName(await getActiveBranding());
}

/** The saved branding, or null when there is none or white-labelling is off. Never throws. */
export async function getActiveBranding(): Promise<BrandingSummary | null> {
	if (!(await isWhiteLabelEnabled())) {
		return null;
	}
	if (!summaryCache || summaryCache.expiresAt <= Date.now()) {
		const value = brandingQueries.getBrandingSummary();
		summaryCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
		value.catch(() => {
			summaryCache = null;
		});
	}
	try {
		return await summaryCache.value;
	} catch (error) {
		logger.warn(`Branding lookup failed, using the defaults: ${String(error)}`, { source: 'system' });
		return null;
	}
}

export async function getActiveBrandingAsset(kind: BrandingAssetKind): Promise<BrandingAsset | null> {
	if (!(await isWhiteLabelEnabled())) {
		return null;
	}
	const cached = assetCache.get(kind);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.value;
	}
	const value = brandingQueries.getBrandingAsset(kind);
	assetCache.set(kind, { value, expiresAt: Date.now() + CACHE_TTL_MS });
	value.catch(() => assetCache.delete(kind));
	return value;
}

export async function updateBranding(values: BrandingValues): Promise<void> {
	await brandingQueries.upsertBranding(values);
	invalidateBrandingCache();
}

export async function removeBrandingAsset(kind: BrandingAssetKind): Promise<void> {
	await brandingQueries.clearBrandingAsset(kind);
	invalidateBrandingCache();
}

export function invalidateBrandingCache(): void {
	summaryCache = null;
	assetCache.clear();
}

async function isWhiteLabelEnabled(): Promise<boolean> {
	return hasFeature(WHITE_LABEL_FEATURE);
}
