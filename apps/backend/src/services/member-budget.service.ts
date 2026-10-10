/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { getNextPeriodStart } from '@insight/shared/date';
import { getMemberBudgetStatus, type MemberBudgetStatus } from '@insight/shared/member-budget';
import type { MemberBudgetPeriod } from '@insight/shared/types';

import * as memberBudgetQueries from '../queries/member-budget.queries';
import { listProjectMembersWithRoles } from '../queries/project.queries';
import * as userGroupQueries from '../queries/user-group.queries';
import type { MemberBudgetLimit } from '../types/member-budget';
import { getMemberBudgetLimit } from '../utils/member-budget';

export interface MemberBudgetView extends MemberBudgetLimit {
	spendUsd: number;
	status: MemberBudgetStatus;
	resetsAt: Date;
}

export interface MemberBudgetOverviewMember extends MemberBudgetView {
	id: string;
	name: string;
	email: string;
	role: string;
	personalLimitUsd: number | null;
	groupIds: string[];
}

export interface MemberBudgetOverviewGroup {
	id: string;
	name: string;
	isDefault: boolean;
	limitUsd: number | null;
}

export interface MemberBudgetOverview {
	period: MemberBudgetPeriod;
	defaultLimitUsd: number;
	groups: MemberBudgetOverviewGroup[];
	members: MemberBudgetOverviewMember[];
}

export async function getMemberBudget(projectId: string, userId: string): Promise<MemberBudgetView> {
	const limit = await getMemberBudgetLimit(projectId, userId);
	const spendUsd = await memberBudgetQueries.getUserPeriodCost(projectId, userId, limit.period);
	return toView(limit, spendUsd);
}

/**
 * Every group budget and every member with the limit that applies to them and their spend this period.
 * The default group carries no limit here: its budget is defaultLimitUsd.
 */
export async function getMemberBudgetOverview(projectId: string): Promise<MemberBudgetOverview> {
	const settings = await memberBudgetQueries.getMemberBudgetSettings(projectId);
	const [members, costs, groups, groupBudgets, personalBudgets, memberships] = await Promise.all([
		listProjectMembersWithRoles(projectId),
		memberBudgetQueries.getPeriodCostsByUser(projectId, settings.period),
		userGroupQueries.listUserGroups(projectId),
		memberBudgetQueries.listGroupBudgets(projectId),
		memberBudgetQueries.listPersonalBudgets(projectId),
		listAllMemberships(projectId),
	]);
	const groupLimit = new Map(groupBudgets.map((budget) => [budget.groupId, budget.limitUsd]));
	const personalLimit = new Map(personalBudgets.map((budget) => [budget.userId, budget.limitUsd]));
	return {
		period: settings.period,
		defaultLimitUsd: settings.defaultLimitUsd,
		groups: groups.map((group) => ({
			id: group.id,
			name: group.name,
			isDefault: group.isDefault,
			limitUsd: group.isDefault ? null : (groupLimit.get(group.id) ?? null),
		})),
		members: await Promise.all(
			members.map(async (member) => ({
				id: member.id,
				name: member.name,
				email: member.email,
				role: member.role,
				personalLimitUsd: personalLimit.get(member.id) ?? null,
				groupIds: memberships.get(member.id) ?? [],
				...toView(await getMemberBudgetLimit(projectId, member.id), costs[member.id] ?? 0),
			})),
		),
	};
}

export async function getMemberBudgetSettings(projectId: string) {
	return memberBudgetQueries.getMemberBudgetSettings(projectId);
}

export async function getMemberSpendForPeriod(projectId: string, period: MemberBudgetPeriod) {
	return memberBudgetQueries.getPeriodCostsByUser(projectId, period);
}

export async function saveMemberBudgets(projectId: string, settings: memberBudgetQueries.MemberBudgetSettings) {
	await memberBudgetQueries.saveMemberBudgetSettings(projectId, settings);
}

export async function setPersonalBudget(projectId: string, userId: string, limitUsd: number | null): Promise<void> {
	await memberBudgetQueries.setPersonalBudget(projectId, userId, limitUsd);
}

/** The default group has no budget of its own: its budget is the project's default member budget. */
export async function setGroupBudget(projectId: string, groupId: string, limitUsd: number | null): Promise<void> {
	const groups = await userGroupQueries.listUserGroups(projectId);
	if (groups.find((group) => group.id === groupId)?.isDefault) {
		const settings = await memberBudgetQueries.getMemberBudgetSettings(projectId);
		await memberBudgetQueries.saveMemberBudgetSettings(projectId, { ...settings, defaultLimitUsd: limitUsd ?? 0 });
		return;
	}
	await memberBudgetQueries.setGroupBudget(projectId, groupId, limitUsd);
}

async function listAllMemberships(projectId: string): Promise<Map<string, string[]>> {
	const [manual, sso] = await Promise.all([
		userGroupQueries.listUserGroupMemberships(projectId),
		userGroupQueries.listUserGroupSsoMemberships(projectId),
	]);
	const byUser = new Map<string, string[]>();
	for (const { userId, groupId } of [...manual, ...sso]) {
		byUser.set(userId, [...new Set([...(byUser.get(userId) ?? []), groupId])]);
	}
	return byUser;
}

function toView(limit: MemberBudgetLimit, spendUsd: number): MemberBudgetView {
	return {
		...limit,
		spendUsd,
		status: getMemberBudgetStatus(spendUsd, limit.limitUsd),
		resetsAt: getNextPeriodStart(limit.period),
	};
}
