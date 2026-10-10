/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { env } from '../env';
import { getLoginTokens } from '../queries/account.queries';
import {
	hasSsoUserGroupSyncState,
	listConfiguredSsoGroupIdentifiers,
	reconcileSsoUserGroupMemberships,
} from '../queries/sso-user-group-membership.queries';
import { logger, serializeError } from '../utils/logger';
import {
	type EntraGroupInsightGroupMapping,
	hasMicrosoftGroupsOverage,
	parseEntraGroupInsightGroupMapping,
	parseEntraGroupOrganizationRoleMapping,
} from '../utils/sso-group-mapping';
import { hasFeature, LICENSE_FEATURES } from './license.service';
import { syncOrganizationRoleFromMicrosoftGroups } from './sso-group-mapping.service';
import { verifyMicrosoftIdTokenClaims } from './sso-token.service';

const PROVIDER_ID = 'microsoft';
const GRAPH_CHECK_MEMBER_OBJECTS_URL = 'https://graph.microsoft.com/v1.0/me/checkMemberObjects';
const GRAPH_BATCH_SIZE = 20;
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Keeps Microsoft user group memberships and the organization role in line with Entra groups. */
export async function syncUserGroupsFromMicrosoft(userId: string): Promise<void> {
	if (!(await hasFeature(LICENSE_FEATURES.sso))) {
		return;
	}
	const entraMappings = parseGroupMappings();
	const roleGroupIds = parseRoleGroupIds();
	if (
		entraMappings.length === 0 &&
		roleGroupIds.length === 0 &&
		!(await hasSsoUserGroupSyncState(userId, PROVIDER_ID))
	) {
		return;
	}
	let groupIds: string[] | null;
	try {
		groupIds = await readMemberGroupIds(userId, entraMappings, roleGroupIds);
	} catch (error) {
		logger.error('Failed to resolve Microsoft group memberships', {
			source: 'system',
			context: { userId, error: serializeError(error) },
		});
		return;
	}
	if (!groupIds) {
		return;
	}
	await reconcileGroups(userId, groupIds, entraMappings);
	await syncOrganizationRoleFromMicrosoftGroups(userId, groupIds);
}

/** Asks Graph which of the candidate groups the user belongs to, 20 IDs per request. */
export async function resolveMicrosoftGraphMemberships(
	accessToken: string,
	candidateGroupIds: string[],
	fetcher: typeof fetch = fetch,
): Promise<string[]> {
	const candidates = unique(candidateGroupIds.map((id) => id.toLowerCase()));
	const members: string[] = [];
	for (let start = 0; start < candidates.length; start += GRAPH_BATCH_SIZE) {
		const batch = candidates.slice(start, start + GRAPH_BATCH_SIZE);
		members.push(...(await checkMemberObjects(accessToken, batch, fetcher)));
	}
	return members;
}

async function readMemberGroupIds(
	userId: string,
	entraMappings: EntraGroupInsightGroupMapping[],
	roleGroupIds: string[],
): Promise<string[] | null> {
	const tokens = await getLoginTokens(userId, PROVIDER_ID);
	if (!tokens?.idToken) {
		return preserve(userId, 'no ID token is stored');
	}
	const verified = await verifyMicrosoftIdTokenClaims(tokens.idToken);
	if (verified.status !== 'verified') {
		return preserve(userId, `the ID token is ${verified.status}`);
	}
	if (hasMicrosoftGroupsOverage(verified.claims)) {
		return resolveOverage(userId, tokens, entraMappings, roleGroupIds);
	}
	const claim = verified.claims.groups;
	if (!Array.isArray(claim) || !claim.every((id) => typeof id === 'string' && GUID_PATTERN.test(id.toLowerCase()))) {
		return preserve(userId, claim === undefined ? 'the groups claim is missing' : 'the groups claim is malformed');
	}
	return unique(claim.map((id: string) => id.toLowerCase()));
}

async function resolveOverage(
	userId: string,
	tokens: { accessToken: string | null; accessTokenExpiresAt: Date | null },
	entraMappings: EntraGroupInsightGroupMapping[],
	roleGroupIds: string[],
): Promise<string[] | null> {
	const candidates = unique([
		...(await listConfiguredSsoGroupIdentifiers(userId, PROVIDER_ID, true)).map((id) => id.toLowerCase()),
		...entraMappings.map((mapping) => mapping.entraGroupId),
		...roleGroupIds,
	]);
	if (candidates.length === 0) {
		return [];
	}
	const expired = tokens.accessTokenExpiresAt && tokens.accessTokenExpiresAt.getTime() <= Date.now();
	if (!tokens.accessToken || expired) {
		return preserve(userId, 'the Microsoft access token is unavailable or expired');
	}
	return resolveMicrosoftGraphMemberships(tokens.accessToken, candidates);
}

async function reconcileGroups(userId: string, groupIds: string[], entraMappings: EntraGroupInsightGroupMapping[]) {
	try {
		const hasUnlimitedUserGroups = await hasFeature(LICENSE_FEATURES.userGroups);
		await reconcileSsoUserGroupMemberships(userId, PROVIDER_ID, groupIds, {
			hasUnlimitedUserGroups,
			entraMappings,
		});
	} catch (error) {
		logger.error('Failed to sync User Group memberships from Microsoft', {
			source: 'system',
			context: { userId, error: serializeError(error) },
		});
	}
}

async function checkMemberObjects(accessToken: string, batch: string[], fetcher: typeof fetch): Promise<string[]> {
	const response = await fetcher(GRAPH_CHECK_MEMBER_OBJECTS_URL, {
		method: 'POST',
		headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ ids: batch }),
	});
	if (!response.ok) {
		throw new Error(`Microsoft Graph answered with status ${response.status}`);
	}
	const body = (await response.json()) as { value?: unknown };
	const requested = new Set(batch);
	if (
		!Array.isArray(body.value) ||
		!body.value.every((id) => typeof id === 'string' && requested.has(id.toLowerCase()))
	) {
		throw new Error('Microsoft Graph returned a malformed membership response');
	}
	return body.value.map((id: string) => id.toLowerCase());
}

function parseGroupMappings(): EntraGroupInsightGroupMapping[] {
	const parsed = parseEntraGroupInsightGroupMapping(env.AZURE_AD_GROUP_INSIGHT_GROUP_MAPPING);
	return parsed.status === 'valid' ? parsed.mappings : [];
}

function parseRoleGroupIds(): string[] {
	const parsed = parseEntraGroupOrganizationRoleMapping(env.AZURE_AD_GROUP_INSIGHT_ROLE_MAPPING);
	return parsed.status === 'valid' ? [...parsed.mapping.keys()] : [];
}

function preserve(userId: string, reason: string): null {
	logger.warn('Kept existing Microsoft User Group memberships', { source: 'system', context: { userId, reason } });
	return null;
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}
