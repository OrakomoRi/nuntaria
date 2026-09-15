import type { DialogPosition } from '../types.js';
import { backdropMotion, dialogMotion } from '../ui/motions.js';
import { element, setOptionalAttribute } from '../utils/dom.js';
import { deepActiveElement, restoreFocus } from '../utils/focus.js';
import { lockScroll, unlockScroll } from '../utils/scroll-lock.js';
import { BaseNotice, type MotionLayer, type NoticeSettings, type Settler } from './notice.js';
import { markDialogOpened, stageRoot } from './stage.js';

export interface DialogSettings<V> extends NoticeSettings<V> {
	position: DialogPosition;
	backdrop: boolean;
	closeOnEscape: boolean;
	closeOnBackdrop: boolean;
	role: 'dialog' | 'alertdialog';
}

function isModal(dialog: HTMLDialogElement): boolean {
	try {
		return dialog.matches(':modal');
	} catch {
		return false;
	}
}

export class DialogNotice<V> extends BaseNotice<V, DialogSettings<V>> {
	readonly kind = 'dialog';

	private readonly dialog: HTMLDialogElement;
	private previousFocus: Element | null = null;
	private scrollLocked = false;
	private backdropPressed = false;
	private expectedCloses = 0;

	constructor(settings: DialogSettings<V>, onSettle: Settler<V>) {
		super(settings, onSettle, dialogMotion);

		this.dialog = element('dialog', 'nu-dialog', {
			part: 'dialog',
			'data-position': settings.position,
			'aria-modal': 'true',
		});
		setOptionalAttribute(this.dialog, 'role', settings.role === 'alertdialog' ? 'alertdialog' : null);
		setOptionalAttribute(this.dialog, 'data-backdrop', settings.backdrop ? '' : null);
		this.dialog.append(this.panel);
		this.updateLabelling();
	}

	protected get frame(): HTMLElement {
		return this.dialog;
	}

	restore(): void {
		if (this.finished || !this.dialog.isConnected) return;

		if (this.dialog.hasAttribute('data-fallback')) {
			if (!this.dialog.open) this.dialog.show();
			return;
		}

		if (isModal(this.dialog)) return;
		this.closeNatively();
		this.showModal();
	}

	protected override extraLayers(): readonly MotionLayer[] {
		return [{ element: this.dialog, motion: backdropMotion }];
	}

	protected attach(): void {
		this.previousFocus = deepActiveElement();
		stageRoot().append(this.dialog);
		this.showModal();
		markDialogOpened();
		this.scrollLocked = lockScroll();

		this.listen<Event>(this.dialog, 'cancel', event => {
			event.preventDefault();
			this.requestEscape();
		});
		this.listen(this.dialog, 'close', () => this.handleNativeClose());
		this.listen<PointerEvent>(this.dialog, 'pointerdown', event => {
			this.backdropPressed = event.target === this.dialog;
		});
		this.listen<MouseEvent>(this.dialog, 'click', event => {
			const pressed = this.backdropPressed;
			this.backdropPressed = false;
			if (pressed && event.target === this.dialog && this.settings.closeOnBackdrop && !this.busy) this.close(null, 'backdrop');
		});
	}

	protected detach(): void {
		const active = deepActiveElement();
		const keptFocus = !active || active === document.body || active === document.documentElement || this.dialog.contains(active);

		this.closeNatively();
		this.dialog.remove();

		if (this.scrollLocked) {
			this.scrollLocked = false;
			unlockScroll();
		}

		if (keptFocus) restoreFocus(this.previousFocus);
	}

	protected override handleKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		this.requestEscape();
	}

	protected override contentChanged(): void {
		this.updateLabelling();
	}

	private updateLabelling(): void {
		const { title, text } = this.settings;
		setOptionalAttribute(this.dialog, 'aria-labelledby', title ? this.titleElement.id : null);
		setOptionalAttribute(this.dialog, 'aria-describedby', title && text ? this.textElement.id : null);
		setOptionalAttribute(this.dialog, 'aria-label', !title && text ? text : null);
	}

	private showModal(): void {
		try {
			this.dialog.showModal();
		} catch {
			this.dialog.setAttribute('data-fallback', '');
			this.dialog.show();
		}
	}

	private closeNatively(): void {
		if (!this.dialog.open) return;
		this.expectedCloses += 1;
		this.dialog.close();
	}

	private requestEscape(): void {
		if (this.settings.closeOnEscape && !this.busy) this.close(null, 'escape');
	}

	private handleNativeClose(): void {
		if (this.expectedCloses > 0) {
			this.expectedCloses -= 1;
			return;
		}

		if (this.finished) return;

		if (this.settings.closeOnEscape && !this.busy) {
			this.close(null, 'escape');
			return;
		}

		this.showModal();
	}
}
