export const INTERACTIVE_SERIES_TYPES = [
	'line',
	'bar',
	'pie',
	'scatter',
	'heatmap',
	'funnel',
	'boxplot',
	'candlestick',
	'sankey',
	'graph',
	'treemap',
	'sunburst',
	'tree',
] as const;

export const MAX_NETWORK_LINKS = 1000;

type InteractiveSeries = Record<string, unknown> & { type: string };
type Row = Record<string, unknown>;

export type InteractiveChartOption = Record<string, unknown> & { series: InteractiveSeries[] };

interface FromRows {
	source?: string;
	target?: string;
	value?: string;
	path?: string[];
}

interface HierarchyNode {
	name: string;
	value?: number;
	children?: HierarchyNode[];
}

const NETWORK_TYPES = new Set(['sankey', 'graph']);
const HIERARCHY_TYPES = new Set(['treemap', 'sunburst', 'tree']);
const AXIS_TRIGGER_TYPES = new Set(['line', 'bar', 'boxplot', 'candlestick']);
const CARTESIAN_TYPES = new Set(['line', 'bar', 'scatter', 'heatmap', 'boxplot', 'candlestick']);
const LEGEND_BY_ITEM_TYPES = new Set(['pie', 'funnel']);

const ALLOWED_OPTION_KEYS = new Set([
	'legend',
	'grid',
	'xAxis',
	'yAxis',
	'visualMap',
	'tooltip',
	'dataZoom',
	'calendar',
	'series',
	'color',
]);

/** These reach the DOM or the network: links, HTML tooltip hooks and remote images. */
const UNSAFE_KEYS = new Set(['link', 'sublink', 'image', 'appendTo', 'extraCssText', 'className']);
const INLINE_DATA_KEYS = ['data', 'links', 'edges', 'nodes', 'categories', 'dataset', 'datasetIndex', 'datasetId'];

/**
 * Returns what is wrong with an option, in words the model can act on. A chart may only draw
 * columns of its query result, so every number on screen traces back to SQL.
 */
export function findInteractiveChartProblem(
	option: InteractiveChartOption,
	columns: string[],
	rows: Row[],
): string | null {
	if (rows.length === 0) {
		return 'The query returned no rows, so there is nothing to chart.';
	}

	for (const series of option.series) {
		const problem = findSeriesProblem(series, columns, rows);
		if (problem) {
			return problem;
		}
	}

	return findMissingColumnProblem(referencedVisualMapColumns(option), columns);
}

/** Runs on every render, because the option comes back from stored messages and not only from a validated tool call. */
export function prepareInteractiveChartOption(option: InteractiveChartOption, rows: Row[]): Record<string, unknown> {
	const safeOption = Object.fromEntries(
		Object.entries(option)
			.filter(([key]) => ALLOWED_OPTION_KEYS.has(key))
			.map(([key, value]) => [key, removeUnsafeValues(value)]),
	);
	const series = (safeOption.series as InteractiveSeries[]).map((entry) => expandSeries(entry, rows));
	const usesAxes = series.some(isCartesianSeries);

	return {
		...safeOption,
		...(usesAxes && buildAxisDefaults(safeOption)),
		legend: safeOption.legend ?? buildDefaultLegend(series),
		series,
		dataset: { source: rows },
		tooltip: buildTooltip(safeOption.tooltip, series),
		toolbox: buildToolbox(usesAxes),
	};
}

function findSeriesProblem(series: InteractiveSeries, columns: string[], rows: Row[]): string | null {
	const inlineKey = INLINE_DATA_KEYS.find((key) => series[key] !== undefined);
	if (inlineKey) {
		return `Series "${series.type}" sets "${inlineKey}" inline. Remove it: data comes from the query result through "encode" or "from_rows".`;
	}

	const fromRows = series.from_rows as FromRows | undefined;
	if (NETWORK_TYPES.has(series.type)) {
		return findNetworkProblem(series.type, fromRows, columns, rows);
	}
	if (HIERARCHY_TYPES.has(series.type)) {
		if (!fromRows?.path?.length || !fromRows.value) {
			return `A "${series.type}" series needs from_rows with "path" (columns from outermost to innermost level) and "value".`;
		}
		return findMissingColumnProblem([...fromRows.path, fromRows.value], columns);
	}

	const encode = series.encode as Record<string, unknown> | undefined;
	if (!encode || Object.keys(encode).length === 0) {
		return `A "${series.type}" series needs "encode" mapping its roles to column names.`;
	}
	return findMissingColumnProblem(Object.values(encode).flat().map(String), columns);
}

function findNetworkProblem(type: string, fromRows: FromRows | undefined, columns: string[], rows: Row[]) {
	if (!fromRows?.source || !fromRows.target) {
		return `A "${type}" series needs from_rows with "source" and "target" columns, plus "value" if the links are weighted.`;
	}

	const referenced = [fromRows.source, fromRows.target, ...(fromRows.value ? [fromRows.value] : [])];
	const missingColumn = findMissingColumnProblem(referenced, columns);
	if (missingColumn) {
		return missingColumn;
	}

	const links = buildLinks(fromRows, rows);
	if (links.length > MAX_NETWORK_LINKS) {
		return `This ${type} would draw ${links.length} links, over the limit of ${MAX_NETWORK_LINKS}. Keep only the strongest links in SQL.`;
	}
	if (type === 'sankey' && hasCycle(links)) {
		return 'A sankey cannot draw cycles, and these links contain one. Use a "graph" series, or split the stages so flows only move forward.';
	}
	return null;
}

function findMissingColumnProblem(referenced: string[], columns: string[]): string | null {
	const missing = referenced.filter((column) => !columns.includes(column));
	if (missing.length === 0) {
		return null;
	}
	return `Column(s) ${missing.map((column) => `"${column}"`).join(', ')} are not in the query result. Available columns: ${columns.join(', ')}.`;
}

function referencedVisualMapColumns(option: InteractiveChartOption): string[] {
	const visualMaps = [option.visualMap].flat() as ({ dimension?: unknown } | undefined)[];
	return visualMaps.flatMap((visualMap) => (typeof visualMap?.dimension === 'string' ? [visualMap.dimension] : []));
}

function removeUnsafeValues(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(removeUnsafeValues);
	}
	if (typeof value !== 'object' || value === null) {
		return value;
	}
	return Object.fromEntries(
		Object.entries(value)
			.filter(([key, entry]) => !UNSAFE_KEYS.has(key) && !isRemoteImageReference(entry))
			.map(([key, entry]) => [key, removeUnsafeValues(entry)]),
	);
}

function isRemoteImageReference(value: unknown): boolean {
	return typeof value === 'string' && value.trim().toLowerCase().startsWith('image://');
}

function expandSeries(series: InteractiveSeries, rows: Row[]): InteractiveSeries {
	const { from_rows: fromRows, ...rest } = series;
	const tabular = Object.fromEntries(
		Object.entries(rest).filter(([key]) => !INLINE_DATA_KEYS.includes(key)),
	) as InteractiveSeries;
	const source = fromRows as FromRows | undefined;

	if (source && NETWORK_TYPES.has(series.type)) {
		return expandNetworkSeries(tabular, source, rows);
	}
	if (source && HIERARCHY_TYPES.has(series.type)) {
		return expandHierarchySeries(tabular, source, rows);
	}
	return series.type === 'candlestick' ? withRisingGreen(tabular) : tabular;
}

/** ECharts draws rises in red, the East Asian convention, which reads backwards to most of our users. */
function withRisingGreen(series: InteractiveSeries): InteractiveSeries {
	const risingAndFalling = { color: '#16a34a', color0: '#dc2626', borderColor: '#16a34a', borderColor0: '#dc2626' };
	return { ...series, itemStyle: { ...risingAndFalling, ...(series.itemStyle as object | undefined) } };
}

function expandNetworkSeries(series: InteractiveSeries, fromRows: FromRows, rows: Row[]): InteractiveSeries {
	const links = buildLinks(fromRows, rows);
	const degrees = new Map<string, number>();
	for (const { source, target } of links) {
		degrees.set(source, (degrees.get(source) ?? 0) + 1);
		degrees.set(target, (degrees.get(target) ?? 0) + 1);
	}

	if (series.type === 'sankey') {
		return {
			emphasis: { focus: 'adjacency' },
			...series,
			data: [...degrees.keys()].map((name) => ({ name })),
			links,
		};
	}

	return {
		layout: 'force',
		roam: true,
		draggable: true,
		force: { repulsion: 160, edgeLength: 70 },
		emphasis: { focus: 'adjacency' },
		label: { show: degrees.size <= 40, position: 'right' },
		...series,
		data: [...degrees].map(([name, degree]) => ({ name, value: degree, symbolSize: 8 + 5 * Math.sqrt(degree) })),
		links,
	};
}

function expandHierarchySeries(series: InteractiveSeries, fromRows: FromRows, rows: Row[]): InteractiveSeries {
	const data = buildHierarchy(fromRows.path ?? [], fromRows.value ?? '', rows);
	if (series.type === 'tree') {
		return {
			roam: true,
			initialTreeDepth: 2,
			label: { position: 'left', align: 'right' },
			leaves: { label: { position: 'right', align: 'left' } },
			...series,
			data: [{ name: 'All', children: data }],
		};
	}
	return { ...series, data };
}

function buildLinks(fromRows: FromRows, rows: Row[]) {
	const valueByLink = new Map<string, { source: string; target: string; value: number }>();
	for (const row of rows) {
		const source = row[fromRows.source ?? ''];
		const target = row[fromRows.target ?? ''];
		if (source == null || target == null) {
			continue;
		}
		const link = { source: String(source), target: String(target) };
		const key = JSON.stringify([link.source, link.target]);
		const value = fromRows.value ? Number(row[fromRows.value]) || 0 : 1;
		valueByLink.set(key, { ...link, value: (valueByLink.get(key)?.value ?? 0) + value });
	}
	return [...valueByLink.values()];
}

function hasCycle(links: { source: string; target: string }[]): boolean {
	const targetsBySource = new Map<string, string[]>();
	const remainingSources = new Map<string, number>();
	for (const { source, target } of links) {
		targetsBySource.set(source, [...(targetsBySource.get(source) ?? []), target]);
		remainingSources.set(target, (remainingSources.get(target) ?? 0) + 1);
		remainingSources.set(source, remainingSources.get(source) ?? 0);
	}

	const readyNodes = [...remainingSources].filter(([, count]) => count === 0).map(([node]) => node);
	let visitedCount = 0;
	while (readyNodes.length > 0) {
		const node = readyNodes.pop() as string;
		visitedCount += 1;
		for (const target of targetsBySource.get(node) ?? []) {
			const remaining = (remainingSources.get(target) ?? 0) - 1;
			remainingSources.set(target, remaining);
			if (remaining === 0) {
				readyNodes.push(target);
			}
		}
	}
	return visitedCount < remainingSources.size;
}

function buildHierarchy(path: string[], valueColumn: string, rows: Row[]): HierarchyNode[] {
	const roots: HierarchyNode[] = [];
	for (const row of rows) {
		let level = roots;
		path.forEach((column, depth) => {
			const name = String(row[column] ?? '(none)');
			let node = level.find((candidate) => candidate.name === name);
			if (!node) {
				node = { name };
				level.push(node);
			}
			if (depth === path.length - 1) {
				node.value = (node.value ?? 0) + (Number(row[valueColumn]) || 0);
				return;
			}
			node.children ??= [];
			level = node.children;
		});
	}
	return roots;
}

function isCartesianSeries(series: InteractiveSeries): boolean {
	return CARTESIAN_TYPES.has(series.type) && series.coordinateSystem !== 'calendar';
}

function buildAxisDefaults(option: Record<string, unknown>) {
	const hasSliderZoom = [option.dataZoom]
		.flat()
		.some((zoom) => (zoom as { type?: string } | undefined)?.type === 'slider');
	return {
		xAxis: option.xAxis ?? { type: 'category' },
		yAxis: option.yAxis ?? { type: 'value' },
		grid: option.grid ?? { containLabel: true, left: 8, right: 16, top: 44, bottom: hasSliderZoom ? 60 : 8 },
	};
}

function buildDefaultLegend(series: InteractiveSeries[]) {
	const hasSeveralEntries = series.length > 1 || series.some((entry) => LEGEND_BY_ITEM_TYPES.has(entry.type));
	return hasSeveralEntries ? { type: 'scroll', top: 4, left: 8, right: 96 } : { show: false };
}

/** richText draws the tooltip on the canvas. The default HTML mode writes it through innerHTML, database values included. */
function buildTooltip(tooltip: unknown, series: InteractiveSeries[]) {
	const trigger = series.every((entry) => AXIS_TRIGGER_TYPES.has(entry.type)) ? 'axis' : 'item';
	const configured = [tooltip].flat()[0] as Record<string, unknown> | undefined;
	return { trigger, ...configured, renderMode: 'richText', confine: true };
}

/** Owned here rather than taken from the option, because the toolbox's dataView feature writes through innerHTML. */
function buildToolbox(usesAxes: boolean) {
	return {
		right: 8,
		top: 4,
		feature: {
			...(usesAxes && { dataZoom: { title: { zoom: 'Zoom to selection', back: 'Undo zoom' } } }),
			restore: { title: 'Reset view' },
			saveAsImage: { title: 'Save as image' },
		},
	};
}
