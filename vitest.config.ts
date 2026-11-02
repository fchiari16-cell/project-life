import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'packages', environment: 'node', testTimeout: 30_000, include: ['packages/*/test/**/*.test.ts'] } },
      {
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['apps/web/src/**/*.test.{ts,tsx}'],
          setupFiles: ['apps/web/src/test-setup.ts'],
        },
      },
    ],
  },
});
