import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { closeAll, toast } from '../src/index.js';
import { firstInStage, inStage, opened, pointer, stageEmpty, wait } from './helpers.js';

afterEach(async () => {
	closeAll();
	await stageEmpty();
});

describe('toast', () => {
	it('renders in a live region that leaves the page usable', async () => {
		toast('Saved', { duration: 0 });
		await opened();

		const region = firstInStage('.nu-region');
		expect(region.dataset.position).toBe('top-right');
		expect(region.getAttribute('aria-live')).toBe('polite');
		expect(region.getAttribute('aria-label')).toBe('Notifications');
		expect(getComputedStyle(region).pointerEvents).toBe('none');
		expect(getComputedStyle(firstInStage('.nu-toast')).pointerEvents).toBe('auto');
		expect(document.body.style.overflow).toBe('');
	});

	it('puts the newest toast nearest the edge it grows from', async () => {
		toast('First', { duration: 0 });
		await opened();
		toast('Second', { duration: 0 });
		await opened(2);

		expect(inStage('.nu-region[data-position="top-right"] .nu-title').map(node => node.textContent)).toEqual(['Second', 'First']);

		toast('Bottom first', { duration: 0, position: 'bottom-left' });
		await opened(3);
		toast('Bottom second', { duration: 0, position: 'bottom-left' });
		await opened(4);

		expect(inStage('.nu-region[data-position="bottom-left"] .nu-title').map(node => node.textContent)).toEqual(['Bottom first', 'Bottom second']);
	});

	it('closes the oldest toast when the limit is reached', async () => {
		const reasons: string[] = [];
		const first = toast('1', { duration: 0, onClose: (_value, reason) => reasons.push(reason) });
		await opened();

		for (const index of [2, 3, 4, 5]) toast(String(index), { duration: 0 });
		await opened(5);

		toast('6', { duration: 0 });

		await expect(first).resolves.toBeNull();
		expect(reasons).toEqual(['limit']);
		await vi.waitFor(() => expect(inStage('.nu-toast')).toHaveLength(5));
	});

	it('closes itself when the duration runs out', async () => {
		const reasons: string[] = [];
		const started = performance.now();
		const result = toast('Timed', { duration: 250, pauseOnHover: false, onClose: (_value, reason) => reasons.push(reason) });
		await opened();
		expect(firstInStage('.nu-progress').hidden).toBe(false);

		await expect(result).resolves.toBeNull();
		expect(reasons).toEqual(['timeout']);
		expect(performance.now() - started).toBeGreaterThanOrEqual(250);
	});

	it('pauses the timer while the pointer is over the toast', async () => {
		const result = toast('Hovered', { duration: 300 });
		await opened();
		const panel = firstInStage('.nu-toast');
		const settled = vi.fn();
		void result.then(settled);

		panel.dispatchEvent(new PointerEvent('pointerenter'));
		await wait(600);
		expect(settled).not.toHaveBeenCalled();

		panel.dispatchEvent(new PointerEvent('pointerleave'));
		await expect(result).resolves.toBeNull();
	});

	it('does not start the timer when the toast appears under the pointer', async () => {
		const notice = toast('Under the pointer', { duration: 0 });
		await opened();
		const panel = firstInStage('.nu-toast');
		const box = panel.getBoundingClientRect();
		const settled = vi.fn();
		void notice.then(settled);

		document.dispatchEvent(new PointerEvent('pointermove', {
			bubbles: true,
			clientX: box.left + box.width / 2,
			clientY: box.top + box.height / 2,
		}));
		notice.update({ duration: 300 });

		await wait(600);
		expect(settled).not.toHaveBeenCalled();

		document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 5, clientY: 5 }));

		await expect(notice).resolves.toBeNull();
	});

	it('leaves the progress bar where it was when the toast is closed', async () => {
		const notice = toast('Closing', { duration: 4000, pauseOnHover: false });
		await opened();
		const bar = firstInStage('.nu-progress');
		await wait(600);

		const before = new DOMMatrix(getComputedStyle(bar).transform).a;
		expect(before).toBeLessThan(0.95);

		firstInStage<HTMLButtonElement>('.nu-close').click();
		await new Promise(resolve => requestAnimationFrame(resolve));

		expect(new DOMMatrix(getComputedStyle(bar).transform).a).toBeCloseTo(before, 1);
		await notice;
	});

	it('pauses the timer while the tab is hidden', async () => {
		const result = toast('Background', { duration: 250, pauseOnHover: false });
		await opened();
		const settled = vi.fn();
		void result.then(settled);

		const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
		document.dispatchEvent(new Event('visibilitychange'));
		await wait(500);
		expect(settled).not.toHaveBeenCalled();

		hidden.mockReturnValue(false);
		document.dispatchEvent(new Event('visibilitychange'));
		await expect(result).resolves.toBeNull();
	});

	it('closes from the close button and from a click when closeOnClick is set', async () => {
		const reasons: string[] = [];
		const first = toast('Closable', { duration: 0, onClose: (_value, reason) => reasons.push(reason) });
		await opened();
		firstInStage<HTMLButtonElement>('.nu-close').click();
		await expect(first).resolves.toBeNull();
		await stageEmpty();

		const second = toast('Clickable', { duration: 0, closeOnClick: true, onClose: (_value, reason) => reasons.push(reason) });
		await opened();
		firstInStage('.nu-toast').click();
		await expect(second).resolves.toBeNull();

		expect(reasons).toEqual(['close-button', 'click']);
	});

	it('dismisses on a horizontal swipe', async () => {
		const reasons: string[] = [];
		const result = toast('Swipe me', { duration: 0, onClose: (_value, reason) => reasons.push(reason) });
		await opened();
		const panel = firstInStage('.nu-toast');
		const { top, left } = panel.getBoundingClientRect();

		pointer('pointerdown', panel, { x: left + 20, y: top + 20 });
		pointer('pointermove', panel, { x: left + 50, y: top + 22 });
		pointer('pointermove', panel, { x: left + 120, y: top + 22 });
		pointer('pointerup', panel, { x: left + 120, y: top + 22 });

		await expect(result).resolves.toBeNull();
		expect(reasons).toEqual(['swipe']);
	});

	it('keeps a short vertical drag from dismissing the toast', async () => {
		const result = toast('Scrolled', { duration: 0 });
		await opened();
		const panel = firstInStage('.nu-toast');
		const { top, left } = panel.getBoundingClientRect();
		const settled = vi.fn();
		void result.then(settled);

		pointer('pointerdown', panel, { x: left + 20, y: top + 20 });
		pointer('pointermove', panel, { x: left + 22, y: top + 90 });
		pointer('pointerup', panel, { x: left + 22, y: top + 90 });
		await wait(50);

		expect(settled).not.toHaveBeenCalled();
	});

	it('marks an error toast as an alert and keeps other types polite', async () => {
		toast.error('Broken', { duration: 0 });
		await opened();
		expect(firstInStage('.nu-toast').getAttribute('role')).toBe('alert');
		expect(firstInStage('.nu-panel').dataset.type).toBe('error');

		closeAll();
		await stageEmpty();

		toast.success('Fine', { duration: 0 });
		await opened();
		expect(firstInStage('.nu-toast').getAttribute('role')).toBeNull();
		expect(firstInStage('.nu-panel').dataset.type).toBe('success');
	});

	it('follows a promise from loading to success', async () => {
		let finish!: (value: string) => void;
		const task = new Promise<string>(resolve => {
			finish = resolve;
		});

		const result = toast.promise(task, {
			loading: 'Saving',
			success: value => `Saved ${value}`,
			error: 'Failed',
		});

		await opened();
		expect(firstInStage('.nu-panel').dataset.type).toBe('loading');
		expect(firstInStage('.nu-title').textContent).toBe('Saving');

		finish('twice');
		await expect(result).resolves.toBe('twice');
		await vi.waitFor(() => expect(firstInStage('.nu-title').textContent).toBe('Saved twice'));
		expect(firstInStage('.nu-panel').dataset.type).toBe('success');
	});

	it('shows the error branch of a promise and still rejects', async () => {
		const result = toast.promise(Promise.reject(new Error('nope')), {
			loading: 'Working',
			success: 'Done',
			error: error => `Failed: ${(error as Error).message}`,
		});

		await expect(result).rejects.toThrow('nope');
		await vi.waitFor(() => expect(firstInStage('.nu-title').textContent).toBe('Failed: nope'));
		expect(firstInStage('.nu-panel').dataset.type).toBe('error');
	});

	it('closes on Escape only while the focus is inside the toast', async () => {
		const staying = toast('Stays', { duration: 0 });
		await opened();
		await userEvent.keyboard('{Escape}');
		await wait(50);

		const settled = vi.fn();
		void staying.then(settled);
		expect(settled).not.toHaveBeenCalled();

		firstInStage<HTMLButtonElement>('.nu-close').focus();
		await userEvent.keyboard('{Escape}');

		await expect(staying).resolves.toBeNull();
	});
});
