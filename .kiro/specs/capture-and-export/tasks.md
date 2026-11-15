# Tasks: capture-and-export

- [ ] 1. URL guard
  - `src/capture/url-guard.ts` with `checkUrlSyntax` and `isPublicAddress`; table tests and a fast-check property over private ranges.
  - _Requirements: R1.3, R1.4_

- [ ] 2. Metadata extractor and date finder
  - `src/capture/extract.ts` and `src/capture/dates.ts`, pure, with HTML and text fixtures written for this repo.
  - _Requirements: R1.2, R1.6, R1.8_

- [ ] 3. fetch-meta function and dev proxy
  - Confirm Vercel function signature and free-tier limits in Vercel docs. Write `api/fetch-meta.ts` and the Vite `configureServer` middleware sharing one handler.
  - Tests with mocked `fetch` and DNS: blocked addresses, redirects, timeout, size cap.
  - _Requirements: R1.1, R1.4, R1.5, R1.6_

- [ ] 4. Add form with fallbacks
  - URL, paste text and manual tabs; errors inline; zone defaults to the user's zone.
  - _Requirements: R1.7, R1.8, R1.9_

- [ ] 5. .ics export and parser
  - `src/capture/ics.ts` with escaping, folding, TZID and date-only forms, Demo prefix; property P6 round trip.
  - _Requirements: R2.1, R2.2, R2.3, R2.4_

- [ ] 6. Notifications
  - Confirm Notification API and `ServiceWorkerRegistration.showNotification` on MDN. Reminders toggle, scheduling, limitation text in UI and README.
  - _Requirements: R3.1, R3.2, R3.3, R3.4_

- [ ] 7. Backup and restore UI
  - Download and restore buttons wired to the deadline-engine repository, with confirmation.
  - _Requirements: R4.1, R4.2_

- [ ] 8. LLM adapter
  - `src/llm/provider.ts` with `none` default; Gemini, Groq and Ollama providers only after confirming endpoints, browser CORS and free tiers in official docs. Validation and fallback.
  - _Requirements: R5.1, R5.2, R5.3, R5.4, R5.5_
