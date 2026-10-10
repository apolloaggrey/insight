import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	listActiveUserGroups: vi.fn(),
}));

vi.mock('../src/services/user-group-availability.service', () => ({
	listActiveUserGroups: mocks.listActiveUserGroups,
}));

import {
	listEffectiveEntraUserGroupMappings,
	listEffectiveOidcUserGroupMappings,
} from '../src/services/sso-user-group-mapping.service';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.listActiveUserGroups.mockResolvedValue([
		{ id: 'analysts-id', name: 'Analysts', isDefault: false },
		{ id: 'marketing-id', name: 'Marketing', isDefault: false },
		{ id: 'all-users-id', name: 'All Users', isDefault: true },
	]);
});

describe('listEffectiveOidcUserGroupMappings', () => {
	it('resolves wildcard mappings and lets the current project override them', async () => {
		const mappings = [
			{ oidcGroup: 'finance', projectScope: '*', insightUserGroup: 'analysts' },
			{ oidcGroup: 'finance', projectScope: 'project-1', insightUserGroup: 'marketing' },
			{ oidcGroup: 'sales', projectScope: '*', insightUserGroup: 'analysts' },
		];

		await expect(listEffectiveOidcUserGroupMappings('project-1', mappings)).resolves.toEqual([
			{ identifier: 'finance', targetGroupId: 'marketing-id', targetGroupName: 'Marketing' },
			{ identifier: 'sales', targetGroupId: 'analysts-id', targetGroupName: 'Analysts' },
		]);
	});

	it('does not expose mappings belonging only to another project', async () => {
		await expect(
			listEffectiveOidcUserGroupMappings('project-1', [
				{ oidcGroup: 'finance', projectScope: 'project-2', insightUserGroup: 'analysts' },
			]),
		).resolves.toEqual([]);
	});

	it('reports missing, default, and unavailable targets as unresolved overrides', async () => {
		await expect(
			listEffectiveOidcUserGroupMappings('project-1', [
				{ oidcGroup: 'missing', projectScope: '*', insightUserGroup: 'missing group' },
				{ oidcGroup: 'everyone', projectScope: '*', insightUserGroup: 'all users' },
				{ oidcGroup: 'locked', projectScope: '*', insightUserGroup: 'locked group' },
			]),
		).resolves.toEqual([
			{ identifier: 'missing', targetGroupId: null, targetGroupName: 'missing group' },
			{ identifier: 'everyone', targetGroupId: null, targetGroupName: 'all users' },
			{ identifier: 'locked', targetGroupId: null, targetGroupName: 'locked group' },
		]);
		expect(mocks.listActiveUserGroups).toHaveBeenCalledWith('project-1');
	});

	it('matches target User Group names case-insensitively', async () => {
		await expect(
			listEffectiveOidcUserGroupMappings('project-1', [
				{ oidcGroup: 'finance', projectScope: '*', insightUserGroup: 'ANALYSTS' },
			]),
		).resolves.toEqual([{ identifier: 'finance', targetGroupId: 'analysts-id', targetGroupName: 'Analysts' }]);
	});
});

describe('listEffectiveEntraUserGroupMappings', () => {
	it('reports unresolved Entra targets without activating a UI fallback', async () => {
		const groupId = 'a0b1c2d3-e4f5-6789-abcd-ef0123456789';
		await expect(
			listEffectiveEntraUserGroupMappings('project-1', [
				{ entraGroupId: groupId, projectScope: '*', insightUserGroup: 'missing group' },
			]),
		).resolves.toEqual([{ identifier: groupId, targetGroupId: null, targetGroupName: 'missing group' }]);
	});
});
