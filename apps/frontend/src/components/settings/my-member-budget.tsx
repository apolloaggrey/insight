/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { useQuery } from '@tanstack/react-query';

import { formatLimit, SOURCE_LABELS, UsageBar } from '@/components/settings/member-budget-kit';
import { SettingsCard } from '@/components/ui/settings-card';
import { useLicenseFeatures } from '@/hooks/use-license';
import { trpc } from '@/main';

export function MyMemberBudget() {
	const features = useLicenseFeatures();
	const isLicensed = features.data?.['user-budget'] === true;
	const budget = useQuery({ ...trpc.memberBudget.getMine.queryOptions(), enabled: isLicensed });

	return (
		<SettingsCard title='Your AI budget' description='How much you can spend on AI models in this project.'>
			{!isLicensed ? (
				<p className='text-sm text-muted-foreground'>Member budgets are switched off on this server.</p>
			) : budget.isLoading ? (
				<p className='text-sm text-muted-foreground'>Loading…</p>
			) : budget.isError || !budget.data ? (
				<p className='text-sm text-destructive'>Your budget could not be loaded.</p>
			) : (
				<div className='flex flex-col gap-3 text-sm'>
					<UsageBar
						spendUsd={budget.data.spendUsd}
						limitUsd={budget.data.limitUsd}
						status={budget.data.status}
					/>
					<p className='text-muted-foreground'>
						{formatLimit(budget.data.limitUsd)} per {budget.data.period}, from your{' '}
						{SOURCE_LABELS[budget.data.source].toLowerCase()}. Resets{' '}
						{new Date(budget.data.resetsAt).toLocaleDateString()}.
					</p>
				</div>
			)}
		</SettingsCard>
	);
}
