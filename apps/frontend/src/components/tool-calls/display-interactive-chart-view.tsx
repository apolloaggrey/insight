import { useEffect, useRef, useState } from 'react';
import { DEFAULT_COLORS } from '@insight/shared';
import { prepareInteractiveChartOption } from '@insight/shared/interactive-chart';
import {
	BarChart,
	BoxplotChart,
	CandlestickChart,
	FunnelChart,
	GraphChart,
	HeatmapChart,
	LineChart,
	PieChart,
	SankeyChart,
	ScatterChart,
	SunburstChart,
	TreeChart,
	TreemapChart,
} from 'echarts/charts';
import {
	AriaComponent,
	CalendarComponent,
	DatasetComponent,
	DataZoomComponent,
	GridComponent,
	LegendComponent,
	ToolboxComponent,
	TooltipComponent,
	VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import type { InteractiveChartOption } from '@insight/shared/interactive-chart';
import { useIsDarkMode } from '@/contexts/theme.provider';

echarts.use([
	BarChart,
	BoxplotChart,
	CandlestickChart,
	FunnelChart,
	GraphChart,
	HeatmapChart,
	LineChart,
	PieChart,
	SankeyChart,
	ScatterChart,
	SunburstChart,
	TreeChart,
	TreemapChart,
	AriaComponent,
	CalendarComponent,
	DatasetComponent,
	DataZoomComponent,
	GridComponent,
	LegendComponent,
	ToolboxComponent,
	TooltipComponent,
	VisualMapComponent,
	LabelLayout,
	CanvasRenderer,
]);

interface InteractiveChartViewProps {
	option: InteractiveChartOption;
	rows: Record<string, unknown>[];
}

export default function InteractiveChartView({ option, rows }: InteractiveChartViewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const isDark = useIsDarkMode();
	const [renderError, setRenderError] = useState<string | null>(null);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) {
			return;
		}

		setRenderError(null);
		try {
			return renderInteractiveChart(element, option, rows, isDark);
		} catch (error) {
			setRenderError(error instanceof Error ? error.message : String(error));
		}
	}, [option, rows, isDark]);

	return (
		<div className='relative h-[420px] w-full'>
			<div ref={containerRef} className='size-full' />
			{renderError && (
				<div className='absolute inset-0 flex items-center justify-center bg-background text-sm text-muted-foreground'>
					Could not render this chart: {renderError}
				</div>
			)}
		</div>
	);
}

export function renderInteractiveChart(
	element: HTMLElement,
	option: InteractiveChartOption,
	rows: Record<string, unknown>[],
	isDark: boolean,
) {
	const chart = echarts.init(element, isDark ? 'dark' : undefined);
	const resizeObserver = new ResizeObserver(() => chart.resize());
	resizeObserver.observe(element);

	const dispose = () => {
		resizeObserver.disconnect();
		chart.dispose();
	};

	try {
		chart.setOption({
			color: DEFAULT_COLORS,
			...prepareInteractiveChartOption(option, rows),
			backgroundColor: 'transparent',
			textStyle: { fontFamily: getComputedStyle(element).fontFamily },
			animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
			aria: { enabled: true },
		});
	} catch (error) {
		dispose();
		throw error;
	}

	return dispose;
}
