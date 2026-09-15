import { createNuntaria } from './factory.js';

export { addStyles } from './core/stage.js';
export { createNuntaria } from './factory.js';

export type {
	ActionContext,
	AlertOptions,
	Button,
	ButtonAction,
	ButtonVariant,
	CloseReason,
	CommonOptions,
	ConfirmOptions,
	Content,
	Defaults,
	DialogBehaviour,
	DialogDefaults,
	DialogOptions,
	DialogPosition,
	Labels,
	Motion,
	MotionSet,
	Notice,
	NoticeChanges,
	NoticeControls,
	NoticeType,
	Nuntaria,
	PromptInput,
	PromptInputType,
	PromptOptions,
	PromptValidator,
	Size,
	Theme,
	ToastBehaviour,
	ToastDefaults,
	ToastFunction,
	ToastMessage,
	ToastOptions,
	ToastPosition,
	ToastPromiseMessages,
} from './types.js';

const nuntaria = createNuntaria();

export const { show, alert, confirm, prompt, toast, closeAll } = nuntaria;
