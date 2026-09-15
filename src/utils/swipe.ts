import { INTERACTIVE } from './dom.js';

const SLOP_PX = 8;
const DISMISS_PX = 64;

export interface SwipeHandlers {
	start(): void;
	cancel(offset: number): void;
	dismiss(offset: number, direction: 'left' | 'right'): void;
}

function capture(target: HTMLElement, pointerId: number): void {
	try {
		target.setPointerCapture(pointerId);
	} catch {
		return;
	}
}

export function enableSwipe(target: HTMLElement, handlers: SwipeHandlers): () => void {
	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let offset = 0;
	let dragging = false;

	const reset = () => {
		pointerId = null;
		dragging = false;
		offset = 0;
	};

	const onDown = (event: PointerEvent) => {
		if (pointerId !== null || event.pointerType === 'mouse' || !event.isPrimary) return;
		if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
		pointerId = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
	};

	const onMove = (event: PointerEvent) => {
		if (event.pointerId !== pointerId) return;
		const deltaX = event.clientX - startX;
		const deltaY = event.clientY - startY;

		if (!dragging) {
			if (Math.abs(deltaX) < SLOP_PX && Math.abs(deltaY) < SLOP_PX) return;
			if (Math.abs(deltaY) > Math.abs(deltaX)) {
				pointerId = null;
				return;
			}
			dragging = true;
			capture(target, event.pointerId);
			handlers.start();
		}

		offset = deltaX;
		target.style.transform = `translateX(${deltaX}px)`;
	};

	const onEnd = (event: PointerEvent) => {
		if (event.pointerId !== pointerId) return;
		const wasDragging = dragging;
		const distance = offset;
		reset();
		if (!wasDragging) return;

		if (event.type === 'pointerup' && Math.abs(distance) >= DISMISS_PX) {
			handlers.dismiss(distance, distance > 0 ? 'right' : 'left');
			return;
		}

		handlers.cancel(distance);
	};

	target.addEventListener('pointerdown', onDown);
	target.addEventListener('pointermove', onMove);
	target.addEventListener('pointerup', onEnd);
	target.addEventListener('pointercancel', onEnd);

	return () => {
		target.removeEventListener('pointerdown', onDown);
		target.removeEventListener('pointermove', onMove);
		target.removeEventListener('pointerup', onEnd);
		target.removeEventListener('pointercancel', onEnd);
		target.style.removeProperty('transform');
		reset();
	};
}
