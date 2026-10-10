import { env, isCloudBillingEnabled } from '../env';
import * as userQueries from '../queries/user.queries';
import { adminProtectedProcedure, publicProcedure } from './trpc';

export const systemRoutes = {
	getPublicConfig: publicProcedure.query(async () => ({
		insightMode: env.INSIGHT_MODE,
		cloudBillingEnabled: isCloudBillingEnabled(),
		enableUserLogin: env.ENABLE_USER_LOGIN,
		enableUserSignup: await isUserSignupAvailable(),
		betaAutomationsEnabled: env.BETA_AUTOMATIONS_ENABLED,
		betaContextRecommendationsEnabled: env.BETA_CONTEXT_RECOMMENDATIONS_ENABLED,
		betaStoryFiltersEnabled: env.BETA_STORY_FILTERS_ENABLED,
		betaSubagentsEnabled: env.BETA_SUBAGENTS_ENABLED,
		betaCustomStoriesEnabled: env.BETA_CUSTOM_STORIES_ENABLED,
	})),

	version: adminProtectedProcedure.query(() => ({
		version: env.APP_VERSION,
		commit: env.APP_COMMIT,
		buildDate: env.APP_BUILD_DATE,
	})),
};

async function isUserSignupAvailable(): Promise<boolean> {
	if (env.ENABLE_USER_SIGNUP) {
		return true;
	}

	return (await userQueries.countUsers()) === 0;
}
