import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { PanelLeft } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { CommandMenu } from '@/components/command-menu';
import { CloudBillingAccessBanner } from '@/components/cloud-billing-access-banner';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { CommandMenuCallbackProvider, useCommandMenuCallback } from '@/contexts/command-menu-callback';
import { SidebarProvider, useSidebar } from '@/contexts/sidebar';
import { useTheme } from '@/contexts/theme.provider';
import { useThemeCustomizer } from '@/contexts/theme-customizer.provider';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_sidebar-layout')({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<CommandMenuCallbackProvider>
			<SidebarProvider>
				<SidebarLayoutContent />
			</SidebarProvider>
		</CommandMenuCallbackProvider>
	);
}

function SidebarLayoutContent() {
	const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
	const { settings } = useThemeCustomizer();
	const isInset = settings.sidebarVariant === 'inset';
	useCollapsedSidebarPreference(settings.sidebarCollapsed);

	return (
		<div
			className={cn(
				'flex h-full min-w-0 flex-1',
				settings.sidebarSide === 'right' && 'flex-row-reverse',
				isInset && 'md:bg-sidebar',
				isInset && settings.sidebarColor === 'default' && 'dark:md:bg-background',
			)}
		>
			<GlobalShortcuts onOpenKeyboardShortcuts={() => setKeyboardShortcutsOpen(true)} />
			<Sidebar />
			<CommandMenu onOpenKeyboardShortcuts={() => setKeyboardShortcutsOpen(true)} />
			<KeyboardShortcutsDialog open={keyboardShortcutsOpen} onOpenChange={setKeyboardShortcutsOpen} />
			<div
				className={cn(
					'flex min-h-0 min-w-0 flex-1 flex-col',
					isInset && 'md:m-2 md:overflow-hidden md:rounded-xl md:border md:bg-background md:shadow-sm',
				)}
			>
				<AppHeader />
				<CloudBillingAccessBanner />
				<div
					className={cn(
						'flex min-h-0 w-full min-w-0 flex-1',
						settings.contentPadding === 'default' && 'p-1 md:p-2',
						settings.contentPadding === 'comfortable' && 'p-3 md:p-6',
						settings.contentWidth === 'wide' && 'mx-auto max-w-[96rem]',
						settings.contentWidth === 'boxed' && 'mx-auto max-w-7xl',
					)}
				>
					<Outlet />
				</div>
			</div>
			<OffCanvasSidebarButton />
		</div>
	);
}

/** Collapses on load when the preference is on; only expands when it is switched off, so manual collapses stick. */
function useCollapsedSidebarPreference(sidebarCollapsed: boolean) {
	const { collapse, expand } = useSidebar();
	const wasCollapsed = useRef(false);

	useEffect(() => {
		if (sidebarCollapsed) {
			collapse();
		} else if (wasCollapsed.current) {
			expand();
		}
		wasCollapsed.current = sidebarCollapsed;
	}, [sidebarCollapsed, collapse, expand]);
}

/** A fully hidden sidebar takes its own toggle with it, so this keeps a way back on screen. */
function OffCanvasSidebarButton() {
	const { isCollapsed, isMobile, toggle } = useSidebar();
	const { settings } = useThemeCustomizer();

	if (isMobile || !isCollapsed || settings.sidebarCollapsible !== 'offcanvas') {
		return null;
	}
	return (
		<Button
			variant='outline'
			size='icon-sm'
			aria-label='Show sidebar'
			onClick={() => toggle()}
			className={cn('fixed top-2 z-30', settings.sidebarSide === 'right' ? 'right-2' : 'left-2')}
		>
			<PanelLeft />
		</Button>
	);
}

function GlobalShortcuts({ onOpenKeyboardShortcuts }: { onOpenKeyboardShortcuts: () => void }) {
	const navigate = useNavigate();
	const { toggle } = useSidebar();
	const { theme, setTheme } = useTheme();
	const { fire: openCommandMenu } = useCommandMenuCallback();
	const { canStartNewChat } = usePermissions();

	const navigateHome = useCallback(() => navigate({ to: '/' }), [navigate]);
	const navigateStories = useCallback(() => navigate({ to: '/stories', search: { folderId: null } }), [navigate]);
	const toggleTheme = useCallback(() => {
		setTheme(theme === 'light' ? 'dark' : 'light');
	}, [theme, setTheme]);

	useKeyboardShortcuts({
		'toggle-sidebar': toggle,
		'command-menu': openCommandMenu,
		'toggle-theme': toggleTheme,
		'new-chat': canStartNewChat ? navigateHome : undefined,
		'go-to-stories': navigateStories,
		'keyboard-help': onOpenKeyboardShortcuts,
	});

	return null;
}
