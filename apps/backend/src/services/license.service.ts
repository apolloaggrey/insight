/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { type License, LICENSE_ALL_FEATURES, LICENSE_FEATURES, type LicenseFeature } from '../types/license';

export { LICENSE_ALL_FEATURES, LICENSE_FEATURES };
export type { License, LicenseFeature };

let cached: License | null = null;

export async function getLicense(): Promise<License> {
	cached ??= buildLicense();
	return cached;
}

export async function hasFeature(feature: LicenseFeature): Promise<boolean> {
	return (await getLicense()).features.includes(feature);
}

export async function getFeatureMap(): Promise<Record<LicenseFeature, boolean>> {
	const license = await getLicense();
	return Object.fromEntries(
		Object.values(LICENSE_FEATURES).map((feature) => [feature, license.features.includes(feature)]),
	) as Record<LicenseFeature, boolean>;
}

export function resetLicenseCache(): void {
	cached = null;
}

export async function refreshLicenseOnline(): Promise<License> {
	resetLicenseCache();
	return getLicense();
}

export async function startLicenseHeartbeat(): Promise<void> {}

export function stopLicenseHeartbeat(): void {}

/** INSIGHT_DISABLED_FEATURES takes a comma-separated list of feature keys to switch off. */
function buildLicense(): License {
	const disabled = new Set(
		(process.env.INSIGHT_DISABLED_FEATURES ?? '')
			.split(',')
			.map((feature) => feature.trim())
			.filter(Boolean),
	);
	return {
		edition: 'insight',
		companyName: process.env.INSIGHT_ORGANIZATION_NAME || 'Self-hosted',
		subscriptionId: 'insight',
		features: Object.values(LICENSE_FEATURES).filter((feature) => !disabled.has(feature)),
		isOffline: true,
	};
}
