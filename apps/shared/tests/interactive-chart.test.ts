import { describe, expect, it } from 'vitest';

import type { InteractiveChartOption } from '../src/interactive-chart';
import { findInteractiveChartProblem, prepareInteractiveChartOption } from '../src/interactive-chart';

type PreparedOption = Record<string, undefined> & {
	toolbox: { feature: { dataView?: unknown } };
	tooltip: { renderMode: string; trigger: string; appendTo?: unknown; extraCssText?: unknown };
	legend: { show?: boolean; type?: string };
	xAxis?: unknown;
	series: { symbol?: unknown; itemStyle: { color: { image?: unknown } | string } }[];
};

const flowRows = [
	{ from_step: 'Visit', to_step: 'Signup', users: 10 },
	{ from_step: 'Visit', to_step: 'Signup', users: 5 },
	{ from_step: 'Signup', to_step: 'Paid', users: '3' },
];

const sankey = (series: Record<string, unknown> = {}): InteractiveChartOption => ({
	series: [{ type: 'sankey', from_rows: { source: 'from_step', target: 'to_step', value: 'users' }, ...series }],
});

describe('findInteractiveChartProblem', () => {
	const columns = ['from_step', 'to_step', 'users'];

	it('accepts a chart built only from query columns', () => {
		expect(findInteractiveChartProblem(sankey(), columns, flowRows)).toBeNull();
		const bar = { series: [{ type: 'bar', encode: { x: 'from_step', y: ['users'] } }] };
		expect(findInteractiveChartProblem(bar, columns, flowRows)).toBeNull();
	});

	it('rejects numbers typed into the option', () => {
		const typedIn = { series: [{ type: 'bar', encode: { x: 'a' }, data: [1, 2] }] };
		expect(findInteractiveChartProblem(typedIn, ['a'], [{ a: 1 }])).toContain('"data" inline');
	});

	it('names missing columns and the available ones', () => {
		const option = { series: [{ type: 'line', encode: { x: 'month', y: 'users' } }] };
		const problem = findInteractiveChartProblem(option, columns, flowRows);
		expect(problem).toContain('"month"');
		expect(problem).toContain('Available columns: from_step, to_step, users');
	});

	it('checks a visualMap dimension too', () => {
		const option = {
			visualMap: { dimension: 'nope' },
			series: [{ type: 'scatter', encode: { x: 'users', y: 'users' } }],
		};
		expect(findInteractiveChartProblem(option, columns, flowRows)).toContain('"nope"');
	});

	it('requires the mapping each series type needs', () => {
		expect(findInteractiveChartProblem({ series: [{ type: 'bar' }] }, columns, flowRows)).toContain('encode');
		expect(findInteractiveChartProblem({ series: [{ type: 'graph' }] }, columns, flowRows)).toContain('from_rows');
		expect(findInteractiveChartProblem({ series: [{ type: 'treemap' }] }, columns, flowRows)).toContain('path');
	});

	it('rejects a sankey with a cycle but allows the same links as a graph', () => {
		const rows = [
			{ from_step: 'A', to_step: 'B', users: 1 },
			{ from_step: 'B', to_step: 'A', users: 1 },
		];
		expect(findInteractiveChartProblem(sankey(), columns, rows)).toContain('cycles');
		const graph = { series: [{ type: 'graph', from_rows: { source: 'from_step', target: 'to_step' } }] };
		expect(findInteractiveChartProblem(graph, columns, rows)).toBeNull();
	});

	it('rejects empty results and oversized networks', () => {
		expect(findInteractiveChartProblem(sankey(), columns, [])).toContain('no rows');
		const rows = Array.from({ length: 1001 }, (_, index) => ({ from_step: `a${index}`, to_step: 'b', users: 1 }));
		expect(findInteractiveChartProblem(sankey(), columns, rows)).toContain('over the limit');
	});
});

describe('prepareInteractiveChartOption', () => {
	it('sums duplicate links and coerces numeric strings', () => {
		const { series } = prepareInteractiveChartOption(sankey(), flowRows) as {
			series: { links: unknown[]; data: unknown[]; from_rows?: unknown }[];
		};
		expect(series[0].links).toEqual([
			{ source: 'Visit', target: 'Signup', value: 15 },
			{ source: 'Signup', target: 'Paid', value: 3 },
		]);
		expect(series[0].data).toEqual([{ name: 'Visit' }, { name: 'Signup' }, { name: 'Paid' }]);
		expect(series[0].from_rows).toBeUndefined();
	});

	it('sizes graph nodes by their connections', () => {
		const option = { series: [{ type: 'graph', from_rows: { source: 'from_step', target: 'to_step' } }] };
		const { series } = prepareInteractiveChartOption(option, flowRows) as {
			series: { data: { name: string; value: number }[]; layout: string }[];
		};
		expect(series[0].layout).toBe('force');
		expect(series[0].data.find((node) => node.name === 'Signup')?.value).toBe(2);
	});

	it('nests rows into a hierarchy and wraps trees in one root', () => {
		const rows = [
			{ region: 'EU', country: 'FR', revenue: 2 },
			{ region: 'EU', country: 'FR', revenue: 1 },
			{ region: 'EU', country: 'DE', revenue: 4 },
			{ region: 'US', country: 'US', revenue: 8 },
		];
		const from_rows = { path: ['region', 'country'], value: 'revenue' };
		const treemap = prepareInteractiveChartOption({ series: [{ type: 'treemap', from_rows }] }, rows) as {
			series: { data: unknown }[];
		};
		expect(treemap.series[0].data).toEqual([
			{
				name: 'EU',
				children: [
					{ name: 'FR', value: 3 },
					{ name: 'DE', value: 4 },
				],
			},
			{ name: 'US', children: [{ name: 'US', value: 8 }] },
		]);
		const tree = prepareInteractiveChartOption({ series: [{ type: 'tree', from_rows }] }, rows) as {
			series: { data: { name: string }[] }[];
		};
		expect(tree.series[0].data.map((node) => node.name)).toEqual(['All']);
	});

	it('injects the rows and ignores any data smuggled into a stored option', () => {
		const prepared = prepareInteractiveChartOption(
			{ dataset: { source: [{ fake: 1 }] }, series: [{ type: 'bar', encode: { x: 'a' }, data: [99] }] },
			[{ a: 1 }],
		) as { dataset: unknown; series: { data?: unknown }[] };
		expect(prepared.dataset).toEqual({ source: [{ a: 1 }] });
		expect(prepared.series[0].data).toBeUndefined();
	});

	it('keeps anything that can reach the DOM or the network out', () => {
		const prepared = prepareInteractiveChartOption(
			{
				graphic: [{ type: 'image', style: { image: 'https://evil.example/x.png' } }],
				toolbox: { feature: { dataView: {} } },
				title: { text: 'x', link: 'javascript:alert(1)' },
				media: [],
				baseOption: {},
				tooltip: {
					renderMode: 'html',
					appendTo: 'body',
					extraCssText: 'x',
					formatter: '<img src=x onerror=alert(1)>',
				},
				series: [
					{
						type: 'scatter',
						encode: { x: 'a' },
						symbol: 'image://https://evil.example/x.png',
						itemStyle: { color: { image: 'https://evil.example/x.png' } },
					},
				],
			},
			[{ a: 1 }],
		) as PreparedOption;

		for (const key of ['graphic', 'title', 'media', 'baseOption']) {
			expect(prepared[key]).toBeUndefined();
		}
		expect(prepared.toolbox.feature.dataView).toBeUndefined();
		expect(prepared.tooltip.renderMode).toBe('richText');
		expect(prepared.tooltip.appendTo).toBeUndefined();
		expect(prepared.tooltip.extraCssText).toBeUndefined();
		expect(prepared.series[0].symbol).toBeUndefined();
		expect(prepared.series[0].itemStyle.color.image).toBeUndefined();
	});

	it('picks a tooltip trigger and legend to suit the chart', () => {
		const line = prepareInteractiveChartOption({ series: [{ type: 'line', encode: { x: 'a' } }] }, [
			{ a: 1 },
		]) as PreparedOption;
		expect(line.tooltip.trigger).toBe('axis');
		expect(line.legend.show).toBe(false);
		expect(line.xAxis).toEqual({ type: 'category' });

		const pie = prepareInteractiveChartOption({ series: [{ type: 'pie', encode: { value: 'a' } }] }, [
			{ a: 1 },
		]) as PreparedOption;
		expect(pie.tooltip.trigger).toBe('item');
		expect(pie.legend.type).toBe('scroll');
		expect(pie.xAxis).toBeUndefined();
	});

	it('draws rising candles in green unless told otherwise', () => {
		const option = { series: [{ type: 'candlestick', encode: { x: 'a' } }] };
		expect((prepareInteractiveChartOption(option, [{ a: 1 }]) as PreparedOption).series[0].itemStyle.color).toBe(
			'#16a34a',
		);
		const custom = { series: [{ type: 'candlestick', encode: { x: 'a' }, itemStyle: { color: 'red' } }] };
		expect((prepareInteractiveChartOption(custom, [{ a: 1 }]) as PreparedOption).series[0].itemStyle.color).toBe(
			'red',
		);
	});

	it('leaves calendar heatmaps off the cartesian axes', () => {
		const option = { series: [{ type: 'heatmap', coordinateSystem: 'calendar', encode: { time: 'a' } }] };
		expect((prepareInteractiveChartOption(option, [{ a: 1 }]) as PreparedOption).xAxis).toBeUndefined();
	});
});
