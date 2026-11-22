import { defineConfig } from 'vite-plus';

const ignore = ['**/dist/**', 'openspec/**', '.claude/**', '.agents/**', 'data/**', 'docs/**', '**/public/world/**'];

export default defineConfig({
  run: {
    cache: true,
  },
  test: {
    include: ['{apps,packages,tools}/*/src/**/*.test.ts'],
  },
  fmt: {
    ignorePatterns: ignore,
    singleQuote: true,
    printWidth: 120,
  },
  lint: {
    ignorePatterns: ignore,
  },
});
