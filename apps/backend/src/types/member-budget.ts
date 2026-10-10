/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import type {
	InheritedMemberBudgetSource,
	MemberBudgetSource,
	MemberBudgetStatus,
} from '@insight/shared/member-budget';
import type { MemberBudgetPeriod } from '@insight/shared/types';
import { z } from 'zod';

export { DEFAULT_MEMBER_BUDGET_PERIOD } from '@insight/shared/member-budget';
export type { InheritedMemberBudgetSource, MemberBudgetSource, MemberBudgetStatus };

/** Whole US dollars; 0 means no limit, null removes the budget. */
export const budgetLimitUsdSchema = z.number().int().min(0).max(1_000_000).nullable();

export interface MemberBudgetLimit {
	limitUsd: number;
	source: MemberBudgetSource;
	inheritedLimitUsd: number;
	inheritedSource: InheritedMemberBudgetSource;
	period: MemberBudgetPeriod;
}

export interface MemberBudgetUsage extends MemberBudgetLimit {
	spendUsd: number;
	ratio: number;
	status: MemberBudgetStatus;
	resetsAt: Date;
}
