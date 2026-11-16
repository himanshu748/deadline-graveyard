// "Fill from the link" and "paste page text" helpers inside the add form (capture-and-export R1.1,
// R1.7, R1.8, R5.5). Nothing here saves: it only proposes values that the user sees, can edit and
// confirms with the form's own save button.
import { useState } from 'preact/hooks';
import { CAPTURE_MESSAGES, datesFromMeta, type CaptureResult } from '../capture/client.ts';
import { findDateCandidates, type DateCandidate } from '../capture/dates.ts';
import { extractMeta, htmlToText, type Extracted } from '../capture/extract.ts';
import { suggestDeadline, type LlmProvider } from '../llm/provider.ts';

export interface CaptureApply {
  title?: string;
  candidate?: DateCandidate;
}

export interface CapturePanelProps {
  url: string;
  userZone: string;
  capture: (url: string) => Promise<CaptureResult>;
  llm: LlmProvider;
  llmName: string;
  onApply: (values: CaptureApply) => void;
}

export const PASTE_MAX_LENGTH = 100_000;

export function candidateLabel(c: DateCandidate): string {
  const when = c.time ? `${c.date} ${c.time}` : `${c.date} (no time, end of day)`;
  return `${when}, ${c.zone}${c.zoneAssumed ? ' (zone assumed)' : ''}`;
}

export function CapturePanel({ url, userZone, capture, llm, llmName, onApply }: CapturePanelProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [candidates, setCandidates] = useState<DateCandidate[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');

  const showCandidates = (found: DateCandidate[], title: string | undefined, origin: string, note = '') => {
    setCandidates(found);
    const first = found[0];
    const apply: CaptureApply = {};
    if (title) apply.title = title;
    if (first) apply.candidate = first;
    if (title || first) onApply(apply);
    const parts = [title ? 'the name' : null, first ? 'the date' : null].filter(Boolean).join(' and ');
    if (!first) {
      setMessage(`${parts ? `Filled in ${parts} from ${origin}. ` : ''}No date was found. Enter the date below${pasteOpen ? '' : ', or paste the page text'}.`);
      return;
    }
    setMessage(`Filled in ${parts} from ${origin}.${note} Check every field before you save.${found.length > 1 ? ' Other dates found are listed below.' : ''}`);
  };

  // A bare <time> element is the weakest source: it is often a publish or update date.
  const sourceNote = (meta: Extracted) =>
    meta.dateSource === 'time-element' ? ' The date came from a date shown on the page, which may be when it was published rather than the deadline.' : '';

  const fillFromLink = async () => {
    if (url.trim() === '') {
      setMessage('Paste a link first.');
      return;
    }
    setBusy(true);
    setMessage('Reading the page...');
    setCandidates([]);
    const result = await capture(url.trim());
    setBusy(false);
    if (!result.ok) {
      setMessage(`${CAPTURE_MESSAGES[result.error]} The link is kept. Enter the details below, or paste the page text.`);
      setPasteOpen(true);
      return;
    }
    showCandidates(datesFromMeta(result.value, userZone), result.value.title, 'the page', sourceNote(result.value));
  };

  const findInText = () => {
    const text = pasted.slice(0, PASTE_MAX_LENGTH);
    if (text.trim() === '') {
      setMessage('Paste some text from the page first.');
      return;
    }
    const looksLikeHtml = /<[a-z!][^>]*>/i.test(text);
    const meta = looksLikeHtml ? extractMeta(text, url) : null;
    const fromMeta = meta ? datesFromMeta(meta, userZone) : [];
    const fromText = findDateCandidates(looksLikeHtml ? htmlToText(text) : text, userZone);
    const all = [...fromMeta, ...fromText.filter((c) => !fromMeta.some((m) => m.date === c.date && m.time === c.time && m.zone === c.zone))];
    showCandidates(all, meta?.title, 'the pasted text');
  };

  const askLlm = async () => {
    const text = pasted.slice(0, PASTE_MAX_LENGTH);
    if (text.trim() === '') {
      setMessage('Paste some text from the page first.');
      return;
    }
    setBusy(true);
    setMessage(`Asking ${llmName}...`);
    const { suggestion, fellBack } = await suggestDeadline(llm, text, userZone);
    setBusy(false);
    if (!suggestion) {
      setMessage(`${fellBack ? `${llmName} did not give a usable answer, and the` : 'The'} rule-based finder found no date. Enter it below.`);
      return;
    }
    const apply: CaptureApply = {};
    if (suggestion.title) apply.title = suggestion.title;
    if (suggestion.date) {
      const c: DateCandidate = { text: 'suggestion', date: suggestion.date, zone: suggestion.zone ?? userZone, zoneAssumed: suggestion.zone === undefined };
      if (suggestion.time) c.time = suggestion.time;
      apply.candidate = c;
    }
    onApply(apply);
    setCandidates([]);
    setMessage(
      fellBack
        ? `${llmName} did not give a usable answer, so the rule-based finder filled this in. Check it before you save.`
        : `Suggested by ${llmName}. This is a suggestion: check every field before you save.`,
    );
  };

  return (
    <div class="capture">
      <div class="capture-actions">
        <button type="button" class="btn btn-small" onClick={() => void fillFromLink()} disabled={busy} aria-describedby="capture-hint">
          Fill in from the link
        </button>
        <button type="button" class="btn btn-small" aria-expanded={pasteOpen} aria-controls="capture-paste" onClick={() => setPasteOpen(!pasteOpen)}>
          Paste page text instead
        </button>
      </div>
      <span class="hint" id="capture-hint">
        Reads only the page title and dates. Nothing is saved until you light the candle.
      </span>
      <p class="capture-status" role="status" aria-live="polite">
        {message}
      </p>
      {candidates.length > 1 ? (
        <fieldset class="capture-candidates">
          <legend>Dates found</legend>
          <ul>
            {candidates.map((c) => (
              <li key={`${c.date}|${c.time ?? ''}|${c.zone}`}>
                <button type="button" class="btn btn-small" onClick={() => onApply({ candidate: c })}>
                  Use {candidateLabel(c)}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
      {pasteOpen ? (
        <div class="field" id="capture-paste">
          <label for="f-paste">Page text</label>
          <textarea id="f-paste" rows={5} maxLength={PASTE_MAX_LENGTH} value={pasted} onInput={(e) => setPasted(e.currentTarget.value)} aria-describedby="f-paste-hint" />
          <span class="hint" id="f-paste-hint">
            Copy the part of the page with the deadline. It stays in this browser{llm.id === 'none' ? '' : ` unless you ask ${llmName}`}.
          </span>
          <div class="capture-actions">
            <button type="button" class="btn btn-small" onClick={findInText} disabled={busy}>
              Find dates in the text
            </button>
            {llm.id === 'none' ? null : (
              <button type="button" class="btn btn-small" onClick={() => void askLlm()} disabled={busy}>
                Ask {llmName} (sends this text to {llmName})
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
