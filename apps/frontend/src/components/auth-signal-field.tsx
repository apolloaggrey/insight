import { useEffect, useRef } from 'react';

const DOT_SPACING = 20;
const SCATTER = 14;
const LENS_RADIUS = 300;
const LENS_EASING = 0.05;
const FORM_SIDE_RATIO = 0.5;

interface Dot {
	gridX: number;
	gridY: number;
	noiseX: number;
	noiseY: number;
	restingAlpha: number;
}

interface Point {
	x: number;
	y: number;
}

/**
 * Scattered dots that snap into a rippling grid under a drifting lens, which follows the pointer
 * while it is over the open side of the page.
 */
export function AuthSignalField({ color }: { color: string }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext('2d');
		if (!canvas || !context) {
			return;
		}

		let dots: Dot[] = [];
		let pointer: Point | null = null;
		let animationFrame = 0;
		const lens = driftPosition(canvas, 0);

		const resize = () => {
			const pixelRatio = window.devicePixelRatio || 1;
			canvas.width = canvas.clientWidth * pixelRatio;
			canvas.height = canvas.clientHeight * pixelRatio;
			context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
			dots = createDots(canvas.clientWidth, canvas.clientHeight);
		};

		const render = (time: number) => {
			const target = pointer ?? driftPosition(canvas, time);
			lens.x += (target.x - lens.x) * LENS_EASING;
			lens.y += (target.y - lens.y) * LENS_EASING;
			drawField(context, canvas, dots, lens, time, color);
		};

		const loop = (time: number) => {
			render(time);
			animationFrame = requestAnimationFrame(loop);
		};

		const handlePointerMove = (event: PointerEvent) => {
			const isOverOpenSide = event.clientX > window.innerWidth * FORM_SIDE_RATIO;
			pointer = isOverOpenSide ? { x: event.clientX, y: event.clientY } : null;
		};

		resize();
		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(canvas);

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			render(0);
			return () => resizeObserver.disconnect();
		}

		window.addEventListener('pointermove', handlePointerMove);
		animationFrame = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(animationFrame);
			window.removeEventListener('pointermove', handlePointerMove);
			resizeObserver.disconnect();
		};
	}, [color]);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden='true'
			className='pointer-events-none absolute inset-0 hidden size-full [mask-image:linear-gradient(to_right,transparent_38%,black_62%)] lg:block'
		/>
	);
}

function createDots(width: number, height: number): Dot[] {
	const dots: Dot[] = [];
	for (let gridY = 0; gridY <= height; gridY += DOT_SPACING) {
		for (let gridX = 0; gridX <= width; gridX += DOT_SPACING) {
			dots.push({
				gridX,
				gridY,
				noiseX: (Math.random() - 0.5) * SCATTER * 2,
				noiseY: (Math.random() - 0.5) * SCATTER * 2,
				restingAlpha: 0.08 + Math.random() * 0.16,
			});
		}
	}
	return dots;
}

function driftPosition(canvas: HTMLCanvasElement, time: number): Point {
	const seconds = time / 1000;
	return {
		x: canvas.clientWidth * (0.75 + 0.15 * Math.sin(seconds * 0.23)),
		y: canvas.clientHeight * (0.5 + 0.3 * Math.sin(seconds * 0.31 + 1)),
	};
}

function drawField(
	context: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	dots: Dot[],
	lens: Point,
	time: number,
	color: string,
) {
	context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
	context.fillStyle = color;

	for (const dot of dots) {
		const focus = lensFocus(Math.hypot(dot.gridX - lens.x, dot.gridY - lens.y));
		const ripple = 0.5 + 0.5 * Math.sin(dot.gridX * 0.025 + dot.gridY * 0.018 - time * 0.0012);

		context.globalAlpha = dot.restingAlpha + (0.95 - dot.restingAlpha) * focus * (0.35 + 0.65 * ripple);
		context.beginPath();
		context.arc(
			dot.gridX + dot.noiseX * (1 - focus),
			dot.gridY + dot.noiseY * (1 - focus),
			1 + focus * ripple * 3.5,
			0,
			Math.PI * 2,
		);
		context.fill();
	}
}

function lensFocus(distanceFromLens: number): number {
	const closeness = Math.max(0, 1 - distanceFromLens / LENS_RADIUS);
	return closeness * closeness * (3 - 2 * closeness);
}
