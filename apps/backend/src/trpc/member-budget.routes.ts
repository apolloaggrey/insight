/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { MEMBER_BUDGET_PERIODS } from '@insight/shared/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as projectQueries from '../queries/project.queries';
import * as memberBudgetService from '../services/member-budget.service';
import { budgetLimitUsdSchema } from '../types/member-budget';
import { assertMemberBudgetLicensed } from '../utils/member-budget';
import { adminProtectedProcedure, projectProtectedProcedure } from './trpc';

const memberInput = z.object({ userId: z.string() });

export const memberBudgetRoutes = {
	getMine: projectProtectedProcedure.query(async ({ ctx }) => {
		await assertMemberBudgetLicensed();
		return memberBudgetService.getMemberBudget(ctx.project.id, ctx.user.id);
	}),

	getForMember: adminProtectedProcedure.input(memberInput).query(async ({ ctx, input }) => {
		await assertMemberBudgetLicensed();
		await assertProjectMember(ctx.project.id, input.userId);
		return memberBudgetService.getMemberBudget(ctx.project.id, input.userId);
	}),

	getOverview: adminProtectedProcedure.query(async ({ ctx }) => {
		await assertMemberBudgetLicensed();
		return memberBudgetService.getMemberBudgetOverview(ctx.project.id);
	}),

	getSettings: adminProtectedProcedure.query(async ({ ctx }) => {
		await assertMemberBudgetLicensed();
		return memberBudgetService.getMemberBudgetSettings(ctx.project.id);
	}),

	saveSettings: adminProtectedProcedure
		.input(
			z.object({
				period: z.enum(MEMBER_BUDGET_PERIODS),
				defaultLimitUsd: z.number().int().min(0).max(1_000_000),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await assertMemberBudgetLicensed();
			await memberBudgetService.saveMemberBudgets(ctx.project.id, input);
			return { success: true };
		}),

	setPersonalBudget: adminProtectedProcedure
		.input(z.object({ userId: z.string(), limitUsd: budgetLimitUsdSchema }))
		.mutation(async ({ ctx, input }) => {
			await assertMemberBudgetLicensed();
			await assertProjectMember(ctx.project.id, input.userId);
			await memberBudgetService.setPersonalBudget(ctx.project.id, input.userId, input.limitUsd);
			return { success: true };
		}),
};

async function assertProjectMember(projectId: string, userId: string): Promise<void> {
	if (!(await projectQueries.getUserRoleInProject(projectId, userId))) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'That person is not a member of this project.' });
	}
}
