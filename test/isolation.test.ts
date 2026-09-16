import { afterEach, describe, expect, it } from 'vitest';
import { addStyles, closeAll, show, toast } from '../src/index.js';
import { animationsSettled, firstInStage, opened, stageEmpty, stageHost } from './helpers.js';

afterEach(async () => {
	closeAll();
	await stageEmpty();
});

describe('isolation', () => {
	it('renders inside a shadow root and leaves nothing behind', async () => {
		const result = show({ title: 'Isolated' });
		await opened();

		expect(stageHost()?.shadowRoot).toBeInstanceOf(ShadowRoot);
		expect('Nuntaria' in window).toBe(false);
		expect('nuntaria' in window).toBe(false);

		closeAll();
		await result;
		await stageEmpty();
	});

	it('adds no styles to the page', async () => {
		const styles = document.querySelectorAll('style, link[rel="stylesheet"]').length;
		const adopted = document.adoptedStyleSheets.length;

		show({ title: 'Styles stay inside' });
		await opened();

		expect(document.querySelectorAll('style, link[rel="stylesheet"]')).toHaveLength(styles);
		expect(document.adoptedStyleSheets).toHaveLength(adopted);
	});

	it('is not restyled by the page', async () => {
		const pageStyle = document.createElement('style');
		pageStyle.textContent = [
			':root { --nu-info: rgb(255, 0, 0); }',
			'* { color: rgb(255, 0, 0) !important; letter-spacing: 10px !important; }',
			'.nu-title { font-size: 99px !important; }',
		].join('\n');
		document.head.append(pageStyle);

		try {
			show({ title: 'Styled', text: 'Body' });
			await opened();

			const title = firstInStage('.nu-title');
			const button = firstInStage('.nu-button');
			expect(Number.parseFloat(getComputedStyle(title).fontSize)).toBeCloseTo(18.24, 1);
			expect(getComputedStyle(title).color).not.toBe('rgb(255, 0, 0)');
			expect(getComputedStyle(title).letterSpacing).toBe('normal');
			expect(getComputedStyle(button).backgroundColor).toBe('rgb(129, 140, 248)');
		} finally {
			pageStyle.remove();
		}
	});

	it('ignores the page root font size', async () => {
		const measure = async (rootSize: string): Promise<void> => {
			document.documentElement.style.fontSize = rootSize;
			const notice = show({ title: 'Untouched' });
			await opened();

			const size = Number.parseFloat(getComputedStyle(firstInStage('.nu-title')).fontSize);
			expect(size, `root font size ${rootSize} changed the title`).toBeCloseTo(18.24, 1);

			notice.close();
			await notice;
			await stageEmpty();
		};

		try {
			await measure('20px');
			await measure('40px');
			await measure('4px');
		} finally {
			document.documentElement.style.removeProperty('font-size');
		}
	});

	it('can be themed from the page through ::part', async () => {
		const pageStyle = document.createElement('style');
		pageStyle.textContent = 'nuntaria-stage::part(title) { text-transform: uppercase; }';
		document.head.append(pageStyle);

		try {
			show({ title: 'parts' });
			await opened();
			expect(getComputedStyle(firstInStage('.nu-title')).textTransform).toBe('uppercase');
		} finally {
			pageStyle.remove();
		}
	});

	it('applies and removes styles added with addStyles', async () => {
		const remove = addStyles('.nu-panel { --nu-info: rgb(1, 2, 3); }');

		show({ title: 'Themed' });
		await opened();
		await animationsSettled();
		expect(getComputedStyle(firstInStage('.nu-button')).backgroundColor).toBe('rgb(1, 2, 3)');

		remove();
		await animationsSettled();
		expect(getComputedStyle(firstInStage('.nu-button')).backgroundColor).toBe('rgb(129, 140, 248)');
	});

	it('builds its markup without assigning HTML strings', async () => {
		const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
		if (!descriptor) throw new Error('innerHTML is not configurable in this browser');

		Object.defineProperty(Element.prototype, 'innerHTML', {
			configurable: true,
			get: descriptor.get,
			set() {
				throw new Error('innerHTML must not be used');
			},
		});

		try {
			show({ title: 'Trusted', type: 'success', closeButton: true });
			await opened();
			toast.error('Also trusted', { duration: 0 });
			await opened(2);
		} finally {
			Object.defineProperty(Element.prototype, 'innerHTML', descriptor);
		}

		expect(firstInStage('.nu-icon').querySelector('svg')).toBeInstanceOf(SVGSVGElement);
	});

	it('follows the page text direction', async () => {
		document.documentElement.dir = 'rtl';

		try {
			show({ title: 'من اليمين' });
			await opened();
			expect(getComputedStyle(firstInStage('.nu-panel')).direction).toBe('rtl');
		} finally {
			document.documentElement.removeAttribute('dir');
		}
	});
});
