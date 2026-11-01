import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

function TooltipProvider({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return <TooltipPrimitive.Provider data-slot='tooltip-provider' {...props} />;
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
	return <TooltipPrimitive.Root data-slot='tooltip' {...props} />;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return <TooltipPrimitive.Trigger data-slot='tooltip-trigger' {...props} />;
}

const TooltipContent = React.forwardRef<
	React.ElementRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, children, ...props }, ref) => (
	<TooltipPrimitive.Portal>
		<TooltipPrimitive.Content
			ref={ref}
			data-slot='tooltip-content'
			sideOffset={sideOffset}
			className={cn('app-tooltip z-50 w-fit origin-(--radix-tooltip-content-transform-origin)', className)}
			{...props}
		>
			{children}
			{document.documentElement.dataset.tooltipArrow === 'on' && (
				<TooltipPrimitive.Arrow width={12} height={6} className='app-tooltip-svg-arrow' />
			)}
		</TooltipPrimitive.Content>
	</TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

function SimpleTooltip({
	content,
	children,
	side,
	align,
}: {
	content: React.ReactNode;
	children: React.ReactNode;
	side?: React.ComponentProps<typeof TooltipContent>['side'];
	align?: React.ComponentProps<typeof TooltipContent>['align'];
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side={side} align={align}>
				{content}
			</TooltipContent>
		</Tooltip>
	);
}

export { SimpleTooltip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
