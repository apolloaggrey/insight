import { describe, expect, it } from 'vitest';

import {
	accentVariables,
	DEFAULT_THEME_CUSTOMIZER,
	presetPatch,
	PRESETS,
	sanitizeThemeCustomizer,
	sidebarWidthValue,
	toneVariables,
	TONE_VARIABLES,
} from './theme-customizer';

describe('sanitizeThemeCustomizer', () => {
	it('drops unknown keys, inherited keys and wrongly typed values', () => {
		const parsed = JSON.parse('{"accent":"blue","radius":"big","nope":1,"__proto__":{"x":1},"sidebarWidthPx":300}');
		expect(sanitizeThemeCustomizer(parsed)).toEqual({ accent: 'blue', sidebarWidthPx: 300 });
	});

	it('accepts a cleared drag width and rejects non-objects', () => {
		expect(sanitizeThemeCustomizer({ sidebarWidthPx: null })).toEqual({ sidebarWidthPx: null });
		expect(sanitizeThemeCustomizer('blue')).toEqual({});
		expect(sanitizeThemeCustomizer(null)).toEqual({});
	});
});

describe('accentVariables', () => {
	it('leaves the stock and white-label colours alone by default', () => {
		expect(accentVariables(DEFAULT_THEME_CUSTOMIZER, false)).toBeNull();
		expect(accentVariables({ ...DEFAULT_THEME_CUSTOMIZER, accent: 'constructor' }, false)).toBeNull();
	});

	it('ignores a custom colour that is not a hex value', () => {
		const settings = { ...DEFAULT_THEME_CUSTOMIZER, accent: 'custom', customColor: 'red; } body {' };
		expect(accentVariables(settings, false)).toBeNull();
	});

	it('picks readable text for a custom colour', () => {
		const settings = { ...DEFAULT_THEME_CUSTOMIZER, accent: 'custom', customColor: '#ffff00' };
		expect(accentVariables(settings, false)?.['--primary-foreground']).toBe('#000000');
	});
});

describe('toneVariables', () => {
	it('keeps the stylesheet surfaces for the default tone', () => {
		expect(toneVariables('default', false, 'default')).toBeNull();
		expect(toneVariables('default', true, 'default')).toBeNull();
	});

	it('still applies the dark surface choice on the default tone', () => {
		expect(toneVariables('default', true, 'black')?.['--background']).toContain('oklch(0 ');
	});

	it('sets every tone variable', () => {
		expect(Object.keys(toneVariables('slate', false, 'default') ?? {}).sort()).toEqual([...TONE_VARIABLES].sort());
	});
});

describe('presets', () => {
	it('resets the keys a preset leaves out', () => {
		const patch = presetPatch(PRESETS.find((preset) => preset.name === 'Bistro')!.settings);
		expect(patch.chartPalette).toBe('default');
		expect(patch.accent).toBe('orange');
	});
});

describe('sidebarWidthValue', () => {
	it('prefers a dragged width over the preset', () => {
		expect(sidebarWidthValue(DEFAULT_THEME_CUSTOMIZER)).toBe('18rem');
		expect(sidebarWidthValue({ ...DEFAULT_THEME_CUSTOMIZER, sidebarWidthPx: 321 })).toBe('321px');
	});
});
