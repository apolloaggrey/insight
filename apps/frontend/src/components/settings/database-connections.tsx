/* Insight: database connections managed from the web app. Apache-2.0. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Database, Pencil, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { ConnectionField, ConnectionType } from '@insight/shared/database-connections';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '@/components/ui/settings-card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/hooks/use-permissions';
import { trpc } from '@/main';

type FormValues = Record<string, string | boolean>;

interface Connection {
	id: string;
	name: string;
	typeId: string;
	typeLabel: string;
	settings: Record<string, unknown>;
	storedSecrets: string[];
	createdByName: string | null;
	lastSyncAt: string | Date | null;
	lastSyncOk: boolean | null;
	lastSyncMessage: string | null;
}

type DialogState = { mode: 'create' } | { mode: 'edit'; connection: Connection } | null;

export function DatabaseConnections() {
	const { isAdmin, isContextAdmin } = usePermissions();
	const canManage = isAdmin || isContextAdmin;
	const types = useQuery(trpc.databaseConnection.types.queryOptions());
	const connections = useQuery(trpc.databaseConnection.list.queryOptions());
	const [dialog, setDialog] = useState<DialogState>(null);
	const [deleting, setDeleting] = useState<Connection | null>(null);
	const refresh = useRefreshConnections();
	const remove = useMutation(trpc.databaseConnection.delete.mutationOptions({ onSuccess: refresh }));

	return (
		<>
			<SettingsCard
				title='Database connections'
				description='Connect the databases the agent can query. Passwords and keys are encrypted and never shown again.'
				action={
					canManage ? (
						<Button size='sm' onClick={() => setDialog({ mode: 'create' })}>
							Add database
						</Button>
					) : undefined
				}
			>
				{connections.isLoading ? (
					<p className='text-sm text-muted-foreground'>Loading…</p>
				) : connections.isError ? (
					<p className='text-sm text-destructive'>{connections.error.message}</p>
				) : connections.data?.length ? (
					<ul className='flex flex-col divide-y'>
						{connections.data.map((connection) => (
							<ConnectionRow
								key={connection.id}
								connection={connection}
								canManage={canManage}
								onEdit={() => setDialog({ mode: 'edit', connection })}
								onDelete={() => setDeleting(connection)}
							/>
						))}
					</ul>
				) : (
					<p className='text-sm text-muted-foreground'>
						No databases yet. {canManage ? 'Add one to let the agent answer questions about it.' : ''}
					</p>
				)}
			</SettingsCard>
			{dialog && types.data && (
				<ConnectionDialog state={dialog} types={types.data} onClose={() => setDialog(null)} />
			)}
			<ConfirmationDialog
				open={!!deleting}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={`Delete ${deleting?.name ?? 'connection'}?`}
				description='The agent stops using this database and its stored credentials and synced table descriptions are removed.'
				confirmLabel='Delete'
				isPending={remove.isPending}
				error={remove.error?.message}
				onConfirm={async () => {
					if (deleting) {
						await remove.mutateAsync({ id: deleting.id });
						setDeleting(null);
					}
				}}
			/>
		</>
	);
}

function ConnectionRow(props: {
	connection: Connection;
	canManage: boolean;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const { connection, canManage } = props;
	const sync = useMutation(trpc.databaseConnection.sync.mutationOptions({ onSettled: useRefreshConnections() }));
	const target = String(connection.settings.host ?? connection.settings.path ?? connection.settings.account_id ?? '');

	return (
		<li className='flex items-start gap-3 py-3'>
			<Database className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
			<div className='flex min-w-0 flex-1 flex-col gap-0.5'>
				<div className='flex items-center gap-2'>
					<span className='text-sm font-medium'>{connection.name}</span>
					<Badge variant='secondary'>{connection.typeLabel}</Badge>
					<SyncBadge connection={connection} isSyncing={sync.isPending} />
				</div>
				<span className='truncate text-xs text-muted-foreground'>
					{target}
					{connection.createdByName ? ` · added by ${connection.createdByName}` : ''}
				</span>
				{connection.lastSyncOk === false && connection.lastSyncMessage && (
					<pre className='mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs'>
						{connection.lastSyncMessage}
					</pre>
				)}
			</div>
			{canManage && (
				<div className='flex items-center gap-1'>
					<Button
						variant='ghost'
						size='sm'
						disabled={sync.isPending}
						onClick={() => sync.mutate({ id: connection.id })}
						title='Read the tables again'
					>
						<RefreshCw className={sync.isPending ? 'size-4 animate-spin' : 'size-4'} />
						Sync
					</Button>
					<Button variant='ghost' size='icon' onClick={props.onEdit} aria-label={`Edit ${connection.name}`}>
						<Pencil className='size-4' />
					</Button>
					<Button
						variant='ghost'
						size='icon'
						onClick={props.onDelete}
						aria-label={`Delete ${connection.name}`}
					>
						<Trash2 className='size-4' />
					</Button>
				</div>
			)}
		</li>
	);
}

function SyncBadge({ connection, isSyncing }: { connection: Connection; isSyncing: boolean }) {
	if (isSyncing) {
		return <Badge variant='secondary'>Syncing…</Badge>;
	}
	if (connection.lastSyncOk === null) {
		return <Badge variant='secondary'>Not synced</Badge>;
	}
	return connection.lastSyncOk ? (
		<Badge variant='success'>Synced {formatDate(connection.lastSyncAt)}</Badge>
	) : (
		<Badge variant='destructive'>Sync failed</Badge>
	);
}

function ConnectionDialog(props: { state: NonNullable<DialogState>; types: ConnectionType[]; onClose: () => void }) {
	const editing = props.state.mode === 'edit' ? props.state.connection : null;
	const [type, setType] = useState<ConnectionType | null>(
		editing ? (props.types.find((candidate) => candidate.id === editing.typeId) ?? null) : null,
	);

	return (
		<Dialog open onOpenChange={(open) => !open && props.onClose()}>
			<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-xl'>
				<DialogHeader>
					<DialogTitle>
						{editing ? `Edit ${editing.name}` : type ? `Connect ${type.label}` : 'Add a database'}
					</DialogTitle>
					<DialogDescription>
						{type
							? 'Use a read-only account: the agent only needs to read.'
							: 'Pick the kind of database to connect.'}
					</DialogDescription>
				</DialogHeader>
				{type ? (
					<ConnectionForm
						type={type}
						editing={editing}
						onBack={editing ? undefined : () => setType(null)}
						onDone={props.onClose}
					/>
				) : (
					<TypePicker types={props.types} onPick={setType} />
				)}
			</DialogContent>
		</Dialog>
	);
}

function TypePicker({ types, onPick }: { types: ConnectionType[]; onPick: (type: ConnectionType) => void }) {
	const groups = [
		{ label: 'Most popular', items: types.filter((type) => type.popular) },
		{ label: 'More', items: types.filter((type) => !type.popular) },
	];
	return (
		<div className='flex flex-col gap-4'>
			{groups.map((group) => (
				<div key={group.label} className='flex flex-col gap-2'>
					<span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
						{group.label}
					</span>
					<div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
						{group.items.map((type) => (
							<button
								key={type.id}
								type='button'
								onClick={() => onPick(type)}
								className='rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
							>
								{type.label}
							</button>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function ConnectionForm(props: {
	type: ConnectionType;
	editing: Connection | null;
	onBack?: () => void;
	onDone: () => void;
}) {
	const { type, editing } = props;
	const [name, setName] = useState(editing?.name ?? type.id);
	const [values, setValues] = useState<FormValues>(() => initialValues(type, editing));
	const refresh = useRefreshConnections();
	const test = useMutation(trpc.databaseConnection.test.mutationOptions());
	const create = useMutation(trpc.databaseConnection.create.mutationOptions());
	const update = useMutation(trpc.databaseConnection.update.mutationOptions());
	const sync = useMutation(trpc.databaseConnection.sync.mutationOptions({ onSettled: refresh }));
	const saving = create.isPending || update.isPending;
	const error = create.error ?? update.error;

	const save = async () => {
		if (editing) {
			await update.mutateAsync({ id: editing.id, values });
		} else {
			const created = await create.mutateAsync({ name, typeId: type.id, values });
			sync.mutate({ id: created.id });
		}
		await refresh();
		props.onDone();
	};

	return (
		<form
			className='flex flex-col gap-4'
			onSubmit={(event) => {
				event.preventDefault();
				void save().catch(() => undefined);
			}}
		>
			{!editing && (
				<FieldRow
					id='connection-name'
					label='Name'
					help='Lowercase letters, numbers, - and _. The agent sees this name.'
				>
					<Input
						id='connection-name'
						value={name}
						required
						pattern='[a-z0-9][a-z0-9_\-]{0,62}'
						onChange={(event) => setName(event.target.value.toLowerCase())}
					/>
				</FieldRow>
			)}
			{type.fields.map((field) => (
				<ConnectionFieldInput
					key={field.key}
					field={field}
					value={values[field.key]}
					isStored={!!editing?.storedSecrets.includes(field.key)}
					onChange={(value) => setValues((previous) => ({ ...previous, [field.key]: value }))}
				/>
			))}
			{test.data && (
				<p
					className={
						test.data.ok ? 'flex gap-2 text-sm text-green-600' : 'flex gap-2 text-sm text-destructive'
					}
				>
					{test.data.ok ? (
						<CheckCircle2 className='size-4 shrink-0' />
					) : (
						<XCircle className='size-4 shrink-0' />
					)}
					<span className='break-all'>{test.data.message}</span>
				</p>
			)}
			{(error || test.error) && <p className='text-sm text-destructive'>{(error ?? test.error)?.message}</p>}
			<div className='flex items-center gap-2'>
				{props.onBack && (
					<Button type='button' variant='ghost' onClick={props.onBack}>
						Back
					</Button>
				)}
				<Button
					type='button'
					variant='outline'
					className='ml-auto'
					disabled={test.isPending}
					onClick={() => test.mutate({ typeId: type.id, values, id: editing?.id, name })}
				>
					{test.isPending ? 'Testing…' : 'Test connection'}
				</Button>
				<Button type='submit' disabled={saving}>
					{saving ? 'Saving…' : editing ? 'Save' : 'Add and sync'}
				</Button>
			</div>
		</form>
	);
}

function ConnectionFieldInput(props: {
	field: ConnectionField;
	value: string | boolean | undefined;
	isStored: boolean;
	onChange: (value: string | boolean) => void;
}) {
	const { field, value, isStored } = props;
	const id = `connection-${field.key}`;
	const placeholder = isStored ? 'Stored — leave blank to keep' : field.placeholder;
	const required = field.required && !isStored;

	if (field.kind === 'boolean') {
		return (
			<FieldRow id={id} label={field.label} help={field.help}>
				<Switch id={id} checked={value === true} onCheckedChange={(checked) => props.onChange(checked)} />
			</FieldRow>
		);
	}
	if (field.kind === 'select') {
		return (
			<FieldRow id={id} label={field.label} help={field.help}>
				<select
					id={id}
					className='h-9 rounded-md border bg-background px-2 text-sm'
					value={String(value ?? '')}
					onChange={(event) => props.onChange(event.target.value)}
				>
					{field.options?.map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
			</FieldRow>
		);
	}
	if (field.kind === 'certificate') {
		return (
			<FieldRow
				id={id}
				label={field.label}
				help={isStored ? 'Stored — choose a file to replace it.' : field.help}
			>
				<Input
					id={id}
					type='file'
					accept='.crt,.pem,.cer'
					onChange={(event) => {
						void event.target.files?.[0]?.text().then(props.onChange);
					}}
				/>
			</FieldRow>
		);
	}
	if (field.kind === 'textarea' || field.kind === 'json') {
		return (
			<FieldRow id={id} label={field.label} help={field.help}>
				<Textarea
					id={id}
					rows={5}
					className='font-mono text-xs'
					placeholder={placeholder}
					required={required}
					value={String(value ?? '')}
					onChange={(event) => props.onChange(event.target.value)}
				/>
			</FieldRow>
		);
	}
	return (
		<FieldRow id={id} label={field.label} help={field.help}>
			<Input
				id={id}
				type={field.kind === 'password' ? 'password' : field.kind === 'number' ? 'number' : 'text'}
				autoComplete={field.secret ? 'new-password' : 'off'}
				placeholder={placeholder ?? (field.default !== undefined ? String(field.default) : undefined)}
				required={required}
				value={String(value ?? '')}
				onChange={(event) => props.onChange(event.target.value)}
			/>
		</FieldRow>
	);
}

function FieldRow(props: { id: string; label: string; help?: string; children: React.ReactNode }) {
	return (
		<div className='flex flex-col gap-1.5'>
			<label htmlFor={props.id} className='text-sm font-medium'>
				{props.label}
			</label>
			{props.children}
			{props.help && <span className='text-xs text-muted-foreground'>{props.help}</span>}
		</div>
	);
}

function initialValues(type: ConnectionType, editing: Connection | null): FormValues {
	const values: FormValues = {};
	for (const field of type.fields) {
		const saved = editing?.settings[field.key];
		if (field.secret) {
			values[field.key] = '';
		} else if (saved !== undefined && saved !== null) {
			values[field.key] = typeof saved === 'boolean' ? saved : String(saved);
		} else if (field.default !== undefined) {
			values[field.key] = typeof field.default === 'boolean' ? field.default : String(field.default);
		} else {
			values[field.key] = '';
		}
	}
	return values;
}

function formatDate(value: string | Date | null): string {
	return value ? new Date(value).toLocaleDateString() : '';
}

function useRefreshConnections() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: trpc.databaseConnection.list.queryKey() });
}
