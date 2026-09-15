import { defineConfig } from 'vite';

export default defineConfig({
	publicDir: false,
	build: {
		target: 'es2022',
		minify: false,
		cssMinify: true,
		emptyOutDir: true,
		reportCompressedSize: false,
		lib: {
			entry: 'src/index.ts',
			formats: ['es'],
			fileName: () => 'index.js',
		},
	},
});
