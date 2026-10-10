/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { LockedFieldset } from '@/components/settings/locked-fieldset';
import { formatLimit, LimitInput, SOURCE_LABELS, UsageBar } from '@/components/settings/member-budget-kit';
import { UpgradeToEnterprise } from '@/components/settings/upgrade-to-enterprise';
import { Button } from '@/components/ui/button';
import { SettingsCard } from '@/components/ui/settings-card';
import { trpc } from '@/main';

interface UserGroupUserBudgetProps {
	userId: string;
	isLicensed: boolean;
}

/** One person's budget: what applies to them, their spend, and a personal override. */
export function UserGroupUserBudget({ userId, isLicensed }: UserGroupUserBudgetProps) {
	const queryClient = useQueryClient();
	const budget = useQuery({ ...trpc.memberBudget.getForMember.queryOptions({ userId }), enabled: isLicensed });
	const save = useMutation(
		trpc.memberBudget.setPersonalBudget.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries({ queryKey: [['memberBudget']] }),
		}),
	);
	const personalLimit = budget.data?.source === 'personal' ? budget.data.limitUsd : null;
	const [draft, setDraft] = useState<number | null>(personalLimit);

	useEffect(() => setDraft(personalLimit), [personalLimit]);

	return (
		<SettingsCard
			title='Budget'
			description='A personal budget overrides their user group budgets and the default.'
			action={!isLicensed ? <UpgradeToEnterprise /> : undefined}
		>
			<LockedFieldset disabled={!isLicensed}>
				{budget.isLoading ? (
					<p className='text-sm text-muted-foreground'>Loading…</p>
				) : budget.isError || !budget.data ? (
					<p className='text-sm text-destructive'>The budget could not be loaded.</p>
				) : (
					<div className='flex flex-col gap-4 text-sm'>
						<UsageBar
							spendUsd={budget.data.spendUsd}
							limitUsd={budget.data.limitUsd}
							status={budget.data.status}
						/>
						<p className='text-muted-foreground'>
							Without a personal budget: {formatLimit(budget.data.inheritedLimitUsd)} per{' '}
							{budget.data.period} ({SOURCE_LABELS[budget.data.inheritedSource].toLowerCase()}).
						</p>
						<div className='flex items-center gap-2'>
							<LimitInput id={`personal-budget-${userId}`} value={draft} onChange={setDraft} />
							<Button
								disabled={draft === personalLimit || save.isPending}
								onClick={() => save.mutate({ userId, limitUsd: draft })}
							>
								{save.isPending ? 'Saving…' : 'Save'}
							</Button>
						</div>
						{save.error && <p className='text-destructive'>{save.error.message}</p>}
					</div>
				)}
			</LockedFieldset>
		</SettingsCard>
	);
}
