import { expect, vi } from 'vitest';

export function stageHost(): Element | null {
	return document.querySelector('nuntaria-stage');
}

export function stageRoot(): ShadowRoot | null {
	return stageHost()?.shadowRoot ?? null;
}

export function inStage<E extends Element = HTMLElement>(selector: string): E[] {
	return [...(stageRoot()?.querySelectorAll<E>(selector) ?? [])];
}

export function firstInStage<E extends Element = HTMLElement>(selector: string): E {
	const [node] = inStage<E>(selector);
	if (!node) throw new Error(`Nothing matches "${selector}" inside the stage`);
	return node;
}

export function buttonWith(label: string): HTMLButtonElement {
	const node = inStage<HTMLButtonElement>('.nu-button').find(button => button.textContent === label);
	if (!node) throw new Error(`No button labelled "${label}"`);
	return node;
}

export async function opened(count = 1): Promise<HTMLElement[]> {
	return vi.waitFor(() => {
		const open = inStage('[data-state="open"]');
		expect(open).toHaveLength(count);
		return open;
	});
}

export async function stageEmpty(): Promise<void> {
	await vi.waitFor(() => expect(stageHost()).toBeNull(), { timeout: 3000 });
}

export function pressEscape(target: Element): void {
	target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

export function wait(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function runningAnimations(): Animation[] {
	const inStageRoot = [...(stageRoot()?.querySelectorAll('*') ?? [])].flatMap(node => node.getAnimations());
	return [...document.getAnimations(), ...inStageRoot].filter(animation =>
		animation.playState === 'running' && animation.effect?.getComputedTiming().endTime !== Infinity);
}

export async function animationsSettled(): Promise<void> {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		await new Promise(resolve => requestAnimationFrame(resolve));
		const running = runningAnimations();
		if (running.length === 0) return;
		await Promise.allSettled(running.map(animation => animation.finished));
	}
}

export function pointer(type: string, target: Element, position: { x: number; y: number }): void {
	target.dispatchEvent(new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		pointerId: 7,
		pointerType: 'touch',
		isPrimary: true,
		clientX: position.x,
		clientY: position.y,
	}));
}
