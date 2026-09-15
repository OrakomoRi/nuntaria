export type NoticeType = 'info' | 'success' | 'warning' | 'error' | 'confirm' | 'loading';

export type Theme = 'auto' | 'dark' | 'light' | 'glass';

export type Size = 'small' | 'normal' | 'large';

export type DialogPosition = 'center' | 'top' | 'bottom';

export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type ButtonVariant = 'primary' | 'success' | 'danger' | 'warning' | 'cancel';

export type CloseReason = 'button' | 'escape' | 'backdrop' | 'close-button' | 'click' | 'swipe' | 'timeout' | 'limit' | 'abort' | 'api';

export interface Labels {
	ok: string;
	cancel: string;
	confirm: string;
	close: string;
	required: string;
	notifications: string;
}

export interface ActionContext<T> {
	readonly signal: AbortSignal;
	setError(message: string | null): void;
	close(value?: T): void;
}

export type ButtonAction<T> = (context: ActionContext<T>) => boolean | void | Promise<boolean | void>;

export interface Button<T> {
	label: string;
	value: T;
	variant?: ButtonVariant;
	action?: ButtonAction<T>;
	autofocus?: boolean;
	className?: string;
}

export interface Motion {
	keyframes: Keyframe[];
	options?: KeyframeAnimationOptions;
}

export interface MotionSet {
	enter?: Motion | false;
	exit?: Motion | false;
}

export interface Content {
	title?: string;
	text?: string;
	content?: Node | null;
	type?: NoticeType | null;
	icon?: Node | false;
	accent?: string | null;
}

export interface NoticeChanges<V> extends Content {
	buttons?: readonly Button<V>[];
	duration?: number;
}

export interface CommonOptions<R> extends Content {
	theme?: Theme;
	size?: Size;
	className?: string;
	duration?: number;
	pauseOnHover?: boolean;
	progress?: boolean;
	closeButton?: boolean;
	animation?: MotionSet | false;
	labels?: Partial<Labels>;
	signal?: AbortSignal;
	onClose?: (result: R, reason: CloseReason) => void;
}

export interface DialogBehaviour {
	position?: DialogPosition;
	backdrop?: boolean;
	closeOnEscape?: boolean;
	closeOnBackdrop?: boolean;
}

export interface ToastBehaviour {
	position?: ToastPosition;
	closeOnClick?: boolean;
	swipe?: boolean;
}

export interface DialogOptions<T> extends CommonOptions<T | null>, DialogBehaviour {
	buttons?: readonly Button<T>[];
	role?: 'dialog' | 'alertdialog';
}

export interface AlertOptions extends CommonOptions<void>, DialogBehaviour {
	okLabel?: string;
}

export interface ConfirmOptions extends CommonOptions<boolean>, DialogBehaviour {
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
	action?: ButtonAction<boolean>;
}

export type PromptInputType = 'text' | 'password' | 'email' | 'number' | 'url' | 'tel' | 'search' | 'textarea';

export interface PromptInput {
	type?: PromptInputType;
	value?: string;
	placeholder?: string;
	label?: string;
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	min?: number;
	max?: number;
	step?: number;
	autocomplete?: string;
}

export type PromptValidator = (
	value: string,
	context: { readonly signal: AbortSignal },
) => string | null | undefined | Promise<string | null | undefined>;

export interface PromptOptions extends CommonOptions<string | null>, DialogBehaviour {
	input?: PromptInput;
	validate?: PromptValidator;
	confirmLabel?: string;
	cancelLabel?: string;
}

export interface ToastOptions<T> extends CommonOptions<T | null>, ToastBehaviour {
	buttons?: readonly Button<T>[];
}

export interface NoticeControls<V> {
	close(value?: V): void;
	update(changes: NoticeChanges<V>): void;
}

export type Notice<R, V = R> = Promise<R> & NoticeControls<V>;

export type ToastMessage<A> = string | NoticeChanges<never> | ((argument: A) => string | NoticeChanges<never>);

export interface ToastPromiseMessages<R> {
	loading: string | NoticeChanges<never>;
	success: ToastMessage<R>;
	error: ToastMessage<unknown>;
}

export interface ToastFunction {
	<T = never>(title: string, options?: ToastOptions<T>): Notice<T | null, T>;
	<T = never>(options: ToastOptions<T>): Notice<T | null, T>;
	info<T = never>(title: string, options?: ToastOptions<T>): Notice<T | null, T>;
	success<T = never>(title: string, options?: ToastOptions<T>): Notice<T | null, T>;
	warning<T = never>(title: string, options?: ToastOptions<T>): Notice<T | null, T>;
	error<T = never>(title: string, options?: ToastOptions<T>): Notice<T | null, T>;
	loading<T = never>(title: string, options?: ToastOptions<T>): Notice<T | null, T>;
	promise<R>(task: Promise<R> | (() => Promise<R>), messages: ToastPromiseMessages<R>, options?: ToastOptions<never>): Promise<R>;
}

export interface DialogDefaults extends DialogBehaviour {
	closeButton?: boolean;
	className?: string;
	animation?: MotionSet | false;
}

export interface ToastDefaults extends ToastBehaviour {
	duration?: number;
	pauseOnHover?: boolean;
	progress?: boolean;
	closeButton?: boolean;
	className?: string;
	animation?: MotionSet | false;
	limit?: number;
}

export interface Defaults {
	theme?: Theme;
	size?: Size;
	labels?: Partial<Labels>;
	dialog?: DialogDefaults;
	toast?: ToastDefaults;
}

export interface Nuntaria {
	show<T = true>(options: DialogOptions<T>): Notice<T | null, T>;
	alert(title: string, options?: AlertOptions): Notice<void, never>;
	alert(options: AlertOptions): Notice<void, never>;
	confirm(title: string, options?: ConfirmOptions): Notice<boolean>;
	confirm(options: ConfirmOptions): Notice<boolean>;
	prompt(title: string, options?: PromptOptions): Notice<string | null, string>;
	prompt(options: PromptOptions): Notice<string | null, string>;
	readonly toast: ToastFunction;
	closeAll(filter?: 'dialogs' | 'toasts'): void;
}
