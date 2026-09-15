import type { ActionContext, PromptInput, PromptValidator } from '../types.js';
import { element } from '../utils/dom.js';

export interface Field {
	readonly node: HTMLElement;
	readonly control: HTMLInputElement | HTMLTextAreaElement;
}

export function createField(input: PromptInput, id: string, fallbackLabel: string): Field {
	const node = element('div', 'nu-field', { part: 'field' });
	const control = input.type === 'textarea'
		? element('textarea', 'nu-input', { part: 'input', rows: '4' })
		: element('input', 'nu-input', { part: 'input', type: input.type ?? 'text' });

	control.id = `${id}-input`;
	control.setAttribute('autofocus', '');
	control.setAttribute('autocomplete', input.autocomplete ?? 'off');

	if (input.label) {
		const label = element('label', 'nu-label', { part: 'label', for: control.id });
		label.textContent = input.label;
		node.append(label);
	} else if (fallbackLabel) {
		control.setAttribute('aria-label', fallbackLabel);
	}

	if (input.placeholder) control.placeholder = input.placeholder;
	if (input.required) control.required = true;
	if (input.minLength !== undefined) control.minLength = input.minLength;
	if (input.maxLength !== undefined) control.maxLength = input.maxLength;

	if (control instanceof HTMLInputElement) {
		if (input.pattern) control.pattern = input.pattern;
		if (input.min !== undefined) control.min = String(input.min);
		if (input.max !== undefined) control.max = String(input.max);
		if (input.step !== undefined) control.step = String(input.step);
	}

	control.value = input.value ?? '';
	node.append(control);

	return { node, control };
}

export async function readFieldValue(
	field: Field,
	input: PromptInput,
	validate: PromptValidator | undefined,
	requiredMessage: string,
	context: ActionContext<string | null>,
): Promise<string | null> {
	const { control } = field;
	const { value } = control;

	let message: string | null = null;
	if (input.required && value.trim() === '') message = requiredMessage;
	else if (!control.checkValidity()) message = control.validationMessage || requiredMessage;
	else if (validate) message = (await validate(value, { signal: context.signal })) ?? null;

	if (context.signal.aborted) return null;

	control.setAttribute('aria-invalid', message ? 'true' : 'false');
	if (!message) return value;

	context.setError(message);
	control.focus();
	return null;
}
