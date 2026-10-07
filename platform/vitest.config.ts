import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { env: { TZ: 'UTC' }, include: ['tests/**/*.test.ts'], testTimeout: 30000, hookTimeout: 60000, pool: 'forks' },
});
