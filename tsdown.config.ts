import { defineConfig } from 'tsdown';

const env = process.env.NODE_ENV;

export default defineConfig({
	sourcemap: env === 'production',
	dts: true,
	format: ['cjs', 'esm'],
	minify: env === 'production',
	watch: env === 'development',
	unbundle: true,
	target: 'es2022',
	entry: ['src/index.ts'],
});
