/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { getAgentSettings } from '../queries/project.queries';
import type { AgentSettings } from '../types/agent-settings';
import { hasFeature, LICENSE_FEATURES } from './license.service';

/** On by default once the feature is available; a project can switch it off in its agent settings. */
export async function resolveExcludedColumnEnforcement(settings: AgentSettings | null | undefined): Promise<boolean> {
	if (!(await hasFeature(LICENSE_FEATURES.excludeColumns))) {
		return false;
	}
	return settings?.sql?.enforceExcludedColumns ?? true;
}

export async function resolveExcludedColumnEnforcementForProject(projectId: string): Promise<boolean> {
	return resolveExcludedColumnEnforcement(await getAgentSettings(projectId));
}
