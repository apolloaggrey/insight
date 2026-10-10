/* Insight: database connections managed from the web app. Apache-2.0. */
import { createFileRoute } from '@tanstack/react-router';

import { DatabaseConnections } from '@/components/settings/database-connections';

export const Route = createFileRoute('/_sidebar-layout/settings/project/databases')({
	staticData: {
		title: 'Databases',
		description:
			'Connect PostgreSQL, MySQL, SQL Server, Oracle, Snowflake, BigQuery and more for the agent to query.',
	},
	component: DatabaseConnections,
});
