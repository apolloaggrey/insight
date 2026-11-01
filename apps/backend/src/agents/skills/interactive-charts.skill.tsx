import { Block, Bold, Code, CodeBlock, List, ListItem, renderToMarkdown, Span, Title } from '../../lib/markdown';
import type { InternalSkill } from './types';

export const interactiveChartsSkill: InternalSkill = {
	name: 'interactive-charts',
	description:
		'How to choose and draw a chart beyond the basics: network graphs and relationships, flows (sankey), hierarchies (treemap, sunburst, tree), heatmaps, calendars, funnels, box plots, candlesticks, and zoomable long series. Load this before drawing any of them, or when the user asks to explore a chart interactively.',
	body: ({ canRenderInteractiveCharts }) =>
		renderToMarkdown(
			canRenderInteractiveCharts ? (
				<Block>
					<Title level={1}>Drawing interactive charts</Title>
					<Span>
						<Bold>display_interactive_chart</Bold> draws an Apache ECharts option from a query result. Reach
						for it only when the question needs it: <Bold>display_chart</Bold> stays the right tool for
						ordinary bars, lines, areas, pies and KPIs, because only those can go in stories, exports and
						messages.
					</Span>

					<Title level={2}>Pick the chart from the question</Title>
					<List>
						<ListItem>
							<Bold>Who is connected to whom</Bold> (customers and products, referrals, dependencies):{' '}
							<Code>graph</Code>.
						</ListItem>
						<ListItem>
							<Bold>Where does volume flow</Bold> (journey steps, budget allocation, source to
							destination): <Code>sankey</Code>. It cannot draw cycles; use <Code>graph</Code> if the data
							loops back.
						</ListItem>
						<ListItem>
							<Bold>Which steps lose people</Bold> in one ordered sequence: <Code>funnel</Code>.
						</ListItem>
						<ListItem>
							<Bold>Which parts make up the whole</Bold> across levels: <Code>treemap</Code> to compare
							sizes, <Code>sunburst</Code> to read the levels, <Code>tree</Code> when structure matters
							more than size.
						</ListItem>
						<ListItem>
							<Bold>Where are the hot spots</Bold> across two categories (cohort retention, hour by
							weekday): <Code>heatmap</Code>. Across days of the year: <Code>heatmap</Code> on a{' '}
							<Code>calendar</Code>.
						</ListItem>
						<ListItem>
							<Bold>How are values spread</Bold> across groups: <Code>boxplot</Code>. Price movement over
							time: <Code>candlestick</Code>.
						</ListItem>
						<ListItem>
							<Bold>How do two measures relate</Bold>, with a third as size or color: <Code>scatter</Code>{' '}
							with a <Code>visualMap</Code>.
						</ListItem>
						<ListItem>
							<Bold>A long series</Bold> (hundreds of points or more) that the user will want to inspect:{' '}
							<Code>line</Code> with <Code>dataZoom</Code>.
						</ListItem>
					</List>

					<Title level={2}>The data comes from the query, always</Title>
					<Span>
						Rows are injected from <Code>query_id</Code>. Never write <Code>data</Code>, <Code>links</Code>,{' '}
						<Code>nodes</Code> or <Code>dataset</Code> into the option: the tool rejects them, so that no
						number on screen can differ from what the query returned. Shape the data in SQL instead,
						including sorting, filtering and limiting. If a chart needs one series per category, pivot in
						SQL so each one is a column. Refer to columns by their exact names.
					</Span>
					<Span>
						Tabular types name their columns in <Code>encode</Code>. Network and hierarchy types name them
						in <Code>from_rows</Code>, and the rest is built for you. Only these top-level keys are honored:{' '}
						<Code>series</Code>, <Code>xAxis</Code>, <Code>yAxis</Code>, <Code>grid</Code>,{' '}
						<Code>legend</Code>, <Code>tooltip</Code>, <Code>visualMap</Code>, <Code>dataZoom</Code>,{' '}
						<Code>calendar</Code>, <Code>color</Code>. The option is JSON, so JavaScript functions are
						impossible; a <Code>formatter</Code> is a template string such as <Code>{'{value} ms'}</Code>.
					</Span>

					<Title level={2}>Recipes</Title>
					<Span>
						Network graph, from rows of <Code>customer</Code>, <Code>product</Code>, <Code>orders</Code>.
						Nodes are sized by their number of connections. Keep it readable: 200 links or fewer, the
						strongest ones, chosen in SQL. The tool refuses more than 1,000.
					</Span>
					<CodeBlock header='json'>
						{`{ "series": [{ "type": "graph", "from_rows": { "source": "customer", "target": "product", "value": "orders" } }] }`}
					</CodeBlock>
					<Span>Sankey, from rows of one link per row:</Span>
					<CodeBlock header='json'>
						{`{ "series": [{ "type": "sankey", "from_rows": { "source": "from_step", "target": "to_step", "value": "users" } }] }`}
					</CodeBlock>
					<Span>
						Treemap (<Code>sunburst</Code> and <Code>tree</Code> take the same shape), one row per leaf:
					</Span>
					<CodeBlock header='json'>
						{`{ "series": [{ "type": "treemap", "from_rows": { "path": ["region", "country"], "value": "revenue" } }] }`}
					</CodeBlock>
					<Span>Funnel, with rows in step order:</Span>
					<CodeBlock header='json'>
						{`{ "series": [{ "type": "funnel", "sort": "none", "encode": { "itemName": "step", "value": "users" } }] }`}
					</CodeBlock>
					<Span>
						Heatmap. Both axes must be categories, and <Code>visualMap</Code> needs the real range, so
						select <Code>min</Code> and <Code>max</Code> first:
					</Span>
					<CodeBlock header='json'>
						{`{
  "xAxis": { "type": "category" },
  "yAxis": { "type": "category" },
  "grid": { "containLabel": true, "left": 8, "right": 16, "top": 44, "bottom": 64 },
  "visualMap": { "min": 0, "max": 1200, "dimension": "orders", "calculable": true, "orient": "horizontal", "left": "center", "bottom": 0 },
  "series": [{ "type": "heatmap", "encode": { "x": "hour", "y": "weekday" } }]
}`}
					</CodeBlock>
					<Span>
						Calendar. <Code>range</Code> is a year, or a pair of dates:
					</Span>
					<CodeBlock header='json'>
						{`{
  "calendar": { "range": "2026", "top": 70, "left": 64, "right": 16 },
  "visualMap": { "min": 0, "max": 300, "dimension": "orders", "orient": "horizontal", "left": "center", "top": 0 },
  "series": [{ "type": "heatmap", "coordinateSystem": "calendar", "encode": { "time": "day", "value": "orders" } }]
}`}
					</CodeBlock>
					<Span>
						Box plot, with the five statistics computed in SQL (<Code>quantile_cont</Code> or your
						dialect&apos;s equivalent), in this order:
					</Span>
					<CodeBlock header='json'>
						{`{ "series": [{ "type": "boxplot", "encode": { "x": "team", "y": ["low", "q1", "median", "q3", "high"] } }] }`}
					</CodeBlock>
					<Span>Candlestick, in this order:</Span>
					<CodeBlock header='json'>
						{`{ "xAxis": { "type": "category" }, "yAxis": { "scale": true }, "series": [{ "type": "candlestick", "encode": { "x": "day", "y": ["open", "close", "low", "high"] } }] }`}
					</CodeBlock>
					<Span>Long series with zooming, where the slider also moves with the scroll wheel:</Span>
					<CodeBlock header='json'>
						{`{
  "xAxis": { "type": "time" },
  "dataZoom": [{ "type": "inside" }, { "type": "slider" }],
  "series": [{ "type": "line", "showSymbol": false, "encode": { "x": "day", "y": "revenue" } }]
}`}
					</CodeBlock>
					<Span>Bubbles, with a third measure as size:</Span>
					<CodeBlock header='json'>
						{`{
  "xAxis": { "type": "value", "name": "Spend", "nameLocation": "middle", "nameGap": 28 },
  "yAxis": { "type": "value", "name": "Revenue", "nameLocation": "middle", "nameGap": 40 },
  "grid": { "left": 64, "right": 32, "top": 44, "bottom": 48 },
  "visualMap": { "show": false, "dimension": "customers", "min": 0, "max": 500, "inRange": { "symbolSize": [6, 40] } },
  "series": [{ "type": "scatter", "encode": { "x": "spend", "y": "revenue", "itemName": "segment" } }]
}`}
					</CodeBlock>

					<Title level={2}>Make it honest and readable</Title>
					<List>
						<ListItem>
							Name your axes with units whenever the title does not make them obvious, and start bar
							charts at zero.
						</ListItem>
						<ListItem>
							Use a sequential color range for a measure that only goes up, and a diverging one (with{' '}
							<Code>min</Code> and <Code>max</Code> equally far from the midpoint) for a change that can
							go either way. Leave <Code>color</Code> unset otherwise: the theme handles light and dark.
						</ListItem>
						<ListItem>
							Do not encode a measure in color alone when people must read exact values: add labels, or
							say the key figures in your reply.
						</ListItem>
						<ListItem>
							Tooltips, legend toggles, reset and save-as-image are already there, plus zoom on axis
							charts, so do not configure them. Tell the user what they can do only when it is not
							obvious, such as dragging the nodes of a graph or clicking into a treemap.
						</ListItem>
						<ListItem>
							If the tool returns an error, fix the option from what it says. After two failed attempts,
							fall back to <Bold>display_chart</Bold> or a table rather than retrying.
						</ListItem>
					</List>
				</Block>
			) : (
				<Block>
					<Title level={1}>Charts on this surface</Title>
					<Span>
						Interactive charts only render in the web chat, and this run cannot display them. Answer with{' '}
						<Bold>display_chart</Bold> or a table: rank the top links for a network or flow, and pivot two
						categories into a table with conditional formatting in place of a heatmap. Mention that the
						richer view is available if the user opens the question in the web chat.
					</Span>
				</Block>
			),
		),
};
