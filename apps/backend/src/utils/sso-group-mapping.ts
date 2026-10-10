/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import type { UserRole } from '@insight/shared/types';

import type { OrgRole } from '../types/organization';

export interface OidcGroupInsightGroupMapping {
	oidcGroup: string;
	projectScope: string;
	insightUserGroup: string;
}

export interface EntraGroupInsightGroupMapping {
	entraGroupId: string;
	projectScope: string;
	insightUserGroup: string;
}

export type GroupMappingParseResult<T> = { status: 'valid'; mappings: T[] } | { status: 'invalid'; reason: string };
export type OrganizationRoleMappingParseResult =
	| { status: 'valid'; mapping: Map<string, OrgRole> }
	| { status: 'invalid'; reason: string };

export interface GroupMappingTarget {
	id: string;
	name: string;
}

export interface GroupOrganizationRoleDecision {
	action: 'allow' | 'deny';
	organizationRole: OrgRole | null;
	claimPresent: boolean;
}

const WILDCARD_SCOPE = '*';
const ORGANIZATION_ROLES: readonly OrgRole[] = ['admin', 'user', 'viewer'];
const ROLE_STRENGTH: Record<UserRole, number> = { viewer: 0, user: 1, context_admin: 2, admin: 3 };
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseGroupOrganizationRoleMapping(raw: string | undefined): Map<string, OrgRole> {
	const mapping = new Map<string, OrgRole>();
	for (const entry of splitEntries(raw)) {
		const parsed = splitOnLastColon(entry);
		if (parsed && isOrganizationRole(parsed.value)) {
			mapping.set(normalizeName(parsed.key), parsed.value);
		}
	}
	return mapping;
}

export function parseEntraGroupOrganizationRoleMapping(raw: string | undefined): OrganizationRoleMappingParseResult {
	const mapping = new Map<string, OrgRole>();
	for (const entry of splitEntries(raw)) {
		const parsed = splitOnLastColon(entry);
		if (!parsed) {
			return invalid(`"${entry}" is not group-id:role`);
		}
		const groupId = normalizeName(parsed.key);
		if (!GUID_PATTERN.test(groupId)) {
			return invalid(`"${parsed.key}" is not a Microsoft Entra group Object ID`);
		}
		if (!isOrganizationRole(parsed.value)) {
			return invalid(`"${parsed.value}" is not an organization role`);
		}
		const existing = mapping.get(groupId);
		if (existing && existing !== parsed.value) {
			return invalid(`group ${groupId} is mapped to more than one role`);
		}
		mapping.set(groupId, parsed.value);
	}
	return { status: 'valid', mapping };
}

export function parseOidcGroupInsightGroupMapping(
	raw: string | undefined,
): GroupMappingParseResult<OidcGroupInsightGroupMapping> {
	const parsed = parseGroupTargetEntries(raw, () => true);
	if (parsed.status === 'invalid') {
		return parsed;
	}
	return {
		status: 'valid',
		mappings: parsed.mappings.map((entry) => ({
			oidcGroup: entry.group,
			projectScope: entry.projectScope,
			insightUserGroup: entry.insightUserGroup,
		})),
	};
}

export function parseEntraGroupInsightGroupMapping(
	raw: string | undefined,
): GroupMappingParseResult<EntraGroupInsightGroupMapping> {
	const parsed = parseGroupTargetEntries(raw, (group) => GUID_PATTERN.test(group));
	if (parsed.status === 'invalid') {
		return parsed;
	}
	return {
		status: 'valid',
		mappings: parsed.mappings.map((entry) => ({
			entraGroupId: entry.group,
			projectScope: entry.projectScope,
			insightUserGroup: entry.insightUserGroup,
		})),
	};
}

export function resolveOidcGroupInsightGroupMappings(
	groups: string[],
	projectId: string,
	mappings: OidcGroupInsightGroupMapping[],
): Map<string, string> {
	return resolveGroupNames(
		groups,
		projectId,
		mappings.map((mapping) => ({ ...mapping, group: mapping.oidcGroup })),
	);
}

export function resolveEntraGroupInsightGroupMappings(
	groupIds: string[],
	projectId: string,
	mappings: EntraGroupInsightGroupMapping[],
): Map<string, string> {
	return resolveGroupNames(
		groupIds,
		projectId,
		mappings.map((mapping) => ({ ...mapping, group: mapping.entraGroupId })),
	);
}

export function resolveOidcGroupInsightGroupMappingTargets(
	projectId: string,
	mappings: OidcGroupInsightGroupMapping[],
	availableTargets: GroupMappingTarget[],
): Map<string, GroupMappingTarget> {
	const names = resolveOidcGroupInsightGroupMappings(
		mappings.map((mapping) => mapping.oidcGroup),
		projectId,
		mappings,
	);
	return matchTargets(names, availableTargets);
}

export function resolveEntraGroupInsightGroupMappingTargets(
	projectId: string,
	mappings: EntraGroupInsightGroupMapping[],
	availableTargets: GroupMappingTarget[],
): Map<string, GroupMappingTarget> {
	const names = resolveEntraGroupInsightGroupMappings(
		mappings.map((mapping) => mapping.entraGroupId),
		projectId,
		mappings,
	);
	return matchTargets(names, availableTargets);
}

export function resolveOrganizationRoleFromGroups(groups: string[], mapping: Map<string, OrgRole>): OrgRole | null {
	const roles = groups.flatMap((group) => {
		const role = mapping.get(normalizeName(group));
		return role ? [role] : [];
	});
	return resolveStrongestUserRole(roles) as OrgRole | null;
}

export function resolveStrongestUserRole(roles: UserRole[]): UserRole | null {
	return roles.reduce<UserRole | null>(
		(strongest, role) => (!strongest || ROLE_STRENGTH[role] > ROLE_STRENGTH[strongest] ? role : strongest),
		null,
	);
}

/** A present claim that maps to no role denies sign-in; a missing or undecodable claim leaves roles alone. */
export function decideGroupOrganizationRoleMapping(
	claims: Record<string, unknown> | null | undefined,
	claimName: string,
	mapping: Map<string, OrgRole>,
): GroupOrganizationRoleDecision {
	if (!claims || !(claimName in claims) || claims[claimName] === undefined || claims[claimName] === null) {
		return { action: 'allow', organizationRole: null, claimPresent: false };
	}
	const organizationRole = resolveOrganizationRoleFromGroups(extractGroups(claims, claimName), mapping);
	return { action: organizationRole ? 'allow' : 'deny', organizationRole, claimPresent: true };
}

export function extractGroups(claims: Record<string, unknown>, claimName: string): string[] {
	const value = claims[claimName];
	if (Array.isArray(value)) {
		return value.filter((group): group is string => typeof group === 'string');
	}
	if (typeof value === 'string') {
		return splitEntries(value);
	}
	return [];
}

/** Entra leaves groups out of the token when a user has too many; the token then only flags it. */
export function hasMicrosoftGroupsOverage(claims: Record<string, unknown>): boolean {
	const claimNames = claims._claim_names;
	const namesGroups =
		!!claimNames && typeof claimNames === 'object' && 'groups' in (claimNames as Record<string, unknown>);
	return namesGroups || claims.hasgroups === true || claims.hasgroups === 'true';
}

function parseGroupTargetEntries(
	raw: string | undefined,
	isValidGroup: (group: string) => boolean,
): GroupMappingParseResult<{ group: string; projectScope: string; insightUserGroup: string }> {
	const mappings: { group: string; projectScope: string; insightUserGroup: string }[] = [];
	for (const entry of splitEntries(raw)) {
		const parts = entry.split(':').map((part) => part.trim());
		if (parts.length !== 3 || parts.some((part) => part === '')) {
			return invalid(`"${entry}" is not group:project-scope:user-group`);
		}
		const [group, projectScope, insightUserGroup] = [normalizeName(parts[0]), parts[1], normalizeName(parts[2])];
		if (!isValidGroup(group)) {
			return invalid(`"${parts[0]}" is not a valid group identifier`);
		}
		const conflict = mappings.find((m) => m.group === group && m.projectScope === projectScope);
		if (conflict && conflict.insightUserGroup !== insightUserGroup) {
			return invalid(`group ${group} is mapped to more than one user group in scope ${projectScope}`);
		}
		if (!conflict) {
			mappings.push({ group, projectScope, insightUserGroup });
		}
	}
	return { status: 'valid', mappings };
}

function resolveGroupNames(
	groups: string[],
	projectId: string,
	mappings: { group: string; projectScope: string; insightUserGroup: string }[],
): Map<string, string> {
	const resolved = new Map<string, string>();
	for (const group of new Set(groups.map(normalizeName))) {
		const candidates = mappings.filter((mapping) => normalizeName(mapping.group) === group);
		const exact = candidates.find((mapping) => mapping.projectScope === projectId);
		const wildcard = candidates.find((mapping) => mapping.projectScope === WILDCARD_SCOPE);
		const chosen = exact ?? wildcard;
		if (chosen) {
			resolved.set(group, normalizeName(chosen.insightUserGroup));
		}
	}
	return resolved;
}

function matchTargets(
	names: Map<string, string>,
	availableTargets: GroupMappingTarget[],
): Map<string, GroupMappingTarget> {
	const matched = new Map<string, GroupMappingTarget>();
	for (const [group, name] of names) {
		const target = availableTargets.find((candidate) => normalizeName(candidate.name) === name);
		if (target) {
			matched.set(group, target);
		}
	}
	return matched;
}

function splitEntries(raw: string | undefined): string[] {
	return (raw ?? '')
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function splitOnLastColon(entry: string): { key: string; value: string } | null {
	const index = entry.lastIndexOf(':');
	if (index <= 0 || index === entry.length - 1) {
		return null;
	}
	return { key: entry.slice(0, index).trim(), value: entry.slice(index + 1).trim() };
}

function normalizeName(name: string): string {
	return name.trim().toLowerCase();
}

function isOrganizationRole(role: string): role is OrgRole {
	return (ORGANIZATION_ROLES as readonly string[]).includes(role);
}

function invalid(reason: string): { status: 'invalid'; reason: string } {
	return { status: 'invalid', reason };
}
