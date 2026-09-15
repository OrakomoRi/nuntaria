import type { Button, CloseReason, Labels, MotionSet, NoticeChanges, NoticeType, Size, Theme } from '../types.js';
import { createIcon } from '../ui/icons.js';
import { BUTTON_SPINNER_MS, SPINNER_MS } from '../ui/motions.js';
import { classNames, containsPoint, element, setOptionalAttribute, uniqueId } from '../utils/dom.js';
import { awaitAll, play, playFrom, snapshot, spin } from '../utils/motion.js';
import { Countdown } from './countdown.js';
import { lastPointer, register, unregister, type StagedNotice } from './stage.js';

const HOVER_RELEASE_MS = 5000;

export type PauseReason = 'hover' | 'focus' | 'hidden' | 'swipe' | 'busy';

export type Settler<V> = (value: V | null, reason: CloseReason) => void;

export interface MotionLayer {
	readonly element: Element;
	readonly motion: MotionSet;
}

export interface NoticeSettings<V> {
	title: string;
	text: string;
	content: Node | null;
	type: NoticeType | null;
	icon: Node | false | undefined;
	accent: string | null;
	theme: Theme;
	size: Size;
	className: string;
	duration: number;
	pauseOnHover: boolean;
	progress: boolean;
	closeButton: boolean;
	animation: MotionSet | false | null;
	labels: Labels;
	signal: AbortSignal | null;
	buttons: readonly Button<V>[];
}

type State = 'idle' | 'open' | 'closing' | 'closed';

function errorMessage(error: unknown): string | null {
	if (error instanceof Error) return error.message || null;
	return typeof error === 'string' && error ? error : null;
}

export abstract class BaseNotice<V, S extends NoticeSettings<V> = NoticeSettings<V>> implements StagedNotice {
	abstract readonly kind: 'dialog' | 'toast';

	protected readonly settings: S;
	protected readonly panel: HTMLElement;
	protected readonly titleElement: HTMLHeadingElement;
	protected readonly textElement: HTMLParagraphElement;
	protected readonly motion: MotionSet;

	private readonly onSettle: Settler<V>;
	private readonly iconSlot: HTMLElement;
	private readonly contentSlot: HTMLElement;
	private readonly errorElement: HTMLParagraphElement;
	private readonly actions: HTMLElement;
	private readonly progressBar: HTMLElement;
	private readonly buttonNodes = new Map<Button<V>, HTMLButtonElement>();
	private readonly pauses = new Set<PauseReason>();
	private readonly cleanups: Array<() => void> = [];
	private animations: Animation[] = [];
	private exitMotion: MotionSet['exit'] = undefined;
	private iconSpinner: Animation | null = null;
	private state: State = 'idle';
	private countdown: Countdown | null = null;
	private action: AbortController | null = null;

	constructor(settings: S, onSettle: Settler<V>, defaultMotion: MotionSet) {
		this.settings = settings;
		this.onSettle = onSettle;
		this.motion = settings.animation === false ? {} : { ...defaultMotion, ...settings.animation };

		const id = uniqueId('nu');
		this.panel = element('div', ['nu-panel', ...classNames(settings.className)].join(' '), { part: 'panel' });
		this.iconSlot = element('div', 'nu-icon', { part: 'icon', 'aria-hidden': 'true' });
		this.titleElement = element('h2', 'nu-title', { id: `${id}-title`, part: 'title' });
		this.textElement = element('p', 'nu-text', { id: `${id}-text`, part: 'text' });
		this.contentSlot = element('div', 'nu-content', { part: 'content' });
		this.errorElement = element('p', 'nu-error', { id: `${id}-error`, part: 'error', role: 'alert' });
		this.actions = element('div', 'nu-actions', { part: 'actions' });
		this.progressBar = element('div', 'nu-progress', { part: 'progress', 'aria-hidden': 'true' });
		this.errorElement.hidden = true;
		this.progressBar.hidden = true;

		const body = element('div', 'nu-body');
		body.append(this.iconSlot, this.titleElement, this.textElement, this.contentSlot, this.errorElement, this.actions);
		this.panel.append(body, this.progressBar);
		this.panel.setAttribute('data-theme', settings.theme);
		this.panel.setAttribute('data-size', settings.size);
		if (settings.closeButton) {
			this.panel.setAttribute('data-closable', '');
			this.panel.append(this.createCloseButton());
		}

		this.renderText();
		this.renderContent();
		this.renderIcon();
		this.renderButtons();
	}

	get errorId(): string {
		return this.errorElement.id;
	}

	get active(): boolean {
		return this.state === 'open';
	}

	protected get busy(): boolean {
		return this.action !== null;
	}

	protected get finished(): boolean {
		return this.state === 'closing' || this.state === 'closed';
	}

	protected abstract get frame(): HTMLElement;

	protected abstract attach(): void;

	protected abstract detach(): void;

	abstract restore(): void;

	open(): void {
		if (this.state !== 'idle') return;

		if (this.settings.signal?.aborted) {
			this.state = 'closed';
			this.onSettle(null, 'abort');
			return;
		}

		this.state = 'open';
		register(this);
		this.attach();
		this.frame.setAttribute('data-state', 'open');
		this.bind();

		this.whenVisible(() => {
			if (this.state !== 'open') return;
			this.animations = this.layers()
				.map(layer => play(layer.element, layer.motion.enter, 'backwards'))
				.filter((animation): animation is Animation => animation !== null);
			this.startCountdown();
		});
	}

	close(value: V | null, reason: CloseReason): void {
		if (this.finished) return;

		if (this.state === 'idle') {
			this.state = 'closed';
			this.onSettle(value, reason);
			return;
		}

		this.state = 'closing';
		this.action?.abort();
		this.action = null;
		this.countdown?.cancel();
		this.countdown = null;
		void this.animateOut().then(() => this.finish(value, reason));
	}

	dismiss(reason: CloseReason): void {
		this.close(null, reason);
	}

	update(changes: NoticeChanges<V>): void {
		if (this.finished) return;
		const { settings } = this;

		if (changes.title !== undefined) settings.title = changes.title;
		if (changes.text !== undefined) settings.text = changes.text;
		if (changes.title !== undefined || changes.text !== undefined) this.renderText();

		if (changes.content !== undefined) {
			settings.content = changes.content;
			this.renderContent();
		}

		if (changes.type !== undefined || changes.icon !== undefined || changes.accent !== undefined) {
			if (changes.type !== undefined) settings.type = changes.type;
			if (changes.icon !== undefined) settings.icon = changes.icon;
			if (changes.accent !== undefined) settings.accent = changes.accent;
			this.renderIcon();
		}

		if (changes.buttons !== undefined) {
			settings.buttons = changes.buttons;
			this.renderButtons();
		}

		this.contentChanged();

		if (changes.duration !== undefined) {
			settings.duration = changes.duration;
			if (this.state === 'open') this.startCountdown();
		}
	}

	trigger(button: Button<V>): void {
		const node = this.buttonNodes.get(button);
		if (node) void this.activate(button, node);
	}

	clearError(): void {
		this.showError(null);
	}

	protected contentChanged(): void {}

	protected handleKeydown(_event: KeyboardEvent): void {}

	protected extraLayers(): readonly MotionLayer[] {
		return [];
	}

	protected whenVisible(run: () => void): void {
		run();
	}

	protected listen<E extends Event>(target: EventTarget, type: string, handler: (event: E) => void, options?: AddEventListenerOptions): void {
		const listener = handler as EventListener;
		target.addEventListener(type, listener, options);
		this.cleanups.push(() => target.removeEventListener(type, listener, options));
	}

	protected addCleanup(cleanup: () => void): void {
		this.cleanups.push(cleanup);
	}

	protected pause(reason: PauseReason): void {
		this.pauses.add(reason);
		this.syncCountdown();
	}

	protected resume(reason: PauseReason): void {
		this.pauses.delete(reason);
		this.syncCountdown();
	}

	protected animate(motion: MotionSet['enter'], fill: FillMode = 'forwards'): Animation | null {
		const animation = play(this.panel, motion, fill);
		if (animation) this.animations.push(animation);
		return animation;
	}

	protected setExitMotion(motion: MotionSet['exit']): void {
		this.exitMotion = motion;
	}

	private layers(): readonly MotionLayer[] {
		if (this.settings.animation === false) return [];
		const panel: MotionLayer = {
			element: this.panel,
			motion: this.exitMotion === undefined ? this.motion : { ...this.motion, exit: this.exitMotion },
		};
		return [...this.extraLayers(), panel];
	}

	private bind(): void {
		const { panel, frame, settings } = this;

		for (const type of ['keydown', 'keyup', 'keypress']) {
			this.listen<KeyboardEvent>(frame, type, event => {
				event.stopPropagation();
				if (event.type === 'keydown') this.handleKeydown(event);
			});
		}

		if (settings.pauseOnHover) {
			this.listen(panel, 'pointerenter', () => this.pause('hover'));
			this.listen(panel, 'pointerleave', () => this.resume('hover'));
		}

		this.listen(panel, 'focusin', () => this.pause('focus'));
		this.listen<FocusEvent>(panel, 'focusout', event => {
			if (!(event.relatedTarget instanceof Node && panel.contains(event.relatedTarget))) this.resume('focus');
		});

		if (document.hidden) this.pauses.add('hidden');
		this.listen(document, 'visibilitychange', () => {
			if (document.hidden) this.pause('hidden');
			else this.resume('hidden');
		});

		if (settings.signal) this.listen(settings.signal, 'abort', () => this.close(null, 'abort'), { once: true });
	}

	private async animateOut(): Promise<void> {
		const layers = this.layers();
		const starts = layers.map(layer => snapshot(layer.element, layer.motion.exit));

		for (const animation of this.animations) animation.cancel();
		this.frame.setAttribute('data-state', 'closing');

		this.animations = layers
			.map((layer, index) => playFrom(layer.element, layer.motion.exit, starts[index] ?? null))
			.filter((animation): animation is Animation => animation !== null);

		await awaitAll(this.animations);
	}

	private finish(value: V | null, reason: CloseReason): void {
		this.state = 'closed';
		for (const cleanup of this.cleanups.splice(0)) cleanup();
		for (const animation of this.animations) animation.cancel();
		this.animations = [];
		this.iconSpinner?.cancel();
		this.iconSpinner = null;
		this.detach();
		unregister(this);
		this.onSettle(value, reason);
	}

	private startCountdown(): void {
		this.countdown?.cancel();
		this.countdown = null;

		const { duration, progress } = this.settings;
		const visible = duration > 0 && progress;
		this.progressBar.hidden = !visible;
		if (duration <= 0) return;

		if (visible) {
			const rightToLeft = getComputedStyle(this.panel).direction === 'rtl';
			this.progressBar.style.setProperty('--nu-progress-origin', rightToLeft ? 'right center' : 'left center');
		}

		this.countdown = new Countdown(duration, visible ? this.progressBar : null, () => this.close(null, 'timeout'));
		this.pauseWhilePointerInside();
		this.syncCountdown();
	}

	private pauseWhilePointerInside(): void {
		const point = lastPointer();
		if (!this.settings.pauseOnHover || !point || !containsPoint(this.panel.getBoundingClientRect(), point)) return;

		this.pause('hover');

		const release = () => {
			document.removeEventListener('pointermove', onMove, true);
			window.clearTimeout(timer);
		};
		const onMove = (event: PointerEvent) => {
			if (containsPoint(this.panel.getBoundingClientRect(), { x: event.clientX, y: event.clientY })) return;
			release();
			this.resume('hover');
		};

		document.addEventListener('pointermove', onMove, { capture: true, passive: true });
		const timer = window.setTimeout(() => {
			release();
			if (!this.panel.matches(':hover')) this.resume('hover');
		}, HOVER_RELEASE_MS);

		this.addCleanup(release);
	}

	private syncCountdown(): void {
		this.countdown?.run(this.pauses.size === 0);
	}

	private renderText(): void {
		const { title, text } = this.settings;
		this.titleElement.textContent = title;
		this.titleElement.hidden = !title;
		this.textElement.textContent = text;
		this.textElement.hidden = !text;
	}

	private renderContent(): void {
		const { content } = this.settings;
		this.contentSlot.replaceChildren(...(content ? [content] : []));
		this.contentSlot.hidden = !content;
	}

	private renderIcon(): void {
		const { type, icon, accent } = this.settings;

		setOptionalAttribute(this.panel, 'data-type', type);
		if (accent) this.panel.style.setProperty('--nu-accent', accent);
		else this.panel.style.removeProperty('--nu-accent');

		this.iconSpinner?.cancel();
		this.iconSpinner = null;

		const node = icon === false ? null : icon ?? (type ? createIcon(type) : null);
		this.iconSlot.replaceChildren(...(node ? [node] : []));
		this.iconSlot.hidden = !node;

		if (node instanceof Element && type === 'loading' && !icon) this.iconSpinner = spin(node, SPINNER_MS);
	}

	private renderButtons(): void {
		this.buttonNodes.clear();
		const nodes = this.settings.buttons.map(button => {
			const node = this.createButton(button);
			this.buttonNodes.set(button, node);
			return node;
		});
		this.actions.replaceChildren(...nodes);
		this.actions.hidden = nodes.length === 0;
	}

	private createButton(button: Button<V>): HTMLButtonElement {
		const variant = button.variant ?? 'primary';
		const node = element('button', ['nu-button', ...classNames(button.className)].join(' '), {
			type: 'button',
			part: `button button-${variant}`,
			'data-variant': variant,
		});
		node.textContent = button.label;
		if (button.autofocus) node.setAttribute('autofocus', '');
		node.addEventListener('click', () => void this.activate(button, node));
		return node;
	}

	private createCloseButton(): HTMLButtonElement {
		const node = element('button', 'nu-close', {
			type: 'button',
			part: 'close-button',
			'aria-label': this.settings.labels.close,
		});
		node.append(createIcon('close'));
		node.addEventListener('click', () => this.close(null, 'close-button'));
		return node;
	}

	private async activate(button: Button<V>, node: HTMLButtonElement): Promise<void> {
		if (!this.active || this.busy) return;

		if (!button.action) {
			this.close(button.value, 'button');
			return;
		}

		const controller = new AbortController();
		this.action = controller;
		this.setBusy(node, true);
		this.showError(null);

		let keepOpen: boolean;
		try {
			const outcome = await button.action({
				signal: controller.signal,
				setError: message => {
					if (!controller.signal.aborted) this.showError(message);
				},
				close: value => this.close(value === undefined ? button.value : value, 'button'),
			});
			keepOpen = outcome === false;
		} catch (error) {
			keepOpen = true;
			if (!controller.signal.aborted) this.showError(errorMessage(error));
		}

		if (controller.signal.aborted || this.action !== controller) return;

		this.action = null;
		this.setBusy(node, false);
		if (!keepOpen) this.close(button.value, 'button');
	}

	private setBusy(active: HTMLButtonElement, busy: boolean): void {
		for (const node of this.buttonNodes.values()) setOptionalAttribute(node, 'aria-disabled', busy ? 'true' : null);
		setOptionalAttribute(active, 'aria-busy', busy ? 'true' : null);
		setOptionalAttribute(this.panel, 'aria-busy', busy ? 'true' : null);

		const existing = active.querySelector('.nu-spinner');
		existing?.remove();

		if (busy) {
			const spinner = element('span', 'nu-spinner', { part: 'spinner', 'aria-hidden': 'true' });
			active.append(spinner);
			const animation = spin(spinner, BUTTON_SPINNER_MS);
			if (animation) this.addCleanup(() => animation.cancel());
		}

		if (busy) this.pause('busy');
		else this.resume('busy');
	}

	private showError(message: string | null): void {
		this.errorElement.textContent = message ?? '';
		this.errorElement.hidden = !message;
	}
}
