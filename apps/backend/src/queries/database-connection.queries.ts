/* Insight: database connections managed from the web app. Apache-2.0. */
import { and, asc, eq } from 'drizzle-orm';

import s, { type DBDatabaseConnection } from '../db/abstractSchema';
import { db } from '../db/db';

export type DatabaseConnectionRow = DBDatabaseConnection & { createdByName: string | null };

export interface NewDatabaseConnection {
	projectId: string;
	name: string;
	typeId: string;
	settings: string;
	encryptedSecrets: string | null;
	createdBy: string;
}

export async function listDatabaseConnections(projectId: string): Promise<DatabaseConnectionRow[]> {
	const rows = await db
		.select({ connection: s.databaseConnection, createdByName: s.user.name })
		.from(s.databaseConnection)
		.leftJoin(s.user, eq(s.user.id, s.databaseConnection.createdBy))
		.where(eq(s.databaseConnection.projectId, projectId))
		.orderBy(asc(s.databaseConnection.name))
		.execute();
	return rows.map((row) => ({ ...row.connection, createdByName: row.createdByName }));
}

export async function getDatabaseConnection(projectId: string, id: string): Promise<DBDatabaseConnection | null> {
	const [row] = await db
		.select()
		.from(s.databaseConnection)
		.where(and(eq(s.databaseConnection.projectId, projectId), eq(s.databaseConnection.id, id)))
		.limit(1)
		.execute();
	return row ?? null;
}

export async function insertDatabaseConnection(values: NewDatabaseConnection): Promise<DBDatabaseConnection> {
	const [row] = await db.insert(s.databaseConnection).values(values).returning().execute();
	return row;
}

export async function updateDatabaseConnection(
	id: string,
	values: Partial<
		Pick<DBDatabaseConnection, 'settings' | 'encryptedSecrets' | 'lastSyncAt' | 'lastSyncOk' | 'lastSyncMessage'>
	>,
): Promise<void> {
	await db.update(s.databaseConnection).set(values).where(eq(s.databaseConnection.id, id)).execute();
}

export async function deleteDatabaseConnection(id: string): Promise<void> {
	await db.delete(s.databaseConnection).where(eq(s.databaseConnection.id, id)).execute();
}
