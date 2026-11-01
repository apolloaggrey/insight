import { useMutation, useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { ThemeCustomizerSettings } from '@/lib/theme-customizer';
import { TruncationTooltip } from '@/components/truncation-tooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useIsDarkMode, useTheme } from '@/contexts/theme.provider';
import { useSession } from '@/lib/auth-client';
import {
	ACCENT_VARIABLES,
	accentVariables,
	CHART_PALETTES,
	CHART_VARIABLES,
	DEFAULT_THEME_CUSTOMIZER,
	FONT_SIZES,
	FONTS,
	HEADER_HEIGHTS,
	LETTER_SPACING,
	OPTIONAL_FONTS_URL,
	sanitizeThemeCustomizer,
	SIDEBAR_VARIABLES,
	sidebarVariables,
	sidebarWidthValue,
	TONE_VARIABLES,
	toneVariables,
	TOOLTIP_DELAYS,
	TOOLTIP_WIDTHS,
} from '@/lib/theme-customizer';
import { trpc } from '@/main';

export type ThemeSyncState = 'local' | 'saving' | 'saved' | 'error';

interface ThemeCustomizerContextValue {
	settings: ThemeCustomizerSettings;
	update: (patch: Partial<ThemeCustomizerSettings>) => void;
	reset: () => void;
	syncState: ThemeSyncState;
}

const LOCAL_STORAGE_KEY = 'insight-theme-customizer';
const ACCOUNT_SAVE_DELAY_MS = 600;
const FONT_LINK_ID = 'theme-customizer-fonts';

const ThemeCustomizerContext = createContext<ThemeCustomizerContextValue>({
	settings: DEFAULT_THEME_CUSTOMIZER,
	update: () => {},
	reset: () => {},
	syncState: 'local',
});

export const useThemeCustomizer = () => useContext(ThemeCustomizerContext);

/** Embedded charts and stories follow their host page, so viewers' personal themes never reach them. */
export function ThemeCustomizerProvider({ children }: { children: React.ReactNode }) {
	if (window.location.pathname.startsWith('/embed')) {
		return <TooltipProvider>{children}</TooltipProvider>;
	}
	return <ActiveThemeCustomizerProvider>{children}</ActiveThemeCustomizerProvider>;
}

function ActiveThemeCustomizerProvider({ children }: { children: React.ReactNode }) {
	const { theme, setTheme } = useTheme();
	const isDark = useIsDarkMode();
	const [stored, setStored] = useState(readLocalSettings);
	const settings = useMemo<ThemeCustomizerSettings>(() => ({ ...stored, mode: theme }), [stored, theme]);

	const update = useCallback(
		(patch: Partial<ThemeCustomizerSettings>) => {
			if (patch.mode) {
				setTheme(patch.mode);
			}
			setStored((current) => ({ ...current, ...patch }));
		},
		[setTheme],
	);
	const syncState = useAccountSync(settings, update);

	useEffect(() => {
		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
	}, [settings]);

	useLayoutEffect(() => {
		setVariables(ACCENT_VARIABLES, accentVariables(settings, isDark));
	}, [settings.accent, settings.customColor, isDark]); // eslint-disable-line react-hooks/exhaustive-deps

	useLayoutEffect(() => {
		applySettings(settings, isDark);
	}, [settings, isDark]);

	const value = useMemo(
		() => ({ settings, update, reset: () => update(DEFAULT_THEME_CUSTOMIZER), syncState }),
		[settings, update, syncState],
	);

	return (
		<ThemeCustomizerContext.Provider value={value}>
			<TooltipProvider delayDuration={(TOOLTIP_DELAYS[settings.tooltipDelay] ?? TOOLTIP_DELAYS.normal).value}>
				{children}
				<TruncationTooltip enabled={settings.truncationTips} delay={settings.tooltipDelay} />
			</TooltipProvider>
		</ThemeCustomizerContext.Provider>
	);
}

/** Once signed in the account's saved theme wins over this browser's copy; later changes save back, debounced. */
function useAccountSync(
	settings: ThemeCustomizerSettings,
	update: (patch: Partial<ThemeCustomizerSettings>) => void,
): ThemeSyncState {
	const { data: session } = useSession();
	const isSignedIn = !!session?.user;
	const [syncState, setSyncState] = useState<ThemeSyncState>('local');
	const hasLoadedAccount = useRef(false);
	const lastSaved = useRef('');
	const preferences = useQuery({ ...trpc.user.getPreferences.queryOptions(), enabled: isSignedIn });
	const { mutate: savePreferences } = useMutation(
		trpc.user.updatePreferences.mutationOptions({
			onSuccess: () => setSyncState('saved'),
			onError: () => setSyncState('error'),
		}),
	);

	useEffect(() => {
		if (!isSignedIn) {
			hasLoadedAccount.current = false;
			setSyncState('local');
		}
	}, [isSignedIn]);

	useEffect(() => {
		if (!isSignedIn || !preferences.data || hasLoadedAccount.current) {
			return;
		}
		hasLoadedAccount.current = true;
		setSyncState('saved');
		const saved = sanitizeThemeCustomizer(preferences.data.themeCustomizer);
		if (Object.keys(saved).length > 0) {
			const merged = { ...DEFAULT_THEME_CUSTOMIZER, ...saved };
			lastSaved.current = JSON.stringify(merged);
			update(merged);
		}
	}, [isSignedIn, preferences.data, update]);

	useEffect(() => {
		const serialized = JSON.stringify(settings);
		if (!hasLoadedAccount.current || serialized === lastSaved.current) {
			return;
		}
		setSyncState('saving');
		const timer = setTimeout(() => {
			lastSaved.current = serialized;
			savePreferences({ themeCustomizer: settings });
		}, ACCOUNT_SAVE_DELAY_MS);
		return () => clearTimeout(timer);
	}, [settings, savePreferences]);

	return syncState;
}

function readLocalSettings(): ThemeCustomizerSettings {
	try {
		const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
		return { ...DEFAULT_THEME_CUSTOMIZER, ...sanitizeThemeCustomizer(raw && JSON.parse(raw)) };
	} catch {
		return DEFAULT_THEME_CUSTOMIZER;
	}
}

function applySettings(settings: ThemeCustomizerSettings, isDark: boolean) {
	const html = document.documentElement;
	const root = html.style;

	const tone = toneVariables(settings.tone, isDark, settings.darkSurface);
	setVariables(TONE_VARIABLES, tone);
	if (settings.highContrast) {
		root.setProperty('--muted-foreground', 'color-mix(in oklch, var(--foreground) 82%, var(--background))');
		root.setProperty('--border', 'color-mix(in oklch, var(--foreground) 28%, var(--background))');
		root.setProperty('--input', 'color-mix(in oklch, var(--foreground) 35%, var(--background))');
	}

	const palette = settings.chartPalette === 'default' ? null : CHART_PALETTES[settings.chartPalette];
	setVariables(
		CHART_VARIABLES,
		palette && Object.fromEntries(CHART_VARIABLES.map((name, index) => [name, palette[index]])),
	);

	const sidebar = sidebarVariables(settings.sidebarColor, isDark);
	setVariables(SIDEBAR_VARIABLES, sidebar);
	if (!sidebar && tone) {
		root.setProperty('--sidebar', isDark ? tone['--card'] : 'oklch(1 0 0)');
	}

	root.setProperty('--radius', `${settings.radius}rem`);
	root.setProperty('--app-font', (FONTS[settings.font] ?? FONTS.geist).family);
	root.setProperty('--app-sidebar-width', sidebarWidthValue(settings));
	root.setProperty('--app-header-height', (HEADER_HEIGHTS[settings.headerHeight] ?? HEADER_HEIGHTS.default).value);
	root.setProperty('--tooltip-max-w', (TOOLTIP_WIDTHS[settings.tooltipWidth] ?? TOOLTIP_WIDTHS.default).value);
	root.fontSize = FONT_SIZES[settings.fontSize]?.value ?? '100%';
	root.letterSpacing = LETTER_SPACING[settings.letterSpacing]?.value ?? 'normal';

	html.dataset.cardStyle = settings.cardStyle;
	html.dataset.navActive = settings.navActive;
	html.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
	html.dataset.scrollbar = settings.thinScrollbars ? 'thin' : 'auto';
	html.dataset.sidebarColor = settings.sidebarColor;
	html.dataset.sidebarSide = settings.sidebarSide;
	html.dataset.tooltipStyle = settings.tooltipStyle;
	html.dataset.tooltipAnim = settings.tooltipAnimation;
	html.dataset.tooltipSize = settings.tooltipSize;
	html.dataset.tooltipArrow = settings.tooltipArrow ? 'on' : 'off';

	if (settings.font !== 'geist' && settings.font !== 'system') {
		loadOptionalFonts();
	}
}

function setVariables(names: string[], values: Record<string, string> | null) {
	const root = document.documentElement.style;
	for (const name of names) {
		if (values?.[name]) {
			root.setProperty(name, values[name]);
		} else {
			root.removeProperty(name);
		}
	}
}

export function loadOptionalFonts() {
	if (document.getElementById(FONT_LINK_ID)) {
		return;
	}
	const link = document.createElement('link');
	link.id = FONT_LINK_ID;
	link.rel = 'stylesheet';
	link.href = OPTIONAL_FONTS_URL;
	document.head.appendChild(link);
}
