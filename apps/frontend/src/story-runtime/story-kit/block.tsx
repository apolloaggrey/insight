import { joinClassNames } from '@insight/shared/class-names';
import { CodeIcon, PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { isPrintMode, isStoryExport, requestBlockAsk, requestBlockEdit } from '../story-host';
import { QuerySql } from './query-sql';
import { useStoryEditing } from './hooks';
import type { StoryBlockEditRequest } from '@insight/shared/story-app';
import type { CSSProperties, ReactNode } from 'react';
import type { BlockData } from './use-block-data';

export interface BlockProps {
	queryId?: string;
	title?: string;
	description?: string;
	className?: string;
	style?: CSSProperties;
}

interface BlockFrameProps extends BlockProps {
	kind: string;
	edit?: StoryBlockEditRequest;
	children: ReactNode;
}

const ASK_AGENT_LABEL =
	'Edit with the agent: describe in the chat everything you want changed in this block, the agent rewrites it for you.';

export function Block({ kind, queryId, title, description, className, style, edit, children }: BlockFrameProps) {
	const editingEnabled = useStoryEditing();
	const canViewQuery = queryId !== undefined && !isStoryExport() && !isPrintMode();
	const [showQuery, setShowQuery] = useState(false);
	return (
		<section className={joinClassNames('insight-block', `insight-${kind}`, className)} style={style}>
			{(title || description || editingEnabled || canViewQuery) && (
				<header className='insight-block__header'>
					<div className='insight-block__heading'>
						{title && <h3 className='insight-block__title'>{title}</h3>}
						{description && <p className='insight-block__description'>{description}</p>}
					</div>
					{(canViewQuery || editingEnabled) && (
						<div className='insight-block__actions'>
							{canViewQuery && kind !== 'data-table' && (
								<BlockAction
									label={showQuery ? 'Hide SQL query' : 'View SQL query'}
									onClick={() => setShowQuery((current) => !current)}
									pressed={showQuery}
								>
									<CodeIcon />
								</BlockAction>
							)}
							{editingEnabled &&
								kind !== 'data-table' &&
								(edit ? (
									<BlockAction label='Edit chart' onClick={() => requestBlockEdit(edit)}>
										<PencilIcon />
									</BlockAction>
								) : (
									<BlockAction
										label={ASK_AGENT_LABEL}
										onClick={() => requestBlockAsk({ kind, title, queryId })}
									>
										<PencilIcon />
									</BlockAction>
								))}
						</div>
					)}
				</header>
			)}
			<div className='insight-block__body'>
				{showQuery && canViewQuery ? <QuerySql queryId={queryId} /> : children}
			</div>
		</section>
	);
}

interface BlockActionProps {
	label: string;
	onClick: () => void;
	pressed?: boolean;
	children: ReactNode;
}

/** The tooltip is drawn in CSS: the frame has no host UI to borrow one from. */
function BlockAction({ label, onClick, pressed, children }: BlockActionProps) {
	return (
		<button
			type='button'
			className='insight-block__action'
			onClick={onClick}
			aria-label={label}
			aria-pressed={pressed}
			data-tooltip={label}
		>
			{children}
		</button>
	);
}

interface BlockStateProps {
	data: BlockData & { refetch: () => void };
	emptyMessage?: string;
	children: (rows: NonNullable<BlockData['rows']>, columns: string[]) => ReactNode;
}

export function BlockState({ data, emptyMessage = 'No rows.', children }: BlockStateProps) {
	if (data.status === 'loading') {
		return <div className='insight-skeleton' aria-busy='true' />;
	}
	if (data.status === 'error') {
		return (
			<div className='insight-block__state insight-block__state--error' role='alert'>
				{data.error}
				<button type='button' onClick={data.refetch}>
					Retry
				</button>
			</div>
		);
	}
	if (data.rows.length === 0) {
		return <div className='insight-block__state'>{emptyMessage}</div>;
	}
	return <>{children(data.rows, data.columns)}</>;
}
