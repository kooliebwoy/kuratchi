module.exports = {
  extends: ['@kuratchi/config-eslint/base', 'plugin:svelte/recommended'],
  overrides: [
    {
      files: ['*.svelte'],
      processor: 'svelte/svelte',
    },
    {
      files: ['*.ts', '*.js'],
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  ],
  settings: {
    'svelte/typescript': true,
  },
};
