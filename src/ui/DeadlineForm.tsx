// Add and edit form. Times are entered as wall-clock date and time in a chosen IANA zone, which
// defaults to the user's zone, and converted with domain/time.ts toInstant (deadline-engine R3).
import { useState } from 'preact/hooks';
import { toInstant, toLocal, type ConversionError } from '../domain/time.ts';
import type { Item } from '../domain/types.ts';
import type { CaptureResult } from '../capture/client.ts';
import type { LlmProvider } from '../llm/provider.ts';
import { CapturePanel, type CaptureApply } from './CapturePanel.tsx';
import { Modal } from './Modal.tsx';

export interface DeadlineValues {
  title: string;
  url?: string;
  dueAt: number;
  zone: string;
  dateOnly: boolean;
}

export interface DeadlineFormProps {
  /** Present when editing. */
  item?: Item;
  userZone: string;
  onSave: (values: DeadlineValues) => Promise<string | null>;
  onCancel: () => void;
  /** Add-from-URL helpers (capture-and-export). Shown when adding, not when editing. */
  capture?: {
    fetchMeta: (url: string) => Promise<CaptureResult>;
    llm: LlmProvider;
    llmName: string;
  };
}

export const TITLE_MAX_LENGTH = 120;

const CONVERSION_ERRORS: Record<ConversionError, string> = {
  'invalid-zone': 'Choose a time zone from the list.',
  'invalid-date': 'Enter a real date, for example 2026-12-04.',
  'invalid-time': 'Enter a time like 14:00, or tick "No specific time".',
};

/** Every IANA zone the browser knows, plus the ones in use, sorted. */
export function zoneOptions(userZone: string, extra?: string): string[] {
  let zones: string[];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  const set = new Set([...zones, userZone, 'UTC']);
  if (extra) set.add(extra);
  return [...set].sort();
}

export function DeadlineForm({ item, userZone, onSave, onCancel, capture }: DeadlineFormProps) {
  const initialZone = item?.zone ?? userZone;
  const local = item ? toLocal(item.dueAt, item.zone) : null;
  const [title, setTitle] = useState(item?.title ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [date, setDate] = useState(local?.date ?? '');
  const [time, setTime] = useState(local && !item?.dateOnly ? local.time.slice(0, 5) : '');
  const [dateOnly, setDateOnly] = useState(item?.dateOnly ?? false);
  const [zone, setZone] = useState(initialZone);
  const [error, setError] = useState<string | null>(null);
  const titleId = item ? 'form-title-edit' : 'form-title-add';

  // R1.2, R1.7: prefilled values land in the normal fields, so they stay editable.
  const applyCapture = ({ title: found, candidate }: CaptureApply) => {
    if (found) setTitle(found.slice(0, TITLE_MAX_LENGTH));
    if (candidate) {
      setDate(candidate.date);
      setTime(candidate.time ?? '');
      setDateOnly(candidate.time === undefined);
      setZone(candidate.zone);
    }
    setError(null);
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    const name = title.trim();
    if (name.length === 0) return setError('Give the deadline a name.');
    const trimmedUrl = url.trim();
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) return setError('Links must start with http:// or https://.');
    if (!dateOnly && time === '') return setError(CONVERSION_ERRORS['invalid-time']);
    const converted = toInstant(dateOnly ? { date, zone } : { date, time, zone });
    if (!converted.ok) return setError(CONVERSION_ERRORS[converted.error]);
    const values: DeadlineValues = { title: name, dueAt: converted.epochMs, zone, dateOnly };
    if (trimmedUrl) values.url = trimmedUrl;
    const failed = await onSave(values);
    if (failed) setError(failed);
  };

  return (
    <Modal titleId={titleId} onClose={onCancel}>
      <h2 id={titleId}>{item ? 'Edit deadline' : 'Light a new candle'}</h2>
      <form onSubmit={submit} noValidate>
        <div class="field">
          <label for="f-title">Name</label>
          <input id="f-title" required maxLength={TITLE_MAX_LENGTH} value={title} onInput={(e) => setTitle(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="f-url">Link (optional)</label>
          <input id="f-url" type="url" inputMode="url" placeholder="https://" value={url} onInput={(e) => setUrl(e.currentTarget.value)} aria-describedby="f-url-hint" />
          <span class="hint" id="f-url-hint">
            Optional. Saved with the deadline{capture && !item ? '; use the buttons below to fill in the name and date from it' : ''}.
          </span>
        </div>
        {capture && !item ? (
          <CapturePanel url={url} userZone={userZone} capture={capture.fetchMeta} llm={capture.llm} llmName={capture.llmName} onApply={applyCapture} />
        ) : null}
        <div class="row">
          <div class="field">
            <label for="f-date">Date</label>
            <input id="f-date" type="date" required value={date} onInput={(e) => setDate(e.currentTarget.value)} />
          </div>
          <div class="field">
            <label for="f-time">Time</label>
            <input id="f-time" type="time" disabled={dateOnly} value={dateOnly ? '' : time} onInput={(e) => setTime(e.currentTarget.value)} />
          </div>
        </div>
        <div class="field check">
          <input id="f-date-only" type="checkbox" checked={dateOnly} onChange={(e) => setDateOnly(e.currentTarget.checked)} />
          <label for="f-date-only">No specific time (due at the end of that day, 23:59:59)</label>
        </div>
        <div class="field">
          <label for="f-zone">Time zone of the deadline</label>
          <select id="f-zone" value={zone} onChange={(e) => setZone(e.currentTarget.value)} aria-describedby="f-zone-hint">
            {zoneOptions(userZone, zone).map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <span class="hint" id="f-zone-hint">
            Your zone is {userZone}. Pick the organiser's zone if it is different; times are always shown in yours.
          </span>
        </div>
        <p role="alert" class="error">
          {error ?? ''}
        </p>
        <div class="panel-actions">
          <button type="submit" class="btn btn-primary">
            {item ? 'Save changes' : 'Light the candle'}
          </button>
          <button type="button" class="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
