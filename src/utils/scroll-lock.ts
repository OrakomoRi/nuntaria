const COUNT = 'data-nuntaria-scroll-lock';
const OVERFLOW = 'data-nuntaria-overflow';
const PADDING = 'data-nuntaria-padding';
const SIDE = 'data-nuntaria-padding-side';

type PaddingSide = 'paddingLeft' | 'paddingRight';

export function lockScroll(): boolean {
	const { documentElement: root, body } = document;
	if (!body) return false;

	const count = Number(root.getAttribute(COUNT)) || 0;
	root.setAttribute(COUNT, String(count + 1));
	if (count > 0) return true;

	const side: PaddingSide = getComputedStyle(root).direction === 'rtl' ? 'paddingLeft' : 'paddingRight';
	const scrollbar = window.innerWidth - root.clientWidth;

	root.setAttribute(OVERFLOW, body.style.overflow);
	root.setAttribute(PADDING, body.style[side]);
	root.setAttribute(SIDE, side);

	if (scrollbar > 0) {
		const padding = Number.parseFloat(getComputedStyle(body)[side]) || 0;
		body.style[side] = `${padding + scrollbar}px`;
	}
	body.style.overflow = 'hidden';

	return true;
}

export function unlockScroll(): void {
	const { documentElement: root, body } = document;
	const count = Number(root.getAttribute(COUNT)) || 0;
	if (count === 0) return;

	if (count > 1) {
		root.setAttribute(COUNT, String(count - 1));
		return;
	}

	if (body) {
		const side: PaddingSide = root.getAttribute(SIDE) === 'paddingLeft' ? 'paddingLeft' : 'paddingRight';
		body.style.overflow = root.getAttribute(OVERFLOW) ?? '';
		body.style[side] = root.getAttribute(PADDING) ?? '';
	}

	for (const attribute of [COUNT, OVERFLOW, PADDING, SIDE]) root.removeAttribute(attribute);
}
