/* Insight: independent implementation (see NOTICE). Apache-2.0. */
export const LICENSE_FEATURES = {
	sso: 'sso',
	whiteLabel: 'white-label',
	userBudget: 'user-budget',
	userGroups: 'user-groups',
	excludeColumns: 'exclude-columns',
	rowLevelSecurity: 'row-level-security',
} as const;

export type LicenseFeature = (typeof LICENSE_FEATURES)[keyof typeof LICENSE_FEATURES];

export const LICENSE_ALL_FEATURES = '*';

/** Insight has no paid tier: every feature ships on, and an operator can switch some off. */
export interface License {
	edition: 'insight';
	companyName: string;
	subscriptionId: string;
	features: LicenseFeature[];
	isOffline: true;
}

export type LicenseStatus = 'licensed';
