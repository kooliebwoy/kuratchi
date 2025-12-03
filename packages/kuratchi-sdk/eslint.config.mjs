import js from '@eslint/js';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve lint plugins from the local shared config package so we don't rely on hoisting
const configPackageRoot = path.resolve(__dirname, '../config-eslint');
const requireFromConfig = createRequire(path.join(configPackageRoot, 'package.json'));

const tseslint = requireFromConfig('@typescript-eslint/eslint-plugin');
const svelte = requireFromConfig('eslint-plugin-svelte');
const globals = requireFromConfig('globals');

const svelteRecommended = svelte.configs['flat/recommended'].map((config) => ({
	...config,
	languageOptions: {
		...config.languageOptions,
		parserOptions: {
			...config.languageOptions?.parserOptions,
			extraFileExtensions: ['.svelte']
		},
		globals: {
			...globals.browser,
			...globals.node
		}
	}
}));

const tsRecommended = tseslint.configs['flat/recommended'].map((config) => ({
	...config,
	files: config.files ?? ['**/*.{ts,js,mts,cts}'],
	languageOptions: {
		...config.languageOptions,
		parserOptions: {
			...config.languageOptions?.parserOptions,
			project: './tsconfig.json',
			tsconfigRootDir: __dirname
		},
		globals: {
			...globals.browser,
			...globals.node
		}
	}
}));

export default [
	{
		ignores: [
			'dist',
			'package',
			'.svelte-kit',
			'node_modules',
			'examples/**',
			'scripts/**',
			'test-*.mjs',
			'src/tests/**',
			'*.cjs'
		]
	},
	js.configs.recommended,
	...svelteRecommended,
	...tsRecommended,
	{
		files: ['**/*.{ts,js,mts,cts}'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
		}
	}
];
