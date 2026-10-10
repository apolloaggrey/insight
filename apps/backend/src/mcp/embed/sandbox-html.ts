import type { CustomBoundarySet } from '@insight/shared';

import type { QueryDataMap } from '../../utils/story-download';
import { generateStoryHtml } from '../../utils/story-html';
import { backfillMissingQueryDataForSandbox } from '../../utils/story-query-data';
import { storyEmbedUrls } from '../urls';
import { MAX_SANDBOX_HTML_CHARS, MAX_SANDBOX_MCP_BYTES } from './embed-payload';
import { SANDBOX_EMBED_ROOT_STYLES, SANDBOX_ICON_DOWNLOAD, SANDBOX_ICON_EXTERNAL_LINK } from './header';

type StorySandboxHeaderConfig = {
	kind: 'story';
	title: string;
	openUrl: string;
	pdfUrl: string;
	htmlUrl: string;
};

type ChartSandboxHeaderConfig = {
	kind: 'chart';
	title: string;
	insightChatUrl: string | null;
};

export async function buildStorySandboxHtml(params: {
	title: string;
	code: string;
	openInInsightUrl: string;
	storyId: string;
	projectId: string;
	chatId?: string | null;
	userId?: string;
}): Promise<string | null> {
	const queryData = await backfillMissingQueryDataForSandbox(params.code, {
		storyId: params.storyId,
		chatId: params.chatId,
		projectId: params.projectId,
		userId: params.userId,
	});
	const inner = wrapStoryBodyForMcpHeightMeasure(
		await generateStoryHtml(
			{ title: params.title, code: params.code },
			(queryData as QueryDataMap | null) ?? null,
			null,
			undefined,
			{
				staticMaps: true,
			},
		),
	);
	const withEmbedStyle = injectMcpEmbedRootStyles(inner);

	const { pdfUrl, htmlUrl } = storyEmbedUrls(params.storyId, params.projectId);
	const footerScript = buildSandboxEmbedFooterScript({
		kind: 'story',
		title: params.title,
		openUrl: params.openInInsightUrl,
		pdfUrl,
		htmlUrl,
	});

	return finalizeSandboxHtml(withEmbedStyle, footerScript);
}

export async function buildChartSandboxHtml(params: {
	title: string;
	chartBlock: string;
	queryId: string;
	columns: string[];
	data: Record<string, unknown>[];
	insightChatUrl: string | null;
}): Promise<string | null> {
	const code = `# ${params.title}\n\n${params.chartBlock}`;
	const queryData: QueryDataMap = {
		[params.queryId]: { columns: params.columns, data: params.data },
	};
	const inner = wrapStoryBodyForMcpHeightMeasure(await generateStoryHtml({ title: params.title, code }, queryData));
	const withEmbedStyle = injectMcpEmbedRootStyles(inner);

	const footerScript = buildSandboxEmbedFooterScript({
		kind: 'chart',
		title: params.title,
		insightChatUrl: params.insightChatUrl,
	});

	return finalizeSandboxHtml(withEmbedStyle, footerScript);
}

export async function buildMapSandboxHtml(params: {
	title: string;
	mapBlock: string;
	queryId: string;
	columns: string[];
	data: Record<string, unknown>[];
	insightChatUrl: string | null;
	customBoundaries?: CustomBoundarySet[];
}): Promise<string | null> {
	const code = `# ${params.title}\n\n${params.mapBlock}`;
	const queryData: QueryDataMap = {
		[params.queryId]: { columns: params.columns, data: params.data },
	};
	const inner = wrapStoryBodyForMcpHeightMeasure(
		await generateStoryHtml({ title: params.title, code }, queryData, null, params.customBoundaries, {
			staticMaps: true,
		}),
	);
	const withEmbedStyle = injectMcpEmbedRootStyles(inner);

	const footerScript = buildSandboxEmbedFooterScript({
		kind: 'chart',
		title: params.title,
		insightChatUrl: params.insightChatUrl,
	});

	return finalizeSandboxHtml(withEmbedStyle, footerScript);
}

function buildSandboxEmbedFooterScript(config: StorySandboxHeaderConfig | ChartSandboxHeaderConfig): string {
	const titleJs = escapeJsStringLiteral(config.title);
	const headerActionsJs =
		config.kind === 'story' ? buildStoryHeaderActionsJs(config) : buildChartHeaderActionsJs(config);

	return `
<script>
(function () {
	var headerTitle = ${titleJs};
	${headerActionsJs}
	function postOpenLink(url) {
		if (typeof parent !== 'undefined' && parent !== window) {
			parent.postMessage({ type: 'insight-open-link', url: url }, '*');
		}
	}
	function measureHeight() {
		var m = document.getElementById('insight-mcp-story-measure');
		if (m) {
			return Math.ceil(Math.max(80, m.scrollHeight, m.offsetHeight, m.getBoundingClientRect().height) + 6);
		}
		var e = document.documentElement;
		var b = document.body;
		return Math.ceil(Math.max(80, e.scrollHeight, b.scrollHeight) + 6);
	}
	function reportSize() {
		var h = measureHeight();
		if (typeof parent !== 'undefined' && parent !== window) {
			parent.postMessage({ type: 'insight-embed-size', height: Math.min(Math.max(h, 80), 8000) }, '*');
		}
	}
	function scheduleReports() {
		reportSize();
		requestAnimationFrame(function () {
			reportSize();
			requestAnimationFrame(reportSize);
		});
		[50, 150, 400, 900, 2000, 3500].forEach(function (ms) {
			setTimeout(reportSize, ms);
		});
	}
	function buildHeaderChrome() {
		var header = document.createElement('header');
		header.setAttribute('data-insight-mcp-app-header', '1');
		header.setAttribute('data-insight-mcp-story-chrome', '1');
		var h1 = document.createElement('h1');
		h1.textContent = headerTitle;
		var actions = document.createElement('div');
		actions.className = 'insight-mcp-header-actions';
		buildHeaderActions(actions);
		header.appendChild(h1);
		header.appendChild(actions);
		return header;
	}
	var chrome = buildHeaderChrome();
	var mRoot = document.getElementById('insight-mcp-story-measure');
	if (mRoot && mRoot.firstChild) {
		mRoot.insertBefore(chrome, mRoot.firstChild);
	} else if (mRoot) {
		mRoot.appendChild(chrome);
	} else {
		document.body.insertBefore(chrome, document.body.firstChild);
	}
	window.addEventListener('load', scheduleReports);
	window.addEventListener('resize', reportSize);
	if (typeof ResizeObserver !== 'undefined') {
		try {
			var mEl = document.getElementById('insight-mcp-story-measure');
			var ro = new ResizeObserver(reportSize);
			if (mEl) {
				ro.observe(mEl);
			} else {
				ro.observe(document.documentElement);
				ro.observe(document.body);
			}
		} catch (err) {}
	}
	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(reportSize).catch(function () {});
	}
	reportSize();
})();
</script>
`;
}

function buildStoryHeaderActionsJs(config: StorySandboxHeaderConfig): string {
	const openUrl = escapeJsStringLiteral(config.openUrl);
	const pdfUrl = escapeJsStringLiteral(config.pdfUrl);
	const htmlUrl = escapeJsStringLiteral(config.htmlUrl);
	const downloadBtnHtml = escapeJsStringLiteral(
		`${SANDBOX_ICON_DOWNLOAD}<span class="insight-mcp-btn-text">Download</span>`,
	);
	const openBtnHtml = escapeJsStringLiteral(
		`${SANDBOX_ICON_EXTERNAL_LINK}<span class="insight-mcp-btn-text">Open in Insight</span>`,
	);

	return `
	function buildHeaderActions(actions) {
		var openUrl = ${openUrl};
		var pdfUrl = ${pdfUrl};
		var htmlUrl = ${htmlUrl};
		var dlWrap = document.createElement('div');
		dlWrap.className = 'insight-mcp-dl-wrap';
		var dlBtn = document.createElement('button');
		dlBtn.type = 'button';
		dlBtn.className = 'insight-mcp-btn';
		dlBtn.innerHTML = ${downloadBtnHtml};
		dlBtn.setAttribute('aria-haspopup', 'true');
		var menu = document.createElement('div');
		menu.setAttribute('role', 'menu');
		menu.className = 'insight-mcp-menu';
		function addItem(label, url) {
			var mi = document.createElement('button');
			mi.type = 'button';
			mi.setAttribute('role', 'menuitem');
			mi.className = 'insight-mcp-menuitem';
			mi.textContent = label;
			mi.addEventListener('click', function (e) {
				e.preventDefault();
				e.stopPropagation();
				menu.style.display = 'none';
				postOpenLink(url);
			});
			menu.appendChild(mi);
		}
		addItem('PDF', pdfUrl);
		addItem('HTML', htmlUrl);
		dlBtn.addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
		});
		document.addEventListener('click', function (ev) {
			if (!dlWrap.contains(ev.target)) {
				menu.style.display = 'none';
			}
		});
		dlWrap.appendChild(dlBtn);
		dlWrap.appendChild(menu);
		var openBtn = document.createElement('button');
		openBtn.type = 'button';
		openBtn.className = 'insight-mcp-btn';
		openBtn.setAttribute('title', 'Open in Insight');
		openBtn.innerHTML = ${openBtnHtml};
		openBtn.addEventListener('click', function (e) {
			e.preventDefault();
			postOpenLink(openUrl);
		});
		actions.appendChild(dlWrap);
		actions.appendChild(openBtn);
	}`;
}

function buildChartHeaderActionsJs(config: ChartSandboxHeaderConfig): string {
	const insightChatUrlJs = config.insightChatUrl ? escapeJsStringLiteral(config.insightChatUrl) : 'null';
	const openBtnHtml = escapeJsStringLiteral(
		`${SANDBOX_ICON_EXTERNAL_LINK}<span class="insight-mcp-btn-text">Open in Insight</span>`,
	);

	return `
	function buildHeaderActions(actions) {
		var insightChatUrl = ${insightChatUrlJs};
		if (!insightChatUrl) return;
		var openBtn = document.createElement('button');
		openBtn.type = 'button';
		openBtn.className = 'insight-mcp-btn';
		openBtn.setAttribute('title', 'Open in Insight');
		openBtn.innerHTML = ${openBtnHtml};
		openBtn.addEventListener('click', function (e) {
			e.preventDefault();
			postOpenLink(insightChatUrl);
		});
		actions.appendChild(openBtn);
	}`;
}

function finalizeSandboxHtml(html: string, footerScript: string): string | null {
	const doc = html.replace(/<\/body>\s*<\/html>\s*$/i, `${footerScript}</body></html>`);
	if (doc.length <= MAX_SANDBOX_HTML_CHARS && Buffer.byteLength(doc, 'utf8') <= MAX_SANDBOX_MCP_BYTES) {
		return doc;
	}
	return null;
}

function injectMcpEmbedRootStyles(html: string): string {
	return html.includes('</title>')
		? html.replace(/<\/title>/i, `</title>${SANDBOX_EMBED_ROOT_STYLES}`)
		: html.replace(/<head[^>]*>/i, (m) => `${m}${SANDBOX_EMBED_ROOT_STYLES}`);
}

function wrapStoryBodyForMcpHeightMeasure(html: string): string {
	const withOpen = html.replace(/<body(\s[^>]*)?>/i, '<body$1><div id="insight-mcp-story-measure">');
	return withOpen.replace(/<\/body>/i, '</div></body>');
}

function escapeJsStringLiteral(value: string): string {
	return JSON.stringify(value);
}
