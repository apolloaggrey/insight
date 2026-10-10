/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import type { Session } from 'better-auth';

import { env } from '../env';
import { hasAccountForProvider } from '../queries/account.queries';
import { hasSsoSessionExceededMaxAge } from '../utils/sso-session';
import { isMicrosoftConfigured } from './microsoft-auth.service';
import { getOidcProviderId, isOidcConfigured } from './oidc-auth.service';

/** SSO_SESSION_MAX_AGE caps how long a session of anyone signing in through company SSO lasts. */
export async function shouldExpireSsoSession(session: Pick<Session, 'userId' | 'createdAt'>): Promise<boolean> {
	const maxAge = env.SSO_SESSION_MAX_AGE;
	if (!maxAge || !hasSsoSessionExceededMaxAge(new Date(session.createdAt), maxAge)) {
		return false;
	}
	return isSsoUser(session.userId);
}

async function isSsoUser(userId: string): Promise<boolean> {
	const providers = [
		...(isOidcConfigured() ? [getOidcProviderId()] : []),
		...(isMicrosoftConfigured() ? ['microsoft'] : []),
	];
	for (const providerId of providers) {
		if (await hasAccountForProvider(userId, providerId)) {
			return true;
		}
	}
	return false;
}
