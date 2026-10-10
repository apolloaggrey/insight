/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { getFeatureMap, getLicense } from '../services/license.service';
import { protectedProcedure, router } from './trpc';

export const licenseRoutes = router({
	getStatus: protectedProcedure.query(async () => ({ status: 'licensed' as const, edition: 'insight' as const })),
	getDetails: protectedProcedure.query(async () => getLicense()),
	getFeatures: protectedProcedure.query(async () => getFeatureMap()),
});
