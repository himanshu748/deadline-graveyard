# Requirements: capture-and-export

## Introduction

Getting deadlines in and out: add from a URL (title and date extracted when the page exposes them), paste page text, manual entry, `.ics` export, opt-in browser notifications, JSON backup and restore entry points, and the optional LLM adapter. Judging criterion: Potential Impact (PLAN.md F3, F4, F5).

## Requirement 1: add from URL

**User Story:** As a hackathon participant, I want to paste an event URL and get the title and deadline filled in, so that I do not retype them.

#### Acceptance Criteria

- **R1.1** WHEN the user submits a URL THE SYSTEM SHALL request page metadata from `/api/fetch-meta` (the Vercel function when hosted, the Vite dev proxy locally).
- **R1.2** WHEN the page exposes a `<title>`, Open Graph tags or schema.org JSON-LD `Event` data THE SYSTEM SHALL prefill the title and, when present, the end date or start date, and the zone from the date's offset when given.
- **R1.3** IF the URL scheme is not `http` or `https` THEN THE SYSTEM SHALL reject it before any request.
- **R1.4** IF the URL's host resolves to a private, loopback, link-local or otherwise non-public address THEN THE SYSTEM SHALL refuse to fetch it.
- **R1.5** THE SYSTEM SHALL limit each fetch to 5 s, 1 MB of response body and 3 redirects, re-checking R1.3 and R1.4 for every redirect target.
- **R1.6** THE SYSTEM SHALL return only the extracted fields (title, dates, zone hint, source URL), never the raw page.
- **R1.7** IF the fetch fails, times out or finds no date THEN THE SYSTEM SHALL keep the URL, show what was found and fall back to manual entry with a clear message.
- **R1.8** WHEN the user chooses "paste page text" THE SYSTEM SHALL extract candidate dates from the pasted text with the same rule-based parser and let the user pick one.
- **R1.9** THE SYSTEM SHALL always allow fully manual entry of title, date, optional time and zone, defaulting the zone to the user's zone.

## Requirement 2: .ics export

**User Story:** As a user, I want my deadlines in my calendar app.

#### Acceptance Criteria

- **R2.1** WHEN the user exports THE SYSTEM SHALL produce an RFC 5545 `.ics` file with one `VEVENT` per unresolved item, each with a stable `UID`, `DTSTAMP`, `SUMMARY` and `DTSTART`.
- **R2.2** WHEN an item is demo data THE SYSTEM SHALL prefix its `SUMMARY` with "[Demo] ".
- **R2.3** WHEN the exported file is parsed by the app's own parser THE SYSTEM SHALL recover the same uid, title, instant, zone and dateOnly flag (deadline-engine P6).
- **R2.4** THE SYSTEM SHALL escape commas, semicolons, backslashes and newlines in text values and fold lines longer than 75 octets.

## Requirement 3: notifications

**User Story:** As a user, I want a reminder before a candle burns out.

#### Acceptance Criteria

- **R3.1** THE SYSTEM SHALL ask for notification permission only after the user turns reminders on.
- **R3.2** WHILE reminders are on and the app or its service worker is running THE SYSTEM SHALL notify once when an item becomes due-soon and once 1 h before due.
- **R3.3** THE SYSTEM SHALL state in the UI and README that reminders only fire while the app or its service worker is running, because there is no push server.
- **R3.4** IF permission is denied or the Notification API is missing THEN THE SYSTEM SHALL explain this and keep in-app indicators working.

## Requirement 4: backup and restore entry points

**User Story:** As a user, I want to download and restore my graveyard.

#### Acceptance Criteria

- **R4.1** WHEN the user chooses "Download backup" THE SYSTEM SHALL save the deadline-engine backup JSON as a file.
- **R4.2** WHEN the user chooses "Restore backup" THE SYSTEM SHALL confirm before replacing data and report the deadline-engine validation result.

## Requirement 5: optional LLM adapter

**User Story:** As a judge, I want everything to work without any API key; as a power user, I want optional help with messy pages.

#### Acceptance Criteria

- **R5.1** THE SYSTEM SHALL route every LLM call through one `LlmProvider` interface with providers `none`, `gemini`, `groq` and `ollama`.
- **R5.2** THE SYSTEM SHALL use provider `none` by default, which uses only rule-based logic and makes no network calls.
- **R5.3** WHEN the user selects a provider that needs a key THE SYSTEM SHALL store the key only in the browser and never send it anywhere except that provider's API.
- **R5.4** IF an LLM call fails or returns output that fails validation THEN THE SYSTEM SHALL fall back to the `none` result and say so.
- **R5.5** THE SYSTEM SHALL label LLM-suggested values as suggestions that the user must confirm.
