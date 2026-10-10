/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { isCloud } from '../env';
import { addUserToDefaultOrganizationIfExists } from '../queries/organization.queries';
import { syncUserGroupsFromMicrosoft } from './microsoft-user-group-membership.service';
import { isSocialProviderOidc } from './oidc-auth.service';
import { syncOrganizationRoleFromSsoGroups } from './sso-group-mapping.service';
import { syncUserGroupsFromOidc } from './sso-user-group-membership.service';

const MICROSOFT_PROVIDER_ID = 'microsoft';

/** Runs after every SSO sign-in. A failing step is logged and never blocks the sign-in. */
export async function syncSsoLoginGroups(userId: string, providerId: string | undefined): Promise<void> {
	if (providerId === MICROSOFT_PROVIDER_ID) {
		await restoreOrganization(userId);
		await runStep('Microsoft user group sync', userId, () => syncUserGroupsFromMicrosoft(userId));
		return;
	}
	if (!isSocialProviderOidc(providerId)) {
		return;
	}
	await restoreOrganization(userId);
	await runStep('OIDC user group sync', userId, () => syncUserGroupsFromOidc(userId));
	await runStep('OIDC organization role sync', userId, () => syncOrganizationRoleFromSsoGroups(userId));
}

async function restoreOrganization(userId: string): Promise<void> {
	if (isCloud) {
		return;
	}
	await runStep('default organization restore', userId, () => addUserToDefaultOrganizationIfExists(userId));
}

async function runStep(name: string, userId: string, step: () => Promise<unknown>): Promise<void> {
	try {
		await step();
	} catch (error) {
		console.error(`[sso] ${name} failed for user ${userId}:`, error instanceof Error ? error.message : error);
	}
}
