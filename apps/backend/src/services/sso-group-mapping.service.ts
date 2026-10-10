/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { env } from '../env';
import { countOrgAdmins, getUserOrgMembership, updateOrgMemberRole } from '../queries/organization.queries';
import type { OrgRole } from '../types/organization';
import { logger } from '../utils/logger';
import {
	decideGroupOrganizationRoleMapping,
	extractGroups,
	parseEntraGroupOrganizationRoleMapping,
	parseGroupOrganizationRoleMapping,
	resolveOrganizationRoleFromGroups,
} from '../utils/sso-group-mapping';
import { hasFeature, LICENSE_FEATURES } from './license.service';
import { isMicrosoftConfigured } from './microsoft-auth.service';
import { getOidcProviderId, isOidcConfigured } from './oidc-auth.service';
import { readDecodedIdTokenClaims, readVerifiedOidcIdTokenClaims } from './sso-token.service';

export const DEFAULT_GROUPS_CLAIM = 'groups';

export type SsoTokenProblem =
	| 'no-token'
	| 'invalid-token'
	| 'claim-missing'
	| 'claim-malformed'
	| 'no-mapping'
	| 'no-group-matched'
	| null;

export interface SsoTokenInspection {
	claimName: string;
	groups: string[];
	matchedGroups: string[];
	resolvedOrganizationRole: OrgRole | null;
	problem: SsoTokenProblem;
	claims: Record<string, unknown> | null;
	issuedAt: string | null;
	mapping: { group: string; organizationRole: OrgRole }[];
}

export async function isOrganizationRoleMappingActive(): Promise<boolean> {
	const [oidc, microsoft] = await Promise.all([
		isOidcOrganizationRoleMappingActive(),
		isMicrosoftOrganizationRoleMappingActive(),
	]);
	return oidc || microsoft;
}

export async function isOidcOrganizationRoleMappingActive(): Promise<boolean> {
	if (!isOidcConfigured() || getOidcRoleMapping().size === 0) {
		return false;
	}
	return hasFeature(LICENSE_FEATURES.sso);
}

export async function isMicrosoftOrganizationRoleMappingActive(): Promise<boolean> {
	if (!isMicrosoftConfigured() || getMicrosoftRoleMapping().size === 0) {
		return false;
	}
	return hasFeature(LICENSE_FEATURES.sso);
}

/** Shows an admin what the identity provider sent and which organization role it maps to. */
export async function inspectSsoToken(userId: string): Promise<SsoTokenInspection> {
	const claimName = getGroupsClaimName();
	const mapping = getOidcRoleMapping();
	const base = {
		claimName,
		mapping: [...mapping].map(([group, organizationRole]) => ({ group, organizationRole })),
	};
	const token = await readDecodedIdTokenClaims(userId, getOidcProviderId());
	if (token.status !== 'decoded') {
		return {
			...base,
			...emptyResult(),
			problem: token.status === 'no-token' ? 'no-token' : 'invalid-token',
		};
	}
	const groups = extractGroups(token.claims, claimName);
	const matchedGroups = groups.filter((group) => mapping.has(group.trim().toLowerCase()));
	return {
		...base,
		groups,
		matchedGroups,
		resolvedOrganizationRole: resolveOrganizationRoleFromGroups(groups, mapping),
		problem: describeProblem(token.claims, claimName, mapping, matchedGroups),
		claims: token.claims,
		issuedAt: typeof token.claims.iat === 'number' ? new Date(token.claims.iat * 1000).toISOString() : null,
	};
}

export async function syncOrganizationRoleFromSsoGroups(userId: string): Promise<void> {
	if (!(await isOidcOrganizationRoleMappingActive())) {
		return;
	}
	const token = await readVerifiedOidcIdTokenClaims(userId);
	if (token.status !== 'verified') {
		logger.warn('Could not verify the SSO ID token, leaving roles untouched', {
			source: 'system',
			context: { userId, problem: token.status },
		});
		return;
	}
	const decision = decideGroupOrganizationRoleMapping(token.claims, getGroupsClaimName(), getOidcRoleMapping());
	if (decision.organizationRole) {
		await applyOrganizationRole(userId, decision.organizationRole);
	}
}

export async function syncOrganizationRoleFromMicrosoftGroups(userId: string, groupIds: string[]): Promise<void> {
	if (!(await isMicrosoftOrganizationRoleMappingActive())) {
		return;
	}
	const role = resolveOrganizationRoleFromGroups(groupIds, getMicrosoftRoleMapping());
	if (role) {
		await applyOrganizationRole(userId, role);
	}
}

async function applyOrganizationRole(userId: string, nextRole: OrgRole): Promise<void> {
	const membership = await getUserOrgMembership(userId);
	if (!membership || membership.role === nextRole) {
		return;
	}
	if (membership.role === 'admin' && (await countOrgAdmins(membership.orgId)) <= 1) {
		logger.warn('Skipped SSO group demotion of the last organization admin', {
			source: 'system',
			context: { orgId: membership.orgId, nextRole },
		});
		return;
	}
	await updateOrgMemberRole(membership.orgId, userId, nextRole);
}

function describeProblem(
	claims: Record<string, unknown>,
	claimName: string,
	mapping: Map<string, OrgRole>,
	matchedGroups: string[],
): SsoTokenProblem {
	const value = claims[claimName];
	if (value === undefined || value === null) {
		return 'claim-missing';
	}
	if (!Array.isArray(value) && typeof value !== 'string') {
		return 'claim-malformed';
	}
	if (mapping.size === 0) {
		return 'no-mapping';
	}
	return matchedGroups.length === 0 ? 'no-group-matched' : null;
}

function emptyResult(): Omit<SsoTokenInspection, 'claimName' | 'mapping' | 'problem'> {
	return { groups: [], matchedGroups: [], resolvedOrganizationRole: null, claims: null, issuedAt: null };
}

function getGroupsClaimName(): string {
	return env.OIDC_GROUPS_CLAIM || DEFAULT_GROUPS_CLAIM;
}

function getOidcRoleMapping(): Map<string, OrgRole> {
	return parseGroupOrganizationRoleMapping(env.OIDC_GROUP_INSIGHT_ROLE_MAPPING);
}

function getMicrosoftRoleMapping(): Map<string, OrgRole> {
	const parsed = parseEntraGroupOrganizationRoleMapping(env.AZURE_AD_GROUP_INSIGHT_ROLE_MAPPING);
	return parsed.status === 'valid' ? parsed.mapping : new Map();
}
