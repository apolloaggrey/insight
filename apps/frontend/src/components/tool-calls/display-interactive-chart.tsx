import { lazy, Suspense } from 'react';
import { Skeleton } from '../ui/skeleton';
import type { ToolCallComponentProps } from '.';
import { useSourceQuery } from '@/hooks/use-source-query';

const InteractiveChartView = lazy(() => import('./display-interactive-chart-view'));

export const DisplayInteractiveChartToolCall = ({
	toolPart: { state, input, output },
}: ToolCallComponentProps<'display_interactive_chart'>) => {
	const config = state !== 'input-streaming' ? input : undefined;
	const { sourceData } = useSourceQuery(config?.query_id);

	if (output && !output.success) {
		return <ChartMessage>Could not display this chart: {output.error}</ChartMessage>;
	}
	if (!config || !output) {
		return <Skeleton className='my-4 h-[420px] w-full rounded-lg' />;
	}
	if (!sourceData?.data) {
		return <ChartMessage>The data behind this chart is no longer available.</ChartMessage>;
	}

	return (
		<div className='my-4 -mx-3 flex flex-col gap-2 rounded-lg border border-transparent bg-backgroundSecondary/30 p-3 transition-colors hover:border-border'>
			<span className='text-sm font-medium text-foreground'>{config.title}</span>
			<Suspense fallback={<Skeleton className='h-[420px] w-full rounded-lg' />}>
				<InteractiveChartView option={config.option} rows={sourceData.data} />
			</Suspense>
		</div>
	);
};

function ChartMessage({ children }: { children: React.ReactNode }) {
	return <div className='my-4 text-sm text-muted-foreground'>{children}</div>;
}
