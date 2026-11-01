/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { useEffect } from 'react';

import { useIsDarkMode } from '@/contexts/theme.provider';
import { useThemeCustomizer } from '@/contexts/theme-customizer.provider';
import { useBranding } from '@/hooks/use-branding';
import { buildBrandVars } from '@/lib/brand-vars';

export { buildBrandVars, buildLastUsedPillVars } from '@/lib/brand-vars';

/** Applies the white-label colour to the whole app, unless the user picked their own primary colour. */
export function BrandColor() {
	const branding = useBranding();
	const isDark = useIsDarkMode();
	const { settings } = useThemeCustomizer();
	const color = branding.enabled ? branding.brandColor : null;

	useEffect(() => {
		if (settings.accent !== 'default') {
			return;
		}
		const root = document.documentElement;
		const vars = buildBrandVars(color ?? '#000000', isDark ? 'dark' : 'light');
		for (const [name, value] of Object.entries(vars)) {
			if (color) {
				root.style.setProperty(name, value);
			} else {
				root.style.removeProperty(name);
			}
		}
	}, [color, isDark, settings.accent]);

	return null;
}
