/* Insight: database connections managed from the web app. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, projectPath: '' }));

vi.mock('../src/env', () => ({ env: { BETTER_AUTH_SECRET: 'test-secret', FASTAPI_PORT: 9 } }));
vi.mock('../src/queries/project.queries', () => ({
	retrieveProjectById: async () => ({ id: 'p1', path: state.projectPath }),
	getEnvVars: async () => ({ PROJECT_VAR: 'x' }),
}));
vi.mock('../src/queries/database-connection.queries', () => ({
	listDatabaseConnections: async () => state.rows.map((row) => ({ ...row, createdByName: 'Ada' })),
	getDatabaseConnection: async (_projectId: string, id: string) => state.rows.find((row) => row.id === id) ?? null,
	insertDatabaseConnection: async (values: Record<string, unknown>) => {
		const row = {
			...values,
			id: `id-${state.rows.length + 1}`,
			createdAt: new Date(),
			updatedAt: new Date(),
			lastSyncAt: null,
			lastSyncOk: null,
			lastSyncMessage: null,
		};
		state.rows.push(row);
		return row;
	},
	updateDatabaseConnection: async (id: string, values: Record<string, unknown>) => {
		Object.assign(state.rows.find((row) => row.id === id) ?? {}, values);
	},
	deleteDatabaseConnection: async (id: string) => {
		state.rows = state.rows.filter((row) => row.id !== id);
	},
}));

import * as service from '../src/services/database-connection.service';

const fetchMock = vi.fn();

beforeEach(() => {
	state.rows = [];
	state.projectPath = mkdtempSync(path.join(tmpdir(), 'insight-conn-'));
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

const postgresValues = { host: 'db.example.com', database: 'sales', user: 'reader', password: 'p@ss:"w#rd' };

describe('database connections', () => {
	it('stores secrets encrypted and writes them to the YAML only as env references', async () => {
		const view = await service.createConnection('p1', 'u1', {
			name: 'Warehouse',
			typeId: 'postgres',
			values: postgresValues,
		});

		expect(view.name).toBe('warehouse');
		expect(view.storedSecrets).toEqual(['password']);
		expect(view.settings).toEqual({ host: 'db.example.com', port: 5432, database: 'sales', user: 'reader' });
		expect(String(state.rows[0].encryptedSecrets)).not.toContain('p@ss');

		const yaml = readFileSync(path.join(state.projectPath, service.MANAGED_CONNECTIONS_FILE), 'utf8');
		expect(yaml).toContain('- name: "warehouse"\n  type: "postgres"\n  host: "db.example.com"\n  port: 5432');
		expect(yaml).toMatch(/password: \{\{ env\('INSIGHT_CONN_ID1_PASSWORD'\) \}\}/);
		expect(yaml).not.toContain('p@ss');

		const vars = await service.getRuntimeEnvVars('p1');
		expect(vars).toMatchObject({
			PROJECT_VAR: 'x',
			INSIGHT_CONN_ID1_PASSWORD: JSON.stringify(postgresValues.password),
		});
	});

	it('maps MariaDB to the MySQL engine', async () => {
		await service.createConnection('p1', 'u1', { name: 'maria', typeId: 'mariadb', values: postgresValues });
		expect(readFileSync(path.join(state.projectPath, service.MANAGED_CONNECTIONS_FILE), 'utf8')).toContain(
			'type: "mysql"',
		);
	});

	it('rejects missing required fields, bad names, duplicates and invalid JSON', async () => {
		await expect(
			service.createConnection('p1', 'u1', {
				name: 'w',
				typeId: 'postgres',
				values: { ...postgresValues, password: '' },
			}),
		).rejects.toThrow('Password is required');
		await expect(
			service.createConnection('p1', 'u1', { name: '../etc', typeId: 'postgres', values: postgresValues }),
		).rejects.toThrow('connection name');
		await service.createConnection('p1', 'u1', { name: 'w', typeId: 'postgres', values: postgresValues });
		await expect(
			service.createConnection('p1', 'u1', { name: 'w', typeId: 'postgres', values: postgresValues }),
		).rejects.toThrow('already exists');
		await expect(
			service.createConnection('p1', 'u1', {
				name: 'bq',
				typeId: 'bigquery',
				values: { project_id: 'demo', credentials_json: '{not json' },
			}),
		).rejects.toThrow('not valid JSON');
	});

	it('keeps the stored password when an edit leaves it blank', async () => {
		const view = await service.createConnection('p1', 'u1', {
			name: 'w',
			typeId: 'postgres',
			values: postgresValues,
		});
		await service.updateConnection('p1', view.id, { ...postgresValues, host: 'new.example.com', password: '' });

		const [updated] = await service.listConnections('p1');
		expect(updated.settings.host).toBe('new.example.com');
		expect((await service.getRuntimeEnvVars('p1')).INSIGHT_CONN_ID1_PASSWORD).toBe(
			JSON.stringify(postgresValues.password),
		);
	});

	it('tests a candidate with the stored secret filled in', async () => {
		const view = await service.createConnection('p1', 'u1', {
			name: 'w',
			typeId: 'postgres',
			values: postgresValues,
		});
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, message: 'Connected' })));

		await expect(
			service.testConnection('p1', {
				id: view.id,
				typeId: 'postgres',
				values: { ...postgresValues, password: '' },
			}),
		).resolves.toEqual({ ok: true, message: 'Connected' });
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.config).toMatchObject({ type: 'postgres', password: postgresValues.password, port: 5432 });
	});

	it('removes the synced context folder with the connection, never anything outside databases/', async () => {
		const view = await service.createConnection('p1', 'u1', {
			name: 'w',
			typeId: 'postgres',
			values: postgresValues,
		});
		const context = path.join(state.projectPath, 'databases', 'type=postgres', 'database=sales');
		mkdirSync(context, { recursive: true });
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ path: 'databases/type=postgres/database=sales' })));

		await service.deleteConnection('p1', view.id);

		expect(existsSync(context)).toBe(false);
		expect(state.rows).toHaveLength(0);
		expect(readFileSync(path.join(state.projectPath, service.MANAGED_CONNECTIONS_FILE), 'utf8')).not.toContain(
			'name:',
		);

		const outside = await service.createConnection('p1', 'u1', {
			name: 'x',
			typeId: 'postgres',
			values: postgresValues,
		});
		mkdirSync(path.join(state.projectPath, 'keep'), { recursive: true });
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ path: '../keep' })));
		await service.deleteConnection('p1', outside.id);
		expect(existsSync(path.join(state.projectPath, 'keep'))).toBe(true);
	});
});
