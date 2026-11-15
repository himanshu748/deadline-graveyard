// Detail panel for one item: status, times, epitaph editor and every action (accessible-list-view
// R1.4, R2.3, R2.4). The same actions the list view offers, plus delete.
import { useState } from 'preact/hooks';
import { EPITAPH_MAX_LENGTH } from '../domain/actions.ts';
import { Modal } from './Modal.tsx';
import type { EntryAction, ViewEntry } from './view-model.ts';
import { ACTION_LABELS } from './view-model.ts';

export interface DetailDialogProps {
  entry: ViewEntry;
  /** Runs an action. Resolves to an error message, or null on success. */
  onAction: (action: Exclude<EntryAction, 'edit' | 'epitaph'>) => Promise<string | null>;
  onSaveEpitaph: (text: string) => Promise<string | null>;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

const SUCCESS: Record<'submit' | 'revive' | 'bury', string> = {
  submit: 'Submitted. A lantern is lit on the fence.',
  revive: 'Revived. The project is active again.',
  bury: 'Buried. Its tombstone stands in the graveyard.',
};

export function DetailDialog({ entry, onAction, onSaveEpitaph, onEdit, onDelete, onClose }: DetailDialogProps) {
  const [epitaph, setEpitaph] = useState(entry.epitaph ?? '');
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleId = `detail-title-${entry.id}`;
  const canEpitaph = entry.actions.includes('epitaph');
  const direct = entry.actions.filter((a): a is 'submit' | 'revive' | 'bury' => a === 'submit' || a === 'revive' || a === 'bury');

  const run = async (action: 'submit' | 'revive' | 'bury') => {
    const error = await onAction(action);
    setMessage(error ? { kind: 'error', text: error } : { kind: 'success', text: SUCCESS[action] });
  };

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <button type="button" class="btn btn-small panel-close" onClick={onClose}>
        Close
      </button>
      <h2 id={titleId}>
        {entry.title}
        {entry.demo ? <span class="badge-demo">Demo</span> : null}
      </h2>
      <p>
        <span class="entry-status" data-status={entry.status}>
          {entry.statusText}
        </span>
        {`, ${entry.relativeText}.`}
      </p>
      <p>Due {entry.dueText}.</p>
      {entry.sourceDueText ? <p class="entry-meta">Deadline's own time: {entry.sourceDueText}.</p> : null}

      {canEpitaph ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const error = await onSaveEpitaph(epitaph);
            setMessage(error ? { kind: 'error', text: error } : { kind: 'success', text: 'Epitaph engraved.' });
          }}
        >
          <div class="field">
            <label for={`epitaph-${entry.id}`}>Epitaph: what did you learn?</label>
            <textarea
              id={`epitaph-${entry.id}`}
              rows={3}
              maxLength={EPITAPH_MAX_LENGTH}
              value={epitaph}
              onInput={(e) => setEpitaph(e.currentTarget.value)}
              aria-describedby={`epitaph-hint-${entry.id}`}
            />
            <span class="hint" id={`epitaph-hint-${entry.id}`}>
              Up to {EPITAPH_MAX_LENGTH} characters. Leave it empty to clear it.
            </span>
          </div>
          <button type="submit" class="btn">
            Save epitaph
          </button>
        </form>
      ) : null}

      <div class="panel-actions">
        {direct.map((action) => (
          <button key={action} type="button" class={action === 'bury' ? 'btn btn-danger' : action === 'submit' ? 'btn btn-primary' : 'btn'} onClick={() => void run(action)}>
            {ACTION_LABELS[action]}
          </button>
        ))}
        {entry.actions.includes('edit') ? (
          <button type="button" class="btn" onClick={onEdit}>
            {ACTION_LABELS.edit}
          </button>
        ) : null}
        {confirmDelete ? (
          <>
            <button type="button" class="btn btn-danger" onClick={() => void onDelete()}>
              Delete for good
            </button>
            <button type="button" class="btn" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button type="button" class="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        )}
      </div>
      <p role="status" class={message?.kind === 'error' ? 'error' : 'success'}>
        {message?.text ?? ''}
      </p>
    </Modal>
  );
}
