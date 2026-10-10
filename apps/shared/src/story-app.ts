import type { ChartType } from './chart-types';
import type { ColumnConditionalFormats } from './conditional-formatting';
import type { KeydownSnapshot, Shortcut } from './keyboard-shortcut';
import type { StoryTheme } from './story-theme';
import type { displayChart } from './tools';
import type { StoryBlockReference } from './types';

/** Bare specifiers a story may import. Everything else is rejected at build time. */
export const STORY_APP_ALLOWED_IMPORTS = [
	'react',
	'react/jsx-runtime',
	'react-dom',
	'react-dom/client',
	'recharts',
	'lucide-react',
	'leaflet',
	'react-leaflet',
	'@insight/story-kit',
] as const;

export type StoryAppAllowedImport = (typeof STORY_APP_ALLOWED_IMPORTS)[number];

export const STORY_APP_MANIFEST_PATH = 'insight.json';

export const STORY_APP_ENTRY_CANDIDATES = ['app.jsx', 'app.tsx', 'app.js', 'app.ts'] as const;

export const STORY_APP_KINDS = ['react', 'html'] as const;

export type StoryAppKind = (typeof STORY_APP_KINDS)[number];

export type StoryApp = { kind: 'react'; bundle: string } | { kind: 'html'; bundle: string; pageShell: string };

export const isHtmlStoryEntry = (path: string): boolean => {
	return /\.html$/i.test(path);
};

export const STORY_DOCUMENT_SLOTS = { head: '<!--insight:head-->', body: '<!--insight:body-->' } as const;

export const STORY_HTML_API_GLOBAL = 'insight';

export interface StoryHtmlApi {
	query(queryId: string, options?: { fresh?: boolean }): Promise<StoryQueryResult>;
	querySql(queryId: string): Promise<string>;
	narratives(): Promise<StoryNarratives>;
	theme(): StoryTheme | null;
	onTheme(listener: (theme: StoryTheme) => void): () => void;
	isExport(): boolean;
	isPrint(): boolean;
}

export const MAX_STORY_BUNDLE_BYTES = 2 * 1024 * 1024;

export const isAllowedStoryImport = (specifier: string): specifier is StoryAppAllowedImport => {
	return (STORY_APP_ALLOWED_IMPORTS as readonly string[]).includes(specifier);
};

/** Module the frame's bootstrap uses to mount the app and talk to the host; stories cannot import it. */
export const STORY_HOST_MODULE = '@insight/story-host';

export const STORY_RUNTIME_PATH = '/story-runtime';

export const STORY_FRAME_ORIGIN = 'null';

export const STORY_FRAME_CORS_HEADERS = {
	'Access-Control-Allow-Origin': STORY_FRAME_ORIGIN,
	'Access-Control-Allow-Private-Network': 'true',
} as const;

/** Bare specifier → file name (without extension) under `STORY_RUNTIME_PATH`. Every import map entry comes from here. */
export const STORY_RUNTIME_MODULES: Record<StoryAppAllowedImport | typeof STORY_HOST_MODULE, string> = {
	react: 'react',
	'react/jsx-runtime': 'react-jsx-runtime',
	'react-dom': 'react-dom',
	'react-dom/client': 'react-dom-client',
	recharts: 'recharts',
	'lucide-react': 'lucide-react',
	leaflet: 'leaflet',
	'react-leaflet': 'react-leaflet',
	'@insight/story-kit': 'story-kit',
	[STORY_HOST_MODULE]: 'story-host',
};

export type CustomStoryViewerAccess = { kind: 'sharedChat'; shareId: string } | { kind: 'replay'; chatId: string };

export interface StoryQueryResult {
	columns: string[];
	data: unknown[];
}

/** Narrative id → text regenerated from the latest data */
export type StoryNarratives = Record<string, string>;

export interface StoryExportData {
	queries: Record<string, StoryQueryResult>;
	narratives: StoryNarratives;
}

/** File under `STORY_RUNTIME_PATH` holding every runtime module in one classic script, for downloaded stories. */
export const STORY_STANDALONE_RUNTIME_FILE = 'standalone.js';

/** Global the standalone runtime fills with each module namespace, keyed by bare specifier. */
export const STORY_STANDALONE_RUNTIME_GLOBAL = '__insightStoryRuntime';

/** Global the PDF renderer sets before a downloaded story boots. */
export const STORY_PRINT_FLAG = '__insightStoryPrint';

/** Set on `<html>` while a printed story lays out a deck: the PDF renderer then prints one slide per page. */
export const STORY_PRINT_SLIDES_ATTRIBUTE = 'data-insight-print-slides';

export const STORY_SLIDE_SIZE = { width: 1280, height: 720 } as const;

export const STORY_KIT_NARRATIVE_COMPONENT = 'Narrative';

export type StoryTableExportFormat = 'csv' | 'xlsx';

export const STORY_KIT_EDITABLE_BLOCKS = ['BarChart', 'LineChart', 'Chart', 'KpiCard', 'DataTable'] as const;

export const STORY_KIT_CHART_BLOCKS = ['BarChart', 'LineChart', 'Chart', 'KpiCard'] as const;

export type StoryKitChartBlock = (typeof STORY_KIT_CHART_BLOCKS)[number];

export type StoryKitEditableBlock = (typeof STORY_KIT_EDITABLE_BLOCKS)[number];

export interface StoryKitBlockRef {
	component: StoryKitEditableBlock;
	props: Record<string, unknown>;
}

export type StoryBlockChartConfig = Omit<displayChart.KpiCardInput, 'chart_type'> & {
	chart_type: ChartType;
};

export interface StoryBlockEditRequest {
	block: StoryKitBlockRef & { component: StoryKitChartBlock };
	config: StoryBlockChartConfig;
	columns: string[];
	rows: Record<string, unknown>[];
}

export interface StoryTableFormatEditRequest {
	block: StoryKitBlockRef & { component: 'DataTable' };
	formats: ColumnConditionalFormats;
	columns: string[];
	rows: Record<string, unknown>[];
}

export interface StoryBlockColors {
	palette: string[];
	resolved: Record<string, string>;
}

export interface StoryBlockEditPayload extends StoryBlockEditRequest {
	colors: StoryBlockColors;
}

export interface StoryKitBlockChange {
	component?: StoryKitEditableBlock;
	set: Record<string, unknown>;
	unset: string[];
}

export const isStoryKitEditableBlock = (value: string): value is StoryKitEditableBlock => {
	return (STORY_KIT_EDITABLE_BLOCKS as readonly string[]).includes(value);
};

/** Frame → host. */
export type StoryFrameMessage =
	| { type: 'insight-story:ready' }
	| { type: 'insight-story:query'; requestId: string; queryId: string; fresh?: boolean }
	| { type: 'insight-story:narratives'; requestId: string }
	| { type: 'insight-story:error'; message: string; stack?: string }
	| { type: 'insight-story:copy-table'; columns: string[]; rows: Record<string, unknown>[] }
	| {
			type: 'insight-story:export-table';
			format: StoryTableExportFormat;
			filename: string;
			columns: string[];
			rows: Record<string, unknown>[];
	  }
	| ({ type: 'insight-story:edit-block' } & StoryBlockEditPayload)
	| ({ type: 'insight-story:edit-table-format' } & StoryTableFormatEditRequest)
	| { type: 'insight-story:query-sql'; requestId: string; queryId: string }
	| { type: 'insight-story:ask-block'; block: StoryBlockReference }
	| ({ type: 'insight-story:keydown' } & KeydownSnapshot);

/** Plain keys the host hands to the story while it holds focus; everything else needs the story focused. */
export const STORY_FORWARDED_KEYS: readonly string[] = ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'];

/** Host → frame. */
export type StoryHostMessage =
	| { type: 'insight-story:query-result'; requestId: string; result: StoryQueryResult }
	| { type: 'insight-story:query-error'; requestId: string; message: string }
	| { type: 'insight-story:query-sql-result'; requestId: string; sqlQuery: string }
	| { type: 'insight-story:query-sql-error'; requestId: string; message: string }
	| { type: 'insight-story:narratives-result'; requestId: string; narratives: StoryNarratives }
	| { type: 'insight-story:editing'; enabled: boolean }
	| { type: 'insight-story:theme'; theme: StoryTheme }
	| { type: 'insight-story:shortcuts'; shortcuts: Shortcut[] }
	| ({ type: 'insight-story:keydown' } & KeydownSnapshot);

/**
 * Answers the frame's `ready` once, transferring the MessagePort every later message travels on.
 * The port belongs to the story's document, so a document the story navigates to never receives replies.
 */
export const STORY_CONNECT_MESSAGE = 'insight-story:connect';

export const isStoryConnectMessage = (value: unknown): boolean => {
	return isStoryMessage(value) && value.type === STORY_CONNECT_MESSAGE;
};

/**
 * A random secret the host embeds in the frame document it builds; the frame stamps it on every message,
 * so a document the story navigated to cannot pass for the story.
 */
export const isFromStoryChannel = (value: unknown, channel: string): boolean => {
	return typeof value === 'object' && value !== null && (value as { channel?: unknown }).channel === channel;
};

export const isStoryFrameMessage = (value: unknown): value is StoryFrameMessage => {
	return (
		isStoryMessage(value) &&
		[
			'insight-story:ready',
			'insight-story:query',
			'insight-story:narratives',
			'insight-story:error',
			'insight-story:copy-table',
			'insight-story:export-table',
			'insight-story:edit-block',
			'insight-story:edit-table-format',
			'insight-story:query-sql',
			'insight-story:ask-block',
			'insight-story:keydown',
		].includes(value.type)
	);
};

export const isStoryHostMessage = (value: unknown): value is StoryHostMessage => {
	return (
		isStoryMessage(value) &&
		[
			'insight-story:query-result',
			'insight-story:query-error',
			'insight-story:query-sql-result',
			'insight-story:query-sql-error',
			'insight-story:narratives-result',
			'insight-story:editing',
			'insight-story:theme',
			'insight-story:shortcuts',
			'insight-story:keydown',
		].includes(value.type)
	);
};

const isStoryMessage = (value: unknown): value is { type: string } => {
	return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';
};
