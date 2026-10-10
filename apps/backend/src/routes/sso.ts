/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { z } from 'zod/v4';

import type { App } from '../app';
import { getAuth } from '../auth';
import { env } from '../env';
import { hasFeature, LICENSE_FEATURES } from '../services/license.service';
import { isMicrosoftConfigured } from '../services/microsoft-auth.service';
import { getOidcProviderId, isOidcConfigured } from '../services/oidc-auth.service';
import { HandlerError } from '../utils/error';

const querySchema = z.object({
	provider: z.string().optional(),
	redirect: z.string().optional(),
});

/** Starts company sign-in from a link, e.g. a tile in the identity provider's app dashboard (IdP-initiated). */
export const ssoRoutes = async (app: App) => {
	app.get('/sso/start', { schema: { querystring: querySchema } }, async (request, reply) => {
		if (!(await hasFeature(LICENSE_FEATURES.sso))) {
			throw new HandlerError('FORBIDDEN', 'Company sign-in is switched off on this server');
		}
		const signIn = chooseSignIn(request.query.provider, safeRedirect(request.query.redirect));
		const auth = await getAuth();
		const response = await auth.handler(
			new Request(`${env.BETTER_AUTH_URL}/api/auth${signIn.path}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', origin: env.BETTER_AUTH_URL },
				body: JSON.stringify(signIn.body),
			}),
		);
		const body = (await response.json().catch(() => null)) as { url?: string } | null;
		if (!response.ok || !body?.url) {
			throw new HandlerError('BAD_REQUEST', 'Could not start company sign-in');
		}
		for (const cookie of response.headers.getSetCookie()) {
			reply.header('set-cookie', cookie);
		}
		return reply.redirect(body.url);
	});
};

function chooseSignIn(provider: string | undefined, callbackURL: string): { path: string; body: object } {
	const wantsMicrosoft = provider === 'microsoft' || (!provider && !isOidcConfigured());
	if (wantsMicrosoft && isMicrosoftConfigured()) {
		return { path: '/sign-in/social', body: { provider: 'microsoft', callbackURL } };
	}
	if (isOidcConfigured() && (!provider || provider === getOidcProviderId())) {
		return { path: '/sign-in/oauth2', body: { providerId: getOidcProviderId(), callbackURL } };
	}
	throw new HandlerError('NOT_FOUND', 'That sign-in provider is not configured');
}

/** Only same-site paths, so the link can't be used to bounce people to another site. */
function safeRedirect(redirect: string | undefined): string {
	return redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
}
