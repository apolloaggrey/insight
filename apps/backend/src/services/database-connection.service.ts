/* Insight: database connections managed from the web app. Apache-2.0. */
import { rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import {
	CONNECTION_NAME_PATTERN,
	type ConnectionField,
	type ConnectionType,
	getConnectionType,
} from '@insight/shared/database-connections';

import type { DBDatabaseConnection } from '../db/abstractSchema';
import { env } from '../env';
import * as connectionQueries from '../queries/database-connection.queries';
import * as projectQueries from '../queries/project.queries';
import { decryptSecret, encryptSecret } from '../utils/encryption';
import { HandlerError } from '../utils/error';

export const MANAGED_CONNECTIONS_FILE = 'insight_connections.yaml';

export type ConnectionValues = Record<string, string | number | boolean | null | undefined>;

export interface ConnectionView {
	id: string;
	name: string;
	typeId: string;
	typeLabel: string;
	settings: Record<string, unknown>;
	/** Which secrets are stored; their values never leave the server. */
	storedSecrets: string[];
	createdByName: string | null;
	createdAt: Date;
	updatedAt: Date;
	lastSyncAt: Date | null;
	lastSyncOk: boolean | null;
	lastSyncMessage: string | null;
}

export async function listConnections(projectId: string): Promise<ConnectionView[]> {
	const rows = await connectionQueries.listDatabaseConnections(projectId);
	return rows.map((row) => toView(row, row.createdByName));
}

export async function createConnection(
	projectId: string,
	userId: string,
	input: { name: string; typeId: string; values: ConnectionValues },
): Promise<ConnectionView> {
	const type = requireType(input.typeId);
	const name = input.name.trim().toLowerCase();
	if (!CONNECTION_NAME_PATTERN.test(name)) {
		throw new HandlerError('BAD_REQUEST', 'Use lowercase letters, numbers, "-" and "_" for the connection name.');
	}
	const { settings, secrets } = splitValues(type, input.values, {});
	const existing = await connectionQueries.listDatabaseConnections(projectId);
	if (existing.some((connection) => connection.name === name)) {
		throw new HandlerError('CONFLICT', `A connection named "${name}" already exists.`);
	}
	const row = await connectionQueries.insertDatabaseConnection({
		projectId,
		name,
		typeId: type.id,
		settings: JSON.stringify(settings),
		encryptedSecrets: encryptSecrets(secrets),
		createdBy: userId,
	});
	await writeManagedConnectionsFile(projectId);
	return toView(row, null);
}

/** Blank secret fields keep the stored value, so editing a host never asks for the password again. */
export async function updateConnection(projectId: string, id: string, values: ConnectionValues): Promise<void> {
	const row = await requireConnection(projectId, id);
	const type = requireType(row.typeId);
	const { settings, secrets } = splitValues(type, values, readSecrets(row));
	await connectionQueries.updateDatabaseConnection(id, {
		settings: JSON.stringify(settings),
		encryptedSecrets: encryptSecrets(secrets),
	});
	await writeManagedConnectionsFile(projectId);
}

export async function deleteConnection(projectId: string, id: string): Promise<void> {
	const row = await requireConnection(projectId, id);
	const contextPath = await findContextPath(projectId, row).catch(() => null);
	await connectionQueries.deleteDatabaseConnection(id);
	await writeManagedConnectionsFile(projectId);
	if (contextPath) {
		await removeInsideProject(projectId, contextPath);
	}
}

/** Tries a connection without saving it; with an id, blank secrets fall back to the stored ones. */
export async function testConnection(
	projectId: string,
	input: { typeId: string; values: ConnectionValues; id?: string; name?: string },
): Promise<{ ok: boolean; message: string }> {
	const type = requireType(input.typeId);
	const stored = input.id ? readSecrets(await requireConnection(projectId, input.id)) : {};
	const { settings, secrets } = splitValues(type, input.values, stored);
	return callPython('/test_connection', {
		config: { name: input.name || 'connection-test', type: type.engine, ...settings, ...secrets },
	});
}

/** Reads the connection's schemas and tables so the agent knows what it can query. */
export async function syncConnection(projectId: string, id: string): Promise<{ ok: boolean; output: string }> {
	const row = await requireConnection(projectId, id);
	const project = await projectQueries.retrieveProjectById(projectId);
	const result = await callPython<{ ok: boolean; output: string }>('/sync_database', {
		insight_project_folder: project.path,
		database_name: row.name,
		env_vars: await getRuntimeEnvVars(projectId),
	});
	await connectionQueries.updateDatabaseConnection(id, {
		lastSyncAt: new Date(),
		lastSyncOk: result.ok,
		lastSyncMessage: summarizeSyncOutput(result.output),
	});
	return result;
}

/** Project env vars plus the secrets of connections added from Settings > Project > Databases. */
export async function getRuntimeEnvVars(projectId: string): Promise<Record<string, string>> {
	const [projectVars, connectionVars] = await Promise.all([
		projectQueries.getEnvVars(projectId),
		getConnectionEnvVars(projectId),
	]);
	return { ...projectVars, ...connectionVars };
}

/** Secrets for every managed connection, JSON-encoded so they drop into the YAML as valid values. */
export async function getConnectionEnvVars(projectId: string): Promise<Record<string, string>> {
	const rows = await connectionQueries.listDatabaseConnections(projectId);
	const vars: Record<string, string> = {};
	for (const row of rows) {
		for (const [key, value] of Object.entries(readSecrets(row))) {
			vars[secretEnvName(row.id, key)] = JSON.stringify(value);
		}
	}
	return vars;
}

export async function writeManagedConnectionsFile(projectId: string): Promise<void> {
	const project = await projectQueries.retrieveProjectById(projectId);
	const rows = await connectionQueries.listDatabaseConnections(projectId);
	const header = '# Managed by Insight (Settings > Project > Databases). Edits here are overwritten.\n';
	await writeFile(join(project.path as string, MANAGED_CONNECTIONS_FILE), header + rows.map(renderEntry).join(''), {
		mode: 0o600,
	});
}

function renderEntry(row: DBDatabaseConnection): string {
	const type = requireType(row.typeId);
	const settings = JSON.parse(row.settings) as Record<string, unknown>;
	const lines = [`- name: ${JSON.stringify(row.name)}`, `  type: ${JSON.stringify(type.engine)}`];
	for (const [key, value] of Object.entries(settings)) {
		lines.push(`  ${key}: ${JSON.stringify(value)}`);
	}
	for (const key of Object.keys(readSecrets(row))) {
		lines.push(`  ${key}: {{ env('${secretEnvName(row.id, key)}') }}`);
	}
	return lines.join('\n') + '\n';
}

function splitValues(type: ConnectionType, values: ConnectionValues, storedSecrets: Record<string, unknown>) {
	const settings: Record<string, unknown> = {};
	const secrets: Record<string, unknown> = {};
	for (const field of type.fields) {
		const value = normalizeValue(field, values[field.key]);
		if (field.secret) {
			const resolved = value ?? storedSecrets[field.key];
			if (resolved !== undefined) {
				secrets[field.key] = resolved;
			}
		} else if (value !== undefined) {
			settings[field.key] = value;
		}
		if (field.required && settings[field.key] === undefined && secrets[field.key] === undefined) {
			throw new HandlerError('BAD_REQUEST', `${field.label} is required.`);
		}
	}
	return { settings, secrets };
}

function normalizeValue(field: ConnectionField, raw: ConnectionValues[string]): unknown {
	if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
		return field.default !== undefined && !field.secret ? field.default : undefined;
	}
	switch (field.kind) {
		case 'number': {
			const number = Number(raw);
			if (!Number.isInteger(number) || number <= 0) {
				throw new HandlerError('BAD_REQUEST', `${field.label} must be a whole number.`);
			}
			return number;
		}
		case 'boolean':
			return raw === true || raw === 'true';
		case 'json':
			try {
				return JSON.parse(String(raw));
			} catch {
				throw new HandlerError('BAD_REQUEST', `${field.label} is not valid JSON.`);
			}
		case 'select':
			if (field.options && !field.options.includes(String(raw))) {
				throw new HandlerError('BAD_REQUEST', `${field.label} must be one of ${field.options.join(', ')}.`);
			}
			return String(raw);
		default:
			return String(raw).trim();
	}
}

function toView(row: DBDatabaseConnection, createdByName: string | null): ConnectionView {
	const type = getConnectionType(row.typeId);
	return {
		id: row.id,
		name: row.name,
		typeId: row.typeId,
		typeLabel: type?.label ?? row.typeId,
		settings: JSON.parse(row.settings) as Record<string, unknown>,
		storedSecrets: Object.keys(readSecrets(row)),
		createdByName,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		lastSyncAt: row.lastSyncAt,
		lastSyncOk: row.lastSyncOk,
		lastSyncMessage: row.lastSyncMessage,
	};
}

function readSecrets(row: Pick<DBDatabaseConnection, 'encryptedSecrets'>): Record<string, unknown> {
	return row.encryptedSecrets ? (JSON.parse(decryptSecret(row.encryptedSecrets)) as Record<string, unknown>) : {};
}

function encryptSecrets(secrets: Record<string, unknown>): string | null {
	return Object.keys(secrets).length > 0 ? encryptSecret(JSON.stringify(secrets)) : null;
}

function secretEnvName(connectionId: string, key: string): string {
	return `INSIGHT_CONN_${connectionId.replaceAll('-', '').toUpperCase()}_${key.toUpperCase()}`;
}

function requireType(typeId: string): ConnectionType {
	const type = getConnectionType(typeId);
	if (!type) {
		throw new HandlerError('BAD_REQUEST', `Unknown database type: ${typeId}`);
	}
	return type;
}

async function requireConnection(projectId: string, id: string): Promise<DBDatabaseConnection> {
	const row = await connectionQueries.getDatabaseConnection(projectId, id);
	if (!row) {
		throw new HandlerError('NOT_FOUND', 'Connection not found.');
	}
	return row;
}

async function findContextPath(projectId: string, row: DBDatabaseConnection): Promise<string | null> {
	const project = await projectQueries.retrieveProjectById(projectId);
	const result = await callPython<{ path: string | null }>('/database_context_path', {
		insight_project_folder: project.path,
		database_name: row.name,
		env_vars: await getConnectionEnvVars(projectId),
	});
	return result.path;
}

/** Removes a synced context folder, refusing anything that would land outside the project. */
async function removeInsideProject(projectId: string, relativePath: string): Promise<void> {
	const project = await projectQueries.retrieveProjectById(projectId);
	const root = resolve(project.path as string);
	const target = resolve(root, relativePath);
	if (target.startsWith(root + sep + 'databases' + sep)) {
		await rm(target, { recursive: true, force: true });
	}
}

function summarizeSyncOutput(output: string): string {
	const lines = output
		.split('\n')
		.map((line) => stripVTControlCharacters(line).trim())
		.filter(Boolean);
	return lines.slice(-6).join('\n').slice(0, 1000);
}

async function callPython<T = { ok: boolean; message: string }>(path: string, body: object): Promise<T> {
	const response = await fetch(`http://localhost:${env.FASTAPI_PORT}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-Insight-Internal-Secret': env.BETTER_AUTH_SECRET },
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		const detail = await response.json().catch(() => ({ detail: response.statusText }));
		throw new HandlerError(
			'BAD_REQUEST',
			typeof detail.detail === 'string' ? detail.detail : 'The query service failed.',
		);
	}
	return response.json() as Promise<T>;
}
