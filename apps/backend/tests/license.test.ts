/* Insight: replaces Insight's licence-key tests; Insight has no licence key, every feature ships on. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	getFeatureMap,
	getLicense,
	hasFeature,
	LICENSE_FEATURES,
	resetLicenseCache,
} from '../src/services/license.service';
import { pingLicensesServer } from '../src/services/ping';

describe('Insight feature switches', () => {
	let originalEnv: typeof process.env;

	beforeEach(() => {
		originalEnv = { ...process.env };
		resetLicenseCache();
	});

	afterEach(() => {
		process.env = originalEnv;
		resetLicenseCache();
		vi.unstubAllGlobals();
	});

	it('turns every feature on without a licence key', async () => {
		delete process.env.INSIGHT_DISABLED_FEATURES;
		for (const feature of Object.values(LICENSE_FEATURES)) {
			expect(await hasFeature(feature)).toBe(true);
		}
		expect((await getLicense()).edition).toBe('insight');
	});

	it('switches off the features an operator lists', async () => {
		process.env.INSIGHT_DISABLED_FEATURES = ' white-label , user-budget ';
		expect(await hasFeature(LICENSE_FEATURES.whiteLabel)).toBe(false);
		expect(await hasFeature(LICENSE_FEATURES.userBudget)).toBe(false);
		expect(await hasFeature(LICENSE_FEATURES.sso)).toBe(true);
		expect(await getFeatureMap()).toMatchObject({ 'white-label': false, 'user-budget': false, sso: true });
	});

	it('never contacts an outside licence server', async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		await pingLicensesServer();
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
