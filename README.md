# nuntaria

[![npm](https://img.shields.io/npm/v/nuntaria.svg)](https://www.npmjs.com/package/nuntaria)
[![types](https://img.shields.io/npm/types/nuntaria.svg)](https://www.npmjs.com/package/nuntaria)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Dialogs, confirmations, prompts and toasts that survive a page you do not control. Everything renders inside one shadow root, in the browser's top layer, and nothing is written to `window`.

- **Isolated** — the page's CSS cannot restyle it, its CSS cannot leak out, and no globals are defined
- **On top of everything** — native `<dialog>` and the Popover API put notices above any `z-index`, even above a fullscreen element
- **Accessible** — real focus handling, `Escape`, labelled dialogs, live regions for toasts, motion that respects `prefers-reduced-motion`
- **Promise-based** — every call returns a promise you can `await`, with `close()` and `update()` on the same object
- **Safe by construction** — no HTML strings are ever assigned, so it works on pages that enforce Trusted Types
- **Typed and small** — TypeScript definitions, ES modules, no dependencies

## Installation

```bash
npm install nuntaria
```

```ts
import { alert, confirm, prompt, toast } from 'nuntaria';
```

Without a bundler, load it as a module from a CDN:

```html
<script type="module">
	import { toast } from 'https://cdn.jsdelivr.net/npm/nuntaria/+esm';
	toast.success('Ready');
</script>
```

## Quick start

```ts
import { confirm, prompt, toast } from 'nuntaria';

if (await confirm('Delete this file?', { text: 'It cannot be restored.', danger: true })) {
	toast.success('Deleted');
}

const name = await prompt('Rename', { input: { label: 'New name', required: true } });
if (name !== null) {
	await toast.promise(save(name), { loading: 'Saving', success: 'Saved', error: 'Could not save' });
}
```

## API

| Function | Resolves with |
|---|---|
| `show(options)` | the clicked button's `value`, or `null` when dismissed |
| `alert(title, options?)` | nothing; it resolves once the dialog is closed |
| `confirm(title, options?)` | `true` when confirmed, `false` when cancelled or dismissed |
| `prompt(title, options?)` | the entered text, or `null` when cancelled |
| `toast(title, options?)` | the clicked button's `value`, or `null` |
| `toast.success` / `.error` / `.warning` / `.info` | the same, with that type |
| `toast.loading(title, options?)` | a toast without a timer, for work in progress |
| `toast.promise(task, messages, options?)` | the task's own promise; the toast follows it |
| `closeAll(filter?)` | — closes everything, or only `'dialogs'` / `'toasts'` |
| `createNuntaria(defaults)` | an instance with its own defaults |
| `addStyles(css)` | a function that removes those styles again |

Every function also accepts a single options object: `alert({ title: 'Saved', type: 'success' })`.

### The handle

Each call returns a promise with two extra methods:

```ts
const notice = toast.loading('Uploading');

notice.update({ title: 'Almost there' });
notice.close();

const result = await notice;
```

`close(value?)` resolves the promise with that value, or with the dismissal value when called without one.

### Options

| Option | Type | Default | Applies to |
|---|---|---|---|
| `title` | `string` | — | both |
| `text` | `string` | — | both |
| `content` | `Node` | — | both; your own markup, inserted as is |
| `type` | `'info' \| 'success' \| 'warning' \| 'error' \| 'confirm' \| 'loading' \| null` | varies | both; picks the icon and accent colour |
| `icon` | `Node \| false` | — | both; your own icon, or `false` for none |
| `accent` | `string` | — | both; CSS colour for the icon and the timer bar |
| `theme` | `'auto' \| 'dark' \| 'light' \| 'glass'` | `'dark'` | both |
| `size` | `'small' \| 'normal' \| 'large'` | `'normal'` | both |
| `className` | `string` | — | both; extra classes on the panel |
| `duration` | `number` | `0` for dialogs, `4000` for toasts | both; auto-close in milliseconds |
| `pauseOnHover` | `boolean` | `true` | both |
| `progress` | `boolean` | `true` | both; the timer bar |
| `closeButton` | `boolean` | `false` for dialogs, `true` for toasts | both |
| `animation` | `MotionSet \| false` | built-in motion | both; see [Motion](#motion) |
| `labels` | `Partial<Labels>` | English | both |
| `signal` | `AbortSignal` | — | both; aborting closes the notice |
| `onClose` | `(result, reason) => void` | — | both; `reason` is `'button'`, `'escape'`, `'backdrop'`, `'close-button'`, `'click'`, `'swipe'`, `'timeout'`, `'limit'`, `'abort'` or `'api'` |
| `buttons` | `Button[]` | one `OK` button / none | `show`, `toast` |
| `position` | `'center' \| 'top' \| 'bottom'` | `'center'` | dialogs |
| `position` | `'top-left' \| 'top-center' \| 'top-right' \| 'bottom-left' \| 'bottom-center' \| 'bottom-right'` | `'top-right'` | toasts |
| `backdrop` | `boolean` | `true` | dialogs |
| `closeOnEscape` | `boolean` | `true` | dialogs |
| `closeOnBackdrop` | `boolean` | `true`, `false` for `prompt` | dialogs |
| `role` | `'dialog' \| 'alertdialog'` | `'dialog'` | `show` |
| `closeOnClick` | `boolean` | `false` | toasts |
| `swipe` | `boolean` | `true` | toasts; drag a toast away with a finger |

### Buttons and actions

```ts
await show({
	title: 'Publish this post?',
	buttons: [
		{ label: 'Cancel', value: false, variant: 'cancel' },
		{
			label: 'Publish',
			value: true,
			action: async ({ signal, setError }) => {
				const response = await fetch('/publish', { method: 'POST', signal });
				if (response.ok) return;
				setError('The server refused.');
				return false;
			},
		},
	],
});
```

While an `action` runs, its button shows a spinner and the other buttons are disabled; `Escape` and backdrop clicks are ignored. Return `false` (or throw) to keep the notice open — a thrown `Error`'s message is shown. The `signal` is aborted if the notice closes meanwhile, and `close(value)` in the context resolves with a value of your own.

| Button field | Type |
|---|---|
| `label` | `string` |
| `value` | the value the notice resolves with |
| `variant` | `'primary' \| 'success' \| 'danger' \| 'warning' \| 'cancel'` |
| `action` | `(context) => boolean \| void \| Promise<boolean \| void>` |
| `autofocus` | `boolean` |
| `className` | `string` |

### Prompt

```ts
const email = await prompt('Subscribe', {
	input: { type: 'email', label: 'Email', required: true, placeholder: 'you@example.com' },
	validate: async value => (await isTaken(value)) ? 'That address is already subscribed.' : null,
});
```

The input supports `type` (`text`, `password`, `email`, `number`, `url`, `tel`, `search`, `textarea`), `value`, `label`, `placeholder`, `required`, `minLength`, `maxLength`, `pattern`, `min`, `max`, `step` and `autocomplete`. Built-in validity messages come from the browser, in the browser's language; `validate` adds your own rule and may be async. `Enter` submits, and in a `textarea` `Ctrl`/`Cmd` + `Enter` does.

### Toasts

Toasts stack in their corner, newest nearest the edge, five at a time by default; the oldest one leaves when a sixth arrives. The timer pauses while the pointer is over a toast, while focus is inside it, and while the tab is hidden.

```ts
const notice = toast.loading('Uploading');
notice.update({ type: 'success', title: 'Uploaded', duration: 4000 });
```

### Defaults

```ts
import { createNuntaria } from 'nuntaria';

export const ui = createNuntaria({
	theme: 'light',
	labels: { ok: 'ОК', cancel: 'Отмена', confirm: 'Подтвердить', close: 'Закрыть' },
	toast: { position: 'bottom-center', duration: 6000, limit: 3 },
});
```

An instance has the same functions as the module. `closeAll` closes every notice of the library, whichever instance opened it.

## Motion

Every animation runs on the Web Animations API, so two animations never fight over the same element: interrupting an entrance captures where it is and continues from there. There are no CSS transitions to break.

```ts
await show({
	title: 'Custom motion',
	animation: {
		enter: { keyframes: [{ opacity: 0, transform: 'translateY(2em)' }, { opacity: 1, transform: 'none' }], options: { duration: 300 } },
		exit: { keyframes: [{ opacity: 1 }, { opacity: 0 }], options: { duration: 120 } },
	},
});
```

`animation: false` opens and closes instantly. Nothing is animated when the browser reports `prefers-reduced-motion: reduce`.

## Styling

Sizes are relative to the page's root font size, bounded to stay usable: the base unit is `clamp(14px, 1rem, 20px)`, and everything else is a multiple of it. A reader who enlarges text gets a larger dialog; a page with a broken root font size cannot shrink it away.

Two ways to restyle, both explicit — nothing leaks in by accident:

```css
/* from the page, through parts */
nuntaria-stage::part(panel) { border-radius: 1rem; }
nuntaria-stage::part(button-primary) { text-transform: uppercase; }
```

```ts
// from code, inside the shadow root
import { addStyles } from 'nuntaria';

const remove = addStyles('.nu-panel { --nu-info: #38bdf8; }');
```

Parts: `dialog`, `region`, `panel`, `toast`, `icon`, `title`, `text`, `content`, `field`, `label`, `input`, `error`, `actions`, `button`, `button-<variant>`, `close-button`, `spinner`, `progress`.

| Variables | |
|---|---|
| Types | `--nu-info`, `--nu-success`, `--nu-warning`, `--nu-error`, `--nu-confirm` |
| Text on buttons | `--nu-on-info`, `--nu-on-success`, `--nu-on-warning`, `--nu-on-error` |
| Dark theme | `--nu-dark-bg`, `--nu-dark-border`, `--nu-dark-text`, `--nu-dark-muted`, `--nu-dark-field`, `--nu-dark-field-border`, `--nu-dark-danger` |
| Light theme | the same names with `--nu-light-` |
| Glass theme | `--nu-glass-bg`, `--nu-glass-border`, `--nu-glass-text`, `--nu-glass-muted`, `--nu-glass-field`, `--nu-glass-field-border` |
| Layout | `--nu-base`, `--nu-radius`, `--nu-gap`, `--nu-offset`, `--nu-backdrop`, `--nu-backdrop-blur`, `--nu-font` |

## Accessibility

| | |
|---|---|
| Dialogs | native `<dialog>`: focus moves in, is trapped, and returns to the element that opened it |
| Naming | `aria-labelledby` and `aria-describedby` point at the title and text; `alert`, `confirm` and `prompt` are `alertdialog`s |
| Toasts | a labelled `aria-live` region; error toasts are announced as alerts |
| Keyboard | `Escape` closes the topmost dialog, or a toast while focus is inside it; key presses never reach the page |
| Timers | pause on hover, on focus and while the tab is hidden |
| Motion | nothing animates under `prefers-reduced-motion: reduce` |
| Contrast | the built-in palettes meet WCAG AA for text and buttons; every dialog and toast is checked with axe in the test suite |

## Isolation

| | |
|---|---|
| Globals | none; two copies of the library on one page do not see each other |
| Styles | adopted into an open shadow root on a `<nuntaria-stage>` element, which exists only while something is shown |
| Page CSS | cannot reach inside, and the page's `!important` rules do not apply |
| Markup | built with `createElement` only, never `innerHTML`, so a Trusted Types policy is not violated |
| Page changes | while a modal dialog is open, `body` scrolling is locked; two copies of the library share that lock through attributes on `<html>` |
| Removal | if the page deletes the stage, it is put back and the open notices are restored |

## Browser support

Chrome and Edge 87+, Firefox 98+, Safari 15.4+. Toasts use the Popover API where it exists (Chrome 114+, Firefox 125+, Safari 17+) and fall back to a fixed stack elsewhere. The test suite runs in Chromium, Firefox and WebKit.

On WebKit, changing the page's root font size after a notice has been shown does not rescale it until the page reloads; that is a WebKit style-invalidation bug, not a limitation of the library.

## Credits

The main reference for this library was [sweetalert2](https://github.com/sweetalert2/sweetalert2); its option model and the questions it answers shaped what Nuntaria does. The toast behaviour — stacking, limits, pausing and swipe-to-dismiss — follows the ground laid by [sonner](https://github.com/emilkowalski/sonner), [notyf](https://github.com/caroso1222/notyf) and [iziToast](https://github.com/marcelodolza/iziToast), and the focus rules follow [a11y-dialog](https://github.com/KittyGiraudel/a11y-dialog). None of their code is used here.

## License

[MIT](LICENSE)
