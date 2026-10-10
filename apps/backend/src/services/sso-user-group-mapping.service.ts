/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import {
	type EntraGroupInsightGroupMapping,
	type OidcGroupInsightGroupMapping,
	resolveEntraGroupInsightGroupMappings,
	resolveOidcGroupInsightGroupMappings,
} from '../utils/sso-group-mapping';
import { listActiveUserGroups } from './user-group-availability.service';

export interface EffectiveSsoUserGroupMapping {
	identifier: string;
	targetGroupId: string | null;
	targetGroupName: string;
}

/** What each environment mapping resolves to in this project; unresolved targets come back with a null id. */
export async function listEffectiveOidcUserGroupMappings(
	projectId: string,
	mappings: OidcGroupInsightGroupMapping[],
): Promise<EffectiveSsoUserGroupMapping[]> {
	const identifiers = uniqueInOrder(mappings.map((mapping) => mapping.oidcGroup));
	return resolveTargets(projectId, resolveOidcGroupInsightGroupMappings(identifiers, projectId, mappings));
}

export async function listEffectiveEntraUserGroupMappings(
	projectId: string,
	mappings: EntraGroupInsightGroupMapping[],
): Promise<EffectiveSsoUserGroupMapping[]> {
	const identifiers = uniqueInOrder(mappings.map((mapping) => mapping.entraGroupId));
	return resolveTargets(projectId, resolveEntraGroupInsightGroupMappings(identifiers, projectId, mappings));
}

async function resolveTargets(projectId: string, names: Map<string, string>): Promise<EffectiveSsoUserGroupMapping[]> {
	if (names.size === 0) {
		return [];
	}
	const customGroups = (await listActiveUserGroups(projectId)).filter((group) => !group.isDefault);
	return [...names].map(([identifier, name]) => {
		const target = customGroups.find((group) => group.name.toLowerCase() === name.toLowerCase());
		return target
			? { identifier, targetGroupId: target.id, targetGroupName: target.name }
			: { identifier, targetGroupId: null, targetGroupName: name };
	});
}

function uniqueInOrder(values: string[]): string[] {
	return [...new Set(values)];
}
