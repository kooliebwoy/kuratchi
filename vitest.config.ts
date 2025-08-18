import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/tests/setup/test-setup.ts'],
  },
});
