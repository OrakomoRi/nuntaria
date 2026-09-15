import { DialogNotice, type DialogSettings } from './core/dialog.js';
import type { BaseNotice, NoticeSettings, Settler } from './core/notice.js';
import { closeAll } from './core/stage.js';
import { ToastNotice, type ToastSettings } from './core/toast.js';
import type {
	AlertOptions,
	Button,
	ButtonVariant,
	CloseReason,
	CommonOptions,
	ConfirmOptions,
	Defaults,
	DialogBehaviour,
	DialogOptions,
	Labels,
	MotionSet,
	Notice,
	NoticeChanges,
	NoticeControls,
	NoticeType,
	Nuntaria,
	PromptOptions,
	ToastFunction,
	ToastMessage,
	ToastOptions,
	ToastPromiseMessages,
} from './types.js';
import { createField, readFieldValue } from './ui/field.js';
import { uniqueId } from './utils/dom.js';

const DEFAULT_LABELS: Labels = {
	ok: 'OK',
	cancel: 'Cancel',
	confirm: 'Confirm',
	close: 'Close',
	required: 'Please fill in this field.',
	notifications: 'Notifications',
};

const DEFAULT_TOAST_DURATION = 4000;
const DEFAULT_TOAST_LIMIT = 5;

const TYPE_VARIANTS: Partial<Record<NoticeType, ButtonVariant>> = {
	success: 'success',
	warning: 'warning',
	error: 'danger',
};

interface KindDefaults {
	closeButton: boolean;
	className: string | undefined;
	animation: MotionSet | false | undefined;
	duration: number;
	pauseOnHover: boolean;
	progress: boolean;
}

function assertDom(): void {
	if (typeof document === 'undefined') throw new Error('nuntaria needs a DOM and can only run in a browser.');
}

function withTitle<O extends { title?: string }>(titleOrOptions: string | O | undefined, options: O | undefined): O {
	if (typeof titleOrOptions === 'string') return { ...options, title: titleOrOptions } as O;
	return { ...titleOrOptions } as O;
}

function toChanges(message: string | NoticeChanges<never>): NoticeChanges<never> {
	return typeof message === 'string' ? { title: message } : message;
}

function resolveMessage<A>(message: ToastMessage<A>, argument: A): NoticeChanges<never> {
	return toChanges(typeof message === 'function' ? message(argument) : message);
}

function asPromise<R>(task: Promise<R> | (() => Promise<R>)): Promise<R> {
	if (typeof task !== 'function') return task;
	try {
		return Promise.resolve(task());
	} catch (error) {
		return Promise.reject(error);
	}
}

function launch<V, R, C = V>(
	create: (settle: Settler<V>) => BaseNotice<V>,
	map: (value: V | null) => R,
	onClose: ((result: R, reason: CloseReason) => void) | undefined,
	prepare?: (notice: BaseNotice<V>) => void,
): Notice<R, C> {
	let resolve!: (result: R) => void;
	const promise = new Promise<R>(done => {
		resolve = done;
	});

	const notice = create((value, reason) => {
		const result = map(value);
		try {
			onClose?.(result, reason);
		} finally {
			resolve(result);
		}
	});

	prepare?.(notice);

	const controls: NoticeControls<C> = {
		close: value => notice.close(value === undefined ? null : (value as unknown as V), 'api'),
		update: changes => notice.update(changes as unknown as NoticeChanges<V>),
	};

	notice.open();
	return Object.assign(promise, controls);
}

export function createNuntaria(defaults: Defaults = {}): Nuntaria {
	const labels: Labels = { ...DEFAULT_LABELS, ...defaults.labels };
	const dialogDefaults = defaults.dialog ?? {};
	const toastDefaults = defaults.toast ?? {};

	function common<V>(
		options: CommonOptions<never>,
		kind: KindDefaults,
		type: NoticeType | null,
		buttons: readonly Button<V>[],
	): NoticeSettings<V> {
		return {
			title: options.title ?? '',
			text: options.text ?? '',
			content: options.content ?? null,
			type: options.type === undefined ? type : options.type,
			icon: options.icon,
			accent: options.accent ?? null,
			theme: options.theme ?? defaults.theme ?? 'dark',
			size: options.size ?? defaults.size ?? 'normal',
			className: [kind.className, options.className].filter(Boolean).join(' '),
			duration: options.duration ?? kind.duration,
			pauseOnHover: options.pauseOnHover ?? kind.pauseOnHover,
			progress: options.progress ?? kind.progress,
			closeButton: options.closeButton ?? kind.closeButton,
			animation: options.animation ?? kind.animation ?? null,
			labels: { ...labels, ...options.labels },
			signal: options.signal ?? null,
			buttons,
		};
	}

	function dialogSettings<V>(
		options: CommonOptions<never> & DialogBehaviour,
		type: NoticeType | null,
		buttons: readonly Button<V>[],
		role: 'dialog' | 'alertdialog',
		closeOnBackdrop = dialogDefaults.closeOnBackdrop ?? true,
	): DialogSettings<V> {
		const kind: KindDefaults = {
			closeButton: dialogDefaults.closeButton ?? false,
			className: dialogDefaults.className,
			animation: dialogDefaults.animation,
			duration: 0,
			pauseOnHover: true,
			progress: true,
		};

		return {
			...common(options, kind, type, buttons),
			position: options.position ?? dialogDefaults.position ?? 'center',
			backdrop: options.backdrop ?? dialogDefaults.backdrop ?? true,
			closeOnEscape: options.closeOnEscape ?? dialogDefaults.closeOnEscape ?? true,
			closeOnBackdrop: options.closeOnBackdrop ?? closeOnBackdrop,
			role,
		};
	}

	function toastSettings<V>(
		options: ToastOptions<V>,
		type: NoticeType | null,
		duration = toastDefaults.duration ?? DEFAULT_TOAST_DURATION,
	): ToastSettings<V> {
		const kind: KindDefaults = {
			closeButton: toastDefaults.closeButton ?? true,
			className: toastDefaults.className,
			animation: toastDefaults.animation,
			duration,
			pauseOnHover: toastDefaults.pauseOnHover ?? true,
			progress: toastDefaults.progress ?? true,
		};

		return {
			...common(options as CommonOptions<never>, kind, type, options.buttons ?? []),
			position: options.position ?? toastDefaults.position ?? 'top-right',
			closeOnClick: options.closeOnClick ?? toastDefaults.closeOnClick ?? false,
			swipe: options.swipe ?? toastDefaults.swipe ?? true,
			limit: toastDefaults.limit ?? DEFAULT_TOAST_LIMIT,
		};
	}

	function show<T = true>(options: DialogOptions<T>): Notice<T | null, T> {
		assertDom();
		const buttons = options.buttons ?? [{ label: options.labels?.ok ?? labels.ok, value: true as T }];
		const settings = dialogSettings(options as CommonOptions<never> & DialogBehaviour, null, buttons, options.role ?? 'dialog');
		return launch<T, T | null>(settle => new DialogNotice(settings, settle), value => value, options.onClose);
	}

	function alert(titleOrOptions: string | AlertOptions, maybeOptions?: AlertOptions): Notice<void, never> {
		assertDom();
		const options = withTitle(titleOrOptions, maybeOptions);
		const type = options.type === undefined ? 'info' : options.type;
		const button: Button<true> = {
			label: options.okLabel ?? options.labels?.ok ?? labels.ok,
			value: true,
			variant: (type ? TYPE_VARIANTS[type] : undefined) ?? 'primary',
		};
		const settings = dialogSettings(options as CommonOptions<never> & DialogBehaviour, 'info', [button], 'alertdialog');
		return launch<true, void, never>(settle => new DialogNotice(settings, settle), () => undefined, options.onClose);
	}

	function confirm(titleOrOptions: string | ConfirmOptions, maybeOptions?: ConfirmOptions): Notice<boolean> {
		assertDom();
		const options = withTitle(titleOrOptions, maybeOptions);
		const cancel: Button<boolean> = {
			label: options.cancelLabel ?? options.labels?.cancel ?? labels.cancel,
			value: false,
			variant: 'cancel',
		};
		const accept: Button<boolean> = {
			label: options.confirmLabel ?? options.labels?.confirm ?? labels.confirm,
			value: true,
			variant: options.danger ? 'danger' : 'primary',
			action: options.action,
		};
		const settings = dialogSettings(options as CommonOptions<never> & DialogBehaviour, 'confirm', [cancel, accept], 'alertdialog');
		return launch<boolean, boolean>(settle => new DialogNotice(settings, settle), value => value === true, options.onClose);
	}

	function prompt(titleOrOptions: string | PromptOptions, maybeOptions?: PromptOptions): Notice<string | null, string> {
		assertDom();
		const options = withTitle(titleOrOptions, maybeOptions);
		const input = options.input ?? {};
		const texts: Labels = { ...labels, ...options.labels };
		const field = createField(input, uniqueId('nu-prompt'), options.title ?? '');

		let content: Node = field.node;
		if (options.content) {
			const wrapper = document.createElement('div');
			wrapper.append(options.content, field.node);
			content = wrapper;
		}

		const submit: Button<string | null> = {
			label: options.confirmLabel ?? texts.ok,
			value: null,
			variant: 'primary',
			action: async context => {
				const value = await readFieldValue(field, input, options.validate, texts.required, context);
				if (value === null) return false;
				context.close(value);
				return true;
			},
		};
		const cancel: Button<string | null> = {
			label: options.cancelLabel ?? texts.cancel,
			value: null,
			variant: 'cancel',
		};

		const settings = dialogSettings(
			{ ...options, content } as CommonOptions<never> & DialogBehaviour,
			null,
			[cancel, submit],
			'dialog',
			options.closeOnBackdrop ?? false,
		);

		return launch<string | null, string | null, string>(
			settle => new DialogNotice(settings, settle),
			value => value,
			options.onClose,
			notice => {
				const { control } = field;
				const node: HTMLElement = control;
				control.setAttribute('aria-describedby', notice.errorId);
				node.addEventListener('input', () => {
					control.removeAttribute('aria-invalid');
					notice.clearError();
				});
				node.addEventListener('keydown', event => {
					if (event.key !== 'Enter' || event.isComposing) return;
					if (control instanceof HTMLTextAreaElement && !(event.ctrlKey || event.metaKey)) return;
					event.preventDefault();
					notice.trigger(submit);
				});
			},
		);
	}

	function createToast<T>(options: ToastOptions<T>, type: NoticeType | null, duration?: number): Notice<T | null, T> {
		assertDom();
		const settings = toastSettings(options, type, duration);
		return launch<T, T | null>(settle => new ToastNotice(settings, settle), value => value, options.onClose);
	}

	function toastOf(type: NoticeType, duration?: number) {
		return <T = never>(title: string, options?: ToastOptions<T>): Notice<T | null, T> =>
			createToast<T>({ ...options, title }, type, duration);
	}

	function baseToast<T = never>(titleOrOptions: string | ToastOptions<T>, maybeOptions?: ToastOptions<T>): Notice<T | null, T> {
		return createToast(withTitle(titleOrOptions, maybeOptions), 'info');
	}

	function promise<R>(
		task: Promise<R> | (() => Promise<R>),
		messages: ToastPromiseMessages<R>,
		options: ToastOptions<never> = {},
	): Promise<R> {
		const running = asPromise(task);
		const notice = createToast<never>({ ...options, ...toChanges(messages.loading) }, 'loading', options.duration ?? 0);
		const duration = options.duration ?? toastDefaults.duration ?? DEFAULT_TOAST_DURATION;

		running.then(
			value => notice.update({ type: 'success', duration, ...resolveMessage(messages.success, value) }),
			error => notice.update({ type: 'error', duration, ...resolveMessage(messages.error, error) }),
		);

		return running;
	}

	const toast = Object.assign(baseToast, {
		info: toastOf('info'),
		success: toastOf('success'),
		warning: toastOf('warning'),
		error: toastOf('error'),
		loading: toastOf('loading', 0),
		promise,
	}) as ToastFunction;

	return { show, alert, confirm, prompt, toast, closeAll };
}
