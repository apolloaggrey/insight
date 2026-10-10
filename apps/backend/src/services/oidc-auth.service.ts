/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import type { BetterAuthPlugin } from 'better-auth';
import { APIError } from 'better-auth';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';

import { env } from '../env';
import { decideGroupOrganizationRoleMapping, parseGroupOrganizationRoleMapping } from '../utils/sso-group-mapping';
import { DEFAULT_GROUPS_CLAIM, isOidcOrganizationRoleMappingActive } from './sso-group-mapping.service';
import { fetchOidcUserInfo, verifyOidcIdTokenClaims } from './sso-token.service';

const DEFAULT_PROVIDER_ID = 'oidc';
const DEFAULT_SCOPES = ['openid', 'profile', 'email'];

interface OidcTokens {
	idToken?: string;
	accessToken?: string;
}

export function isOidcConfigured(): boolean {
	return !!(env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET && env.OIDC_DISCOVERY_URL);
}

export function getOidcProviderId(): string {
	return (env.OIDC_PROVIDER_ID as string | undefined) || DEFAULT_PROVIDER_ID;
}

export function isSocialProviderOidc(providerId: string | undefined): boolean {
	return !!providerId && providerId === getOidcProviderId();
}

export function getTrustedProvidersForOidc(): string[] {
	return isOidcConfigured() ? [getOidcProviderId()] : [];
}

export function parseScopes(raw: string | undefined): string[] {
	const scopes = (raw ?? '')
		.split(',')
		.map((scope) => scope.trim())
		.filter(Boolean);
	return scopes.length > 0 ? scopes : DEFAULT_SCOPES;
}

export function augmentPluginsWithOidc(plugins: BetterAuthPlugin[]): void {
	if (!isOidcConfigured()) {
		return;
	}
	plugins.push(
		genericOAuth({
			config: [
				{
					providerId: getOidcProviderId(),
					discoveryUrl: env.OIDC_DISCOVERY_URL as string,
					clientId: env.OIDC_CLIENT_ID as string,
					clientSecret: env.OIDC_CLIENT_SECRET as string,
					scopes: parseScopes(env.OIDC_SCOPES as string | undefined),
					pkce: (env.OIDC_PKCE as string | undefined) !== 'false',
					getUserInfo: (tokens) => getOidcUserInfo(tokens),
				},
			],
		}) as BetterAuthPlugin,
	);
}

async function getOidcUserInfo(tokens: OidcTokens) {
	const claims = await readSignInClaims(tokens);
	const profile = { ...(tokens.accessToken ? await fetchOidcUserInfo(tokens.accessToken) : {}), ...claims };
	const email = typeof profile.email === 'string' ? profile.email : null;
	if (!email || typeof profile.sub !== 'string') {
		throw new APIError('FORBIDDEN', { message: 'Your identity provider did not share an email address.' });
	}
	return {
		id: profile.sub,
		email,
		name: typeof profile.name === 'string' ? profile.name : email,
		image: typeof profile.picture === 'string' ? profile.picture : undefined,
		emailVerified: profile.email_verified === true || profile.email_verified === 'true',
	};
}

/** With a role mapping configured, a verified token from an allowed group is required to sign in. */
async function readSignInClaims(tokens: OidcTokens): Promise<Record<string, unknown>> {
	const verified = tokens.idToken ? await verifyOidcIdTokenClaims(tokens.idToken) : null;
	const claims = verified?.status === 'verified' ? verified.claims : {};
	if (!(await isOidcOrganizationRoleMappingActive())) {
		return claims;
	}
	if (verified?.status !== 'verified') {
		throw new APIError('FORBIDDEN', { message: 'Your sign-in could not be verified.' });
	}
	const claimName = (env.OIDC_GROUPS_CLAIM as string | undefined) || DEFAULT_GROUPS_CLAIM;
	const mapping = parseGroupOrganizationRoleMapping(env.OIDC_GROUP_INSIGHT_ROLE_MAPPING as string | undefined);
	if (decideGroupOrganizationRoleMapping(claims, claimName, mapping).action === 'deny') {
		throw new APIError('FORBIDDEN', { message: 'Your account is not in a group allowed to use this application.' });
	}
	return claims;
}
