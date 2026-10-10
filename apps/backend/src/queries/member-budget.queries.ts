/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { getCurrentPeriodStart } from '@insight/shared/date';
import { DEFAULT_MEMBER_BUDGET_PERIOD } from '@insight/shared/member-budget';
import type { MemberBudgetPeriod } from '@insight/shared/types';
import { and, eq, sql } from 'drizzle-orm';

import s from '../db/abstractSchema';
import { db } from '../db/db';
import dbConfig, { Dialect } from '../db/dbConfig';
import { roundCost } from './budget.queries';
import { createCostLookup, MESSAGE_SENDER_EXPR, TOTAL_COST_EXPR } from './usage.queries';

export interface MemberBudgetSettings {
	period: MemberBudgetPeriod;
	defaultLimitUsd: number;
}

export interface GroupBudget {
	groupId: string;
	limitUsd: number;
}

export async function getMemberBudgetSettings(projectId: string): Promise<MemberBudgetSettings> {
	const [row] = await db
		.select({
			period: s.projectMemberBudgetSettings.period,
			defaultLimitUsd: s.projectMemberBudgetSettings.defaultLimitUsd,
		})
		.from(s.projectMemberBudgetSettings)
		.where(eq(s.projectMemberBudgetSettings.projectId, projectId))
		.limit(1)
		.execute();
	return row ?? { period: DEFAULT_MEMBER_BUDGET_PERIOD, defaultLimitUsd: 0 };
}

export async function saveMemberBudgetSettings(projectId: string, settings: MemberBudgetSettings): Promise<void> {
	await db
		.insert(s.projectMemberBudgetSettings)
		.values({ projectId, ...settings })
		.onConflictDoUpdate({
			target: s.projectMemberBudgetSettings.projectId,
			set: { ...settings, updatedAt: new Date() },
		})
		.execute();
}

export async function getPersonalBudget(projectId: string, userId: string): Promise<{ limitUsd: number } | null> {
	const [row] = await db
		.select({ limitUsd: s.projectMemberBudget.limitUsd })
		.from(s.projectMemberBudget)
		.where(and(eq(s.projectMemberBudget.projectId, projectId), eq(s.projectMemberBudget.userId, userId)))
		.limit(1)
		.execute();
	return row ?? null;
}

export async function listPersonalBudgets(projectId: string): Promise<{ userId: string; limitUsd: number }[]> {
	return db
		.select({ userId: s.projectMemberBudget.userId, limitUsd: s.projectMemberBudget.limitUsd })
		.from(s.projectMemberBudget)
		.where(eq(s.projectMemberBudget.projectId, projectId))
		.execute();
}

/** A null limit removes the personal budget, so the member falls back to their groups or the default. */
export async function setPersonalBudget(projectId: string, userId: string, limitUsd: number | null): Promise<void> {
	if (limitUsd === null) {
		await db
			.delete(s.projectMemberBudget)
			.where(and(eq(s.projectMemberBudget.projectId, projectId), eq(s.projectMemberBudget.userId, userId)))
			.execute();
		return;
	}
	await db
		.insert(s.projectMemberBudget)
		.values({ projectId, userId, limitUsd })
		.onConflictDoUpdate({
			target: [s.projectMemberBudget.projectId, s.projectMemberBudget.userId],
			set: { limitUsd, updatedAt: new Date() },
		})
		.execute();
}

export async function listGroupBudgets(projectId: string): Promise<GroupBudget[]> {
	return db
		.select({ groupId: s.projectGroupBudget.groupId, limitUsd: s.projectGroupBudget.limitUsd })
		.from(s.projectGroupBudget)
		.where(eq(s.projectGroupBudget.projectId, projectId))
		.execute();
}

export async function listGroupBudgetsForMember(projectId: string, userId: string): Promise<GroupBudget[]> {
	return db
		.select({ groupId: s.projectGroupBudget.groupId, limitUsd: s.projectGroupBudget.limitUsd })
		.from(s.projectGroupBudget)
		.innerJoin(s.userGroupMember, eq(s.userGroupMember.groupId, s.projectGroupBudget.groupId))
		.where(and(eq(s.projectGroupBudget.projectId, projectId), eq(s.userGroupMember.userId, userId)))
		.execute();
}

export async function setGroupBudget(projectId: string, groupId: string, limitUsd: number | null): Promise<void> {
	if (limitUsd === null) {
		await db.delete(s.projectGroupBudget).where(eq(s.projectGroupBudget.groupId, groupId)).execute();
		return;
	}
	await db
		.insert(s.projectGroupBudget)
		.values({ projectId, groupId, limitUsd })
		.onConflictDoUpdate({ target: s.projectGroupBudget.groupId, set: { limitUsd, updatedAt: new Date() } })
		.execute();
}

/** What a member has spent on every AI provider in this project since the period began. */
export async function getUserPeriodCost(
	projectId: string,
	userId: string,
	period: MemberBudgetPeriod,
): Promise<number> {
	const costs = await getPeriodCostsByUser(projectId, period, userId);
	return costs[userId] ?? 0;
}

export async function getPeriodCostsByUser(
	projectId: string,
	period: MemberBudgetPeriod,
	userId?: string,
): Promise<Record<string, number>> {
	const costLookup = await createCostLookup(projectId);
	const start = getCurrentPeriodStart(period);
	const startParam =
		dbConfig.dialect === Dialect.Postgres ? sql`${start.toISOString()}::timestamp` : sql`${start.getTime()}`;
	const rows = await db
		.select({ userId: MESSAGE_SENDER_EXPR, totalCost: sql<number>`sum(${TOTAL_COST_EXPR})` })
		.from(s.chatMessage)
		.innerJoin(s.chat, eq(s.chat.id, s.chatMessage.chatId))
		.leftJoin(costLookup.table, costLookup.joinCondition)
		.where(
			and(
				eq(s.chat.projectId, projectId),
				sql`${s.chatMessage.createdAt} >= ${startParam}`,
				userId ? eq(MESSAGE_SENDER_EXPR, userId) : undefined,
			),
		)
		.groupBy(MESSAGE_SENDER_EXPR);
	return Object.fromEntries(
		rows.filter((row) => row.userId).map((row) => [row.userId, roundCost(Number(row.totalCost ?? 0))]),
	);
}

export async function claimMemberBudgetNotification(
	projectId: string,
	userId: string,
	periodStart: Date,
): Promise<boolean> {
	const rows = await db
		.insert(s.memberBudgetNotification)
		.values({ projectId, userId, periodStart })
		.onConflictDoNothing()
		.returning({ id: s.memberBudgetNotification.id })
		.execute();
	return rows.length > 0;
}

export async function releaseMemberBudgetNotification(
	projectId: string,
	userId: string,
	periodStart: Date,
): Promise<void> {
	await db
		.delete(s.memberBudgetNotification)
		.where(
			and(
				eq(s.memberBudgetNotification.projectId, projectId),
				eq(s.memberBudgetNotification.userId, userId),
				eq(s.memberBudgetNotification.periodStart, periodStart),
			),
		)
		.execute();
}
