# Changelog

## 1.0.0 (2026-09-16)

### Added

- `show`, `alert`, `confirm`, `prompt` and `toast` as ES module exports, with TypeScript definitions and no dependencies.
- Every call returns a promise with `close()` and `update()`, so a notice can be changed or dismissed from code.
- `toast.promise` follows a task from loading to success or failure, and `toast.loading`, `toast.success`, `toast.error`, `toast.warning` and `toast.info` are shorthands.
- Buttons take an `action`: it may be async, shows a spinner while it runs, keeps the notice open when it returns `false` or throws, and receives an `AbortSignal` plus `setError` and `close`.
- `prompt` has a real field: input types including `textarea`, a label, `required`, length and range limits, browser validity messages and an async `validate`.
- `createNuntaria(defaults)` builds an instance with its own theme, size, labels and per-kind defaults, including button labels for other languages.
- Toasts: six positions, a limit per corner, swipe to dismiss, a close button, `closeOnClick`, and timers that pause on hover, on focus and while the tab is hidden.
- `signal` closes a notice from an `AbortSignal`, and `onClose` reports why it closed.
- `closeAll()` closes everything, or only dialogs or toasts.
- `addStyles(css)` returns a function that removes those styles again.
- Parts (`::part`) for every element, so the page can restyle Nuntaria without reaching inside it.
- Themes `dark`, `light`, `glass` and `auto`, which follows `prefers-color-scheme`, in three sizes.

### Behaviour worth knowing

- Dialogs are native `<dialog>` elements shown as modals: the top layer puts them above any `z-index` and above fullscreen content, focus is trapped and returns to where it was, and `Escape` goes through the browser's own close request. Toasts render in a `popover` region where that exists.
- All motion runs on the Web Animations API. Interrupting an animation continues from the current position, and custom animations are keyframes rather than class names. Nothing animates under `prefers-reduced-motion: reduce`.
- Sizes are relative to the page's root font size, bounded by `clamp(14px, 1rem, 20px)`, so a reader's text settings are respected while a page cannot break the layout.
- Markup is built without `innerHTML`, so the library works on pages that enforce Trusted Types.
- Nothing is written to `window`, page CSS cannot reach inside the shadow root, and the scroll lock is shared between copies of the library through attributes on `<html>`.
- If the page deletes the stage element, it is put back and open notices are restored.
- The built-in palettes meet WCAG AA contrast for text and buttons, and every dialog and toast is checked with axe in the test suite.
