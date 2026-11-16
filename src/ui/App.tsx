// App shell: one clock, one item list, two renderings (scene and list) of the same view model.
// Specs: graveyard-scene, accessible-list-view. Persistence: storage/repository.ts.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fetchPageMeta, type CaptureResult } from '../capture/client.ts';
import { toIcs } from '../capture/ics.ts';
import { bury, editDue, revive, setEpitaph, submit } from '../domain/actions.ts';
import { toLocal } from '../domain/time.ts';
import type { ActionErrorCode, EpochMs, Item, Result, Status } from '../domain/types.ts';
import { layoutScene } from '../scene/layout.ts';
import { initialMotion, pauseWhenHidden, REDUCED_MOTION_QUERY, type MotionMode } from '../scene/motion.ts';
import { Scene } from '../scene/Scene.tsx';
import { createSound, isSoundSupported, type Sound } from '../scene/sound.ts';
import { createProvider } from '../llm/providers.ts';
import { loadLlmSettings, saveLlmSettings } from '../llm/settings.ts';
import { browserNotifier, type Notifier, type PermissionState } from '../notifications/notify.ts';
import { dueReminders, keysToMark, pruneSent } from '../notifications/reminders.ts';
import { addRecord, lastSeanceAt, parseHistory, SETTING_SEANCE_HISTORY } from '../seance/history.ts';
import { buildPlan, isSeanceDue, type PlanStep, type SeanceAnswers, type SeanceRecord } from '../seance/plan.ts';
import { Seance } from '../seance/Seance.tsx';
import { serializeBackup } from '../storage/backup.ts';
import { openRepository, type Repository } from '../storage/repository.ts';
import { createAnnouncer, type Announcer } from './announcer.ts';
import { DeadlineForm, type DeadlineValues } from './DeadlineForm.tsx';
import { DetailDialog } from './DetailDialog.tsx';
import { downloadText } from './download.ts';
import { LIST_HEADING_ID, ListView } from './ListView.tsx';
import { PROVIDER_SHORT, ToolsDialog } from './ToolsDialog.tsx';
import { CHANGE_MESSAGES, deriveViewModel, diffStatuses, type EntryAction } from './view-model.ts';

export type ViewChoice = 'scene' | 'list';

export const SETTING_MOTION = 'motion';
export const SETTING_VIEW = 'view';
export const SETTING_SOUND = 'sound';
export const SETTING_REMINDERS = 'reminders';
export const SETTING_REMINDERS_SENT = 'reminders-sent';

export interface AppProps {
  open?: () => Promise<{ repo: Repository; persistent: boolean }>;
  clock?: () => EpochMs;
  userZone?: string;
  locale?: string;
  makeSound?: () => Sound;
  matchMedia?: (query: string) => MediaQueryList | null;
  newId?: () => string;
  fetchMeta?: (url: string) => Promise<CaptureResult>;
  notifier?: Notifier;
  /** Where LLM settings (and keys) live. Never the IndexedDB repository, so keys stay out of backups. */
  llmStorage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

type DialogState = null | { kind: 'detail'; id: string } | { kind: 'form'; id?: string } | { kind: 'tools' } | { kind: 'seance' };

const ACTION_ERRORS: Record<ActionErrorCode, string> = {
  resolved: 'This deadline is already resolved.',
  'past-due': 'The deadline has passed, so it can no longer be submitted.',
  'not-ghost': 'Only ghosts can be revived.',
  'not-missed-or-ghost': 'Only missed deadlines and ghosts can be buried.',
  'not-missed-or-buried': 'Epitaphs are for missed and buried deadlines.',
  invalid: 'That value is not valid.',
};

function defaultMatchMedia(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
}

export function App({
  open = openRepository,
  clock = () => Date.now(),
  userZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  locale = typeof navigator !== 'undefined' ? navigator.language : 'en',
  makeSound = createSound,
  matchMedia = defaultMatchMedia,
  newId = () => crypto.randomUUID(),
  fetchMeta = (url) => fetchPageMeta(url),
  notifier = browserNotifier,
  llmStorage,
}: AppProps) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [now, setNow] = useState<EpochMs>(() => clock());
  const [view, setView] = useState<ViewChoice>('scene');
  const [savedMotion, setSavedMotion] = useState<MotionMode | null>(null);
  const [osReduced, setOsReduced] = useState(() => matchMedia(REDUCED_MOTION_QUERY)?.matches ?? false);
  const [soundOn, setSoundOn] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [remindersOn, setRemindersOn] = useState(false);
  const [permission, setPermission] = useState<PermissionState>(() => notifier.permission());
  const [llmSettings, setLlmSettings] = useState(() => (llmStorage === undefined ? loadLlmSettings() : loadLlmSettings(llmStorage)));
  const [seances, setSeances] = useState<SeanceRecord[]>([]);
  const [inviteHidden, setInviteHidden] = useState(false);
  const sentReminders = useRef<Set<string>>(new Set());
  const sound = useRef<Sound | null>(null);
  const opener = useRef<{ el: HTMLElement | SVGElement; id: string | null } | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const announcer = useRef<Announcer | null>(null);
  const prevStatuses = useRef<Map<string, Status> | null>(null);

  const clockRef = useRef(clock);
  clockRef.current = clock;
  const mode = initialMotion({ matches: osReduced }, savedMotion);

  // Items and saved settings, on start and after a restore.
  const loadFrom = async (from: Repository) => {
    const [list, motion, savedView, savedSound, reminders, sent, history] = await Promise.all([
      from.list(),
      from.getSetting(SETTING_MOTION),
      from.getSetting(SETTING_VIEW),
      from.getSetting(SETTING_SOUND),
      from.getSetting(SETTING_REMINDERS),
      from.getSetting(SETTING_REMINDERS_SENT),
      from.getSetting(SETTING_SEANCE_HISTORY),
    ]);
    return { list, motion, savedView, savedSound, reminders, sent, history };
  };

  const applyLoaded = (loaded: Awaited<ReturnType<typeof loadFrom>>) => {
    const { list, motion, savedView, savedSound, reminders, sent, history } = loaded;
    setItems(list);
    setSeances(parseHistory(history));
    if (motion === 'full' || motion === 'reduced') setSavedMotion(motion);
    if (savedView === 'scene' || savedView === 'list') setView(savedView);
    if (savedSound === 'on' && isSoundSupported()) setSoundOn(true);
    setRemindersOn(reminders === 'on');
    sentReminders.current = new Set(Array.isArray(sent) ? sent.filter((k): k is string => typeof k === 'string') : []);
  };

  // Load data and saved settings once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const opened = await open();
      const loaded = await loadFrom(opened.repo);
      if (cancelled) return;
      applyLoaded(loaded);
      setPersistent(opened.persistent);
      setRepo(opened.repo);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The single clock (graveyard-scene: no per-component timers).
  useEffect(() => {
    const timer = setInterval(() => setNow(clockRef.current()), 1000);
    return () => clearInterval(timer);
  }, []);

  // R3.3: follow the media query while the user has not chosen.
  useEffect(() => {
    const mq = matchMedia(REDUCED_MOTION_QUERY);
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setOsReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [matchMedia]);

  useEffect(() => pauseWhenHidden(document), []);

  // Sound saved as on: the browser only allows audio after a gesture, so start on the first one.
  useEffect(() => {
    if (!soundOn || sound.current?.enabled) return;
    const start = () => {
      sound.current ??= makeSound();
      void sound.current.enable();
    };
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, [soundOn]);

  useEffect(() => {
    if (liveRef.current) announcer.current = createAnnouncer(liveRef.current);
  }, []);

  const vm = useMemo(() => deriveViewModel(items, now, userZone, locale), [items, now, userZone, locale]);

  // capture-and-export R3.2: reminders run on the same one-second clock while the tab is open.
  useEffect(() => {
    if (!repo || !remindersOn || permission !== 'granted') return;
    const fired = dueReminders(items, now, sentReminders.current);
    if (fired.length === 0) return;
    for (const key of keysToMark(items, fired)) sentReminders.current.add(key);
    for (const r of fired) void notifier.show(r.title, r.body, r.key).catch(() => {});
    void repo.putSetting(SETTING_REMINDERS_SENT, pruneSent(items, sentReminders.current));
  }, [now, items, repo, remindersOn, permission]);
  const layout = useMemo(() => layoutScene(items, now), [items, now]);
  const entriesById = useMemo(() => new Map(vm.entries.map((e) => [e.id, e])), [vm]);

  // R3.2: announce status changes once; R4.3: chime when a lantern lights.
  useEffect(() => {
    if (!repo) return;
    const next = new Map(vm.entries.map((e) => [e.id, e.status]));
    const prev = prevStatuses.current;
    prevStatuses.current = next;
    if (!prev) return;
    for (const change of diffStatuses(prev, next)) {
      const title = entriesById.get(change.id)?.title ?? 'A deadline';
      announcer.current?.announce(`${title} ${CHANGE_MESSAGES[change.to]}.`);
      if (change.to === 'submitted') sound.current?.chime();
    }
  }, [vm, repo, entriesById]);

  // Restore focus to whatever opened the dialog (R2.4).
  useEffect(() => {
    if (dialog !== null || !opener.current) return;
    const { el, id } = opener.current;
    opener.current = null;
    const fallback = id ? document.querySelector<HTMLElement | SVGElement>(`[data-id="${CSS.escape(id)}"].scene-item, [data-return-id="${CSS.escape(id)}"]`) : null;
    const target = el.isConnected ? el : (fallback ?? document.getElementById(LIST_HEADING_ID));
    target?.focus();
  }, [dialog]);

  const persist = async (next: Item) => {
    setItems((list) => {
      const others = list.filter((i) => i.id !== next.id);
      return [...others, next];
    });
    try {
      await repo?.put(next);
      setSaveError(null);
    } catch {
      setSaveError('Could not save the last change to this browser. It will be lost when the tab closes.');
    }
  };

  const findItem = (id: string) => items.find((i) => i.id === id);

  const applyResult = async (result: Result<Item>): Promise<string | null> => {
    if (!result.ok) return ACTION_ERRORS[result.error.code];
    await persist(result.value);
    return null;
  };

  const runAction = async (id: string, action: 'submit' | 'revive' | 'bury'): Promise<string | null> => {
    const item = findItem(id);
    if (!item) return 'That deadline no longer exists.';
    const at = clock();
    setNow(at);
    const fn = action === 'submit' ? submit : action === 'revive' ? revive : bury;
    return applyResult(fn(item, at));
  };

  const openDialog = (state: DialogState, el: HTMLElement | SVGElement, id: string | null) => {
    opener.current = { el, id };
    setDialog(state);
  };

  const onListAction = (id: string, action: EntryAction, el: HTMLElement) => {
    if (action === 'edit') return openDialog({ kind: 'form', id }, el, id);
    if (action === 'epitaph') return openDialog({ kind: 'detail', id }, el, id);
    void runAction(id, action).then((error) => {
      if (error) setSaveError(error);
    });
  };

  const saveForm = async (values: DeadlineValues, id?: string): Promise<string | null> => {
    const at = clock();
    setNow(at);
    if (id) {
      const item = findItem(id);
      if (!item) return 'That deadline no longer exists.';
      const result = editDue(item, values.dueAt, values.zone, values.dateOnly, at);
      if (!result.ok) return ACTION_ERRORS[result.error.code];
      const updated: Item = { ...result.value, title: values.title };
      if (values.url) updated.url = values.url;
      else delete updated.url;
      await persist(updated);
    } else {
      const created: Item = {
        id: newId(),
        title: values.title,
        dueAt: values.dueAt,
        zone: values.zone,
        dateOnly: values.dateOnly,
        createdAt: at,
        lastActivityAt: at,
        resolution: null,
        demo: false,
      };
      if (values.url) created.url = values.url;
      await persist(created);
    }
    setDialog(null);
    return null;
  };

  const unresolved = items.filter((i) => i.resolution === null);
  const today = () => toLocal(clock(), userZone).date;

  // capture-and-export R2.1: unresolved items only; demo items carry [Demo] (R2.2).
  const exportIcs = () => downloadText(`deadline-graveyard-${today()}.ics`, toIcs(unresolved, clock()), 'text/calendar;charset=utf-8');

  const downloadBackup = async () => {
    if (!repo) return;
    downloadText(`deadline-graveyard-backup-${today()}.json`, serializeBackup(await repo.exportBackup(clock())), 'application/json');
  };

  // R4.2: the dialog confirms first; the repository validates the whole file before writing.
  const restoreBackup = async (text: string) => {
    if (!repo) return { ok: false as const, error: { code: 'invalid-backup' as const, path: '$', reason: 'storage is not open yet' } };
    const result = await repo.importBackup(text);
    if (result.ok) {
      prevStatuses.current = null;
      applyLoaded(await loadFrom(repo));
    }
    return result;
  };

  // R3.1: permission is requested only from this click.
  const toggleReminders = async () => {
    if (remindersOn) {
      setRemindersOn(false);
      void repo?.putSetting(SETTING_REMINDERS, 'off');
      return;
    }
    const state = notifier.permission() === 'granted' ? 'granted' : await notifier.request();
    setPermission(state);
    if (state !== 'granted') return;
    setRemindersOn(true);
    void repo?.putSetting(SETTING_REMINDERS, 'on');
  };

  const saveLlm = (next: typeof llmSettings) => {
    setLlmSettings(next);
    return llmStorage === undefined ? saveLlmSettings(next) : saveLlmSettings(next, llmStorage);
  };

  const llm = useMemo(() => createProvider(llmSettings, userZone), [llmSettings, userZone]);

  // seance R1.3, R3.1: the plan is built from the items at this instant and saved with the answers.
  const finishSeance = async (answers: SeanceAnswers): Promise<{ record: SeanceRecord; error: string | null }> => {
    const at = clock();
    setNow(at);
    const record: SeanceRecord = { id: newId(), at, answers, plan: buildPlan(items, answers, at, { locale, zone: userZone }) };
    const next = addRecord(seances, record);
    setSeances(next);
    try {
      await repo?.putSetting(SETTING_SEANCE_HISTORY, next);
      return { record, error: null };
    } catch {
      return { record, error: 'The plan is ready, but this browser could not save it. It will be lost when the tab closes.' };
    }
  };

  // seance R2.6: one confirmed action at a time, through the same domain rules as the list view.
  const applySeanceStep = async (step: PlanStep): Promise<string | null> => {
    const item = findItem(step.itemId);
    if (!item) return 'That deadline no longer exists.';
    const at = clock();
    setNow(at);
    switch (step.action) {
      case 'revive':
        return applyResult(revive(item, at));
      case 'bury':
        return applyResult(bury(item, at));
      case 'epitaph':
        if (item.epitaph?.trim()) return 'This grave already has an epitaph. Change it from its details instead.';
        if (!step.epitaph) return ACTION_ERRORS.invalid;
        return applyResult(setEpitaph(item, step.epitaph, at));
      case 'work':
        return null;
    }
  };

  const seanceDue = isSeanceDue(lastSeanceAt(seances), now);

  const chooseView = (next: ViewChoice) => {
    setView(next);
    void repo?.putSetting(SETTING_VIEW, next);
  };

  const toggleMotion = () => {
    const next: MotionMode = mode === 'reduced' ? 'full' : 'reduced';
    setSavedMotion(next);
    void repo?.putSetting(SETTING_MOTION, next);
  };

  // R4.2: the AudioContext is created inside this click handler, never before.
  const toggleSound = () => {
    if (soundOn) {
      sound.current?.disable();
      setSoundOn(false);
      void repo?.putSetting(SETTING_SOUND, 'off');
      return;
    }
    sound.current ??= makeSound();
    void sound.current.enable();
    setSoundOn(true);
    void repo?.putSetting(SETTING_SOUND, 'on');
  };

  const detailEntry = dialog?.kind === 'detail' ? entriesById.get(dialog.id) : undefined;
  const formItem = dialog?.kind === 'form' && dialog.id ? findItem(dialog.id) : undefined;
  const soundSupported = isSoundSupported();

  return (
    <>
      <a
        class="skip-link"
        href={`#${LIST_HEADING_ID}`}
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(LIST_HEADING_ID)?.focus();
        }}
      >
        Skip to the list view
      </a>
      <header class="app-header">
        <div>
          <h1>Deadline Graveyard</h1>
          <p>Candles burn down in real time. Times are shown in {userZone}.</p>
        </div>
        <div class="toolbar">
          <button
            type="button"
            class="btn btn-primary"
            disabled={!repo}
            onClick={(e) => openDialog({ kind: 'form' }, e.currentTarget, null)}
          >
            Add deadline
          </button>
          <button type="button" class="btn" disabled={!repo} onClick={(e) => openDialog({ kind: 'tools' }, e.currentTarget, null)}>
            Export and settings
          </button>
          <button type="button" class="btn" disabled={!repo} data-return-id="seance" onClick={(e) => openDialog({ kind: 'seance' }, e.currentTarget, null)}>
            Hold a séance
          </button>
          <div class="segmented" role="group" aria-label="View">
            <button type="button" class="btn" aria-pressed={view === 'scene'} onClick={() => chooseView('scene')}>
              Scene and list
            </button>
            <button type="button" class="btn" aria-pressed={view === 'list'} onClick={() => chooseView('list')}>
              List only
            </button>
          </div>
          <button
            type="button"
            class="btn switch"
            role="switch"
            aria-checked={soundOn}
            disabled={!soundSupported}
            aria-describedby={soundSupported ? undefined : 'sound-unavailable'}
            onClick={toggleSound}
          >
            <span class="switch-track" aria-hidden="true" />
            Sound
          </button>
          {soundSupported ? null : (
            <span id="sound-unavailable" class="hint">
              This browser has no Web Audio.
            </span>
          )}
          <button type="button" class="btn switch" role="switch" aria-checked={mode === 'reduced'} onClick={toggleMotion}>
            <span class="switch-track" aria-hidden="true" />
            Reduce motion
          </button>
        </div>
      </header>
      <main>
        {!persistent ? (
          <p class="notice" role="status">
            This browser is not keeping data (IndexedDB is unavailable, for example in a private window). Your deadlines will be lost when the tab closes.
          </p>
        ) : null}
        {saveError ? (
          <p class="notice" role="alert">
            {saveError}
          </p>
        ) : null}
        {!repo ? <p class="list-view">Opening the graveyard...</p> : null}
        {repo && seanceDue && !inviteHidden && items.length > 0 ? (
          <div class="invite" data-testid="seance-invite">
            <p>
              {seances.length === 0
                ? 'The candles are ready for your first séance: three questions that become next week\'s plan.'
                : 'A week has passed since your last séance. Three questions, then next week\'s plan.'}
            </p>
            <div class="invite-actions">
              {/* A finished séance removes this banner, so focus then returns to "Hold a séance". */}
              <button type="button" class="btn btn-small btn-primary" onClick={(e) => openDialog({ kind: 'seance' }, e.currentTarget, 'seance')}>
                Begin the séance
              </button>
              <button type="button" class="btn btn-small" onClick={() => setInviteHidden(true)}>
                Not now
              </button>
            </div>
          </div>
        ) : null}
        {repo && view === 'scene' ? (
          <div class="scene-wrap">
            <p class="scene-hint">Scroll sideways to see the whole graveyard, or use the list below.</p>
            <Scene layout={layout} entries={entriesById} mode={mode} onOpen={(id, el) => openDialog({ kind: 'detail', id }, el, id)} />
          </div>
        ) : null}
        {repo ? <ListView vm={vm} onOpen={(id, el) => openDialog({ kind: 'detail', id }, el, id)} onAction={onListAction} /> : null}
      </main>
      <div ref={liveRef} class="visually-hidden" aria-live="polite" role="status" />
      <footer class="footer">
        <p>
          Your deadlines stay in this browser. Sound is synthesised in the browser and is off until you turn it on. Reminders, when on, fire only while
          this tab is open.
        </p>
      </footer>
      {detailEntry ? (
        <DetailDialog
          key={detailEntry.id}
          entry={detailEntry}
          onClose={() => setDialog(null)}
          onAction={(action) => runAction(detailEntry.id, action)}
          onSaveEpitaph={async (text) => {
            const item = findItem(detailEntry.id);
            if (!item) return 'That deadline no longer exists.';
            return applyResult(setEpitaph(item, text, clock()));
          }}
          onEdit={() => setDialog({ kind: 'form', id: detailEntry.id })}
          onDelete={async () => {
            const id = detailEntry.id;
            setItems((list) => list.filter((i) => i.id !== id));
            setDialog(null);
            await repo?.remove(id);
          }}
        />
      ) : null}
      {dialog?.kind === 'form' ? (
        <DeadlineForm
          key={dialog.id ?? 'new'}
          {...(formItem ? { item: formItem } : {})}
          userZone={userZone}
          onCancel={() => setDialog(null)}
          onSave={(values) => saveForm(values, dialog.id)}
          capture={{ fetchMeta, llm, llmName: PROVIDER_SHORT[llm.id] }}
        />
      ) : null}
      {dialog?.kind === 'tools' ? (
        <ToolsDialog
          unresolvedCount={unresolved.length}
          onExportIcs={exportIcs}
          onDownloadBackup={downloadBackup}
          onRestore={restoreBackup}
          remindersOn={remindersOn}
          permission={permission}
          onToggleReminders={toggleReminders}
          llm={llmSettings}
          onSaveLlm={saveLlm}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'seance' ? (
        <Seance
          items={items}
          now={now}
          entries={entriesById}
          userZone={userZone}
          locale={locale}
          history={seances}
          mode={mode}
          llm={llm}
          llmName={PROVIDER_SHORT[llm.id]}
          onFinish={finishSeance}
          onApply={applySeanceStep}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
