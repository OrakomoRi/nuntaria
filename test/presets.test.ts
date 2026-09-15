import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { alert, closeAll, confirm, createNuntaria, prompt } from '../src/index.js';
import { buttonWith, firstInStage, inStage, opened, pressEscape, stageEmpty, stageRoot, wait } from './helpers.js';

afterEach(async () => {
	closeAll();
	await stageEmpty();
});

describe('alert', () => {
	it('shows one button, matches the type and resolves when acknowledged', async () => {
		const result = alert('Saved', { type: 'success', text: 'The file is on disk.' });
		await opened();

		expect(firstInStage<HTMLDialogElement>('.nu-dialog').getAttribute('role')).toBe('alertdialog');
		expect(firstInStage('.nu-panel').dataset.type).toBe('success');
		expect(inStage('.nu-button')).toHaveLength(1);
		expect(buttonWith('OK').dataset.variant).toBe('success');

		buttonWith('OK').click();
		await expect(result).resolves.toBeUndefined();
	});

	it('takes everything from a single options object', async () => {
		alert({ title: 'Heads up', okLabel: 'Got it', type: null });
		await opened();

		expect(firstInStage('.nu-title').textContent).toBe('Heads up');
		expect(firstInStage('.nu-icon').hidden).toBe(true);
		expect(buttonWith('Got it')).toBeInstanceOf(HTMLButtonElement);
	});
});

describe('confirm', () => {
	it('resolves true when confirmed and false when cancelled or dismissed', async () => {
		const accepted = confirm('Delete item?', { text: 'This cannot be undone.', danger: true });
		await opened();
		expect(buttonWith('Confirm').dataset.variant).toBe('danger');
		buttonWith('Confirm').click();
		await expect(accepted).resolves.toBe(true);
		await stageEmpty();

		const cancelled = confirm('Delete item?');
		await opened();
		buttonWith('Cancel').click();
		await expect(cancelled).resolves.toBe(false);
		await stageEmpty();

		const dismissed = confirm('Delete item?');
		await opened();
		pressEscape(firstInStage('.nu-dialog'));
		await expect(dismissed).resolves.toBe(false);
	});

	it('waits for an async action before resolving', async () => {
		let finish!: () => void;
		const work = new Promise<void>(resolve => {
			finish = resolve;
		});

		const result = confirm('Publish?', { action: () => work });
		await opened();
		const settled = vi.fn();
		void result.then(settled);

		buttonWith('Confirm').click();
		await vi.waitFor(() => expect(buttonWith('Confirm').getAttribute('aria-busy')).toBe('true'));
		expect(settled).not.toHaveBeenCalled();

		finish();
		await expect(result).resolves.toBe(true);
	});
});

describe('prompt', () => {
	it('focuses the input and resolves with the typed text on Enter', async () => {
		const result = prompt('Your name', { input: { placeholder: 'Name' } });
		await opened();

		const input = firstInStage<HTMLInputElement>('.nu-input');
		expect(stageRoot()?.activeElement).toBe(input);
		expect(input.placeholder).toBe('Name');

		await userEvent.keyboard('Nuntaria{Enter}');

		await expect(result).resolves.toBe('Nuntaria');
	});

	it('resolves with null when cancelled', async () => {
		const result = prompt('Your name');
		await opened();

		buttonWith('Cancel').click();

		await expect(result).resolves.toBeNull();
	});

	it('keeps a backdrop click from throwing away what was typed', async () => {
		const result = prompt('Your name');
		await opened();
		const dialog = firstInStage<HTMLDialogElement>('.nu-dialog');
		const settled = vi.fn();
		void result.then(settled);

		dialog.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await wait(50);

		expect(settled).not.toHaveBeenCalled();
	});

	it('reports an empty required field and clears the message once typing starts', async () => {
		const result = prompt('Your name', { input: { required: true } });
		await opened();
		const input = firstInStage<HTMLInputElement>('.nu-input');

		buttonWith('OK').click();

		await vi.waitFor(() => expect(firstInStage('.nu-error').hidden).toBe(false));
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.getAttribute('aria-describedby')).toBe(firstInStage('.nu-error').id);

		await userEvent.type(input, 'Filled');
		expect(firstInStage('.nu-error').hidden).toBe(true);
		expect(input.getAttribute('aria-invalid')).toBeNull();

		buttonWith('OK').click();
		await expect(result).resolves.toBe('Filled');
	});

	it('runs an async validator and keeps the dialog open while it fails', async () => {
		const result = prompt('Pick a name', {
			input: { value: 'taken' },
			validate: async value => (value === 'taken' ? 'That name is taken.' : null),
		});
		await opened();

		buttonWith('OK').click();
		await vi.waitFor(() => expect(firstInStage('.nu-error').textContent).toBe('That name is taken.'));

		const input = firstInStage<HTMLInputElement>('.nu-input');
		await userEvent.clear(input);
		await userEvent.type(input, 'free');
		buttonWith('OK').click();

		await expect(result).resolves.toBe('free');
	});

	it('submits a textarea only with a modifier key', async () => {
		const result = prompt('Notes', { input: { type: 'textarea' } });
		await opened();
		const input = firstInStage<HTMLTextAreaElement>('.nu-input');
		const settled = vi.fn();
		void result.then(settled);

		await userEvent.type(input, 'first line{Enter}second line');
		expect(settled).not.toHaveBeenCalled();

		await userEvent.keyboard('{Control>}{Enter}{/Control}');

		await expect(result).resolves.toBe('first line\nsecond line');
	});
});

describe('createNuntaria', () => {
	it('applies its own defaults and labels', async () => {
		const custom = createNuntaria({
			theme: 'light',
			size: 'large',
			labels: { ok: 'Ладно', cancel: 'Отмена' },
			toast: { position: 'bottom-center', duration: 0 },
		});

		const dialog = custom.alert('Привет');
		await opened();
		expect(firstInStage('.nu-panel').dataset.theme).toBe('light');
		expect(firstInStage('.nu-panel').dataset.size).toBe('large');
		buttonWith('Ладно').click();
		await dialog;
		await stageEmpty();

		custom.toast('Тост');
		await opened();
		expect(firstInStage('.nu-region').dataset.position).toBe('bottom-center');

		custom.closeAll();
		await stageEmpty();
	});
});
