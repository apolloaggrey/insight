import { findInteractiveChartProblem } from '@insight/shared/interactive-chart';
import { displayInteractiveChart } from '@insight/shared/tools';

import { getQueryResult } from '../../services/query-result.service';
import { createTool } from '../../utils/tools';

export default createTool<displayInteractiveChart.Input, displayInteractiveChart.Output>({
	description: displayInteractiveChart.description,
	inputSchema: displayInteractiveChart.InputSchema,
	outputSchema: displayInteractiveChart.OutputSchema,

	execute: async ({ query_id: queryId, option }, context) => {
		if (!context.supportsCustomCharts) {
			return {
				_version: '1',
				success: false,
				error: 'Interactive charts only render in the web chat. Use display_chart here.',
			};
		}

		const queryResult = await getQueryResult(context, queryId);
		if (!queryResult) {
			return {
				_version: '1',
				success: false,
				error: `Query result "${queryId}" not found. Run \`execute_sql\` first and use the id from its output.`,
			};
		}

		const problem = findInteractiveChartProblem(option, queryResult.columns, queryResult.data);
		return problem ? { _version: '1', success: false, error: problem } : { _version: '1', success: true };
	},

	toModelOutput: ({ output }) => ({
		type: 'text',
		value: output.error
			? `Could not display the chart: ${output.error}`
			: 'Interactive chart displayed successfully.',
	}),
});
