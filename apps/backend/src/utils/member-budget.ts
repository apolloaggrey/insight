/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { getNextPeriodStart } from '@insight/shared/date';
import { getMemberBudgetStatus, resolveMemberBudgetLimit } from '@insight/shared/member-budget';
import { TRPCError } from '@trpc/server';

import * as memberBudgetQueries from '../queries/member-budget.queries';
import { hasFeature, LICENSE_FEATURES } from '../services/license.service';
import { listActiveUserGroups } from '../services/user-group-availability.service';
import type { MemberBudgetLimit, MemberBudgetUsage } from '../types/member-budget';

export type { MemberBudgetLimit, MemberBudgetUsage };

export async function assertMemberBudgetLicensed(): Promise<void> {
	if (!(await hasFeature(LICENSE_FEATURES.userBudget))) {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Member budgets are switched off on this server.' });
	}
}

/** Personal budget first, then the most generous budget among the member's active groups, then the default. */
export async function getMemberBudgetLimit(projectId: string, userId: string): Promise<MemberBudgetLimit> {
	const [settings, personal, groupLimits] = await Promise.all([
		memberBudgetQueries.getMemberBudgetSettings(projectId),
		memberBudgetQueries.getPersonalBudget(projectId, userId),
		listActiveGroupLimits(projectId, userId),
	]);
	const inheritedSource = groupLimits.length > 0 ? 'group' : 'default';
	const inheritedLimitUsd = resolveMemberBudgetLimit(null, groupLimits, settings.defaultLimitUsd);
	return {
		limitUsd: personal ? personal.limitUsd : inheritedLimitUsd,
		source: personal ? 'personal' : inheritedSource,
		inheritedLimitUsd,
		inheritedSource,
		period: settings.period,
	};
}

/** Null when budgets are off or no limit applies to this member. */
export async function resolveMemberBudgetUsage(projectId: string, userId: string): Promise<MemberBudgetUsage | null> {
	if (!(await hasFeature(LICENSE_FEATURES.userBudget))) {
		return null;
	}
	const limit = await getMemberBudgetLimit(projectId, userId);
	if (limit.limitUsd <= 0) {
		return null;
	}
	const spendUsd = await memberBudgetQueries.getUserPeriodCost(projectId, userId, limit.period);
	return {
		...limit,
		spendUsd,
		ratio: spendUsd / limit.limitUsd,
		status: getMemberBudgetStatus(spendUsd, limit.limitUsd),
		resetsAt: getNextPeriodStart(limit.period),
	};
}

async function listActiveGroupLimits(projectId: string, userId: string): Promise<number[]> {
	const [budgets, activeGroups] = await Promise.all([
		memberBudgetQueries.listGroupBudgetsForMember(projectId, userId),
		listActiveUserGroups(projectId),
	]);
	const activeIds = new Set(activeGroups.map((group) => group.id));
	return budgets.filter((budget) => activeIds.has(budget.groupId)).map((budget) => budget.limitUsd);
}
