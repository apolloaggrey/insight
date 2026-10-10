/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { resolveMemberBudgetLimit } from '@insight/shared/member-budget';
import type { MemberBudgetPeriod } from '@insight/shared/types';

import { LockedFieldset } from '@/components/settings/locked-fieldset';
import { formatLimit, formatUsd, LimitInput } from '@/components/settings/member-budget-kit';
import { UpgradeToEnterprise } from '@/components/settings/upgrade-to-enterprise';
import { SettingsCard } from '@/components/ui/settings-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface GroupBudgetMember {
	id: string;
	name: string;
	email: string;
	spendUsd: number;
	personalLimitUsd: number | null;
	groupIds: string[];
}

interface UserGroupBudgetProps {
	groupId: string | null;
	isLicensed: boolean;
	isDefaultGroup: boolean;
	isLoading: boolean;
	isError: boolean;
	limitUsd: number | null;
	defaultLimitUsd: number;
	period: MemberBudgetPeriod;
	members: GroupBudgetMember[];
	groups: Array<{ id: string; limitUsd: number | null }>;
	onLimitChange: (limitUsd: number | null) => void;
}

/** Edits a group's budget and previews what each of its members would get with it. */
export function UserGroupBudget(props: UserGroupBudgetProps) {
	const { isLicensed, isDefaultGroup, isLoading, isError, limitUsd, period, onLimitChange } = props;
	const groupMembers = props.members.filter(
		(member) => isDefaultGroup || (props.groupId !== null && member.groupIds.includes(props.groupId)),
	);

	return (
		<SettingsCard
			title='Group budget'
			description={
				isDefaultGroup
					? `The default member budget applies to everyone without a group or personal budget, per ${period}.`
					: `Members get the most generous budget among their groups, per ${period}. A personal budget overrides it.`
			}
			action={!isLicensed ? <UpgradeToEnterprise /> : undefined}
		>
			<LockedFieldset disabled={!isLicensed}>
				{isLoading ? (
					<p className='text-sm text-muted-foreground'>Loading…</p>
				) : isError ? (
					<p className='text-sm text-destructive'>Budgets could not be loaded.</p>
				) : (
					<div className='flex flex-col gap-4'>
						<div className='flex items-center gap-3 text-sm'>
							<span>Budget per member</span>
							<LimitInput
								id='group-budget-limit'
								value={limitUsd}
								onChange={onLimitChange}
								placeholder={isDefaultGroup ? '0' : 'None'}
							/>
							<span className='text-muted-foreground'>0 means no limit</span>
						</div>
						{groupMembers.length > 0 && (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Member</TableHead>
										<TableHead>Spent this {period}</TableHead>
										<TableHead>Their budget</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{groupMembers.map((member) => (
										<TableRow key={member.id}>
											<TableCell>
												<div className='flex flex-col'>
													<span>{member.name}</span>
													<span className='text-xs text-muted-foreground'>
														{member.email}
													</span>
												</div>
											</TableCell>
											<TableCell>{formatUsd(member.spendUsd)}</TableCell>
											<TableCell>{describeMemberLimit(member, props)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</div>
				)}
			</LockedFieldset>
		</SettingsCard>
	);
}

function describeMemberLimit(member: GroupBudgetMember, props: UserGroupBudgetProps): string {
	if (member.personalLimitUsd !== null) {
		return `${formatLimit(member.personalLimitUsd)} (personal)`;
	}
	const defaultLimit = props.isDefaultGroup ? (props.limitUsd ?? 0) : props.defaultLimitUsd;
	const groupLimits = props.groups
		.filter((group) => member.groupIds.includes(group.id) && group.id !== props.groupId)
		.flatMap((group) => (group.limitUsd === null ? [] : [group.limitUsd]));
	if (!props.isDefaultGroup && props.limitUsd !== null) {
		groupLimits.push(props.limitUsd);
	}
	return formatLimit(resolveMemberBudgetLimit(null, groupLimits, defaultLimit));
}
