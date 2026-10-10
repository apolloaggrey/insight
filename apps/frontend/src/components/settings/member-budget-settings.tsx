/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { MEMBER_BUDGET_PERIODS } from '@insight/shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { MemberBudgetPeriod } from '@insight/shared/types';

import { LockedFieldset } from '@/components/settings/locked-fieldset';
import { formatLimit, LimitInput, SOURCE_LABELS, UsageBar } from '@/components/settings/member-budget-kit';
import { UpgradeToEnterprise } from '@/components/settings/upgrade-to-enterprise';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingsCard } from '@/components/ui/settings-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/main';

interface MemberBudgetSettingsProps {
	isLicensed: boolean;
}

export function MemberBudgetSettings({ isLicensed }: MemberBudgetSettingsProps) {
	const overview = useQuery({ ...trpc.memberBudget.getOverview.queryOptions(), enabled: isLicensed });

	return (
		<div className='flex flex-col gap-8'>
			<SettingsCard
				title='Member budgets'
				description='Cap what each person can spend on AI models. A personal budget beats user group budgets, which beat the default.'
				action={!isLicensed ? <UpgradeToEnterprise /> : undefined}
			>
				<LockedFieldset disabled={!isLicensed}>
					{overview.data ? (
						<DefaultBudgetForm
							period={overview.data.period}
							defaultLimitUsd={overview.data.defaultLimitUsd}
						/>
					) : (
						<QueryState isLoading={overview.isLoading} isError={overview.isError} />
					)}
				</LockedFieldset>
			</SettingsCard>
			{overview.data && overview.data.members.length > 0 && (
				<SettingsCard
					title='Members'
					description={`Spend this ${overview.data.period} against each person's budget.`}
				>
					<MembersTable members={overview.data.members} />
				</SettingsCard>
			)}
		</div>
	);
}

function DefaultBudgetForm({ period, defaultLimitUsd }: { period: MemberBudgetPeriod; defaultLimitUsd: number }) {
	const save = useMutation(trpc.memberBudget.saveSettings.mutationOptions({ onSuccess: useRefreshBudgets() }));
	const [draftPeriod, setDraftPeriod] = useState(period);
	const [draftLimit, setDraftLimit] = useState<number | null>(defaultLimitUsd);

	useEffect(() => {
		setDraftPeriod(period);
		setDraftLimit(defaultLimitUsd);
	}, [period, defaultLimitUsd]);

	const isDirty = draftPeriod !== period || (draftLimit ?? 0) !== defaultLimitUsd;

	return (
		<div className='flex flex-wrap items-center gap-4 text-sm'>
			<label className='flex items-center gap-2'>
				Period
				<Select value={draftPeriod} onValueChange={(value) => setDraftPeriod(value as MemberBudgetPeriod)}>
					<SelectTrigger className='w-28 font-normal'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{MEMBER_BUDGET_PERIODS.map((option) => (
							<SelectItem key={option} value={option}>
								{option.charAt(0).toUpperCase() + option.slice(1)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</label>
			<label className='flex items-center gap-2'>
				Default budget
				<LimitInput id='default-member-budget' value={draftLimit} onChange={setDraftLimit} placeholder='0' />
			</label>
			<span className='text-muted-foreground'>0 means no limit</span>
			<Button
				className='ml-auto'
				disabled={!isDirty || save.isPending}
				onClick={() => save.mutate({ period: draftPeriod, defaultLimitUsd: draftLimit ?? 0 })}
			>
				{save.isPending ? 'Saving…' : 'Save'}
			</Button>
			{save.error && <p className='w-full text-destructive'>{save.error.message}</p>}
		</div>
	);
}

interface OverviewMember {
	id: string;
	name: string;
	email: string;
	spendUsd: number;
	limitUsd: number;
	source: string;
	status: 'under' | 'close' | 'exceeded' | 'unlimited';
	personalLimitUsd: number | null;
}

function MembersTable({ members }: { members: OverviewMember[] }) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Member</TableHead>
					<TableHead>Usage</TableHead>
					<TableHead>Budget from</TableHead>
					<TableHead>Personal budget</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{members.map((member) => (
					<TableRow key={member.id}>
						<TableCell>
							<div className='flex flex-col'>
								<span>{member.name}</span>
								<span className='text-xs text-muted-foreground'>{member.email}</span>
							</div>
						</TableCell>
						<TableCell>
							<UsageBar spendUsd={member.spendUsd} limitUsd={member.limitUsd} status={member.status} />
						</TableCell>
						<TableCell className='text-sm text-muted-foreground'>
							{SOURCE_LABELS[member.source]} · {formatLimit(member.limitUsd)}
						</TableCell>
						<TableCell>
							<PersonalBudgetCell userId={member.id} personalLimitUsd={member.personalLimitUsd} />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

function PersonalBudgetCell({ userId, personalLimitUsd }: { userId: string; personalLimitUsd: number | null }) {
	const save = useMutation(trpc.memberBudget.setPersonalBudget.mutationOptions({ onSuccess: useRefreshBudgets() }));
	const [draft, setDraft] = useState<number | null>(personalLimitUsd);

	useEffect(() => setDraft(personalLimitUsd), [personalLimitUsd]);

	return (
		<div className='flex items-center gap-2'>
			<LimitInput id={`personal-budget-${userId}`} value={draft} onChange={setDraft} />
			{draft !== personalLimitUsd && (
				<Button size='sm' disabled={save.isPending} onClick={() => save.mutate({ userId, limitUsd: draft })}>
					Save
				</Button>
			)}
		</div>
	);
}

function QueryState({ isLoading, isError }: { isLoading: boolean; isError: boolean }) {
	if (isError) {
		return <p className='text-sm text-destructive'>Budgets could not be loaded.</p>;
	}
	return (
		<p className='text-sm text-muted-foreground'>{isLoading ? 'Loading…' : 'Member budgets are switched off.'}</p>
	);
}

function useRefreshBudgets() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: [['memberBudget']] });
}
