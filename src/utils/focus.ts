export function deepActiveElement(): Element | null {
	let active = document.activeElement;
	while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
	return active;
}

export function restoreFocus(target: Element | null): void {
	if (!target?.isConnected || !(target instanceof HTMLElement || target instanceof SVGElement)) return;
	target.focus({ preventScroll: true });
}
