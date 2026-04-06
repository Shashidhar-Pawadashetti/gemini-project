import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./src/__tests__/setup-node.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/*.tsx', '**/auth-integration.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});