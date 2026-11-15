// Screen-reader list view of the whole scene (accessible-list-view R1.1 to R1.5). It renders the
// same view model as the scene, grouped by status, with the same actions.
import type { ViewEntry, ViewModel, EntryAction } from './view-model.ts';
import { ACTION_LABELS } from './view-model.ts';
import { NO_EPITAPH } from '../scene/Tombstone.tsx';

export const LIST_HEADING_ID = 'list-heading';

export interface ListViewProps {
  vm: ViewModel;
  onOpen: (id: string, opener: HTMLElement) => void;
  onAction: (id: string, action: EntryAction, opener: HTMLElement) => void;
}

function Entry({ entry, onOpen, onAction }: { entry: ViewEntry } & Omit<ListViewProps, 'vm'>) {
  const showsEpitaph = entry.status === 'missed' || entry.status === 'buried';
  return (
    <li class="entry" data-id={entry.id} data-status={entry.status}>
      <h4 class="entry-title">
        {entry.title}
        {entry.demo ? <span class="badge-demo">Demo</span> : null}
      </h4>
      <p class="entry-meta">
        <span class="entry-status" data-status={entry.status}>
          {entry.statusText}
        </span>
        {`, ${entry.relativeText}. Due ${entry.dueText}.`}
      </p>
      {entry.sourceDueText ? <p class="entry-meta">Deadline's own time: {entry.sourceDueText}.</p> : null}
      {showsEpitaph ? (
        <p class="epitaph">
          <span class="visually-hidden">Epitaph: </span>
          {entry.epitaph ?? NO_EPITAPH}
        </p>
      ) : null}
      <div class="actions">
        <button type="button" class="btn btn-small" data-return-id={entry.id} onClick={(e) => onOpen(entry.id, e.currentTarget)}>
          Details<span class="visually-hidden">: {entry.title}</span>
        </button>
        {entry.actions.map((action) => (
          <button
            key={action}
            type="button"
            class={action === 'bury' ? 'btn btn-small btn-danger' : 'btn btn-small'}
            onClick={(e) => onAction(entry.id, action, e.currentTarget)}
          >
            {ACTION_LABELS[action]}
            <span class="visually-hidden">: {entry.title}</span>
          </button>
        ))}
      </div>
    </li>
  );
}

export function ListView({ vm, onOpen, onAction }: ListViewProps) {
  const count = vm.entries.length;
  return (
    <section class="list-view" aria-labelledby={LIST_HEADING_ID}>
      <h2 id={LIST_HEADING_ID} tabIndex={-1}>
        Every grave, in words
      </h2>
      <p>
        {count === 0
          ? 'No deadlines yet. Add one to light the first candle.'
          : `${count} deadline${count === 1 ? '' : 's'}. This list shows everything in the graveyard scene, grouped by state.`}
      </p>
      {vm.groups.map((group) => {
        const id = `group-${group.status}`;
        return (
          <section key={group.status} class="group" aria-labelledby={id} data-group={group.status}>
            <h3 id={id}>
              {group.heading} ({group.ids.length})
            </h3>
            <ul class="entries">
              {group.ids.map((entryId) => {
                const entry = vm.entries.find((e) => e.id === entryId);
                return entry ? <Entry key={entryId} entry={entry} onOpen={onOpen} onAction={onAction} /> : null;
              })}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
