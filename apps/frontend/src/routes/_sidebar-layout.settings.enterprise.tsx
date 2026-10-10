/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { createFileRoute } from '@tanstack/react-router';
import { CheckCircle2, CircleOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { SettingsCard, SettingsPageWrapper } from '@/components/ui/settings-card';
import { useLicenseDetails, useLicenseFeatures } from '@/hooks/use-license';
import { requireNonViewerNonCloud } from '@/lib/require-admin';

export interface FeatureDescription {
	key: string;
	label: string;
	description: string;
}

export const ENTERPRISE_FEATURES: FeatureDescription[] = [
	{
		key: 'sso',
		label: 'Company sign-in (SSO)',
		description:
			'Sign in with OIDC (Okta, Auth0, Keycloak…) or Microsoft Entra, with roles and groups from your identity provider.',
	},
	{
		key: 'white-label',
		label: 'Company-branded UI',
		description: 'Replace the product name, logo, favicon and colours with your own.',
	},
	{
		key: 'user-budget',
		label: 'Spend limits per user',
		description: 'Cap what each person can spend on AI models, per person, per user group or by default.',
	},
	{
		key: 'user-groups',
		label: 'Unlimited user groups',
		description: 'Create more than the 3 custom groups included with the free plan.',
	},
	{
		key: 'exclude-columns',
		label: 'Excluded columns',
		description: 'Block the agent from querying columns marked as excluded.',
	},
	{
		key: 'row-level-security',
		label: 'Row-level security',
		description: 'Restrict which rows each user group can see, with filters applied to every query.',
	},
];

export const Route = createFileRoute('/_sidebar-layout/settings/enterprise')({
	beforeLoad: requireNonViewerNonCloud,
	staticData: {
		title: 'Features',
		description: 'Every feature ships switched on. An operator can turn some off on the server.',
	},
	component: FeaturesPage,
});

function FeaturesPage() {
	const features = useLicenseFeatures();
	const details = useLicenseDetails();
	const enabled = features.data as Record<string, boolean> | undefined;

	return (
		<SettingsPageWrapper>
			<div>
				<h1 className='text-lg font-semibold text-foreground'>Features</h1>
				<p className='text-sm text-muted-foreground'>
					{details.data?.companyName ?? 'This server'} runs Insight with no licence key. Switch a feature off
					by listing it in <code>INSIGHT_DISABLED_FEATURES</code> on the server, then restart it.
				</p>
			</div>
			<SettingsCard title='Included features'>
				<ul className='flex flex-col divide-y'>
					{ENTERPRISE_FEATURES.map((feature) => {
						const isOn = enabled?.[feature.key] === true;
						return (
							<li key={feature.key} className='flex items-start gap-3 py-3'>
								{isOn ? (
									<CheckCircle2 className='mt-0.5 size-4 shrink-0 text-green-600' />
								) : (
									<CircleOff className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
								)}
								<div className='flex flex-1 flex-col'>
									<span className='text-sm font-medium'>{feature.label}</span>
									<span className='text-sm text-muted-foreground'>{feature.description}</span>
								</div>
								<Badge variant={isOn ? 'success' : 'secondary'}>{isOn ? 'On' : 'Off'}</Badge>
								<code className='text-xs text-muted-foreground'>{feature.key}</code>
							</li>
						);
					})}
				</ul>
			</SettingsCard>
		</SettingsPageWrapper>
	);
}
