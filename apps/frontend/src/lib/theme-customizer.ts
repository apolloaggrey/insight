import { buildBrandVars, parseHex } from '@/lib/brand-vars';

type CssVariables = Record<string, string>;

export const ACCENTS: Record<string, { name: string; light: string; dark: string }> = {
	default: { name: 'Insight', light: 'oklch(0.5077 0.281 277.89)', dark: 'oklch(0.721 0.157 290.2)' },
	orange: { name: 'Orange', light: 'oklch(0.646 0.195 41.1)', dark: 'oklch(0.705 0.187 47.6)' },
	red: { name: 'Red', light: 'oklch(0.577 0.215 27.3)', dark: 'oklch(0.637 0.217 25.3)' },
	rose: { name: 'Rose', light: 'oklch(0.586 0.222 17.6)', dark: 'oklch(0.645 0.216 16.4)' },
	pink: { name: 'Pink', light: 'oklch(0.592 0.218 0.6)', dark: 'oklch(0.656 0.212 354.3)' },
	violet: { name: 'Violet', light: 'oklch(0.541 0.232 293)', dark: 'oklch(0.606 0.219 292.7)' },
	indigo: { name: 'Indigo', light: 'oklch(0.511 0.23 276.9)', dark: 'oklch(0.585 0.204 277.1)' },
	blue: { name: 'Blue', light: 'oklch(0.546 0.215 262.9)', dark: 'oklch(0.623 0.188 259.8)' },
	sky: { name: 'Sky', light: 'oklch(0.588 0.158 241.9)', dark: 'oklch(0.685 0.148 237.3)' },
	teal: { name: 'Teal', light: 'oklch(0.6 0.118 184.7)', dark: 'oklch(0.704 0.123 182.5)' },
	green: { name: 'Green', light: 'oklch(0.596 0.145 163.2)', dark: 'oklch(0.696 0.17 162.5)' },
	lime: { name: 'Lime', light: 'oklch(0.648 0.2 131.7)', dark: 'oklch(0.768 0.204 130.9)' },
	amber: { name: 'Amber', light: 'oklch(0.666 0.157 58.3)', dark: 'oklch(0.769 0.165 70.1)' },
	yellow: { name: 'Yellow', light: 'oklch(0.681 0.162 75.8)', dark: 'oklch(0.795 0.184 86.1)' },
	cyan: { name: 'Cyan', light: 'oklch(0.609 0.126 221.7)', dark: 'oklch(0.715 0.143 215.2)' },
	purple: { name: 'Purple', light: 'oklch(0.558 0.288 302.3)', dark: 'oklch(0.627 0.265 303.9)' },
	fuchsia: { name: 'Fuchsia', light: 'oklch(0.591 0.293 322.9)', dark: 'oklch(0.667 0.295 322.2)' },
	slate: { name: 'Mono', light: 'oklch(0.21 0.006 285.9)', dark: 'oklch(0.92 0.004 286.3)' },
};

/** Neutral base tones: hue and chroma applied to background, cards, borders and muted surfaces. */
export const TONES: Record<string, { name: string; hue: number; chroma: number; swatch: string }> = {
	default: { name: 'Default', hue: 270, chroma: 0.005, swatch: 'oklch(0.97 0 0)' },
	neutral: { name: 'Neutral', hue: 0, chroma: 0, swatch: 'oklch(0.9 0 0)' },
	warm: { name: 'Warm white', hue: 75, chroma: 0.002, swatch: 'oklch(0.93 0.01 75)' },
	stone: { name: 'Stone', hue: 56, chroma: 0.006, swatch: 'oklch(0.88 0.012 56)' },
	zinc: { name: 'Zinc', hue: 286, chroma: 0.005, swatch: 'oklch(0.88 0.01 286)' },
	slate: { name: 'Slate', hue: 257, chroma: 0.015, swatch: 'oklch(0.87 0.025 257)' },
	mocha: { name: 'Mocha', hue: 50, chroma: 0.018, swatch: 'oklch(0.85 0.035 50)' },
	sage: { name: 'Sage', hue: 150, chroma: 0.012, swatch: 'oklch(0.88 0.03 150)' },
	blush: { name: 'Blush', hue: 15, chroma: 0.012, swatch: 'oklch(0.9 0.03 15)' },
	ocean: { name: 'Ocean', hue: 230, chroma: 0.02, swatch: 'oklch(0.87 0.035 230)' },
};

export const FONTS: Record<string, { name: string; family: string }> = {
	geist: { name: 'Geist', family: "'Geist'" },
	inter: { name: 'Inter', family: "'Inter'" },
	outfit: { name: 'Outfit', family: "'Outfit'" },
	poppins: { name: 'Poppins', family: "'Poppins'" },
	dmsans: { name: 'DM Sans', family: "'DM Sans'" },
	manrope: { name: 'Manrope', family: "'Manrope'" },
	jakarta: { name: 'Jakarta', family: "'Plus Jakarta Sans'" },
	nunito: { name: 'Nunito', family: "'Nunito'" },
	grotesk: { name: 'Grotesk', family: "'Space Grotesk'" },
	lora: { name: 'Lora', family: "'Lora'" },
	system: { name: 'System', family: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI'" },
	mono: { name: 'Mono', family: "'Geist Mono'" },
};

/** Fonts that only download once a page actually uses them, so unused choices cost one stylesheet request. */
export const OPTIONAL_FONTS_URL =
	'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Outfit:wght@100..900&family=Poppins:wght@400;500;600;700&family=DM+Sans:wght@100..900&family=Manrope:wght@200..800&family=Plus+Jakarta+Sans:wght@200..800&family=Nunito:wght@200..900&family=Space+Grotesk:wght@300..700&family=Lora:wght@400..700&display=swap';

export const FONT_SIZES = {
	xs: { name: 'XS', value: '87.5%' },
	sm: { name: 'Small', value: '93.75%' },
	md: { name: 'Default', value: '100%' },
	lg: { name: 'Large', value: '106.25%' },
	xl: { name: 'XL', value: '112.5%' },
};
export const LETTER_SPACING = {
	tight: { name: 'Tight', value: '-0.012em' },
	normal: { name: 'Normal', value: 'normal' },
	wide: { name: 'Wide', value: '0.02em' },
};
export const SIDEBAR_WIDTHS = {
	compact: { name: 'Compact', value: '16rem' },
	default: { name: 'Default', value: '18rem' },
	wide: { name: 'Wide', value: '20rem' },
};
export const HEADER_HEIGHTS = {
	compact: { name: 'S', value: '3.5rem' },
	default: { name: 'M', value: '4rem' },
	tall: { name: 'L', value: '4.5rem' },
};
export const RADII = [0, 0.3, 0.5, 0.625, 0.75, 1];
export const TOOLTIP_DELAYS = {
	instant: { name: 'Instant', value: 0 },
	fast: { name: 'Fast', value: 200 },
	normal: { name: 'Normal', value: 500 },
	slow: { name: 'Slow', value: 900 },
};
export const TOOLTIP_WIDTHS = {
	narrow: { name: 'Narrow', value: '16rem' },
	default: { name: 'Default', value: '22rem' },
	wide: { name: 'Wide', value: '32rem' },
};
export const TOOLTIP_STYLES = {
	contrast: 'Contrast',
	surface: 'Surface',
	glass: 'Glass',
	accent: 'Accent',
	gradient: 'Gradient',
};

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeCustomizerSettings = {
	mode: ThemeMode;
	accent: string;
	customColor: string;
	tone: string;
	radius: number;
	font: string;
	fontSize: keyof typeof FONT_SIZES;
	letterSpacing: keyof typeof LETTER_SPACING;
	cardStyle: 'bordered' | 'flat' | 'elevated';
	darkSurface: 'default' | 'dim' | 'black';
	highContrast: boolean;
	chartPalette: 'default' | 'accent' | 'vibrant' | 'pastel';
	sidebarVariant: 'sidebar' | 'floating' | 'inset';
	sidebarCollapsible: 'icon' | 'offcanvas';
	sidebarSide: 'left' | 'right';
	sidebarColor: 'default' | 'tinted' | 'inverted';
	sidebarWidth: keyof typeof SIDEBAR_WIDTHS;
	/** Width set by dragging the sidebar edge; overrides `sidebarWidth` until a preset is picked again. */
	sidebarWidthPx: number | null;
	sidebarCollapsed: boolean;
	navActive: 'soft' | 'solid' | 'bar';
	showGroupLabels: boolean;
	showSidebarFooter: boolean;
	/** Insight has no desktop top bar of its own, so this turns one on for the header settings to act on. */
	showTopBar: boolean;
	headerStyle: 'blur' | 'solid' | 'transparent';
	headerHeight: keyof typeof HEADER_HEIGHTS;
	contentWidth: 'full' | 'wide' | 'boxed';
	contentPadding: 'compact' | 'default' | 'comfortable';
	stickyHeader: boolean;
	showQuickLinks: boolean;
	reducedMotion: boolean;
	thinScrollbars: boolean;
	truncationTips: boolean;
	tooltipStyle: keyof typeof TOOLTIP_STYLES;
	tooltipAnimation: 'fade' | 'scale' | 'slide' | 'pop';
	tooltipSize: 'sm' | 'md' | 'lg';
	tooltipWidth: keyof typeof TOOLTIP_WIDTHS;
	tooltipDelay: keyof typeof TOOLTIP_DELAYS;
	tooltipArrow: boolean;
};

/** Matches Insight's stock look, so nothing changes until a user opts in. */
export const DEFAULT_THEME_CUSTOMIZER: ThemeCustomizerSettings = {
	mode: 'system',
	accent: 'default',
	customColor: '#e8590c',
	tone: 'default',
	radius: 0.625,
	font: 'geist',
	fontSize: 'md',
	letterSpacing: 'normal',
	cardStyle: 'bordered',
	darkSurface: 'default',
	highContrast: false,
	chartPalette: 'default',
	sidebarVariant: 'sidebar',
	sidebarCollapsible: 'icon',
	sidebarSide: 'left',
	sidebarColor: 'default',
	sidebarWidth: 'default',
	sidebarWidthPx: null,
	sidebarCollapsed: false,
	navActive: 'soft',
	showGroupLabels: true,
	showSidebarFooter: true,
	showTopBar: false,
	headerStyle: 'blur',
	headerHeight: 'default',
	contentWidth: 'full',
	contentPadding: 'compact',
	stickyHeader: true,
	showQuickLinks: true,
	reducedMotion: false,
	thinScrollbars: true,
	truncationTips: true,
	tooltipStyle: 'surface',
	tooltipAnimation: 'scale',
	tooltipSize: 'sm',
	tooltipWidth: 'default',
	tooltipDelay: 'normal',
	tooltipArrow: false,
};

/** The keys a preset controls; anything a preset leaves out goes back to its default so presets don't leak into each other. */
const PRESET_KEYS = [
	'mode',
	'accent',
	'tone',
	'radius',
	'font',
	'sidebarColor',
	'cardStyle',
	'darkSurface',
	'chartPalette',
	'tooltipStyle',
] as const;

type PresetSettings = Partial<Pick<ThemeCustomizerSettings, (typeof PRESET_KEYS)[number]>> & {
	accent: string;
	tone: string;
	font: string;
};

export const PRESETS: { name: string; settings: PresetSettings }[] = [
	{ name: 'Bistro', settings: { accent: 'orange', tone: 'warm', radius: 0.625, font: 'geist', mode: 'light' } },
	{
		name: 'Ocean',
		settings: { accent: 'blue', tone: 'slate', radius: 0.75, font: 'inter', mode: 'light', sidebarColor: 'tinted' },
	},
	{ name: 'Forest', settings: { accent: 'green', tone: 'stone', radius: 0.5, font: 'outfit', mode: 'light' } },
	{
		name: 'Sunset',
		settings: {
			accent: 'rose',
			tone: 'stone',
			radius: 0.75,
			font: 'outfit',
			mode: 'light',
			chartPalette: 'vibrant',
		},
	},
	{
		name: 'Lavender',
		settings: {
			accent: 'violet',
			tone: 'zinc',
			radius: 1,
			font: 'poppins',
			mode: 'light',
			sidebarColor: 'tinted',
			tooltipStyle: 'glass',
		},
	},
	{
		name: 'Mint',
		settings: { accent: 'teal', tone: 'sage', radius: 0.75, font: 'nunito', mode: 'light', sidebarColor: 'tinted' },
	},
	{
		name: 'Sakura',
		settings: {
			accent: 'pink',
			tone: 'blush',
			radius: 1,
			font: 'nunito',
			mode: 'light',
			chartPalette: 'pastel',
			tooltipStyle: 'surface',
		},
	},
	{
		name: 'Nordic',
		settings: { accent: 'sky', tone: 'slate', radius: 0.5, font: 'inter', mode: 'light', cardStyle: 'flat' },
	},
	{
		name: 'Sand',
		settings: { accent: 'amber', tone: 'stone', radius: 0.5, font: 'dmsans', mode: 'light', cardStyle: 'elevated' },
	},
	{
		name: 'Terracotta',
		settings: { accent: 'orange', tone: 'mocha', radius: 0.5, font: 'lora', mode: 'light', cardStyle: 'elevated' },
	},
	{
		name: 'Citrus',
		settings: {
			accent: 'lime',
			tone: 'neutral',
			radius: 0.75,
			font: 'grotesk',
			mode: 'light',
			sidebarColor: 'inverted',
		},
	},
	{
		name: 'Royal',
		settings: {
			accent: 'indigo',
			tone: 'slate',
			radius: 0.625,
			font: 'jakarta',
			mode: 'light',
			sidebarColor: 'inverted',
			tooltipStyle: 'accent',
		},
	},
	{
		name: 'Editorial',
		settings: {
			accent: 'slate',
			tone: 'warm',
			radius: 0.3,
			font: 'lora',
			mode: 'light',
			cardStyle: 'flat',
			chartPalette: 'accent',
		},
	},
	{
		name: 'Mono',
		settings: {
			accent: 'slate',
			tone: 'neutral',
			radius: 0.3,
			font: 'geist',
			mode: 'light',
			sidebarColor: 'inverted',
		},
	},
	{ name: 'Espresso', settings: { accent: 'amber', tone: 'mocha', radius: 0.75, font: 'poppins', mode: 'dark' } },
	{
		name: 'Midnight',
		settings: { accent: 'violet', tone: 'zinc', radius: 1, font: 'inter', mode: 'dark', tooltipStyle: 'glass' },
	},
	{
		name: 'Deep Sea',
		settings: {
			accent: 'cyan',
			tone: 'ocean',
			radius: 0.75,
			font: 'manrope',
			mode: 'dark',
			sidebarColor: 'tinted',
			tooltipStyle: 'glass',
		},
	},
	{ name: 'Emerald', settings: { accent: 'green', tone: 'sage', radius: 0.75, font: 'dmsans', mode: 'dark' } },
	{
		name: 'Crimson',
		settings: { accent: 'red', tone: 'neutral', radius: 0.3, font: 'manrope', mode: 'dark', darkSurface: 'dim' },
	},
	{
		name: 'Graphite',
		settings: {
			accent: 'slate',
			tone: 'zinc',
			radius: 0.5,
			font: 'geist',
			mode: 'dark',
			darkSurface: 'dim',
			chartPalette: 'accent',
		},
	},
	{
		name: 'Neon',
		settings: {
			accent: 'fuchsia',
			tone: 'zinc',
			radius: 0.5,
			font: 'grotesk',
			mode: 'dark',
			darkSurface: 'black',
			chartPalette: 'vibrant',
			tooltipStyle: 'gradient',
		},
	},
	{
		name: 'OLED',
		settings: { accent: 'blue', tone: 'neutral', radius: 0.625, font: 'geist', mode: 'dark', darkSurface: 'black' },
	},
];

export function presetPatch(preset: PresetSettings): Partial<ThemeCustomizerSettings> {
	return {
		...Object.fromEntries(PRESET_KEYS.map((key) => [key, DEFAULT_THEME_CUSTOMIZER[key]])),
		...preset,
	};
}

/** Keeps only known keys whose value has the same type as the default; the rest of a stored or pasted theme is dropped. */
export function sanitizeThemeCustomizer(value: unknown): Partial<ThemeCustomizerSettings> {
	if (typeof value !== 'object' || value === null) {
		return {};
	}
	return Object.fromEntries(
		Object.entries(value).filter(([key, entry]) => {
			if (!Object.hasOwn(DEFAULT_THEME_CUSTOMIZER, key)) {
				return false;
			}
			if (key === 'sidebarWidthPx') {
				return entry === null || typeof entry === 'number';
			}
			return typeof entry === typeof DEFAULT_THEME_CUSTOMIZER[key as keyof ThemeCustomizerSettings];
		}),
	);
}

export const ACCENT_VARIABLES = [
	'--primary',
	'--primary-foreground',
	'--primary-muted',
	'--violet',
	'--ring',
	'--sidebar-primary',
	'--sidebar-primary-foreground',
	'--sidebar-ring',
	'--chart-1',
	'--gradient-brand',
	'--gradient-brand-hover',
	'--gradient-brand-border',
];

export const TONE_VARIABLES = [
	'--background',
	'--panel',
	'--foreground',
	'--card',
	'--card-foreground',
	'--popover',
	'--popover-foreground',
	'--muted',
	'--muted-foreground',
	'--secondary',
	'--secondary-foreground',
	'--accent',
	'--accent-foreground',
	'--border',
	'--input',
];

export const SIDEBAR_VARIABLES = [
	'--sidebar',
	'--sidebar-foreground',
	'--sidebar-accent',
	'--sidebar-accent-foreground',
	'--sidebar-border',
];

export const CHART_VARIABLES = ['--chart-2', '--chart-3', '--chart-4', '--chart-5'];

export const CHART_PALETTES: Record<Exclude<ThemeCustomizerSettings['chartPalette'], 'default'>, string[]> = {
	accent: [80, 62, 45, 30].map((percent) => `color-mix(in oklch, var(--primary) ${percent}%, var(--background))`),
	vibrant: ['oklch(0.68 0.19 160)', 'oklch(0.6 0.22 262)', 'oklch(0.8 0.18 85)', 'oklch(0.64 0.25 330)'],
	pastel: ['oklch(0.8 0.1 165)', 'oklch(0.78 0.1 255)', 'oklch(0.87 0.11 90)', 'oklch(0.8 0.11 340)'],
};

/** Lightness steps for dark surfaces: [background, card/popover, muted/secondary, muted text]. */
const DARK_SURFACES: Record<ThemeCustomizerSettings['darkSurface'], [number, number, number, number]> = {
	default: [0.16, 0.21, 0.27, 0.71],
	dim: [0.24, 0.29, 0.35, 0.75],
	black: [0, 0.14, 0.21, 0.68],
};

export function accentColor(settings: ThemeCustomizerSettings, accentKey: string, isDark: boolean): string {
	if (accentKey === 'custom') {
		return settings.customColor;
	}
	const accent = ACCENTS[accentKey] ?? ACCENTS.default;
	return isDark ? accent.dark : accent.light;
}

/** Every variable the primary colour drives, or null when the stylesheet (or white-label colour) should decide. */
export function accentVariables(settings: ThemeCustomizerSettings, isDark: boolean): CssVariables | null {
	const isCustom = settings.accent === 'custom' && parseHex(settings.customColor) !== null;
	if (!isCustom && (settings.accent === 'default' || !Object.hasOwn(ACCENTS, settings.accent))) {
		return null;
	}
	const color = accentColor(settings, settings.accent, isDark);
	const brand = buildBrandVars(color, isDark ? 'dark' : 'light');
	const foreground = isCustom ? brand['--primary-foreground'] : presetAccentForeground(settings.accent, isDark);
	return {
		...brand,
		'--primary-foreground': foreground,
		'--sidebar-primary-foreground': foreground,
		'--ring': color,
		'--sidebar-ring': color,
		'--chart-1': color,
		'--gradient-brand': `linear-gradient(180deg, ${color} 0%, color-mix(in oklch, ${color} 88%, white) 100%)`,
		'--gradient-brand-hover': `linear-gradient(180deg, color-mix(in oklch, ${color} 88%, white) 0%, color-mix(in oklch, ${color} 76%, white) 100%)`,
		'--gradient-brand-border': `linear-gradient(180deg, ${color} 0%, color-mix(in oklch, ${color} 80%, black) 50%, color-mix(in oklch, ${color} 60%, white) 100%)`,
	};
}

function presetAccentForeground(accentKey: string, isDark: boolean): string {
	if (accentKey === 'slate') {
		return isDark ? 'oklch(0.21 0.006 285.9)' : 'oklch(0.985 0 0)';
	}
	return isDark ? 'oklch(0.145 0 0)' : 'oklch(0.985 0 0)';
}

/** Surface colours for a tone, or null when Insight's own stylesheet values should stand. */
export function toneVariables(
	toneKey: string,
	isDark: boolean,
	surface: ThemeCustomizerSettings['darkSurface'],
): CssVariables | null {
	if (toneKey === 'default' && (!isDark || surface === 'default')) {
		return null;
	}
	const tone = Object.hasOwn(TONES, toneKey) ? TONES[toneKey] : TONES.neutral;
	const shade = (lightness: number, chromaScale = 1) =>
		`oklch(${lightness} ${(tone.chroma * chromaScale).toFixed(3)} ${tone.hue})`;

	if (isDark) {
		const [background, card, muted, mutedForeground] = DARK_SURFACES[surface] ?? DARK_SURFACES.default;
		return {
			'--background': shade(background),
			'--panel': shade(card, 1.2),
			'--foreground': shade(0.985),
			'--card': shade(card, 1.2),
			'--card-foreground': shade(0.985),
			'--popover': shade(card, 1.2),
			'--popover-foreground': shade(0.985),
			'--muted': shade(muted, 1.2),
			'--muted-foreground': shade(mutedForeground, 1.5),
			'--secondary': shade(muted, 1.2),
			'--secondary-foreground': shade(0.985),
			'--accent': shade(muted, 1.2),
			'--accent-foreground': shade(0.985),
			'--border': `oklch(1 ${tone.chroma.toFixed(3)} ${tone.hue} / 10%)`,
			'--input': `oklch(1 ${tone.chroma.toFixed(3)} ${tone.hue} / 15%)`,
		};
	}
	return {
		'--background': shade(0.985),
		'--panel': shade(0.975, 1.5),
		'--foreground': shade(0.15, 2),
		'--card': 'oklch(1 0 0)',
		'--card-foreground': shade(0.15, 2),
		'--popover': 'oklch(1 0 0)',
		'--popover-foreground': shade(0.15, 2),
		'--muted': shade(0.965, 1.5),
		'--muted-foreground': shade(0.55, 3),
		'--secondary': shade(0.965, 1.5),
		'--secondary-foreground': shade(0.21, 2),
		'--accent': shade(0.965, 1.5),
		'--accent-foreground': shade(0.21, 2),
		'--border': shade(0.92, 2),
		'--input': shade(0.92, 2),
	};
}

export function sidebarVariables(color: ThemeCustomizerSettings['sidebarColor'], isDark: boolean): CssVariables | null {
	if (color === 'tinted') {
		return {
			'--sidebar': 'color-mix(in oklch, var(--primary) 7%, var(--background))',
			'--sidebar-foreground': 'var(--foreground)',
			'--sidebar-accent': 'color-mix(in oklch, var(--primary) 14%, var(--background))',
			'--sidebar-accent-foreground': 'var(--foreground)',
			'--sidebar-border': 'color-mix(in oklch, var(--primary) 18%, var(--border))',
		};
	}
	if (color !== 'inverted') {
		return null;
	}
	return isDark
		? {
				'--sidebar': 'oklch(0.97 0 0)',
				'--sidebar-foreground': 'oklch(0.2 0 0)',
				'--sidebar-accent': 'oklch(0.92 0 0)',
				'--sidebar-accent-foreground': 'oklch(0.2 0 0)',
				'--sidebar-border': 'oklch(0.88 0 0)',
			}
		: {
				'--sidebar': 'oklch(0.2 0.006 285.9)',
				'--sidebar-foreground': 'oklch(0.95 0 0)',
				'--sidebar-accent': 'oklch(0.28 0.006 285.9)',
				'--sidebar-accent-foreground': 'oklch(0.985 0 0)',
				'--sidebar-border': 'oklch(1 0 0 / 10%)',
			};
}

export function sidebarWidthValue(settings: ThemeCustomizerSettings): string {
	if (settings.sidebarWidthPx) {
		return `${settings.sidebarWidthPx}px`;
	}
	return (SIDEBAR_WIDTHS[settings.sidebarWidth] ?? SIDEBAR_WIDTHS.default).value;
}
