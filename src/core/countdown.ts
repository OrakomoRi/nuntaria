export class Countdown {
	private readonly animation: Animation;
	private readonly bar: HTMLElement | null;

	constructor(duration: number, bar: HTMLElement | null, onFinish: () => void) {
		const keyframes = bar ? [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }] : [];
		const effect = new KeyframeEffect(bar, keyframes, { duration, easing: 'linear', fill: 'forwards' });
		this.bar = bar;
		this.animation = new Animation(effect, document.timeline);
		this.animation.pause();
		this.animation.finished.then(onFinish, () => {});
	}

	run(active: boolean): void {
		if (active) this.animation.play();
		else this.animation.pause();
	}

	cancel(): void {
		if (this.bar) this.bar.style.transform = getComputedStyle(this.bar).transform;
		this.animation.cancel();
	}
}
