import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'packages', environment: 'node', testTimeout: 30_000, include: ['packages/*/test/**/*.test.ts'] } },
      {
        test: {
          name: 'web',
          environment: 'jsdom',
          testTimeout: 30_000, // rendering a 252-country form in jsdom is slow when the whole suite runs in parallel
          include: ['apps/web/src/**/*.test.{ts,tsx}'],
          setupFiles: ['apps/web/src/test-setup.ts'],
        },
      },
    ],
  },
});
