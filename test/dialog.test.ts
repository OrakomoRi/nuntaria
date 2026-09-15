import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { closeAll, show } from '../src/index.js';
import { buttonWith, firstInStage, inStage, opened, pressEscape, stageEmpty, stageRoot, wait } from './helpers.js';

afterEach(async () => {
	closeAll();
	await stageEmpty();
	document.body.removeAttribute('style');
});

describe('dialog', () => {
	it('opens a modal dialog and resolves with the value of the clicked button', async () => {
		const result = show({ title: 'Choose', buttons: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] });
		await opened();

		const dialog = firstInStage<HTMLDialogElement>('.nu-dialog');
		expect(dialog.matches(':modal')).toBe(true);
		expect(inStage('.nu-button').map(button => button.textContent)).toEqual(['A', 'B']);

		buttonWith('B').click();

		await expect(result).resolves.toBe('b');
		expect(document.querySelector('nuntaria-stage')).toBeNull();
	});

	it('resolves with null and reports the reason when Escape closes it', async () => {
		const reasons: string[] = [];
		const result = show({ title: 'Escapable', onClose: (_value, reason) => reasons.push(reason) });
		await opened();

		await userEvent.keyboard('{Escape}');

		await expect(result).resolves.toBeNull();
		expect(reasons).toEqual(['escape']);
	});

	it('stays open on Escape when closeOnEscape is false', async () => {
		const result = show({ title: 'Sticky', closeOnEscape: false });
		await opened();
		const settled = vi.fn();
		void result.then(settled);

		await userEvent.keyboard('{Escape}');
		await wait(100);

		expect(settled).not.toHaveBeenCalled();
		expect(firstInStage<HTMLDialogElement>('.nu-dialog').open).toBe(true);
	});

	it('closes on a click that starts and ends on the backdrop', async () => {
		const result = show({ title: 'Backdrop' });
		await opened();
		const dialog = firstInStage<HTMLDialogElement>('.nu-dialog');

		dialog.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		await expect(result).resolves.toBeNull();
	});

	it('keeps open when a drag starts inside the panel and ends on the backdrop', async () => {
		const result = show({ title: 'Drag out' });
		await opened();
		const dialog = firstInStage<HTMLDialogElement>('.nu-dialog');
		const panel = firstInStage('.nu-panel');
		const settled = vi.fn();
		void result.then(settled);

		panel.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await wait(50);

		expect(settled).not.toHaveBeenCalled();
	});

	it('ignores backdrop clicks when closeOnBackdrop is false', async () => {
		const result = show({ title: 'Locked', closeOnBackdrop: false });
		await opened();
		const dialog = firstInStage<HTMLDialogElement>('.nu-dialog');
		const settled = vi.fn();
		void result.then(settled);

		dialog.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await wait(50);

		expect(settled).not.toHaveBeenCalled();
	});

	it('moves focus into the dialog and returns it to the previously focused element', async () => {
		const trigger = document.createElement('button');
		trigger.textContent = 'Open';
		document.body.append(trigger);
		trigger.focus();

		try {
			const result = show({ title: 'Focus' });
			await opened();
			expect(stageRoot()?.activeElement).toBe(buttonWith('OK'));

			buttonWith('OK').click();
			await result;

			expect(document.activeElement).toBe(trigger);
		} finally {
			trigger.remove();
		}
	});

	it('closes only the topmost dialog on Escape', async () => {
		const first = show({ title: 'First' });
		await opened();
		const second = show({ title: 'Second' });
		await opened(2);

		await userEvent.keyboard('{Escape}');
		await expect(second).resolves.toBeNull();
		expect(inStage('.nu-title').map(node => node.textContent)).toEqual(['First']);

		await userEvent.keyboard('{Escape}');
		await expect(first).resolves.toBeNull();
	});

	it('locks page scrolling until the last dialog closes', async () => {
		document.body.style.overflow = 'auto';

		const first = show({ title: 'A' });
		await opened();
		const second = show({ title: 'B' });
		await opened(2);
		expect(document.body.style.overflow).toBe('hidden');

		pressEscape(inStage('.nu-dialog')[1]!);
		await expect(second).resolves.toBeNull();
		expect(document.body.style.overflow).toBe('hidden');

		pressEscape(firstInStage('.nu-dialog'));
		await expect(first).resolves.toBeNull();
		expect(document.body.style.overflow).toBe('auto');
	});

	it('leaves the scroll lock alone while another copy of the library holds it', async () => {
		document.body.style.overflow = 'auto';
		document.documentElement.setAttribute('data-nuntaria-scroll-lock', '1');

		try {
			const result = show({ title: 'Shared lock' });
			await opened();
			expect(document.documentElement.getAttribute('data-nuntaria-scroll-lock')).toBe('2');

			pressEscape(firstInStage('.nu-dialog'));
			await result;

			expect(document.documentElement.getAttribute('data-nuntaria-scroll-lock')).toBe('1');
			expect(document.body.style.overflow).toBe('auto');
		} finally {
			document.documentElement.removeAttribute('data-nuntaria-scroll-lock');
		}
	});

	it('keeps key presses away from the page', async () => {
		const seen: string[] = [];
		const listener = (event: KeyboardEvent) => seen.push(event.key);
		document.addEventListener('keydown', listener);

		try {
			show({ title: 'Quiet' });
			await opened();
			await userEvent.keyboard('abc');
			expect(seen).toEqual([]);
		} finally {
			document.removeEventListener('keydown', listener);
		}
	});

	it('describes itself for assistive technology', async () => {
		show({ title: 'Named', text: 'Described', role: 'alertdialog' });
		await opened();

		const dialog = firstInStage<HTMLDialogElement>('.nu-dialog');
		const title = firstInStage('.nu-title');
		const text = firstInStage('.nu-text');

		expect(dialog.getAttribute('role')).toBe('alertdialog');
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
		expect(dialog.getAttribute('aria-describedby')).toBe(text.id);
	});

	it('closes and updates through the returned handle', async () => {
		const notice = show({ title: 'Before', buttons: [{ label: 'Done', value: 'done' }] });
		await opened();

		notice.update({ title: 'After', text: 'Added' });
		expect(firstInStage('.nu-title').textContent).toBe('After');
		expect(firstInStage('.nu-text').textContent).toBe('Added');

		notice.close('done');
		await expect(notice).resolves.toBe('done');
	});

	it('closes when its abort signal fires and never opens for an aborted signal', async () => {
		const controller = new AbortController();
		const result = show({ title: 'Abortable', signal: controller.signal });
		await opened();

		controller.abort();
		await expect(result).resolves.toBeNull();
		await stageEmpty();

		const already = show({ title: 'Never shown', signal: AbortSignal.abort() });
		await expect(already).resolves.toBeNull();
		expect(document.querySelector('nuntaria-stage')).toBeNull();
	});

	it('runs an async button action with a loading state and keeps the dialog open when it fails', async () => {
		let release: (() => void) | undefined;
		const started = new Promise<void>(resolve => {
			release = resolve;
		});

		const result = show({
			title: 'Save',
			buttons: [{
				label: 'Save',
				value: 'saved',
				action: async ({ setError }) => {
					await started;
					setError('Server refused');
					return false;
				},
			}],
		});
		await opened();

		buttonWith('Save').click();
		await vi.waitFor(() => expect(buttonWith('Save').getAttribute('aria-busy')).toBe('true'));
		expect(buttonWith('Save').getAttribute('aria-disabled')).toBe('true');

		release?.();
		await vi.waitFor(() => expect(firstInStage('.nu-error').textContent).toBe('Server refused'));
		expect(buttonWith('Save').getAttribute('aria-busy')).toBeNull();
		expect(firstInStage<HTMLDialogElement>('.nu-dialog').open).toBe(true);

		const settled = vi.fn();
		void result.then(settled);
		await wait(50);
		expect(settled).not.toHaveBeenCalled();
	});

	it('shows the message of an action that throws', async () => {
		show({
			title: 'Throwing',
			buttons: [{ label: 'Go', value: true, action: () => Promise.reject(new Error('Network down')) }],
		});
		await opened();

		buttonWith('Go').click();

		await vi.waitFor(() => expect(firstInStage('.nu-error').textContent).toBe('Network down'));
		expect(firstInStage<HTMLDialogElement>('.nu-dialog').open).toBe(true);
	});
});
