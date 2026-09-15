import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeAll, show, toast } from '../src/index.js';
import { animationsSettled, firstInStage, opened, stageEmpty, wait } from './helpers.js';

afterEach(async () => {
	closeAll();
	await stageEmpty();
});

function panelAnimations(): Animation[] {
	return firstInStage('.nu-panel').getAnimations();
}

describe('motion', () => {
	it('plays the keyframes given in options', async () => {
		const notice = show({
			title: 'Custom',
			animation: { enter: { keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 400 } } },
		});
		await opened();

		const [animation] = panelAnimations();
		expect(animation?.effect?.getTiming().duration).toBe(400);

		notice.close();
		await notice;
	});

	it('runs no animation when animation is false', async () => {
		const notice = show({ title: 'Instant', animation: false });
		await opened();

		expect(panelAnimations()).toHaveLength(0);

		notice.close();
		await expect(notice).resolves.toBeNull();
	});

	it('skips animations when the user prefers reduced motion', async () => {
		vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
			matches: query.includes('prefers-reduced-motion'),
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false,
		} as MediaQueryList));

		const notice = show({ title: 'Calm' });
		await opened();

		expect(panelAnimations()).toHaveLength(0);

		notice.close();
		await expect(notice).resolves.toBeNull();
	});

	it('fades out gradually instead of jumping', async () => {
		const notice = show({ title: 'Fading' });
		await opened();
		await animationsSettled();
		const panel = firstInStage('.nu-panel');

		notice.close();
		await new Promise(resolve => requestAnimationFrame(resolve));
		await new Promise(resolve => requestAnimationFrame(resolve));

		expect(Number.parseFloat(getComputedStyle(panel).opacity)).toBeGreaterThan(0.7);
		await notice;
	});

	it('takes over from the opening animation when closed straight away', async () => {
		const notice = show({ title: 'Interrupted' });
		await opened();
		const panel = firstInStage('.nu-panel');

		await wait(60);
		const midway = Number.parseFloat(getComputedStyle(panel).opacity);
		notice.close();

		const [exit] = panel.getAnimations();
		const effect = exit?.effect;
		const start = effect instanceof KeyframeEffect ? effect.getKeyframes()[0] : undefined;
		expect(Number.parseFloat(String(start?.opacity ?? '1'))).toBeCloseTo(midway, 1);

		await expect(notice).resolves.toBeNull();
		await stageEmpty();
	});

	it('spins the loading icon for as long as the toast is shown', async () => {
		const notice = toast.loading('Working');
		await opened();

		const icon = firstInStage('.nu-icon').firstElementChild;
		const [spinner] = icon?.getAnimations() ?? [];
		expect(spinner?.effect?.getComputedTiming().iterations).toBe(Infinity);

		notice.close();
		await notice;
	});
});
