import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ThemeCustomizerSettings } from '@/lib/theme-customizer';
import { TOOLTIP_DELAYS } from '@/lib/theme-customizer';

const SKIP_SELECTOR =
	"input, textarea, select, [contenteditable]:not([contenteditable='false']), [data-no-truncate-tip], [data-slot='tooltip-content']";
const MAX_ANCESTOR_DEPTH = 6;
const WARM_WINDOW_MS = 300;

/**
 * App-wide "show the full text" tooltip: any element cut off with an ellipsis or line clamp reveals its full text
 * on hover or keyboard focus, with no per-component wiring. Opt out with `data-no-truncate-tip`.
 */
export function TruncationTooltip({
	enabled,
	delay,
}: {
	enabled: boolean;
	delay: ThemeCustomizerSettings['tooltipDelay'];
}) {
	const [tip, setTip] = useState<{ anchor: HTMLElement; text: string } | null>(null);
	const delayMs = (TOOLTIP_DELAYS[delay] ?? TOOLTIP_DELAYS.normal).value;

	useEffect(() => {
		if (!enabled) {
			return;
		}
		let current: HTMLElement | null = null;
		let isShown = false;
		let warmUntil = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		// A native `title` would pop up on top of ours, so park it while the element is hovered.
		let parkedTitle: { element: Element; title: string } | null = null;

		const restoreTitle = () => {
			parkedTitle?.element.setAttribute('title', parkedTitle.title);
			parkedTitle = null;
		};
		const hide = () => {
			clearTimeout(timer);
			restoreTitle();
			current = null;
			if (!isShown) {
				return;
			}
			isShown = false;
			warmUntil = Date.now() + WARM_WINDOW_MS;
			setTip(null);
		};
		const show = (element: HTMLElement) => {
			if (element.closest("[data-slot='tooltip-trigger'][data-state$='open']")) {
				return;
			}
			const text = (element.innerText || element.textContent || '').trim();
			if (!text) {
				return;
			}
			isShown = true;
			setTip({ anchor: element, text });
		};
		const arm = (element: HTMLElement) => {
			clearTimeout(timer);
			restoreTitle();
			current = element;
			const titled = element.closest('[title]');
			if (titled) {
				parkedTitle = { element: titled, title: titled.getAttribute('title') ?? '' };
				titled.removeAttribute('title');
			}
			if (isShown || delayMs === 0 || Date.now() < warmUntil) {
				show(element);
				return;
			}
			timer = setTimeout(() => {
				if (current === element) {
					show(element);
				}
			}, delayMs);
		};

		const onPointerOver = (event: PointerEvent) => {
			if (event.pointerType === 'touch') {
				return;
			}
			const element = truncatedAncestor(event.target);
			if (element === current) {
				return;
			}
			if (element) {
				arm(element);
			} else {
				hide();
			}
		};
		const onPointerOut = (event: PointerEvent) => {
			if (!event.relatedTarget) {
				hide();
			}
		};
		const onFocusIn = (event: FocusEvent) => {
			const target = event.target;
			if (!(target instanceof Element) || !target.matches(':focus-visible')) {
				return;
			}
			const element = truncatedDescendant(target);
			if (element && element !== current) {
				arm(element);
			}
		};
		const onFocusOut = (event: FocusEvent) => {
			if (current && event.target instanceof Node && event.target.contains(current)) {
				hide();
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				hide();
			}
		};

		document.addEventListener('pointerover', onPointerOver);
		document.addEventListener('pointerout', onPointerOut);
		document.addEventListener('pointerdown', hide, true);
		document.addEventListener('wheel', hide, { capture: true, passive: true });
		document.addEventListener('scroll', hide, true);
		document.addEventListener('focusin', onFocusIn);
		document.addEventListener('focusout', onFocusOut);
		document.addEventListener('keydown', onKeyDown);
		window.addEventListener('blur', hide);
		return () => {
			document.removeEventListener('pointerover', onPointerOver);
			document.removeEventListener('pointerout', onPointerOut);
			document.removeEventListener('pointerdown', hide, true);
			document.removeEventListener('wheel', hide, true);
			document.removeEventListener('scroll', hide, true);
			document.removeEventListener('focusin', onFocusIn);
			document.removeEventListener('focusout', onFocusOut);
			document.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('blur', hide);
			hide();
		};
	}, [enabled, delayMs]);

	if (!enabled || !tip) {
		return null;
	}
	return createPortal(<TipBubble key={tip.text} anchor={tip.anchor} text={tip.text} />, document.body);
}

function isTruncated(element: HTMLElement) {
	if (element.clientWidth < 12) {
		return false;
	}
	const style = getComputedStyle(element);
	const clamp = style.getPropertyValue('-webkit-line-clamp');
	if (clamp && clamp !== 'none') {
		return element.scrollHeight > element.clientHeight;
	}
	return style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth;
}

function truncatedAncestor(target: EventTarget | null): HTMLElement | null {
	let element = target instanceof Element ? target : null;
	if (!element || element.closest(SKIP_SELECTOR)) {
		return null;
	}
	for (let depth = 0; element && depth < MAX_ANCESTOR_DEPTH && element !== document.body; depth++) {
		if (element instanceof HTMLElement && isTruncated(element)) {
			return element;
		}
		element = element.parentElement;
	}
	return null;
}

/** For keyboard focus the clipped text usually sits inside the focused control. */
function truncatedDescendant(root: Element): HTMLElement | null {
	if (root.closest(SKIP_SELECTOR)) {
		return null;
	}
	const candidates = [root, ...Array.from(root.querySelectorAll('*')).slice(0, 40)];
	for (const candidate of candidates) {
		if (candidate instanceof HTMLElement && !candidate.closest(SKIP_SELECTOR) && isTruncated(candidate)) {
			return candidate;
		}
	}
	return null;
}

/** Sits above the clipped element (below if there's no room), kept inside the viewport. */
function TipBubble({ anchor, text }: { anchor: HTMLElement; text: string }) {
	const bubble = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<{
		left: number;
		top: number;
		side: 'top' | 'bottom';
		arrow: number;
	} | null>(null);

	useLayoutEffect(() => {
		if (!bubble.current) {
			return;
		}
		const anchorRect = anchor.getBoundingClientRect();
		const bubbleRect = bubble.current.getBoundingClientRect();
		const gap = 8;
		const side = anchorRect.top - bubbleRect.height - gap >= gap ? 'top' : 'bottom';
		const center = anchorRect.left + Math.min(anchorRect.width, 240) / 2;
		const left = Math.max(gap, Math.min(center - bubbleRect.width / 2, window.innerWidth - bubbleRect.width - gap));
		setPosition({
			left,
			top: side === 'top' ? anchorRect.top - bubbleRect.height - gap : anchorRect.bottom + gap,
			side,
			arrow: Math.max(10, Math.min(center - left - 5, bubbleRect.width - 20)),
		});
	}, [anchor, text]);

	return (
		<div
			ref={bubble}
			data-slot='tooltip-content'
			data-side={position?.side ?? 'top'}
			data-state={position ? 'delayed-open' : undefined}
			className='app-tooltip pointer-events-none fixed z-60 text-left'
			style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}
		>
			<span className='line-clamp-14 whitespace-pre-line'>{text}</span>
			<span
				className='app-tooltip-arrow'
				data-side={position?.side ?? 'top'}
				style={{ left: position?.arrow ?? 0 }}
			/>
		</div>
	);
}
