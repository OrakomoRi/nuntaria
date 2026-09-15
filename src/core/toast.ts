import type { CloseReason, ToastPosition } from '../types.js';
import { swipeBackMotion, swipeOutMotion, toastMotion } from '../ui/motions.js';
import { INTERACTIVE, setOptionalAttribute } from '../utils/dom.js';
import { enableSwipe } from '../utils/swipe.js';
import { BaseNotice, type NoticeSettings, type Settler } from './notice.js';
import { acquireRegion, releaseRegion, restoreRegion } from './stage.js';

export interface ToastSettings<V> extends NoticeSettings<V> {
	position: ToastPosition;
	closeOnClick: boolean;
	swipe: boolean;
	limit: number;
}

interface QueuedToast {
	readonly active: boolean;
	dismiss(reason: CloseReason): void;
}

const queues = new Map<ToastPosition, QueuedToast[]>();
const pending = new Set<ToastPosition>();

export class ToastNotice<V> extends BaseNotice<V, ToastSettings<V>> {
	readonly kind = 'toast';

	private deferred = false;

	constructor(settings: ToastSettings<V>, onSettle: Settler<V>) {
		super(settings, onSettle, toastMotion(settings.position));
		this.panel.classList.add('nu-toast');
		this.panel.setAttribute('part', 'panel toast');
		this.panel.setAttribute('aria-atomic', 'true');
		this.updateRole();
	}

	protected get frame(): HTMLElement {
		return this.panel;
	}

	restore(): void {
		restoreRegion(this.settings.position);
	}

	protected override whenVisible(run: () => void): void {
		if (this.deferred) requestAnimationFrame(run);
		else run();
	}

	protected attach(): void {
		const { position, labels, limit, closeOnClick, swipe } = this.settings;

		const queue = queues.get(position) ?? [];
		queues.set(position, queue);
		queue.push(this);

		const { element: region, created } = acquireRegion(position, labels.notifications);
		const insert = () => {
			if (this.finished) return;
			if (position.startsWith('top')) region.prepend(this.panel);
			else region.append(this.panel);
		};

		this.deferred = created || pending.has(position);
		if (this.deferred) {
			pending.add(position);
			requestAnimationFrame(() => {
				pending.delete(position);
				insert();
			});
		} else {
			insert();
		}

		const visible = queue.filter(toast => toast.active);
		for (const toast of visible.slice(0, Math.max(0, visible.length - limit))) toast.dismiss('limit');

		if (closeOnClick) {
			this.listen<MouseEvent>(this.panel, 'click', event => {
				if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
				this.close(null, 'click');
			});
		}

		if (swipe) this.addCleanup(enableSwipe(this.panel, this.swipeHandlers()));
	}

	protected detach(): void {
		const { position } = this.settings;
		const queue = queues.get(position);

		if (queue) {
			const index = queue.indexOf(this);
			if (index !== -1) queue.splice(index, 1);
			if (queue.length === 0) queues.delete(position);
		}

		this.panel.remove();
		if (!queues.has(position)) releaseRegion(position);
	}

	protected override handleKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		this.close(null, 'escape');
	}

	protected override contentChanged(): void {
		this.updateRole();
	}

	private swipeHandlers() {
		return {
			start: () => this.pause('swipe'),
			cancel: (offset: number) => {
				this.resume('swipe');
				this.panel.style.removeProperty('transform');
				this.animate(swipeBackMotion(offset), 'backwards');
			},
			dismiss: (offset: number, direction: 'left' | 'right') => {
				this.setExitMotion(swipeOutMotion(offset, direction));
				this.close(null, 'swipe');
			},
		};
	}

	private updateRole(): void {
		setOptionalAttribute(this.panel, 'role', this.settings.type === 'error' ? 'alert' : null);
	}
}
