import type { Motion, MotionSet, ToastPosition } from '../types.js';

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN = 'cubic-bezier(0.32, 0, 0.67, 0)';
const ENTER_MS = 220;
const EXIT_MS = 180;
const SWIPE_MS = 200;

export const SPINNER_MS = 900;
export const BUTTON_SPINNER_MS = 700;

export const backdropMotion: MotionSet = {
	enter: { keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: ENTER_MS, easing: EASE_OUT } },
	exit: { keyframes: [{ opacity: 1 }, { opacity: 0 }], options: { duration: EXIT_MS, easing: EASE_IN } },
};

export const dialogMotion: MotionSet = {
	enter: {
		keyframes: [
			{ opacity: 0, transform: 'scale(0.9) translateY(0.875em)' },
			{ opacity: 1, transform: 'none' },
		],
		options: { duration: ENTER_MS, easing: SPRING },
	},
	exit: {
		keyframes: [
			{ opacity: 1, transform: 'none' },
			{ opacity: 0, transform: 'scale(0.94) translateY(0.375em)' },
		],
		options: { duration: EXIT_MS, easing: EASE_IN },
	},
};

export function toastMotion(position: ToastPosition): MotionSet {
	const offset = position.startsWith('top') ? '-0.75em' : '0.75em';
	return {
		enter: {
			keyframes: [
				{ opacity: 0, transform: `translateY(${offset}) scale(0.96)` },
				{ opacity: 1, transform: 'none' },
			],
			options: { duration: ENTER_MS, easing: SPRING },
		},
		exit: {
			keyframes: [
				{ opacity: 1, transform: 'none' },
				{ opacity: 0, transform: `translateY(${offset}) scale(0.96)` },
			],
			options: { duration: EXIT_MS, easing: EASE_IN },
		},
	};
}

export function swipeOutMotion(offset: number, direction: 'left' | 'right'): Motion {
	return {
		keyframes: [
			{ opacity: 1, transform: `translateX(${offset}px)` },
			{ opacity: 0, transform: `translateX(${direction === 'right' ? '110%' : '-110%'})` },
		],
		options: { duration: EXIT_MS, easing: EASE_OUT },
	};
}

export function swipeBackMotion(offset: number): Motion {
	return {
		keyframes: [{ transform: `translateX(${offset}px)` }, { transform: 'none' }],
		options: { duration: SWIPE_MS, easing: SPRING },
	};
}
