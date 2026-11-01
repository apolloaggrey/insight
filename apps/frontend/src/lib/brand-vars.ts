type BrandVars = Record<string, string>;

export function buildBrandVars(color: string, mode: 'light' | 'dark' = 'light'): BrandVars {
	const foreground = readableTextColor(color);
	const muted = `color-mix(in oklab, ${color} ${mode === 'dark' ? 70 : 55}%, ${mode === 'dark' ? 'black' : 'white'})`;
	return {
		'--primary': color,
		'--primary-foreground': foreground,
		'--primary-muted': muted,
		'--violet': color,
		'--sidebar-primary': color,
		'--sidebar-primary-foreground': foreground,
	};
}

export function buildLastUsedPillVars(color: string): BrandVars {
	return { '--last-used-pill-bg': color, '--last-used-pill-fg': readableTextColor(color) };
}

/** Black or white, whichever reads better on the colour (WCAG relative luminance). */
function readableTextColor(color: string): string {
	const rgb = parseHex(color);
	if (!rgb) {
		return '#ffffff';
	}
	const [r, g, b] = rgb.map((channel) => {
		const value = channel / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return luminance > 0.179 ? '#000000' : '#ffffff';
}

export function parseHex(color: string): [number, number, number] | null {
	const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
	if (!match) {
		return null;
	}
	const value = parseInt(match[1], 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
