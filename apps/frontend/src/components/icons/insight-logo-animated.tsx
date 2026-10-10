import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

type InsightLogoAnimatedProps = {
	className?: string;
	style?: CSSProperties;
	width?: number | string;
	height?: number | string;
	durationSeconds?: number;
	loop?: boolean;
	title?: string;
	color?: string;
};

/** Defaults to the live brand color so the loading logo follows white-label theming. */
const DEFAULT_LOGO_COLOR = 'var(--violet)';

const BARS = [
	{ x: 38, top: 34, delay: 0 },
	{ x: 51.5, top: 24, delay: 0.12 },
	{ x: 65, top: 14, delay: 0.24 },
];
const BASELINE = 50;

/** The Insight mark with its three bars rising, used as the loading indicator. */
export default function InsightLogoAnimated({
	className,
	style,
	width = 112,
	height = 65,
	durationSeconds = 1.617,
	loop = true,
	title = 'Insight',
	color = DEFAULT_LOGO_COLOR,
}: InsightLogoAnimatedProps) {
	const reducedMotion = usePrefersReducedMotion();
	const dur = `${durationSeconds}s`;
	const repeatCount = loop ? 'indefinite' : 1;

	return (
		<svg
			width={width}
			height={height}
			viewBox='0 0 112 65'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			style={style}
			role='img'
			aria-label={title}
		>
			<title>{title}</title>
			<rect x='24' y='0.5' width='64' height='64' rx='14' fill={color} />
			{BARS.map((bar) => {
				const fullHeight = BASELINE - bar.top;
				return (
					<rect key={bar.x} x={bar.x} y={bar.top} width='9' height={fullHeight} rx='2.5' fill='white'>
						{!reducedMotion && (
							<>
								<animate
									attributeName='height'
									values={`2;${fullHeight};${fullHeight};2`}
									keyTimes='0;0.45;0.8;1'
									begin={`${bar.delay}s`}
									dur={dur}
									repeatCount={repeatCount}
									fill='freeze'
								/>
								<animate
									attributeName='y'
									values={`${BASELINE - 2};${bar.top};${bar.top};${BASELINE - 2}`}
									keyTimes='0;0.45;0.8;1'
									begin={`${bar.delay}s`}
									dur={dur}
									repeatCount={repeatCount}
									fill='freeze'
								/>
							</>
						)}
					</rect>
				);
			})}
		</svg>
	);
}

function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
		if (!query) {
			return;
		}
		setReduced(query.matches);
		const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	}, []);
	return reduced;
}
