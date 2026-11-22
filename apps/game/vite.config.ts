import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';
import { pwaPlugin } from './sw/pwaPlugin.ts';

const BUDGET_MB = Number(process.env.KC_BUDGET_MB ?? 300);

export default defineConfig({
  plugins: [react(), pwaPlugin({ budgetBytes: BUDGET_MB * 1024 * 1024 })],
  build: {
    target: 'safari16',
    chunkSizeWarningLimit: 4000,
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
  },
  server: {
    host: true,
  },
});
