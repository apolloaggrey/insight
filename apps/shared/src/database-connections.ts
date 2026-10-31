/* Insight: database connections managed from the web app. Apache-2.0. */

export type ConnectionFieldKind =
	| 'text'
	| 'number'
	| 'password'
	| 'textarea'
	| 'json'
	| 'boolean'
	| 'select'
	| 'certificate';

export interface ConnectionField {
	key: string;
	label: string;
	kind: ConnectionFieldKind;
	required?: boolean;
	default?: string | number | boolean;
	placeholder?: string;
	help?: string;
	options?: string[];
	/** Secrets are encrypted at rest, never sent back to the browser, and reach the engine as env vars. */
	secret?: boolean;
}

export interface ConnectionType {
	id: string;
	label: string;
	/** The engine type written to insight_config.yaml (MariaDB uses the MySQL engine). */
	engine: string;
	/** The ten most widely used SQL databases, shown first. */
	popular: boolean;
	fields: ConnectionField[];
}

const host = (placeholder = 'db.example.com'): ConnectionField => ({
	key: 'host',
	label: 'Host',
	kind: 'text',
	required: true,
	placeholder,
});
const port = (value: number): ConnectionField => ({ key: 'port', label: 'Port', kind: 'number', default: value });
const database: ConnectionField = { key: 'database', label: 'Database', kind: 'text', required: true };
const user: ConnectionField = { key: 'user', label: 'Username', kind: 'text', required: true };
const password = (required = true): ConnectionField => ({
	key: 'password',
	label: 'Password',
	kind: 'password',
	required,
	secret: true,
});
const schema: ConnectionField = {
	key: 'schema_name',
	label: 'Schema',
	kind: 'text',
	help: 'Leave empty to make every schema available.',
};

const sslCertificate: ConnectionField = {
	key: 'ssl_ca',
	label: 'SSL CA certificate',
	kind: 'certificate',
	secret: true,
	help: 'Optional. Upload the PEM file from your provider to verify the server. Connections then require TLS.',
};

const serverDatabase = (
	id: string,
	label: string,
	engine: string,
	defaultPort: number,
	extraFields: ConnectionField[] = [],
): ConnectionType => ({
	id,
	label,
	engine,
	popular: true,
	fields: [host(), port(defaultPort), database, user, password(), schema, ...extraFields],
});

export const CONNECTION_TYPES: ConnectionType[] = [
	serverDatabase('postgres', 'PostgreSQL', 'postgres', 5432),
	serverDatabase('mysql', 'MySQL', 'mysql', 3306, [sslCertificate]),
	serverDatabase('mssql', 'SQL Server', 'mssql', 1433),
	{
		id: 'oracle',
		label: 'Oracle',
		engine: 'oracle',
		popular: true,
		fields: [
			host(),
			port(1521),
			{ key: 'service_name', label: 'Service name', kind: 'text', required: true, placeholder: 'ORCLPDB1' },
			user,
			password(),
			schema,
		],
	},
	{
		id: 'sqlite',
		label: 'SQLite',
		engine: 'sqlite',
		popular: true,
		fields: [
			{
				key: 'path',
				label: 'File path on the server',
				kind: 'text',
				required: true,
				placeholder: '/data/app.db',
			},
		],
	},
	serverDatabase('mariadb', 'MariaDB', 'mysql', 3306, [sslCertificate]),
	{
		id: 'snowflake',
		label: 'Snowflake',
		engine: 'snowflake',
		popular: true,
		fields: [
			{ key: 'account_id', label: 'Account', kind: 'text', required: true, placeholder: 'xy12345.eu-west-1' },
			{ key: 'username', label: 'Username', kind: 'text', required: true },
			{ ...password(false), help: 'Or use a private key below.' },
			{ key: 'database', label: 'Database', kind: 'text', required: true },
			{ key: 'warehouse', label: 'Warehouse', kind: 'text' },
			schema,
			{ key: 'private_key', label: 'Private key (PEM)', kind: 'textarea', secret: true },
			{ key: 'passphrase', label: 'Private key passphrase', kind: 'password', secret: true },
		],
	},
	{
		id: 'bigquery',
		label: 'BigQuery',
		engine: 'bigquery',
		popular: true,
		fields: [
			{ key: 'project_id', label: 'Project ID', kind: 'text', required: true },
			{ key: 'dataset_id', label: 'Dataset', kind: 'text', help: 'Leave empty for every dataset.' },
			{ key: 'location', label: 'Location', kind: 'text', placeholder: 'EU' },
			{
				key: 'credentials_json',
				label: 'Service account key (JSON)',
				kind: 'json',
				required: true,
				secret: true,
			},
		],
	},
	{
		id: 'redshift',
		label: 'Amazon Redshift',
		engine: 'redshift',
		popular: true,
		fields: [
			host('cluster.abc123.eu-west-1.redshift.amazonaws.com'),
			port(5439),
			database,
			user,
			password(),
			schema,
		],
	},
	{
		id: 'databricks',
		label: 'Databricks',
		engine: 'databricks',
		popular: true,
		fields: [
			{ key: 'server_hostname', label: 'Server hostname', kind: 'text', required: true },
			{
				key: 'http_path',
				label: 'HTTP path',
				kind: 'text',
				required: true,
				placeholder: '/sql/1.0/warehouses/…',
			},
			{ key: 'access_token', label: 'Access token', kind: 'password', required: true, secret: true },
			{ key: 'catalog', label: 'Catalog', kind: 'text' },
			schema,
		],
	},
	{
		id: 'clickhouse',
		label: 'ClickHouse',
		engine: 'clickhouse',
		popular: false,
		fields: [
			host(),
			{ key: 'port', label: 'Port', kind: 'number', help: 'Defaults to the protocol port.' },
			database,
			user,
			password(false),
			{ key: 'protocol', label: 'Protocol', kind: 'select', options: ['http', 'native'], default: 'http' },
			{ key: 'secure', label: 'Use TLS', kind: 'boolean', default: false },
		],
	},
	{
		id: 'duckdb',
		label: 'DuckDB',
		engine: 'duckdb',
		popular: false,
		fields: [{ key: 'path', label: 'File path on the server', kind: 'text', required: true }],
	},
	{
		id: 'motherduck',
		label: 'MotherDuck',
		engine: 'motherduck',
		popular: false,
		fields: [
			{ key: 'database', label: 'Database', kind: 'text' },
			{ key: 'token', label: 'Token', kind: 'password', required: true, secret: true },
		],
	},
	{
		id: 'trino',
		label: 'Trino',
		engine: 'trino',
		popular: false,
		fields: [
			host(),
			port(8080),
			{ key: 'catalog', label: 'Catalog', kind: 'text', required: true },
			user,
			password(false),
			schema,
			{ key: 'http_scheme', label: 'Scheme', kind: 'select', options: ['http', 'https'], default: 'http' },
		],
	},
	{
		id: 'athena',
		label: 'Amazon Athena',
		engine: 'athena',
		popular: false,
		fields: [
			{ key: 'region_name', label: 'Region', kind: 'text', required: true, placeholder: 'eu-west-1' },
			{
				key: 's3_staging_dir',
				label: 'S3 results location',
				kind: 'text',
				required: true,
				placeholder: 's3://…/',
			},
			{ key: 'aws_access_key_id', label: 'Access key ID', kind: 'text' },
			{ key: 'aws_secret_access_key', label: 'Secret access key', kind: 'password', secret: true },
			{ key: 'work_group', label: 'Workgroup', kind: 'text', default: 'primary' },
			schema,
		],
	},
];

export function getConnectionType(id: string): ConnectionType | undefined {
	return CONNECTION_TYPES.find((type) => type.id === id);
}

/** Connection names become folder names and YAML keys, so keep them simple. */
export const CONNECTION_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/;
