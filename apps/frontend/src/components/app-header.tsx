import { Link, useMatches } from '@tanstack/react-router';
import { NewspaperIcon, Palette, PlusIcon, SlidersVertical } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ThemeCustomizerSheet } from '@/components/settings/theme-customizer';
import { Button } from '@/components/ui/button';
import StoryIcon from '@/components/ui/story-icon';
import { useThemeCustomizer } from '@/contexts/theme-customizer.provider';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

/** Further than the tallest header, so hiding it can't shrink the page back under the threshold and flicker. */
const HIDE_AFTER_SCROLL_PX = 80;

/** Optional desktop top bar (Theme Customizer → Layout → Top bar). */
export function AppHeader() {
	const { settings } = useThemeCustomizer();
	const header = useRef<HTMLElement>(null);
	const isScrolledAway = useIsScrolledAway(header, settings.showTopBar && !settings.stickyHeader);
	const title = useMatches({
		select: (matches) => [...matches].reverse().find((match) => match.staticData?.title)?.staticData.title,
	});

	if (!settings.showTopBar) {
		return null;
	}

	return (
		<header
			ref={header}
			className={cn(
				'hidden shrink-0 items-center gap-3 overflow-hidden border-b px-4 transition-[height,border-color] duration-200 md:flex',
				isScrolledAway ? 'h-0 border-transparent' : 'h-(--app-header-height)',
				settings.headerStyle === 'blur' && 'bg-background/80 backdrop-blur',
				settings.headerStyle === 'solid' && 'bg-background',
				settings.headerStyle === 'transparent' && 'border-transparent bg-transparent',
			)}
		>
			{title && <h1 className='truncate text-sm font-medium text-foreground'>{title}</h1>}
			<div className='ml-auto flex items-center gap-1'>
				{settings.showQuickLinks && <QuickLinks />}
				<ThemeCustomizerSheet
					trigger={
						<Button variant='ghost' size='icon-sm' aria-label='Theme customizer'>
							<Palette />
						</Button>
					}
				/>
				<Button variant='ghost' size='icon-sm' aria-label='Settings' asChild>
					<Link to='/settings'>
						<SlidersVertical />
					</Link>
				</Button>
			</div>
		</header>
	);
}

function QuickLinks() {
	const { isViewer } = usePermissions();

	return (
		<>
			{!isViewer && (
				<Button variant='ghost' size='sm' asChild>
					<Link to='/'>
						<PlusIcon /> New chat
					</Link>
				</Button>
			)}
			<Button variant='ghost' size='sm' asChild>
				<Link to='/stories' search={{ folderId: null }}>
					<StoryIcon className='size-3.5' /> Stories
				</Link>
			</Button>
			<Button variant='ghost' size='sm' asChild>
				<Link to='/feed'>
					<NewspaperIcon /> Feed
				</Link>
			</Button>
		</>
	);
}

/** Pages scroll inside their own containers, so a non-sticky header listens for scrolling anywhere below it. */
function useIsScrolledAway(header: React.RefObject<HTMLElement | null>, isEnabled: boolean) {
	const [isScrolledAway, setIsScrolledAway] = useState(false);

	useEffect(() => {
		const container = header.current?.parentElement;
		setIsScrolledAway(false);
		if (!isEnabled || !container) {
			return;
		}
		const onScroll = (event: Event) => {
			const scrollTop = event.target instanceof Element ? event.target.scrollTop : 0;
			if (scrollTop > HIDE_AFTER_SCROLL_PX) {
				setIsScrolledAway(true);
			} else if (scrollTop === 0) {
				setIsScrolledAway(false);
			}
		};
		container.addEventListener('scroll', onScroll, true);
		return () => container.removeEventListener('scroll', onScroll, true);
	}, [header, isEnabled]);

	return isScrolledAway;
}
