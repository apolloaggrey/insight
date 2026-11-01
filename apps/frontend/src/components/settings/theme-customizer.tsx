import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
	Check,
	ClipboardPaste,
	Cloud,
	Copy,
	HardDrive,
	Loader2,
	Monitor,
	Moon,
	Pipette,
	RotateCcw,
	Shuffle,
	Sun,
	XIcon,
} from 'lucide-react';
import { useState } from 'react';

import type { ThemeSyncState } from '@/contexts/theme-customizer.provider';
import type { ThemeCustomizerSettings, ThemeMode } from '@/lib/theme-customizer';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { TabBar, TabPanel } from '@/components/ui/tab-bar';
import { useIsDarkMode } from '@/contexts/theme.provider';
import { loadOptionalFonts, useThemeCustomizer } from '@/contexts/theme-customizer.provider';
import {
	accentColor,
	ACCENTS,
	CHART_PALETTES,
	FONT_SIZES,
	FONTS,
	HEADER_HEIGHTS,
	LETTER_SPACING,
	presetPatch,
	PRESETS,
	RADII,
	sanitizeThemeCustomizer,
	SIDEBAR_WIDTHS,
	TONES,
	TOOLTIP_DELAYS,
	TOOLTIP_STYLES,
	TOOLTIP_WIDTHS,
} from '@/lib/theme-customizer';
import { cn } from '@/lib/utils';

type CustomizerTab = 'theme' | 'layout' | 'advanced';
type PresetFilter = 'all' | 'light' | 'dark';
type SectionProps = {
	settings: ThemeCustomizerSettings;
	update: (patch: Partial<ThemeCustomizerSettings>) => void;
};

const TABS: { id: CustomizerTab; label: string }[] = [
	{ id: 'theme', label: 'Theme' },
	{ id: 'layout', label: 'Layout' },
	{ id: 'advanced', label: 'Advanced' },
];
const TAB_ID_BASE = 'theme-customizer';

/** Side panel with no dimming overlay, opposite the sidebar, so changes can be judged live against the app. */
export function ThemeCustomizerSheet({ trigger }: { trigger: React.ReactElement }) {
	const { settings, update, reset, syncState } = useThemeCustomizer();
	const [activeTab, setActiveTab] = useState<CustomizerTab>('theme');

	return (
		<DialogPrimitive.Root
			onOpenChange={(isOpen) => {
				if (isOpen) {
					loadOptionalFonts();
				}
			}}
		>
			<DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Content
					data-no-truncate-tip
					className={cn(
						'fixed inset-y-0 z-50 flex w-full flex-col bg-background shadow-xl outline-none animate-in duration-200 sm:max-w-md',
						settings.sidebarSide === 'right'
							? 'left-0 border-r slide-in-from-left'
							: 'right-0 border-l slide-in-from-right',
					)}
				>
					<div className='flex flex-col gap-1 border-b p-4 pr-12'>
						<DialogPrimitive.Title className='text-base font-semibold text-foreground'>
							Theme Customizer
						</DialogPrimitive.Title>
						<DialogPrimitive.Description className='text-sm text-muted-foreground'>
							Customize and preview in real time. Saved in your user settings.
						</DialogPrimitive.Description>
						<SyncBadge state={syncState} />
					</div>
					<DialogPrimitive.Close
						aria-label='Close'
						className='absolute right-4 top-4 cursor-pointer text-muted-foreground hover:text-foreground'
					>
						<XIcon className='size-4' />
					</DialogPrimitive.Close>

					<TabBar
						tabs={TABS}
						activeTab={activeTab}
						onTabChange={setActiveTab}
						idBase={TAB_ID_BASE}
						className='border-b px-4'
						fitted
					/>
					<TabPanel
						idBase={TAB_ID_BASE}
						tabId={activeTab}
						className='flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4'
					>
						{activeTab === 'theme' && <ThemeSection settings={settings} update={update} />}
						{activeTab === 'layout' && <LayoutSection settings={settings} update={update} />}
						{activeTab === 'advanced' && <AdvancedSection settings={settings} update={update} />}
					</TabPanel>

					<div className='border-t p-4'>
						<Button variant='outline' className='w-full' onClick={reset}>
							<RotateCcw /> Reset to defaults
						</Button>
					</div>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

function ThemeSection({ settings, update }: SectionProps) {
	const isDark = useIsDarkMode();

	return (
		<>
			<PresetsGroup settings={settings} update={update} />
			<Group label='Mode'>
				<div className='grid grid-cols-3 gap-2'>
					{MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
						<Choice
							key={value}
							isActive={settings.mode === value}
							onClick={() => update({ mode: value })}
							className='flex-col py-3'
						>
							<Icon className='size-5' />
							{label}
						</Choice>
					))}
				</div>
			</Group>
			<PrimaryColorGroup settings={settings} update={update} isDark={isDark} />
			<Group label='Base color'>
				<div className='grid grid-cols-3 gap-2'>
					{Object.entries(TONES).map(([key, tone]) => (
						<Choice
							key={key}
							isActive={settings.tone === key}
							onClick={() => update({ tone: key })}
							className='justify-start'
						>
							<span className='size-4 shrink-0 rounded-full border' style={{ background: tone.swatch }} />
							<span className='truncate text-xs'>{tone.name}</span>
						</Choice>
					))}
				</div>
			</Group>
			<Group label='Radius'>
				<div className='grid grid-cols-6 gap-2'>
					{RADII.map((radius) => (
						<Choice
							key={radius}
							isActive={settings.radius === radius}
							onClick={() => update({ radius })}
							className='flex-col gap-1 px-0 py-2'
						>
							<span
								className='size-5 border-l-2 border-t-2 border-foreground/60'
								style={{ borderTopLeftRadius: `${radius * 0.9}rem` }}
							/>
							<span className='text-xs'>{radius}</span>
						</Choice>
					))}
				</div>
			</Group>
			<TooltipsGroup settings={settings} update={update} />
		</>
	);
}

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
	{ value: 'light', label: 'Light', icon: Sun },
	{ value: 'dark', label: 'Dark', icon: Moon },
	{ value: 'system', label: 'System', icon: Monitor },
];

function PresetsGroup({ settings, update }: SectionProps) {
	const [filter, setFilter] = useState<PresetFilter>('all');
	const activePreset = PRESETS.find((preset) =>
		Object.entries(presetPatch(preset.settings)).every(
			([key, value]) => settings[key as keyof ThemeCustomizerSettings] === value,
		),
	)?.name;
	const visiblePresets = PRESETS.filter((preset) => filter === 'all' || (preset.settings.mode ?? 'light') === filter);

	return (
		<Group
			label='Presets'
			action={
				<Button variant='ghost' size='sm' onClick={() => update(randomTheme())}>
					<Shuffle /> Surprise me
				</Button>
			}
		>
			<Segmented
				value={filter}
				onChange={setFilter}
				options={[
					['all', `All (${PRESETS.length})`],
					['light', 'Light'],
					['dark', 'Dark'],
				]}
			/>
			<div className='grid grid-cols-3 gap-2'>
				{visiblePresets.map((preset) => (
					<Choice
						key={preset.name}
						isActive={activePreset === preset.name}
						onClick={() => update(presetPatch(preset.settings))}
						className='flex-col gap-1.5 py-2.5'
					>
						<span className='flex -space-x-1.5'>
							{presetSwatches(preset.settings).map((color, index) => (
								<span
									key={index}
									className='size-5 rounded-full border-2 border-background'
									style={{ background: color }}
								/>
							))}
						</span>
						<span className='text-xs' style={{ fontFamily: FONTS[preset.settings.font]?.family }}>
							{preset.name}
						</span>
					</Choice>
				))}
			</div>
		</Group>
	);
}

function PrimaryColorGroup({ settings, update, isDark }: SectionProps & { isDark: boolean }) {
	const isCustom = settings.accent === 'custom';

	return (
		<Group label='Primary color'>
			<div className='grid grid-cols-10 gap-1.5'>
				{Object.entries(ACCENTS).map(([key, accent]) => (
					<button
						key={key}
						type='button'
						title={accent.name}
						aria-label={accent.name}
						aria-pressed={settings.accent === key}
						onClick={() => update({ accent: key })}
						className={cn(
							'flex aspect-square cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background transition',
							settings.accent === key && 'ring-2 ring-foreground',
						)}
						style={{ background: accentColor(settings, key, isDark) }}
					>
						{settings.accent === key && (
							<Check
								className='size-3.5'
								style={{ color: key === 'slate' && isDark ? '#000' : '#fff' }}
							/>
						)}
					</button>
				))}
				<label
					title='Custom color'
					className={cn(
						'relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-full border ring-offset-2 ring-offset-background',
						isCustom && 'ring-2 ring-foreground',
					)}
					style={{
						background: isCustom
							? settings.customColor
							: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
					}}
				>
					<Pipette className='size-3.5 text-white drop-shadow' />
					<input
						type='color'
						aria-label='Custom color'
						value={settings.customColor}
						onChange={(event) => update({ accent: 'custom', customColor: event.target.value })}
						className='absolute inset-0 cursor-pointer opacity-0'
					/>
				</label>
			</div>
			{isCustom && (
				<p className='font-mono text-xs text-muted-foreground'>{settings.customColor.toUpperCase()}</p>
			)}
		</Group>
	);
}

function TooltipsGroup({ settings, update }: SectionProps) {
	return (
		<Group label='Tooltips'>
			<TooltipPreview settings={settings} />
			<div className='grid grid-cols-5 gap-1.5'>
				{optionsOf(TOOLTIP_STYLES, (label) => label).map(([value, label]) => (
					<Choice
						key={value}
						isActive={settings.tooltipStyle === value}
						onClick={() => update({ tooltipStyle: value })}
						className='flex-col gap-1.5 px-1 py-2.5'
					>
						<span className='app-tooltip px-2 py-0.5 text-[11px]' data-tooltip-style={value}>
							Aa
						</span>
						<span className='max-w-full truncate text-[11px]'>{label}</span>
					</Choice>
				))}
			</div>
			<Group label='Animation'>
				<Segmented
					value={settings.tooltipAnimation}
					onChange={(tooltipAnimation) => update({ tooltipAnimation })}
					options={[
						['fade', 'Fade'],
						['scale', 'Zoom'],
						['slide', 'Slide'],
						['pop', 'Pop'],
					]}
				/>
			</Group>
			<div className='grid grid-cols-2 gap-4'>
				<Group label='Size'>
					<Segmented
						value={settings.tooltipSize}
						onChange={(tooltipSize) => update({ tooltipSize })}
						options={[
							['sm', 'S'],
							['md', 'M'],
							['lg', 'L'],
						]}
					/>
				</Group>
				<Group label='Max width'>
					<Segmented
						value={settings.tooltipWidth}
						onChange={(tooltipWidth) => update({ tooltipWidth })}
						options={optionsOf(TOOLTIP_WIDTHS, (width) => width.name)}
					/>
				</Group>
			</div>
			<Group label='Show after'>
				<Segmented
					value={settings.tooltipDelay}
					onChange={(tooltipDelay) => update({ tooltipDelay })}
					options={optionsOf(TOOLTIP_DELAYS, (delay) => delay.name)}
				/>
			</Group>
			<div className='flex flex-col gap-3 pt-1'>
				<SwitchRow
					label='Full text on hover'
					hint='Hovering text cut off with … shows all of it in a tooltip.'
					checked={settings.truncationTips}
					onChange={(truncationTips) => update({ truncationTips })}
				/>
				<SwitchRow
					label='Pointer arrow'
					hint='Point the bubble at what it describes.'
					checked={settings.tooltipArrow}
					onChange={(tooltipArrow) => update({ tooltipArrow })}
				/>
			</div>
		</Group>
	);
}

function LayoutSection({ settings, update }: SectionProps) {
	return (
		<>
			<Group label='Sidebar style'>
				<div className='grid grid-cols-3 gap-2'>
					{SIDEBAR_VARIANTS.map(([value, label]) => (
						<Choice
							key={value}
							isActive={settings.sidebarVariant === value}
							onClick={() => update({ sidebarVariant: value })}
							className='flex-col py-3'
						>
							<SidebarPreview variant={value} isRight={settings.sidebarSide === 'right'} />
							{label}
						</Choice>
					))}
				</div>
			</Group>
			<Group label='Sidebar color'>
				<div className='grid grid-cols-3 gap-2'>
					{SIDEBAR_COLORS.map(([value, label]) => (
						<Choice
							key={value}
							isActive={settings.sidebarColor === value}
							onClick={() => update({ sidebarColor: value })}
							className='flex-col py-3'
						>
							<span className='flex h-10 w-14 gap-1 overflow-hidden rounded-md bg-muted p-1'>
								<span
									className={cn(
										'w-4 rounded-sm',
										value === 'default' && 'border bg-background',
										value === 'tinted' && 'bg-primary/20',
										value === 'inverted' && 'bg-foreground/85',
									)}
								/>
								<span className='flex-1 rounded-sm bg-background' />
							</span>
							{label}
						</Choice>
					))}
				</div>
			</Group>
			<div className='grid grid-cols-2 gap-4'>
				<Group label='Sidebar position'>
					<Segmented
						value={settings.sidebarSide}
						onChange={(sidebarSide) => update({ sidebarSide })}
						options={[
							['left', 'Left'],
							['right', 'Right'],
						]}
					/>
				</Group>
				<Group label='When collapsed'>
					<Segmented
						value={settings.sidebarCollapsible}
						onChange={(sidebarCollapsible) => update({ sidebarCollapsible })}
						options={[
							['icon', 'Icons'],
							['offcanvas', 'Hidden'],
						]}
					/>
				</Group>
			</div>
			<Group label='Sidebar width'>
				<Segmented
					value={settings.sidebarWidth}
					onChange={(sidebarWidth) => update({ sidebarWidth, sidebarWidthPx: null })}
					options={optionsOf(SIDEBAR_WIDTHS, (width) => width.name)}
				/>
				<p className='text-xs text-muted-foreground'>
					{settings.sidebarWidthPx
						? `Dragged to ${settings.sidebarWidthPx}px. Pick a width to go back to it.`
						: 'You can also drag the edge of the sidebar.'}
				</p>
			</Group>
			<Group label='Active menu item'>
				<div className='grid grid-cols-3 gap-2'>
					{NAV_ACTIVE_STYLES.map(([value, label]) => (
						<Choice
							key={value}
							isActive={settings.navActive === value}
							onClick={() => update({ navActive: value })}
							className='flex-col py-3'
						>
							<NavActivePreview style={value} />
							{label}
						</Choice>
					))}
				</div>
			</Group>
			<Group label='Content width'>
				<div className='grid grid-cols-3 gap-2'>
					{CONTENT_WIDTHS.map(([value, label]) => (
						<Choice
							key={value}
							isActive={settings.contentWidth === value}
							onClick={() => update({ contentWidth: value })}
							className='flex-col py-3'
						>
							<WidthPreview width={value} />
							{label}
						</Choice>
					))}
				</div>
			</Group>
			<Group label='Page spacing'>
				<Segmented
					value={settings.contentPadding}
					onChange={(contentPadding) => update({ contentPadding })}
					options={[
						['compact', 'Compact'],
						['default', 'Default'],
						['comfortable', 'Roomy'],
					]}
				/>
			</Group>
			<div className='flex flex-col gap-3'>
				<SwitchRow
					label='Collapsed sidebar'
					hint='Start with the sidebar collapsed.'
					checked={settings.sidebarCollapsed}
					onChange={(sidebarCollapsed) => update({ sidebarCollapsed })}
				/>
				<SwitchRow
					label='Sidebar section labels'
					hint='Show Today, Project, Context… headings.'
					checked={settings.showGroupLabels}
					onChange={(showGroupLabels) => update({ showGroupLabels })}
				/>
				<SwitchRow
					label='Top bar'
					hint='Add a desktop bar with the page title, quick links and settings.'
					checked={settings.showTopBar}
					onChange={(showTopBar) => update({ showTopBar })}
				/>
				<SwitchRow
					label='Sidebar footer'
					hint='Show your account at the bottom. Can only be hidden while the top bar is on, which links to settings.'
					checked={settings.showSidebarFooter || !settings.showTopBar}
					onChange={(showSidebarFooter) => update({ showSidebarFooter })}
					disabled={!settings.showTopBar}
				/>
			</div>
			{settings.showTopBar && <TopBarGroup settings={settings} update={update} />}
		</>
	);
}

const SIDEBAR_VARIANTS = [
	['sidebar', 'Default'],
	['floating', 'Floating'],
	['inset', 'Inset'],
] as const;
const SIDEBAR_COLORS = [
	['default', 'Default'],
	['tinted', 'Tinted'],
	['inverted', 'Inverted'],
] as const;
const NAV_ACTIVE_STYLES = [
	['soft', 'Soft'],
	['solid', 'Solid'],
	['bar', 'Bar'],
] as const;
const CONTENT_WIDTHS = [
	['full', 'Full'],
	['wide', 'Wide'],
	['boxed', 'Boxed'],
] as const;

function TopBarGroup({ settings, update }: SectionProps) {
	return (
		<>
			<div className='grid grid-cols-2 gap-4'>
				<Group label='Header style'>
					<Segmented
						value={settings.headerStyle}
						onChange={(headerStyle) => update({ headerStyle })}
						options={[
							['blur', 'Blur'],
							['solid', 'Solid'],
							['transparent', 'Clear'],
						]}
					/>
				</Group>
				<Group label='Header height'>
					<Segmented
						value={settings.headerHeight}
						onChange={(headerHeight) => update({ headerHeight })}
						options={optionsOf(HEADER_HEIGHTS, (height) => height.name)}
					/>
				</Group>
			</div>
			<div className='flex flex-col gap-3'>
				<SwitchRow
					label='Sticky header'
					hint='Keep the top bar visible while scrolling.'
					checked={settings.stickyHeader}
					onChange={(stickyHeader) => update({ stickyHeader })}
				/>
				<SwitchRow
					label='Header quick links'
					hint='Show New chat, Stories and Feed in the top bar.'
					checked={settings.showQuickLinks}
					onChange={(showQuickLinks) => update({ showQuickLinks })}
				/>
			</div>
		</>
	);
}

function AdvancedSection({ settings, update }: SectionProps) {
	return (
		<>
			<Group label='Font'>
				<div className='grid grid-cols-3 gap-2'>
					{Object.entries(FONTS).map(([key, font]) => (
						<Choice
							key={key}
							isActive={settings.font === key}
							onClick={() => update({ font: key })}
							className='flex-col gap-0.5 py-2.5'
						>
							<span className='text-lg leading-none' style={{ fontFamily: font.family }}>
								Aa
							</span>
							<span className='text-xs' style={{ fontFamily: font.family }}>
								{font.name}
							</span>
						</Choice>
					))}
				</div>
			</Group>
			<Group label='Text size'>
				<Segmented
					value={settings.fontSize}
					onChange={(fontSize) => update({ fontSize })}
					options={optionsOf(FONT_SIZES, (size) => size.name)}
				/>
			</Group>
			<Group label='Letter spacing'>
				<Segmented
					value={settings.letterSpacing}
					onChange={(letterSpacing) => update({ letterSpacing })}
					options={optionsOf(LETTER_SPACING, (spacing) => spacing.name)}
				/>
			</Group>
			<Group label='Card style'>
				<div className='grid grid-cols-3 gap-2'>
					{CARD_STYLES.map(([value, label]) => (
						<Choice
							key={value}
							isActive={settings.cardStyle === value}
							onClick={() => update({ cardStyle: value })}
							className='flex-col py-3'
						>
							<span className='flex h-10 w-14 items-center justify-center rounded-md bg-muted'>
								<span
									className={cn(
										'h-6 w-9 rounded-sm bg-background',
										value === 'bordered' && 'border',
										value === 'flat' && 'border border-transparent',
										value === 'elevated' && 'shadow-md',
									)}
								/>
							</span>
							{label}
						</Choice>
					))}
				</div>
			</Group>
			<Group label='Dark mode surface'>
				<div className='grid grid-cols-3 gap-2'>
					{DARK_SURFACE_OPTIONS.map(([value, label, background, card]) => (
						<Choice
							key={value}
							isActive={settings.darkSurface === value}
							onClick={() => update({ darkSurface: value })}
							className='flex-col py-3'
						>
							<span
								className='flex h-10 w-14 items-center justify-center rounded-md border'
								style={{ background }}
							>
								<span className='h-6 w-9 rounded-sm' style={{ background: card }} />
							</span>
							{label}
						</Choice>
					))}
				</div>
				<p className='text-xs text-muted-foreground'>Applies when dark mode is on. Black suits OLED screens.</p>
			</Group>
			<ChartColorsGroup settings={settings} update={update} />
			<div className='flex flex-col gap-3'>
				<SwitchRow
					label='High contrast'
					hint='Darker borders and stronger secondary text.'
					checked={settings.highContrast}
					onChange={(highContrast) => update({ highContrast })}
				/>
				<SwitchRow
					label='Thin scrollbars'
					hint='Slimmer scrollbars in lists and panels.'
					checked={settings.thinScrollbars}
					onChange={(thinScrollbars) => update({ thinScrollbars })}
				/>
				<SwitchRow
					label='Reduce motion'
					hint='Turn off animations and transitions.'
					checked={settings.reducedMotion}
					onChange={(reducedMotion) => update({ reducedMotion })}
				/>
			</div>
			<ShareGroup settings={settings} update={update} />
		</>
	);
}

const CARD_STYLES = [
	['bordered', 'Bordered'],
	['flat', 'Flat'],
	['elevated', 'Elevated'],
] as const;
const DARK_SURFACE_OPTIONS = [
	['default', 'Default', '#18181b', '#27272a'],
	['dim', 'Dim', '#2a2a2e', '#36363b'],
	['black', 'Black', '#000000', '#151517'],
] as const;
/** Insight's stock chart-2…5, since the live variables hold the chosen palette while one is selected. */
const DEFAULT_CHART_SWATCHES = [
	'oklch(0.646 0.222 41.116)',
	'oklch(0.6 0.118 184.704)',
	'oklch(0.828 0.189 84.429)',
	'oklch(0.769 0.188 70.08)',
];
const CHART_PALETTE_OPTIONS = [
	['default', 'Default'],
	['accent', 'Accent shades'],
	['vibrant', 'Vibrant'],
	['pastel', 'Pastel'],
] as const;

function ChartColorsGroup({ settings, update }: SectionProps) {
	const swatches = (palette: ThemeCustomizerSettings['chartPalette']) => {
		if (palette === 'default') {
			return ['var(--chart-1)', ...DEFAULT_CHART_SWATCHES];
		}
		return ['var(--primary)', ...CHART_PALETTES[palette]];
	};

	return (
		<Group label='Chart colors'>
			<div className='grid grid-cols-2 gap-2'>
				{CHART_PALETTE_OPTIONS.map(([value, label]) => (
					<Choice
						key={value}
						isActive={settings.chartPalette === value}
						onClick={() => update({ chartPalette: value })}
						className='justify-start'
					>
						<span className='flex shrink-0'>
							{swatches(value).map((color, index) => (
								<span
									key={index}
									className='h-4 w-2 first:rounded-l-sm last:rounded-r-sm'
									style={{ background: color }}
								/>
							))}
						</span>
						<span className='truncate text-xs'>{label}</span>
					</Choice>
				))}
			</div>
		</Group>
	);
}

function ShareGroup({ settings, update }: SectionProps) {
	const [message, setMessage] = useState<string | null>(null);

	const exportSettings = async () => {
		try {
			await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
			setMessage('Theme settings copied to the clipboard.');
		} catch {
			setMessage("Couldn't access the clipboard.");
		}
	};

	const importSettings = async () => {
		try {
			const patch = sanitizeThemeCustomizer(JSON.parse(await navigator.clipboard.readText()));
			const count = Object.keys(patch).length;
			if (count === 0) {
				throw new Error('No theme settings found');
			}
			update(patch);
			setMessage(`Imported ${count} theme ${count === 1 ? 'setting' : 'settings'}.`);
		} catch {
			setMessage("Clipboard doesn't contain exported theme settings.");
		}
	};

	return (
		<Group label='Share settings'>
			<div className='grid grid-cols-2 gap-2'>
				<Button variant='outline' size='sm' onClick={exportSettings}>
					<Copy /> Copy
				</Button>
				<Button variant='outline' size='sm' onClick={importSettings}>
					<ClipboardPaste /> Paste
				</Button>
			</div>
			<p role='status' className='text-xs text-muted-foreground'>
				{message ?? 'Copy your theme as JSON to reuse on another account or device.'}
			</p>
		</Group>
	);
}

function randomTheme(): Partial<ThemeCustomizerSettings> {
	const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
	return {
		accent: pick(Object.keys(ACCENTS)),
		tone: pick(Object.keys(TONES)),
		radius: pick(RADII),
		font: pick(Object.keys(FONTS).filter((font) => font !== 'mono')),
		sidebarColor: pick(['default', 'tinted', 'inverted'] as const),
		tooltipStyle: pick(Object.keys(TOOLTIP_STYLES) as ThemeCustomizerSettings['tooltipStyle'][]),
	};
}

function presetSwatches(preset: (typeof PRESETS)[number]['settings']): string[] {
	const accent = ACCENTS[preset.accent];
	const isDark = preset.mode === 'dark';
	const surface = { black: '#000', dim: '#2a2a2e', default: '#18181b' }[preset.darkSurface ?? 'default'];
	return [isDark ? accent.dark : accent.light, TONES[preset.tone].swatch, isDark ? surface : '#fafafa'];
}

function optionsOf<Key extends string, Value>(
	record: Record<Key, Value>,
	getLabel: (value: Value) => string,
): [Key, string][] {
	return (Object.entries(record) as [Key, Value][]).map(([key, value]) => [key, getLabel(value)]);
}

function SyncBadge({ state }: { state: ThemeSyncState }) {
	const { icon: Icon, text, className } = SYNC_BADGES[state];

	return (
		<p className={cn('flex items-center gap-1.5 text-xs', className)}>
			<Icon className={cn('size-3.5', state === 'saving' && 'animate-spin')} />
			{text}
		</p>
	);
}

const SYNC_BADGES = {
	local: { icon: HardDrive, text: 'Saved in this browser only', className: 'text-muted-foreground' },
	saving: { icon: Loader2, text: 'Saving to your account…', className: 'text-muted-foreground' },
	saved: { icon: Cloud, text: 'Saved to your account', className: 'text-emerald-600 dark:text-emerald-400' },
	error: { icon: Cloud, text: "Couldn't save to your account, kept in this browser", className: 'text-destructive' },
};

function Group({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
	return (
		<div className='flex min-w-0 flex-col gap-2'>
			<div className='flex min-h-7 items-center justify-between gap-2'>
				<span className='text-sm font-medium text-foreground'>{label}</span>
				{action}
			</div>
			{children}
		</div>
	);
}

function Choice({
	isActive,
	onClick,
	className,
	children,
}: {
	isActive: boolean;
	onClick: () => void;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			aria-pressed={isActive}
			className={cn(
				'relative flex min-w-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border px-3 py-2 text-sm transition-colors',
				isActive ? 'border-primary bg-primary/8 text-primary' : 'hover:bg-muted',
				className,
			)}
		>
			{children}
			{isActive && <Check className='absolute right-1 top-1 size-3 text-primary' />}
		</button>
	);
}

function Segmented<Value extends string>({
	value,
	onChange,
	options,
}: {
	value: Value;
	onChange: (value: Value) => void;
	options: readonly (readonly [Value, string])[];
}) {
	return (
		<div
			className='grid rounded-lg bg-muted p-[3px]'
			style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
		>
			{options.map(([optionValue, label]) => (
				<button
					key={optionValue}
					type='button'
					aria-pressed={value === optionValue}
					onClick={() => onChange(optionValue)}
					className={cn(
						'min-w-0 cursor-pointer truncate rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
						value === optionValue
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground',
					)}
				>
					{label}
				</button>
			))}
		</div>
	);
}

function SwitchRow({
	label,
	hint,
	checked,
	onChange,
	disabled,
}: {
	label: string;
	hint: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
			<span>
				<span className='block text-sm font-medium text-foreground'>{label}</span>
				<span className='block text-xs text-muted-foreground'>{hint}</span>
			</span>
			<Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
		</div>
	);
}

function SidebarPreview({
	variant,
	isRight,
}: {
	variant: ThemeCustomizerSettings['sidebarVariant'];
	isRight: boolean;
}) {
	return (
		<span
			className={cn(
				'flex h-10 w-14 gap-1 overflow-hidden rounded-md bg-muted',
				variant !== 'sidebar' && 'p-1',
				isRight && 'flex-row-reverse',
			)}
		>
			<span
				className={cn(
					'w-3.5 bg-foreground/25',
					variant === 'floating' && 'rounded-sm',
					variant === 'sidebar' && 'h-full',
				)}
			/>
			<span
				className={cn(
					'flex-1 bg-background',
					variant === 'inset' && 'rounded-sm shadow-xs',
					variant === 'sidebar' && 'my-1 rounded-sm',
					variant === 'sidebar' && (isRight ? 'ml-1' : 'mr-1'),
				)}
			/>
		</span>
	);
}

function NavActivePreview({ style }: { style: ThemeCustomizerSettings['navActive'] }) {
	return (
		<span className='flex h-10 w-14 flex-col justify-center gap-1 rounded-md bg-muted px-1.5'>
			<span className='h-1.5 w-8 rounded-full bg-foreground/15' />
			<span
				className={cn(
					'flex h-2.5 items-center rounded-sm px-1',
					style === 'soft' && 'bg-primary/20',
					style === 'solid' && 'bg-primary',
					style === 'bar' && 'rounded-none border-l-2 border-primary',
				)}
			>
				<span
					className={cn(
						'h-1 w-6 rounded-full',
						style === 'solid' ? 'bg-primary-foreground/80' : 'bg-primary',
					)}
				/>
			</span>
			<span className='h-1.5 w-7 rounded-full bg-foreground/15' />
		</span>
	);
}

function WidthPreview({ width }: { width: ThemeCustomizerSettings['contentWidth'] }) {
	return (
		<span className='flex h-10 w-16 items-stretch justify-center rounded-md bg-muted p-1'>
			<span
				className={cn(
					'rounded-sm bg-background',
					width === 'boxed' && 'w-8',
					width === 'wide' && 'w-11',
					width === 'full' && 'w-full',
				)}
			/>
		</span>
	);
}

/** A static bubble; it re-mounts, replaying its entrance, when a setting changes or on click. */
function TooltipPreview({ settings }: { settings: ThemeCustomizerSettings }) {
	const [replay, setReplay] = useState(0);
	const key = [
		settings.tooltipStyle,
		settings.tooltipAnimation,
		settings.tooltipSize,
		settings.tooltipWidth,
		settings.tooltipArrow,
		replay,
	].join();

	return (
		<button
			type='button'
			onClick={() => setReplay((count) => count + 1)}
			aria-label='Replay tooltip preview'
			className='flex w-full cursor-pointer flex-col items-center overflow-hidden rounded-lg border bg-muted/50 px-4 pb-4 pt-5 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:14px_14px]'
		>
			<span key={key} className='app-tooltip app-tooltip-demo text-left' data-side='top'>
				Revenue by region for the last quarter, grouped by month and compared with the same period last year.
				<span className='app-tooltip-arrow' data-side='top' style={{ left: 'calc(50% - 5px)' }} />
			</span>
		</button>
	);
}
