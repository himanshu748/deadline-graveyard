// Vercel Function (Node.js runtime) for GET /api/fetch-meta?url=...
// Web standard `fetch` export, per https://vercel.com/docs/functions/runtimes/node-js
// All logic, including the SSRF guards, lives in src/capture/fetch-meta-server.ts so the Vite dev
// middleware runs exactly the same code.
// The `.ts` import works on Vercel only because tsconfig.json sets rewriteRelativeImportExtensions:
// Vercel compiles each file with the project's tsconfig and renames it to .js. Without that option
// `vercel build` succeeds but the built function fails to load with ERR_MODULE_NOT_FOUND. Both
// cases were checked with a local `vercel build` (no login, no deploy); the steps are in
// .kiro/specs/capture-and-export/design.md.
import { handleFetchMeta } from '../src/capture/fetch-meta-server.ts';

export default {
  fetch(request: Request): Promise<Response> {
    return handleFetchMeta(request);
  },
};
