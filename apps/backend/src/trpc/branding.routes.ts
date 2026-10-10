/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { TRPCError } from '@trpc/server';
import { z } from 'zod/v4';

import {
	type BrandingAssetKind,
	getActiveBranding,
	removeBrandingAsset,
	updateBranding,
} from '../services/branding.service';
import { hasFeature, LICENSE_FEATURES } from '../services/license.service';
import { adminProtectedProcedure, publicProcedure, router } from './trpc';

const MAX_ASSET_BYTES = 512 * 1024;
const ALLOWED_MEDIA_TYPES = [
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/webp',
	'image/svg+xml',
	'image/x-icon',
	'image/vnd.microsoft.icon',
];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const assetKind = z.enum(['logo', 'favicon']);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const brandingRoutes = router({
	get: publicProcedure.query(async () => {
		const enabled = await hasFeature(LICENSE_FEATURES.whiteLabel);
		const branding = enabled ? await getActiveBranding() : null;
		return {
			enabled,
			appName: branding?.appName?.trim() || null,
			tabTitle: branding?.tabTitle?.trim() || null,
			brandColor: branding?.brandColor ?? null,
			hasLogo: !!branding?.logo,
			hasFavicon: !!branding?.favicon,
			updatedAt: branding?.updatedAt ? new Date(branding.updatedAt).getTime() : null,
		};
	}),

	update: adminProtectedProcedure
		.input(
			z.object({
				appName: optionalText(60),
				tabTitle: optionalText(80),
				brandColor: z.string().regex(HEX_COLOR, 'Use a #rrggbb colour').nullable().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			await assertWhiteLabel();
			await updateBranding({
				...(input.appName !== undefined && { appName: input.appName || null }),
				...(input.tabTitle !== undefined && { tabTitle: input.tabTitle || null }),
				...(input.brandColor !== undefined && { brandColor: input.brandColor }),
			});
			return { success: true };
		}),

	uploadAsset: adminProtectedProcedure
		.input(z.object({ kind: assetKind, data: z.string().min(1), mediaType: z.string() }))
		.mutation(async ({ input }) => {
			await assertWhiteLabel();
			const mediaType = input.mediaType.trim().toLowerCase();
			if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Upload a PNG, JPEG, GIF, WebP, SVG or ICO image.',
				});
			}
			if (Buffer.from(input.data, 'base64').byteLength > MAX_ASSET_BYTES) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: 'The image must be 512 KB or smaller.' });
			}
			await updateBranding({ [input.kind as BrandingAssetKind]: { data: input.data, mediaType } });
			return { success: true };
		}),

	removeAsset: adminProtectedProcedure.input(z.object({ kind: assetKind })).mutation(async ({ input }) => {
		await assertWhiteLabel();
		await removeBrandingAsset(input.kind);
		return { success: true };
	}),

	reset: adminProtectedProcedure.mutation(async () => {
		await assertWhiteLabel();
		await updateBranding({ appName: null, tabTitle: null, brandColor: null, logo: null, favicon: null });
		return { success: true };
	}),
});

async function assertWhiteLabel(): Promise<void> {
	if (!(await hasFeature(LICENSE_FEATURES.whiteLabel))) {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'White-labelling is switched off on this server.' });
	}
}
