import { displayInteractiveChart as displayInteractiveChartSchema } from '@insight/shared/tools';
import { describe, expect, it, vi } from 'vitest';

import displayInteractiveChart from '../src/agents/tools/display-interactive-chart';
import loadSkill from '../src/agents/tools/load-skill';

vi.mock('../src/services/query-result.service', () => ({
	getQueryResult: vi.fn(async (_context: unknown, queryId: string) =>
		queryId === 'query_1' ? { columns: ['a', 'b'], data: [{ a: 'x', b: 1 }] } : null,
	),
}));

const toolOptions = (context: unknown) => ({ experimental_context: context, toolCallId: 't', messages: [] }) as never;

const execute = (input: unknown, context: unknown) => {
	return displayInteractiveChart.execute!(input as never, toolOptions(context)) as Promise<{
		success: boolean;
		error?: string;
	}>;
};

const option = { series: [{ type: 'bar', encode: { x: 'a', y: 'b' } }] };

describe('display_interactive_chart', () => {
	it('draws from a known query', async () => {
		const output = await execute({ query_id: 'query_1', title: 't', option }, { supportsCustomCharts: true });
		expect(output.success).toBe(true);
	});

	it('points back to display_chart outside the web chat', async () => {
		const output = await execute({ query_id: 'query_1', title: 't', option }, { supportsCustomCharts: false });
		expect(output.success).toBe(false);
		expect(output.error).toContain('display_chart');
	});

	it('explains an unknown query or column', async () => {
		const context = { supportsCustomCharts: true };
		expect((await execute({ query_id: 'nope', title: 't', option }, context)).error).toContain('not found');
		const wrongColumn = { series: [{ type: 'bar', encode: { x: 'zzz' } }] };
		expect((await execute({ query_id: 'query_1', title: 't', option: wrongColumn }, context)).error).toContain(
			'"zzz"',
		);
	});
});

describe('interactive-charts skill', () => {
	const load = (context: unknown) => {
		return loadSkill.execute!({ name: 'interactive-charts' }, toolOptions(context)) as Promise<{ body: string }>;
	};

	it('only teaches recipes the tool accepts', async () => {
		const { body } = await load({ supportsCustomCharts: true });
		const recipes = [...body.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => JSON.parse(match[1]));

		expect(recipes.length).toBeGreaterThanOrEqual(10);
		for (const option of recipes) {
			const parsed = displayInteractiveChartSchema.InputSchema.safeParse({ query_id: 'q', title: 't', option });
			expect(parsed.success).toBe(true);
		}
	});

	it('teaches the tool only where it can render', async () => {
		expect((await load({ supportsCustomCharts: true })).body).toContain('display_interactive_chart');
		expect((await load({ supportsCustomCharts: false })).body).not.toContain('display_interactive_chart');
	});
});
