/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5173,
    strictPort: true,
    // FEAT-005 hook point: the dev-only proxy that fetches pages for
    // "add from URL" is registered here (Vercel serves api/ in production).
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    // Domain logic runs in plain Node. UI tests opt in to a DOM with a
    // `// @vitest-environment happy-dom` comment at the top of the file.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
  },
});
