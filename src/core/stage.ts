import type { CloseReason, ToastPosition } from '../types.js';
import css from '../ui/styles.css?inline';

export interface StagedNotice {
	readonly kind: 'dialog' | 'toast';
	dismiss(reason: CloseReason): void;
	restore(): void;
}

interface Region {
	readonly element: HTMLElement;
	layer: number;
}

interface StyleEntry {
	readonly text: string;
}

const HOST_TAG = 'nuntaria-stage';

const styleEntries: StyleEntry[] = [];
const sheets = new Map<string, CSSStyleSheet>();
const notices = new Set<StagedNotice>();
const regions = new Map<ToastPosition, Region>();

let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let root: HTMLElement | null = null;
let observer: MutationObserver | null = null;
let pointer: { x: number; y: number } | null = null;
let dialogLayer = 0;

function supportsAdoptedSheets(): boolean {
	return typeof CSSStyleSheet === 'function'
		&& 'replaceSync' in CSSStyleSheet.prototype
		&& 'adoptedStyleSheets' in ShadowRoot.prototype;
}

function supportsPopover(): boolean {
	return typeof HTMLElement.prototype.showPopover === 'function';
}

function sheetFor(text: string): CSSStyleSheet {
	let sheet = sheets.get(text);
	if (!sheet) {
		sheet = new CSSStyleSheet();
		sheet.replaceSync(text);
		sheets.set(text, sheet);
	}
	return sheet;
}

function applyStyles(): void {
	if (!shadow) return;
	const texts = [css, ...styleEntries.map(entry => entry.text)];

	if (supportsAdoptedSheets()) {
		shadow.adoptedStyleSheets = texts.map(sheetFor);
		return;
	}

	for (const node of [...shadow.children]) {
		if (node instanceof HTMLStyleElement) node.remove();
	}
	shadow.prepend(...texts.map(text => {
		const node = document.createElement('style');
		node.textContent = text;
		return node;
	}));
}

export function addStyles(text: string): () => void {
	const entry: StyleEntry = { text };
	styleEntries.push(entry);
	applyStyles();

	return () => {
		const index = styleEntries.indexOf(entry);
		if (index === -1) return;
		styleEntries.splice(index, 1);
		applyStyles();
	};
}

function trackPointer(event: PointerEvent): void {
	pointer = { x: event.clientX, y: event.clientY };
}

export function lastPointer(): { readonly x: number; readonly y: number } | null {
	return pointer;
}

function mountPoint(): HTMLElement {
	return document.body ?? document.documentElement;
}

function watchHost(): void {
	observer?.disconnect();
	const parent = host?.parentNode;
	if (!parent) return;
	observer ??= new MutationObserver(reattach);
	observer.observe(parent, { childList: true });
	if (parent !== document.documentElement) observer.observe(document.documentElement, { childList: true });
}

function reattach(): void {
	if (!host || host.isConnected || notices.size === 0) return;
	mountPoint().append(host);
	watchHost();
	for (const notice of notices) notice.restore();
}

export function stageRoot(): HTMLElement {
	if (!host || !shadow || !root) {
		host = document.createElement(HOST_TAG);
		shadow = host.attachShadow({ mode: 'open' });
		root = document.createElement('div');
		root.className = 'nu-root';
		shadow.append(root);
		applyStyles();
	}

	if (!host.isConnected) {
		mountPoint().append(host);
		watchHost();
		document.addEventListener('pointermove', trackPointer, { capture: true, passive: true });
	}

	return root;
}

export function register(notice: StagedNotice): void {
	notices.add(notice);
}

export function unregister(notice: StagedNotice): void {
	notices.delete(notice);
	if (notices.size > 0) return;

	observer?.disconnect();
	observer = null;
	document.removeEventListener('pointermove', trackPointer, { capture: true });
	pointer = null;
	host?.remove();
	host = null;
	shadow = null;
	root = null;
}

export function closeAll(filter?: 'dialogs' | 'toasts'): void {
	const kind = filter === 'dialogs' ? 'dialog' : filter === 'toasts' ? 'toast' : null;
	for (const notice of [...notices]) {
		if (!kind || notice.kind === kind) notice.dismiss('api');
	}
}

export function markDialogOpened(): void {
	dialogLayer += 1;
}

function raise(region: Region): void {
	if (!supportsPopover()) return;
	const open = region.element.matches(':popover-open');
	if (open && region.layer === dialogLayer) return;
	if (open) region.element.hidePopover();
	region.element.showPopover();
	region.layer = dialogLayer;
}

export function acquireRegion(position: ToastPosition, label: string): { readonly element: HTMLElement; readonly created: boolean } {
	const parent = stageRoot();
	let region = regions.get(position);
	const created = !region;

	if (!region) {
		const element = document.createElement('section');
		element.className = 'nu-region';
		element.setAttribute('part', 'region');
		element.setAttribute('data-position', position);
		element.setAttribute('aria-live', 'polite');
		element.setAttribute('aria-relevant', 'additions text');
		element.setAttribute('aria-label', label);
		if (supportsPopover()) element.setAttribute('popover', 'manual');
		region = { element, layer: -1 };
		regions.set(position, region);
	}

	if (region.element.parentNode !== parent) parent.append(region.element);
	raise(region);
	return { element: region.element, created };
}

export function releaseRegion(position: ToastPosition): void {
	const region = regions.get(position);
	if (!region || region.element.childElementCount > 0) return;
	if (supportsPopover() && region.element.matches(':popover-open')) region.element.hidePopover();
	region.element.remove();
	regions.delete(position);
}

export function restoreRegion(position: ToastPosition): void {
	const region = regions.get(position);
	if (!region?.element.isConnected || !supportsPopover() || region.element.matches(':popover-open')) return;
	region.element.showPopover();
	region.layer = dialogLayer;
}
