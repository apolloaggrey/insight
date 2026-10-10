/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import type { MemberBudgetStatus } from '@insight/shared/member-budget';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const SOURCE_LABELS: Record<string, string> = {
	personal: 'Personal budget',
	group: 'User group budget',
	default: 'Default member budget',
};

export function formatUsd(value: number): string {
	return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatLimit(limitUsd: number | null | undefined): string {
	return !limitUsd ? 'No limit' : formatUsd(limitUsd);
}

export function UsageBar({
	spendUsd,
	limitUsd,
	status,
}: {
	spendUsd: number;
	limitUsd: number;
	status: MemberBudgetStatus;
}) {
	const percent = limitUsd > 0 ? Math.min(100, Math.round((spendUsd / limitUsd) * 100)) : 0;
	return (
		<div className='flex min-w-40 flex-col gap-1'>
			<div
				className='h-1.5 w-full overflow-hidden rounded-full bg-muted'
				role='progressbar'
				aria-valuenow={percent}
			>
				<div
					className={cn(
						'h-full rounded-full',
						status === 'exceeded' ? 'bg-destructive' : status === 'close' ? 'bg-amber-500' : 'bg-primary',
					)}
					style={{ width: `${percent}%` }}
				/>
			</div>
			<span className='text-xs text-muted-foreground'>
				{formatUsd(spendUsd)} {limitUsd > 0 ? `of ${formatUsd(limitUsd)}` : 'spent, no limit'}
			</span>
		</div>
	);
}

/** Whole dollars; empty means "no budget here" (null), 0 means no limit. */
export function LimitInput(props: {
	id: string;
	value: number | null;
	onChange: (value: number | null) => void;
	disabled?: boolean;
	placeholder?: string;
}) {
	return (
		<div className='flex items-center gap-1'>
			<span className='text-sm text-muted-foreground'>$</span>
			<Input
				id={props.id}
				type='number'
				min={0}
				step={1}
				inputMode='numeric'
				className='w-28'
				disabled={props.disabled}
				placeholder={props.placeholder ?? 'Inherit'}
				value={props.value ?? ''}
				onChange={(event) => {
					const raw = event.target.value;
					props.onChange(raw === '' ? null : Math.max(0, Math.round(Number(raw))));
				}}
			/>
		</div>
	);
}
