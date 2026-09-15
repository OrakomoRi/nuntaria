import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const SUPPORTED = ['chromium', 'firefox', 'webkit'] as const;
const requested = (process.env.NUNTARIA_BROWSERS ?? SUPPORTED.join(',')).split(',').map(name => name.trim());
const browsers = SUPPORTED.filter(name => requested.includes(name));

export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
		restoreMocks: true,
		unstubGlobals: true,
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: browsers.map(browser => ({ browser })),
			screenshotFailures: false,
		},
	},
});
