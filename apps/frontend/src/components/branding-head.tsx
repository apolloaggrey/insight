/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { useEffect } from 'react';

import { brandingAssetUrl, DEFAULT_APP_NAME, useBranding } from '@/hooks/use-branding';

const DEFAULT_TAB_TITLE = `${DEFAULT_APP_NAME} — Chat with your data`;
const DEFAULT_FAVICON = '/favicon.ico';

/** Keeps the browser tab title and favicon in line with the white-label settings. */
export function BrandingHead() {
	const branding = useBranding();
	const title = branding.enabled ? branding.tabTitle || branding.appName : null;
	const favicon = branding.enabled && branding.hasFavicon ? brandingAssetUrl('favicon', branding.updatedAt) : null;

	useEffect(() => {
		document.title = title || DEFAULT_TAB_TITLE;
	}, [title]);

	useEffect(() => {
		const link = getFaviconLink();
		link.href = favicon ?? DEFAULT_FAVICON;
	}, [favicon]);

	return null;
}

function getFaviconLink(): HTMLLinkElement {
	const existing = document.querySelector<HTMLLinkElement>("link[rel='icon']");
	if (existing) {
		return existing;
	}
	const link = document.createElement('link');
	link.rel = 'icon';
	document.head.appendChild(link);
	return link;
}
