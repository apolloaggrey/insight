/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { eq } from 'drizzle-orm';

import s from '../db/abstractSchema';
import { db } from '../db/db';

export type BrandingAssetKind = 'logo' | 'favicon';

export interface BrandingAsset {
	data: string;
	mediaType: string;
}

export interface BrandingSummary {
	appName: string | null;
	tabTitle: string | null;
	brandColor: string | null;
	logo: { mediaType: string } | null;
	favicon: { mediaType: string } | null;
	updatedAt: Date;
}

export interface BrandingValues {
	appName?: string | null;
	tabTitle?: string | null;
	brandColor?: string | null;
	logo?: BrandingAsset | null;
	favicon?: BrandingAsset | null;
}

const ROW_ID = 'default';

export async function getBrandingSummary(): Promise<BrandingSummary | null> {
	const [row] = await db
		.select({
			appName: s.brandingConfig.appName,
			tabTitle: s.brandingConfig.tabTitle,
			brandColor: s.brandingConfig.brandColor,
			logoMediaType: s.brandingConfig.logoMediaType,
			faviconMediaType: s.brandingConfig.faviconMediaType,
			updatedAt: s.brandingConfig.updatedAt,
		})
		.from(s.brandingConfig)
		.where(eq(s.brandingConfig.id, ROW_ID))
		.limit(1)
		.execute();
	if (!row) {
		return null;
	}
	return {
		appName: row.appName,
		tabTitle: row.tabTitle,
		brandColor: row.brandColor,
		logo: row.logoMediaType ? { mediaType: row.logoMediaType } : null,
		favicon: row.faviconMediaType ? { mediaType: row.faviconMediaType } : null,
		updatedAt: row.updatedAt,
	};
}

export async function getBrandingAsset(kind: BrandingAssetKind): Promise<BrandingAsset | null> {
	const [row] = await db
		.select({
			logoData: s.brandingConfig.logoData,
			logoMediaType: s.brandingConfig.logoMediaType,
			faviconData: s.brandingConfig.faviconData,
			faviconMediaType: s.brandingConfig.faviconMediaType,
		})
		.from(s.brandingConfig)
		.where(eq(s.brandingConfig.id, ROW_ID))
		.limit(1)
		.execute();
	const data = kind === 'logo' ? row?.logoData : row?.faviconData;
	const mediaType = kind === 'logo' ? row?.logoMediaType : row?.faviconMediaType;
	return data && mediaType ? { data, mediaType } : null;
}

export async function upsertBranding(values: BrandingValues): Promise<void> {
	const columns = toColumns(values);
	await db
		.insert(s.brandingConfig)
		.values({ id: ROW_ID, ...columns })
		.onConflictDoUpdate({ target: s.brandingConfig.id, set: { ...columns, updatedAt: new Date() } })
		.execute();
}

export async function clearBrandingAsset(kind: BrandingAssetKind): Promise<void> {
	await upsertBranding({ [kind]: null });
}

function toColumns(values: BrandingValues) {
	return {
		...(values.appName !== undefined && { appName: values.appName }),
		...(values.tabTitle !== undefined && { tabTitle: values.tabTitle }),
		...(values.brandColor !== undefined && { brandColor: values.brandColor }),
		...(values.logo !== undefined && {
			logoData: values.logo?.data ?? null,
			logoMediaType: values.logo?.mediaType ?? null,
		}),
		...(values.favicon !== undefined && {
			faviconData: values.favicon?.data ?? null,
			faviconMediaType: values.favicon?.mediaType ?? null,
		}),
	};
}
