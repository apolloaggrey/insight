/* Insight: database connections managed from the web app. Apache-2.0. */
import { CONNECTION_TYPES } from '@insight/shared/database-connections';
import { z } from 'zod';

import * as connectionService from '../services/database-connection.service';
import { contextAdminProtectedProcedure, projectProtectedProcedure, router } from './trpc';

const valuesSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
const idInput = z.object({ id: z.string() });

export const databaseConnectionRoutes = router({
	types: projectProtectedProcedure.query(() => CONNECTION_TYPES),

	list: projectProtectedProcedure.query(({ ctx }) => connectionService.listConnections(ctx.project.id)),

	create: contextAdminProtectedProcedure
		.input(z.object({ name: z.string().min(1).max(63), typeId: z.string(), values: valuesSchema }))
		.mutation(({ ctx, input }) => connectionService.createConnection(ctx.project.id, ctx.user.id, input)),

	update: contextAdminProtectedProcedure
		.input(z.object({ id: z.string(), values: valuesSchema }))
		.mutation(async ({ ctx, input }) => {
			await connectionService.updateConnection(ctx.project.id, input.id, input.values);
			return { success: true };
		}),

	delete: contextAdminProtectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
		await connectionService.deleteConnection(ctx.project.id, input.id);
		return { success: true };
	}),

	test: contextAdminProtectedProcedure
		.input(
			z.object({
				typeId: z.string(),
				values: valuesSchema,
				id: z.string().optional(),
				name: z.string().optional(),
			}),
		)
		.mutation(({ ctx, input }) => connectionService.testConnection(ctx.project.id, input)),

	sync: contextAdminProtectedProcedure
		.input(idInput)
		.mutation(({ ctx, input }) => connectionService.syncConnection(ctx.project.id, input.id)),
});
