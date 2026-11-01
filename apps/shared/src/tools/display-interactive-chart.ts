import z from 'zod/v3';

import { INTERACTIVE_SERIES_TYPES } from '../interactive-chart';

export const description = [
	'Draw an interactive Apache ECharts chart from a previous `execute_sql` result, for what `display_chart` cannot show: network graphs, sankeys, treemaps, sunbursts, trees, heatmaps, calendars, funnels, box plots, candlesticks, or a long series that needs zooming.',
	'Load the `interactive-charts` skill first. Use `display_chart` for ordinary bars, lines, areas, pies and KPIs.',
	'Only renders in the web chat.',
].join(' ');

const SeriesSchema = z
	.object({
		type: z.enum(INTERACTIVE_SERIES_TYPES).describe('ECharts series type.'),
		encode: z
			.record(z.string(), z.union([z.string(), z.array(z.string())]))
			.describe(
				'Maps roles to column names, e.g. { x: "month", y: "revenue" }, or { itemName: "stage", value: "users" } for pie and funnel. Required for every type except sankey, graph, treemap, sunburst and tree.',
			)
			.optional(),
		from_rows: z
			.object({
				source: z.string().describe('sankey/graph: column holding where a link starts.').optional(),
				target: z.string().describe('sankey/graph: column holding where a link ends.').optional(),
				value: z.string().describe('Column holding the link weight or the leaf size.').optional(),
				path: z
					.array(z.string())
					.describe('treemap/sunburst/tree: columns from the outermost level to the innermost.')
					.optional(),
			})
			.describe(
				'Builds the nodes, links or hierarchy of sankey, graph, treemap, sunburst and tree from the rows.',
			)
			.optional(),
	})
	.passthrough();

export const InputSchema = z.object({
	query_id: z.string().describe("The id of a previous `execute_sql` tool call's output to get data from."),
	title: z.string().describe('A concise title of what the chart shows, without naming the chart type.'),
	option: z
		.object({ series: z.array(SeriesSchema).min(1) })
		.passthrough()
		.describe(
			'ECharts option as plain JSON: series, plus xAxis, yAxis, grid, legend, tooltip, visualMap, dataZoom, calendar and color when needed. Never include the data itself.',
		),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	success: z.boolean(),
	error: z.string().optional(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
