/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { handleFetchMeta } from './src/capture/fetch-meta-server.ts';

/**
 * Dev only: serves /api/fetch-meta from the same handler as the Vercel function, so `npm run dev`
 * works without the Vercel CLI (capture-and-export design, "Local dev"). Vite docs:
 * https://vite.dev/guide/api-plugin#configureserver
 */
function fetchMetaDevApi(): Plugin {
  return {
    name: 'deadline-graveyard:fetch-meta-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/fetch-meta', (req, res) => {
        // Connect strips the mount path from req.url; originalUrl keeps the full path and query.
        const path = (req as { originalUrl?: string }).originalUrl ?? req.url ?? '/';
        // handleFetchMeta never throws, but building the Request can (odd Host header), so the
        // whole chain sits in one promise with a JSON 500 instead of a hung request.
        Promise.resolve()
          .then(() => handleFetchMeta(new Request(new URL(path, `http://${req.headers.host ?? 'dev.invalid'}`), { method: req.method ?? 'GET' })))
          .then(async (response) => {
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(await response.text());
          })
          .catch(() => {
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader('content-type', 'application/json; charset=utf-8');
            }
            res.end(JSON.stringify({ error: 'network' }));
          });
      });
    },
  };
}

// The manifest is generated from this build, so an offline reload never mixes asset versions.
// Vite/Rollup writeBundle hook: https://vite.dev/guide/api-plugin#universal-hooks
function offlineShell(): Plugin {
  let base: string;
  return {
    name: 'deadline-graveyard:offline-shell',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    writeBundle(options, bundle) {
      const out = options.dir ?? 'dist';
      const files = ['index.html', ...Object.keys(bundle), 'favicon.svg',
        ...readdirSync('public/fonts').filter((name) => name.endsWith('.woff2')).map((name) => `fonts/${name}`)];
      const assets = files.map((file) => file === 'index.html' ? base : `${base}${file}`);
      const template = readFileSync('public/sw.js', 'utf8');
      const hash = createHash('sha256').update(template).update(base);
      for (const file of files) hash.update(readFileSync(path.join(out, file)));
      const source = template.replace('/* BUILD_CACHE */ null', JSON.stringify(`deadline-graveyard-shell-${hash.digest('hex').slice(0, 16)}`))
        .replace('/* BUILD_ASSETS */ []', JSON.stringify(assets));
      writeFileSync(path.join(out, 'sw.js'), source);
    },
  };
}

export default defineConfig({
  plugins: [preact(), fetchMetaDevApi(), offlineShell()],
  server: {
    port: 5173,
    strictPort: true,
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
    // The heavier fast-check properties run synchronously for 0.5 to 1 s alone but took up to 18 s
    // with every worker busy on a loaded machine, which tripped the 5 s default and blocked the
    // commit-guard hook. A longer suite timeout keeps every property at its full numRuns.
    // https://vitest.dev/config/testtimeout
    testTimeout: 60_000,
  },
});
