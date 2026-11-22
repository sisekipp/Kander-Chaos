import { defineConfig } from 'vite-plus';

const ignore = ['**/dist/**', 'openspec/**', '.claude/**', '.agents/**', 'data/**', 'docs/**', '**/public/world/**'];

export default defineConfig({
  run: {
    // Kein Task-Cache: die Welt-Pipeline hat Netzwerk- und Dateiseiteneffekte (Abruf, fortsetzbare Teilstücke),
    // die sich nicht als zwischenspeicherbares Ergebnis eines Tasks beschreiben lassen.
    cache: false,
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
    rules: {
      // Codestruktur (Design D11): keine Riesen-Dateien
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    },
    overrides: [
      {
        files: ['**/*.test.ts', '**/e2e/**'],
        rules: { 'max-lines': 'off' },
      },
    ],
  },
});
