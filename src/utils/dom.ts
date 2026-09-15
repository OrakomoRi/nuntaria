export const INTERACTIVE = 'a, button, input, select, textarea, [contenteditable]';

let lastId = 0;

export function uniqueId(prefix: string): string {
	lastId += 1;
	return `${prefix}-${lastId}`;
}

export function element<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className: string,
	attributes: Readonly<Record<string, string>> = {},
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	node.className = className;
	for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
	return node;
}

export function setOptionalAttribute(node: Element, name: string, value: string | null | undefined): void {
	if (value === null || value === undefined) node.removeAttribute(name);
	else node.setAttribute(name, value);
}

export function classNames(value: string | null | undefined): string[] {
	return value ? value.split(/\s+/).filter(Boolean) : [];
}

export function containsPoint(rect: DOMRect, point: { readonly x: number; readonly y: number }): boolean {
	return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}
