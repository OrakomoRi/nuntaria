import type { Motion } from '../types.js';

const RESERVED = new Set(['composite', 'easing', 'offset']);

function cssName(property: string): string {
	return property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

export function prefersReducedMotion(): boolean {
	return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function play(element: Element, motion: Motion | false | undefined, fill: FillMode): Animation | null {
	if (!motion || prefersReducedMotion()) return null;
	return element.animate(motion.keyframes, { duration: 200, easing: 'ease', ...motion.options, fill });
}

export function snapshot(element: Element, motion: Motion | false | undefined): Keyframe | null {
	const [first] = motion ? motion.keyframes : [];
	if (!first) return null;

	const style = getComputedStyle(element);
	const frame: Keyframe = {};
	for (const property of Object.keys(first)) {
		if (RESERVED.has(property)) continue;
		frame[property] = style.getPropertyValue(cssName(property));
	}
	return frame;
}

export function playFrom(element: Element, motion: Motion | false | undefined, start: Keyframe | null): Animation | null {
	if (!motion) return null;
	const [, ...rest] = motion.keyframes;
	const keyframes = start ? [start, ...rest] : motion.keyframes;
	return play(element, { keyframes, options: motion.options }, 'forwards');
}

export async function awaitAll(animations: readonly Animation[]): Promise<void> {
	await Promise.allSettled(animations.map(animation => animation.finished));
}

export function spin(element: Element, duration: number): Animation | null {
	if (prefersReducedMotion()) return null;
	return element.animate(
		[{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
		{ duration, iterations: Infinity, easing: 'linear' },
	);
}
