import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { closeAll, confirm, prompt, toast } from '../src/index.js';
import { animationsSettled, opened, stageEmpty, stageHost } from './helpers.js';

const RULES: axe.RunOptions = {
	runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
};

async function violations(): Promise<string[]> {
	await animationsSettled();
	const host = stageHost();
	if (!host) throw new Error('The stage is missing');
	const results = await axe.run(host, RULES);
	return results.violations.flatMap(violation => violation.nodes.map(node =>
		`${violation.id} at ${node.target.flat().join(' ')}: ${node.failureSummary ?? ''}`.replace(/\s+/g, ' ').trim()));
}

afterEach(async () => {
	closeAll();
	await stageEmpty();
});

describe('accessibility', () => {
	it('reports no violations for a confirmation', async () => {
		confirm('Delete this file?', { text: 'It cannot be restored.', danger: true, closeButton: true });
		await opened();

		expect(await violations()).toEqual([]);
	});

	it('reports no violations for a prompt with a label and an error', async () => {
		prompt('Rename', { input: { label: 'New name', required: true, placeholder: 'Name' } });
		await opened();

		expect(await violations()).toEqual([]);
	});

	it('reports no violations for toasts', async () => {
		toast.success('Saved', { duration: 0, text: 'Everything went well.' });
		await opened();
		toast.error('Failed', { duration: 0, text: 'Nothing was saved.', buttons: [{ label: 'Retry', value: 'retry' }] });
		await opened(2);

		expect(await violations()).toEqual([]);
	});
});
