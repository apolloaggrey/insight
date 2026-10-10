/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { z } from 'zod/v4';

import type { App } from '../app';
import { getActiveBrandingAsset } from '../services/branding.service';
import { HandlerError } from '../utils/error';

const paramsSchema = z.object({ kind: z.enum(['logo', 'favicon']) });

/** Serves the uploaded logo and favicon; the ?v= cache-buster in their URLs changes on every update. */
export const brandingRoutes = async (app: App) => {
	app.get('/:kind', { schema: { params: paramsSchema } }, async (request, reply) => {
		const asset = await getActiveBrandingAsset(request.params.kind);
		if (!asset) {
			throw new HandlerError('NOT_FOUND', 'No custom image is set');
		}
		return reply
			.header('Content-Type', asset.mediaType)
			.header('Cache-Control', 'public, max-age=86400')
			.header('X-Content-Type-Options', 'nosniff')
			.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
			.send(Buffer.from(asset.data, 'base64'));
	});
};
