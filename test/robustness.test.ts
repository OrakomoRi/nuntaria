import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeAll, show, toast } from '../src/index.js';
import { firstInStage, inStage, opened, pressEscape, stageEmpty, stageHost, wait } from './helpers.js';

afterEach(async () => {
	closeAll();
	await stageEmpty();
});

describe('robustness', () => {
	it('puts itself back when the page removes the stage', async () => {
		const result = show({ title: 'Survivor' });
		await opened();
		const host = stageHost();
		if (!host) throw new Error('The stage is missing');

		host.remove();

		await vi.waitFor(() => expect(stageHost()).toBe(host));
		const dialog = firstInStage<HTMLDialogElement>('.nu-dialog');
		expect(dialog.open).toBe(true);
		expect(dialog.matches(':modal')).toBe(true);

		pressEscape(dialog);
		await expect(result).resolves.toBeNull();
	});

	it('puts a toast region back in the top layer after the page removes the stage', async () => {
		const result = toast('Survivor', { duration: 0 });
		await opened();
		const host = stageHost();
		if (!host) throw new Error('The stage is missing');

		host.remove();

		await vi.waitFor(() => expect(stageHost()).toBe(host));
		const region = firstInStage('.nu-region');
		if (typeof HTMLElement.prototype.showPopover === 'function') {
			expect(region.matches(':popover-open')).toBe(true);
		}

		firstInStage<HTMLButtonElement>('.nu-close').click();
		await expect(result).resolves.toBeNull();
	});

	it('closes only what the filter names', async () => {
		const dialog = show({ title: 'Dialog' });
		await opened();
		const notice = toast('Toast', { duration: 0 });
		await opened(2);

		closeAll('dialogs');
		await expect(dialog).resolves.toBeNull();
		await vi.waitFor(() => expect(inStage('.nu-toast')).toHaveLength(1));

		closeAll('toasts');
		await expect(notice).resolves.toBeNull();
	});

	it('resolves once when several close paths race', async () => {
		const settled = vi.fn();
		const result = show({ title: 'Once', buttons: [{ label: 'OK', value: 'clicked' }] });
		await opened();
		void result.then(settled);

		firstInStage<HTMLButtonElement>('.nu-button').click();
		pressEscape(firstInStage('.nu-dialog'));
		result.close('clicked');

		await expect(result).resolves.toBe('clicked');
		await wait(400);
		expect(settled).toHaveBeenCalledTimes(1);
	});

	it('resolves and cleans up when closed before it is visible', async () => {
		const result = show({ title: 'Too quick' });
		result.close();

		await expect(result).resolves.toBeNull();
		await stageEmpty();
	});

	it('ignores updates after closing', async () => {
		const notice = toast('Gone', { duration: 0 });
		await opened();

		notice.close();
		await notice;
		notice.update({ title: 'Updated' });

		expect(stageHost()).toBeNull();
	});

	it('keeps several notices of both kinds independent', async () => {
		const first = show({ title: 'First' });
		await opened();
		const second = show({ title: 'Second' });
		await opened(2);
		const notice = toast('Toast', { duration: 0 });
		await opened(3);

		notice.close();
		await notice;
		expect(inStage('.nu-dialog')).toHaveLength(2);

		pressEscape(inStage('.nu-dialog')[1]!);
		await expect(second).resolves.toBeNull();
		pressEscape(firstInStage('.nu-dialog'));
		await expect(first).resolves.toBeNull();
	});
});
