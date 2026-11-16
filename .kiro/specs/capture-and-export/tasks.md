# Tasks: capture-and-export

- [x] 1. URL guard
  - `src/capture/url-guard.ts` with `checkUrlSyntax` and `isPublicAddress`; table tests and a fast-check property over private ranges.
  - Done: `url-guard.test.ts` (table of IPv4 and IPv6 addresses, schemes, ports, credentials) and `url-guard.property.test.ts` (private IPv4, IPv4-mapped, `fc00::/7`, `fe80::/10`, never throws).
  - _Requirements: R1.3, R1.4_

- [x] 2. Metadata extractor and date finder
  - `src/capture/extract.ts` and `src/capture/dates.ts`, pure, with HTML and text fixtures written for this repo.
  - Done: fixtures are hand-written strings in `extract.test.ts` and `dates.test.ts`; no third-party page was copied.
  - _Requirements: R1.2, R1.6, R1.8_

- [x] 3. fetch-meta function and dev proxy
  - Confirm Vercel function signature and free-tier limits in Vercel docs. Write `api/fetch-meta.ts` and the Vite `configureServer` middleware sharing one handler.
  - Tests with mocked `fetch` and DNS: blocked addresses, redirects, timeout, size cap.
  - Done: shared handler in `src/capture/fetch-meta-server.ts` with a pinned DNS lookup; `fetch-meta-server.test.ts` uses fake DNS and HTTP. Checked against the real network with `npm run dev` and with a local `vercel build` (steps in design.md). A real Vercel deploy is not done.
  - _Requirements: R1.1, R1.4, R1.5, R1.6_

- [x] 4. Add form with fallbacks
  - URL, paste text and manual tabs; errors inline; zone defaults to the user's zone.
  - Done as buttons inside the add form rather than tabs ("Fill in from the link", "Paste page text instead", and the normal fields), so the manual fields are always visible. `src/ui/CapturePanel.tsx`, tests in `src/ui/Capture.test.tsx` and `e2e/capture.spec.ts`.
  - _Requirements: R1.7, R1.8, R1.9_

- [x] 5. .ics export and parser
  - `src/capture/ics.ts` with escaping, folding, TZID and date-only forms, Demo prefix; property P6 round trip.
  - Done with the UTC `DTSTART` form plus `X-DG-TZID` instead of `TZID` (design.md explains why). P6 in `ics.property.test.ts`, 300 runs. Import into a real calendar app not checked yet.
  - _Requirements: R2.1, R2.2, R2.3, R2.4_

- [x] 6. Notifications
  - Confirm Notification API and `ServiceWorkerRegistration.showNotification` on MDN. Reminders toggle, scheduling, limitation text in UI and README.
  - Done: `src/notifications/{reminders,notify}.ts`, `public/sw.js`, switch and limitation text in the export and settings dialog, README section. A real OS notification has not been seen yet (needs a person to grant permission).
  - _Requirements: R3.1, R3.2, R3.3, R3.4_

- [x] 7. Backup and restore UI
  - Download and restore buttons wired to the deadline-engine repository, with confirmation.
  - Done in `src/ui/ToolsDialog.tsx`; restore asks "Replace my graveyard" or "Keep what I have" and reports the validation path on failure.
  - _Requirements: R4.1, R4.2_

- [x] 8. LLM adapter
  - `src/llm/provider.ts` with `none` default; Gemini, Groq and Ollama providers only after confirming endpoints, browser CORS and free tiers in official docs. Validation and fallback.
  - Done: `src/llm/{provider,providers,settings}.ts`; docs and CORS checks listed in design.md. Tests use only fake `fetch`; no real key was used, so a live call to each provider is still a user check.
  - _Requirements: R5.1, R5.2, R5.3, R5.4, R5.5_
