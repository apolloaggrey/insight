/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { env } from '../env';
import {
	hasSsoUserGroupSyncState,
	reconcileSsoUserGroupMemberships,
} from '../queries/sso-user-group-membership.queries';
import { logger, serializeError } from '../utils/logger';
import { extractGroups, parseOidcGroupInsightGroupMapping } from '../utils/sso-group-mapping';
import { hasFeature, LICENSE_FEATURES } from './license.service';
import { DEFAULT_GROUPS_CLAIM } from './sso-group-mapping.service';
import { readVerifiedOidcIdTokenClaims } from './sso-token.service';

/** The groups claim decides OIDC user group memberships; an unreadable claim leaves them as they are. */
export async function syncUserGroupsFromOidc(userId: string): Promise<void> {
	try {
		await syncFromVerifiedClaims(userId);
	} catch (error) {
		logger.error('Failed to sync User Group memberships from OIDC', {
			source: 'system',
			context: { userId, error: serializeError(error) },
		});
	}
}

async function syncFromVerifiedClaims(userId: string): Promise<void> {
	if (!(await hasFeature(LICENSE_FEATURES.sso))) {
		return;
	}
	const parsed = parseOidcGroupInsightGroupMapping(env.OIDC_GROUP_INSIGHT_GROUP_MAPPING);
	const oidcMappings = parsed.status === 'valid' ? parsed.mappings : [];
	if (oidcMappings.length === 0 && !(await hasSsoUserGroupSyncState(userId, 'oidc'))) {
		return;
	}
	const groups = await readClaimedGroups(userId);
	if (!groups) {
		return;
	}
	const hasUnlimitedUserGroups = await hasFeature(LICENSE_FEATURES.userGroups);
	await reconcileSsoUserGroupMemberships(userId, 'oidc', groups, { hasUnlimitedUserGroups, oidcMappings });
}

async function readClaimedGroups(userId: string): Promise<string[] | null> {
	const token = await readVerifiedOidcIdTokenClaims(userId);
	if (token.status !== 'verified') {
		warnPreserved(userId, `the ID token is ${token.status}`);
		return null;
	}
	const claimName = env.OIDC_GROUPS_CLAIM || DEFAULT_GROUPS_CLAIM;
	const value = token.claims[claimName];
	if (!Array.isArray(value) && typeof value !== 'string') {
		warnPreserved(
			userId,
			value === undefined ? `the ${claimName} claim is missing` : `the ${claimName} claim is malformed`,
		);
		return null;
	}
	return extractGroups(token.claims, claimName);
}

function warnPreserved(userId: string, reason: string): void {
	logger.warn('Kept existing OIDC User Group memberships', { source: 'system', context: { userId, reason } });
}
