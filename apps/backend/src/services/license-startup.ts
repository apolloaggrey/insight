/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { getLicense } from './license.service';

export async function logLicenseStatus(): Promise<void> {
	const license = await getLicense();
	console.info(`[insight] ${license.companyName}: features on: ${license.features.join(', ') || 'none'}`);
}
