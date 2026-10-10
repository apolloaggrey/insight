import { NOTIFICATION_CHANNELS, type NotificationChannel } from '@insight/shared/types';
import { z } from 'zod/v4';

import type { App } from '../app';
import * as notificationUnsubscribeQueries from '../queries/notification-unsubscribe.queries';
import * as userQueries from '../queries/user.queries';
import { DEFAULT_BRAND_COLOR, getActiveBranding, resolveAppName } from '../services/branding.service';
import { verifyUnsubscribeSignature } from '../services/notification-unsubscribe';

const unsubscribeSchema = z.object({ u: z.string(), s: z.string(), sig: z.string() });

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
	in_app: 'in-app',
	email: 'email',
	slack: 'Slack',
};

const CHANNEL_DELIVERY: Record<NotificationChannel, string> = {
	in_app: 'in the app',
	email: 'by email',
	slack: 'on Slack',
};

function channelFromScope(scope: string): NotificationChannel | null {
	const [channel] = scope.split(':');
	return (NOTIFICATION_CHANNELS as readonly string[]).includes(channel) ? (channel as NotificationChannel) : null;
}

interface Branding {
	appName: string;
	brandColor: string;
	logoUrl: string | null;
}

export const notificationUnsubscribeRoutes = async (app: App) => {
	app.get('/unsubscribe', { schema: { querystring: unsubscribeSchema } }, async (request, reply) => {
		const { u: userId, s: scope, sig } = request.query;
		const branding = await resolveBranding();

		if (!verifyUnsubscribeSignature(userId, scope, sig)) {
			return reply
				.code(400)
				.type('text/html')
				.send(renderResultPage(branding, 'This unsubscribe link is invalid or has expired.', false));
		}

		return reply.type('text/html').send(renderConfirmPage(branding, userId, scope, sig));
	});

	app.post('/unsubscribe', { schema: { body: unsubscribeSchema } }, async (request, reply) => {
		const { u: userId, s: scope, sig } = request.body;
		const branding = await resolveBranding();

		if (!verifyUnsubscribeSignature(userId, scope, sig)) {
			return reply
				.code(400)
				.type('text/html')
				.send(renderResultPage(branding, 'This unsubscribe link is invalid or has expired.', false));
		}

		if (await userQueries.getUser({ id: userId })) {
			await notificationUnsubscribeQueries.addUnsubscribe(userId, scope);
		}
		return reply
			.type('text/html')
			.send(renderResultPage(branding, 'You have been unsubscribed from these notifications.', true));
	});
};

async function resolveBranding(): Promise<Branding> {
	const branding = await getActiveBranding();
	return {
		appName: resolveAppName(branding),
		brandColor: branding?.brandColor ?? DEFAULT_BRAND_COLOR,
		logoUrl: branding?.logo ? `/branding/logo?v=${branding.updatedAt.getTime()}` : null,
	};
}

function renderConfirmPage(branding: Branding, userId: string, scope: string, sig: string): string {
	const channel = channelFromScope(scope);
	const title = channel
		? `Unsubscribe from ${CHANNEL_LABELS[channel]} notifications?`
		: 'Unsubscribe from notifications?';
	const description = channel
		? `You will stop receiving these notifications ${CHANNEL_DELIVERY[channel]}.`
		: 'You will stop receiving these notifications.';
	const card = `<div class="card">
			<h2 class="card-title">${escapeHtml(title)}</h2>
			<p class="card-desc">${escapeHtml(description)}</p>
			<form class="card-footer" method="post" action="/api/notifications/unsubscribe">
				<input type="hidden" name="u" value="${escapeHtml(userId)}" />
				<input type="hidden" name="s" value="${escapeHtml(scope)}" />
				<input type="hidden" name="sig" value="${escapeHtml(sig)}" />
				<button type="submit" class="btn-primary">Unsubscribe</button>
			</form>
		</div>`;
	return renderPage(branding, 'Unsubscribe', card);
}

function renderResultPage(branding: Branding, message: string, ok: boolean): string {
	const title = ok ? 'Unsubscribed' : 'Unsubscribe failed';
	const icon = ok ? CHECK_ICON : X_ICON;
	const iconClass = ok ? 'icon-ok' : 'icon-error';
	const result = `<div class="result">
			<span class="${iconClass}">${icon}</span>
			<div class="result-text">
				<h2>${escapeHtml(title)}</h2>
				<p>${escapeHtml(message)}</p>
			</div>
		</div>`;
	return renderPage(branding, title, result);
}

function renderPage(branding: Branding, title: string, body: string): string {
	const { appName, brandColor } = branding;
	const gradientEnd = lightenHex(brandColor, 15);
	const gradientHoverStart = lightenHex(brandColor, 8);
	const gradientHoverEnd = lightenHex(brandColor, 23);
	const brandMark = branding.logoUrl
		? `<img class="brand-logo" src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(appName)}" />`
		: DEFAULT_LOGO_SVG;

	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${escapeHtml(title)} — ${escapeHtml(appName)}</title>
		<style>
			:root {
				--brand: ${brandColor};
				--gradient-brand: linear-gradient(180deg, ${brandColor} 0%, ${gradientEnd} 100%);
				--gradient-brand-hover: linear-gradient(180deg, ${gradientHoverStart} 0%, ${gradientHoverEnd} 100%);
				--foreground: rgba(0, 0, 0, 0.85);
				--muted-foreground: rgba(0, 0, 0, 0.5);
				--border: rgba(0, 0, 0, 0.1);
			}
			* { box-sizing: border-box; }
			body {
				font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
				background: #fff;
				color: var(--foreground);
				margin: 0;
				min-height: 100vh;
				display: flex;
				align-items: center;
				justify-content: center;
				-webkit-font-smoothing: antialiased;
			}
			.container { width: 100%; max-width: 448px; padding: 32px; margin: auto; }
			.header {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 32px;
				margin-bottom: 40px;
				padding-bottom: 8px;
			}
			.header .brand-logo, .header svg { width: 80px; height: auto; display: block; }
			.header .brand-logo { max-height: 40px; width: auto; }
			.header h1 {
				font-family: 'Borna', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
				font-size: 24px;
				font-weight: 500;
				text-align: center;
				margin: 0;
			}
			.card {
				background: #fff;
				border: 1px solid var(--border);
				border-radius: 10px;
				padding: 24px;
				box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
			}
			.card-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
			.card-desc { font-size: 14px; color: var(--muted-foreground); line-height: 1.5; margin: 6px 0 0; }
			.card-footer { display: flex; justify-content: flex-end; margin: 24px 0 0; }
			.btn-primary {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				height: 36px;
				padding: 0 16px;
				border: 0;
				border-radius: 8px;
				font: inherit;
				font-size: 14px;
				font-weight: 500;
				color: #fff;
				background: var(--gradient-brand);
				cursor: pointer;
				transition: background 0.15s ease, transform 0.05s ease;
			}
			.btn-primary:hover { background: var(--gradient-brand-hover); }
			.btn-primary:active { transform: translateY(0.5px); }
			.result { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; }
			.result svg { width: 40px; height: 40px; }
			.icon-ok { color: var(--brand); }
			.icon-error { color: var(--muted-foreground); }
			.result-text { display: flex; flex-direction: column; gap: 8px; }
			.result h2 { font-size: 18px; font-weight: 600; margin: 0; }
			.result p { font-size: 14px; color: var(--muted-foreground); line-height: 1.5; margin: 0; }
		</style>
	</head>
	<body>
		<div class="container">
			<div class="header">
				${brandMark}
			</div>
			${body}
		</div>
	</body>
</html>`;
}

const DEFAULT_LOGO_SVG = `<svg viewBox="0 0 293 66" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Insight"><rect y="1" width="64" height="64" rx="14" fill="#522bff"/><rect x="14" y="35" width="9" height="16" rx="2.5" fill="white"/><rect x="27.5" y="25" width="9" height="26" rx="2.5" fill="white"/><rect x="41" y="15" width="9" height="36" rx="2.5" fill="white"/><text x="80" y="49" font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-size="46" font-weight="650" fill="currentColor">Insight</text></svg>`;

const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>`;
const X_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;

function lightenHex(hex: string, amount: number): string {
	const [h, s, l] = hexToHsl(hex);
	return hslToHex(h, s, clamp(l + amount, 0, 100));
}

function hexToHsl(hex: string): [number, number, number] {
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) {
		return [0, 0, Math.round(l * 100)];
	}
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h = 0;
	switch (max) {
		case r:
			h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
			break;
		case g:
			h = ((b - r) / d + 2) / 6;
			break;
		case b:
			h = ((r - g) / d + 4) / 6;
			break;
	}
	return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
	const ls = l / 100;
	const ss = s / 100;
	const a = ss * Math.min(ls, 1 - ls);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const color = ls - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * color)
			.toString(16)
			.padStart(2, '0');
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}

function clamp(n: number, min: number, max: number): number {
	return Math.min(Math.max(n, min), max);
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
