/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import type { betterAuth } from 'better-auth';
import { APIError } from 'better-auth';
import { microsoft } from 'better-auth/social-providers';

import { env } from '../env';
import { getRefreshToken, updateRefreshToken } from '../queries/account.queries';
import { logger, serializeError } from '../utils/logger';
import {
	extractGroups,
	hasMicrosoftGroupsOverage,
	parseEntraGroupOrganizationRoleMapping,
} from '../utils/sso-group-mapping';
import { hasFeature, LICENSE_FEATURES } from './license.service';
import { resolveMicrosoftGraphMemberships } from './microsoft-user-group-membership.service';
import { verifyMicrosoftIdTokenClaims } from './sso-token.service';

export type SocialProviders = NonNullable<Parameters<typeof betterAuth>[0]['socialProviders']>;

const PROVIDER_ID = 'microsoft';
const UNVERIFIED_MESSAGE = 'Microsoft group membership could not be verified.';
const GROUP_SCOPES = ['GroupMember.Read.All'];
const TOKEN_REFRESH_MARGIN_MS = 60_000;

interface MicrosoftTokens {
	idToken?: string;
	accessToken?: string;
}

const downstreamTokens = new Map<string, { token: string; expiresAt: number }>();

export function isMicrosoftConfigured(): boolean {
	return !!(env.AZURE_AD_CLIENT_ID && env.AZURE_AD_CLIENT_SECRET && env.AZURE_AD_TENANT_ID);
}

export function isSocialProviderMicrosoft(providerId: string | undefined): boolean {
	return providerId === PROVIDER_ID;
}

export function getTrustedProvidersForMicrosoft(): string[] {
	return isMicrosoftConfigured() ? [PROVIDER_ID] : [];
}

export function augmentSocialProvidersWithMicrosoft(providers: SocialProviders): void {
	if (!isMicrosoftConfigured()) {
		return;
	}
	const credentials = {
		clientId: env.AZURE_AD_CLIENT_ID as string,
		clientSecret: env.AZURE_AD_CLIENT_SECRET as string,
		tenantId: env.AZURE_AD_TENANT_ID as string,
	};
	providers.microsoft = {
		...credentials,
		scope:
			env.AZURE_AD_GROUP_INSIGHT_GROUP_MAPPING || env.AZURE_AD_GROUP_INSIGHT_ROLE_MAPPING
				? GROUP_SCOPES
				: undefined,
		getUserInfo: async (tokens: MicrosoftTokens) => {
			await assertAllowedByGroups(tokens);
			return microsoft(credentials).getUserInfo(
				tokens as Parameters<ReturnType<typeof microsoft>['getUserInfo']>[0],
			);
		},
	} as SocialProviders['microsoft'];
}

/**
 * A token for the warehouse, issued to the signed-in user, so queries run with their own data rights.
 * Exchanges the user's Microsoft refresh token for AZURE_AD_TOKEN_SCOPE (default: this app's .default scope).
 */
export async function getAzureAccessTokenForUser(userId: string): Promise<string | null> {
	if (!isMicrosoftConfigured()) {
		return null;
	}
	const cached = downstreamTokens.get(userId);
	if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
		return cached.token;
	}
	const refreshToken = await getRefreshToken(userId, PROVIDER_ID);
	if (!refreshToken) {
		return null;
	}
	try {
		return await exchangeRefreshToken(userId, refreshToken);
	} catch (error) {
		logger.warn('Could not get a Microsoft token for the warehouse', {
			source: 'system',
			context: { userId, error: serializeError(error) },
		});
		return null;
	}
}

async function assertAllowedByGroups(tokens: MicrosoftTokens): Promise<void> {
	const mapping = parseEntraGroupOrganizationRoleMapping(env.AZURE_AD_GROUP_INSIGHT_ROLE_MAPPING);
	if (mapping.status !== 'valid' || mapping.mapping.size === 0) {
		return;
	}
	if (!(await hasFeature(LICENSE_FEATURES.sso))) {
		return;
	}
	if (!tokens.idToken) {
		throw new APIError('FORBIDDEN', { message: 'Microsoft sign-in did not return an ID token.' });
	}
	const verified = await verifyMicrosoftIdTokenClaims(tokens.idToken);
	if (verified.status !== 'verified') {
		throw new APIError('FORBIDDEN', { message: UNVERIFIED_MESSAGE });
	}
	const mappedGroupIds = [...mapping.mapping.keys()];
	const memberOf = hasMicrosoftGroupsOverage(verified.claims)
		? await resolveOverageGroups(tokens.accessToken, mappedGroupIds)
		: extractGroups(verified.claims, 'groups').map((group) => group.toLowerCase());
	if (!memberOf.some((group) => mapping.mapping.has(group))) {
		throw new APIError('FORBIDDEN', {
			message: 'Your Microsoft account is not in a group allowed to use this application.',
		});
	}
}

async function resolveOverageGroups(accessToken: string | undefined, candidates: string[]): Promise<string[]> {
	if (!accessToken) {
		throw new APIError('FORBIDDEN', { message: UNVERIFIED_MESSAGE });
	}
	try {
		return await resolveMicrosoftGraphMemberships(accessToken, candidates);
	} catch (error) {
		logger.warn('Microsoft Graph group check failed during sign-in', {
			source: 'system',
			context: { error: serializeError(error) },
		});
		throw new APIError('FORBIDDEN', { message: UNVERIFIED_MESSAGE });
	}
}

async function exchangeRefreshToken(userId: string, refreshToken: string): Promise<string | null> {
	const response = await fetch(`https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: env.AZURE_AD_CLIENT_ID as string,
			client_secret: env.AZURE_AD_CLIENT_SECRET as string,
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			scope: env.AZURE_AD_TOKEN_SCOPE || `${env.AZURE_AD_CLIENT_ID}/.default`,
		}),
	});
	if (!response.ok) {
		throw new Error(`Microsoft token endpoint answered ${response.status}`);
	}
	const body = (await response.json()) as { access_token?: string; expires_in?: number; refresh_token?: string };
	if (!body.access_token) {
		return null;
	}
	if (body.refresh_token) {
		await updateRefreshToken(userId, PROVIDER_ID, body.refresh_token);
	}
	downstreamTokens.set(userId, {
		token: body.access_token,
		expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
	});
	return body.access_token;
}
