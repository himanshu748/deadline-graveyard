// "Export and settings" dialog: .ics export, JSON backup and restore, reminders and the optional
// AI helper (capture-and-export R2, R3, R4, R5). Every action is a button the user presses.
import { useState } from 'preact/hooks';
import type { BackupError } from '../storage/backup.ts';
import type { ProviderId } from '../llm/provider.ts';
import { DEFAULT_MODELS, DEFAULT_OLLAMA_URL, type ProviderSettings } from '../llm/providers.ts';
import type { PermissionState } from '../notifications/notify.ts';
import type { Result } from '../domain/types.ts';
import { Modal } from './Modal.tsx';

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  none: 'None (rule-based, works offline)',
  gemini: 'Google Gemini (free tier, your key)',
  groq: 'Groq (free tier, your key)',
  ollama: 'Ollama (runs on your computer)',
};

export const PROVIDER_SHORT: Record<ProviderId, string> = { none: 'rules', gemini: 'Gemini', groq: 'Groq', ollama: 'Ollama' };

export interface ToolsDialogProps {
  unresolvedCount: number;
  onExportIcs: () => void;
  onDownloadBackup: () => Promise<void>;
  /** Replaces all data. Resolves to the number of restored items or the validation error. */
  onRestore: (text: string) => Promise<Result<number, BackupError>>;
  remindersOn: boolean;
  permission: PermissionState;
  onToggleReminders: () => Promise<void>;
  llm: ProviderSettings;
  onSaveLlm: (settings: ProviderSettings) => boolean;
  onClose: () => void;
}

const MAX_BACKUP_BYTES = 20_000_000;

export function ToolsDialog(props: ToolsDialogProps) {
  const { unresolvedCount, onExportIcs, onDownloadBackup, onRestore, remindersOn, permission, onToggleReminders, llm, onSaveLlm, onClose } = props;
  const [backupMessage, setBackupMessage] = useState('');
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null);
  const [draft, setDraft] = useState<ProviderSettings>(llm);
  const [llmMessage, setLlmMessage] = useState('');
  const titleId = 'tools-title';

  const pickFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setBackupMessage('That file is too large to be a Deadline Graveyard backup.');
      return;
    }
    setPending({ name: file.name, text: await file.text() });
    setBackupMessage('');
  };

  const confirmRestore = async () => {
    if (!pending) return;
    const result = await onRestore(pending.text);
    setPending(null);
    setBackupMessage(
      result.ok
        ? `Restored ${result.value} deadline${result.value === 1 ? '' : 's'} from the backup.`
        : `Nothing was changed. That file is not a valid backup: ${result.error.path} ${result.error.reason}.`,
    );
  };

  const set = (patch: Partial<ProviderSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const field = (key: keyof Omit<ProviderSettings, 'provider'>, value: string) => {
    setDraft((d) => {
      const next = { ...d };
      if (value.trim() === '') delete next[key];
      else next[key] = value.trim();
      return next;
    });
  };

  const saveLlm = (e: Event) => {
    e.preventDefault();
    const needsKey = (draft.provider === 'gemini' && !draft.geminiKey) || (draft.provider === 'groq' && !draft.groqKey);
    const saved = onSaveLlm(draft);
    setLlmMessage(
      !saved
        ? 'This browser would not store the setting (storage is blocked), so it lasts until the tab closes.'
        : needsKey
          ? 'Saved. Without a key the app keeps using the rule-based finder.'
          : `Saved. ${draft.provider === 'none' ? 'No AI is used.' : `${PROVIDER_SHORT[draft.provider]} is only asked when you press its button in the add form.`}`,
    );
  };

  const permissionNote: Record<PermissionState, string> = {
    granted: '',
    default: '',
    denied: 'Notifications are blocked for this site in your browser settings. The candles still show what is due.',
    unsupported: 'This browser has no notifications. The candles still show what is due.',
  };

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <h2 id={titleId}>Export and settings</h2>

      <section class="tools-section" aria-labelledby="tools-calendar">
        <h3 id="tools-calendar">Calendar</h3>
        <p class="hint">An .ics file with your {unresolvedCount} unresolved deadline{unresolvedCount === 1 ? '' : 's'}, for Google Calendar, Apple Calendar or Outlook. Demo items are marked [Demo].</p>
        <button type="button" class="btn" onClick={onExportIcs} disabled={unresolvedCount === 0}>
          Export to calendar (.ics)
        </button>
      </section>

      <section class="tools-section" aria-labelledby="tools-backup">
        <h3 id="tools-backup">Backup</h3>
        <p class="hint">A JSON file with every deadline and setting. AI keys are not included.</p>
        <div class="panel-actions">
          <button type="button" class="btn" onClick={() => void onDownloadBackup()}>
            Download backup
          </button>
          <label class="btn file-button">
            Restore backup
            <input type="file" accept="application/json,.json" class="visually-hidden" onChange={(e) => void pickFile(e)} />
          </label>
        </div>
        {pending ? (
          <div class="confirm" role="group" aria-labelledby="restore-q">
            <p id="restore-q">Replace everything in this browser with {pending.name}? This cannot be undone, so download a backup first if unsure.</p>
            <div class="panel-actions">
              <button type="button" class="btn btn-danger" onClick={() => void confirmRestore()}>
                Replace my graveyard
              </button>
              <button type="button" class="btn" onClick={() => setPending(null)}>
                Keep what I have
              </button>
            </div>
          </div>
        ) : null}
        <p role="status" class="hint">
          {backupMessage}
        </p>
      </section>

      <section class="tools-section" aria-labelledby="tools-reminders">
        <h3 id="tools-reminders">Reminders</h3>
        <button type="button" class="btn switch" role="switch" aria-checked={remindersOn} disabled={permission === 'unsupported'} aria-describedby="reminders-limit" onClick={() => void onToggleReminders()}>
          <span class="switch-track" aria-hidden="true" />
          Browser reminders
        </button>
        <p class="hint" id="reminders-limit">
          One notification when a candle enters its last 24 hours and one an hour before it burns out. They only fire while this app is open in a tab: there is no push server, so a closed tab cannot remind you. In a background tab the browser may slow timers, so a reminder can arrive a minute or more late.
        </p>
        {permissionNote[permission] ? <p class="hint">{permissionNote[permission]}</p> : null}
      </section>

      <section class="tools-section" aria-labelledby="tools-ai">
        <h3 id="tools-ai">Optional AI helper</h3>
        <p class="hint">Off by default. Everything works without it. When on, it only reads text you paste in the add form and you confirm whatever it suggests.</p>
        <form onSubmit={saveLlm} noValidate>
          <div class="field">
            <label for="llm-provider">Provider</label>
            <select id="llm-provider" value={draft.provider} onChange={(e) => set({ provider: e.currentTarget.value as ProviderId })}>
              {(Object.keys(PROVIDER_NAMES) as ProviderId[]).map((id) => (
                <option key={id} value={id}>
                  {PROVIDER_NAMES[id]}
                </option>
              ))}
            </select>
          </div>
          {draft.provider === 'gemini' || draft.provider === 'groq' ? (
            <>
              <div class="field">
                <label for="llm-key">API key</label>
                <input
                  id="llm-key"
                  type="password"
                  autoComplete="off"
                  spellcheck={false}
                  value={(draft.provider === 'gemini' ? draft.geminiKey : draft.groqKey) ?? ''}
                  onInput={(e) => field(draft.provider === 'gemini' ? 'geminiKey' : 'groqKey', e.currentTarget.value)}
                  aria-describedby="llm-key-hint"
                />
                <span class="hint" id="llm-key-hint">
                  Kept only in this browser (localStorage) and sent only to {PROVIDER_SHORT[draft.provider]}. Use a free-tier key.
                  {draft.provider === 'gemini' ? ' On the free tier, Google may use what you send to improve its products.' : ''}
                </span>
              </div>
              <div class="field">
                <label for="llm-model">Model</label>
                <input
                  id="llm-model"
                  value={(draft.provider === 'gemini' ? draft.geminiModel : draft.groqModel) ?? ''}
                  placeholder={DEFAULT_MODELS[draft.provider]}
                  onInput={(e) => field(draft.provider === 'gemini' ? 'geminiModel' : 'groqModel', e.currentTarget.value)}
                />
              </div>
            </>
          ) : null}
          {draft.provider === 'ollama' ? (
            <>
              <div class="field">
                <label for="llm-ollama-url">Ollama address</label>
                <input id="llm-ollama-url" type="url" value={draft.ollamaUrl ?? ''} placeholder={DEFAULT_OLLAMA_URL} onInput={(e) => field('ollamaUrl', e.currentTarget.value)} aria-describedby="llm-ollama-hint" />
                <span class="hint" id="llm-ollama-hint">
                  Ollama accepts browser requests from 127.0.0.1 by default. For the hosted app, start it with OLLAMA_ORIGINS set to this site.
                </span>
              </div>
              <div class="field">
                <label for="llm-ollama-model">Model</label>
                <input id="llm-ollama-model" value={draft.ollamaModel ?? ''} placeholder={DEFAULT_MODELS.ollama} onInput={(e) => field('ollamaModel', e.currentTarget.value)} />
              </div>
            </>
          ) : null}
          <div class="panel-actions">
            <button type="submit" class="btn">
              Save AI setting
            </button>
          </div>
          <p role="status" class="hint">
            {llmMessage}
          </p>
        </form>
      </section>

      <div class="panel-actions">
        <button type="button" class="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
