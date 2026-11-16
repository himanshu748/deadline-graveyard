// Validates: seance R3.1 (saved locally and carried by backups), R3.2 (newest first)
import { describe, expect, it } from 'vitest';
import { DAY, HOUR, makeItem } from '../domain/test-items.ts';
import { serializeBackup, validateBackup } from '../storage/backup.ts';
import { memoryRepository } from '../storage/repository.ts';
import { addRecord, HISTORY_MAX, lastSeanceAt, parseHistory, SETTING_SEANCE_HISTORY } from './history.ts';
import { buildPlan, emptyAnswers, type SeanceRecord } from './plan.ts';

const NOW = Date.UTC(2026, 10, 30, 12);
const ghost = makeItem({ id: 'g', title: 'Jam game', dueAt: NOW + 2 * DAY, lastActivityAt: NOW - 8 * DAY });
const missed = makeItem({ id: 'm', title: 'Lab report', dueAt: NOW - DAY, lastActivityAt: NOW - 2 * DAY });
const soon = makeItem({ id: 's', title: 'Grant form', dueAt: NOW + 5 * HOUR, lastActivityAt: NOW });

function record(id: string, at: number): SeanceRecord {
  const answers = emptyAnswers();
  answers.restless = { itemIds: ['g'], note: 'The jam.' };
  answers.lessons = { itemIds: ['m'], note: 'Start early.' };
  return { id, at, answers, plan: buildPlan([ghost, missed, soon], answers, at) };
}

describe('history', () => {
  it('adds records newest first, replaces the same id and caps the list (R3.2)', () => {
    let h: SeanceRecord[] = [];
    h = addRecord(h, record('a', NOW - 14 * DAY));
    h = addRecord(h, record('c', NOW));
    h = addRecord(h, record('b', NOW - 7 * DAY));
    expect(h.map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(addRecord(h, record('b', NOW + DAY)).map((r) => r.id)).toEqual(['b', 'c', 'a']);
    let many: SeanceRecord[] = [];
    for (let i = 0; i < HISTORY_MAX + 5; i++) many = addRecord(many, record(`r${i}`, NOW + i));
    expect(many).toHaveLength(HISTORY_MAX);
    expect(many[0]?.id).toBe(`r${HISTORY_MAX + 4}`);
  });

  it('finds the last séance instant', () => {
    expect(lastSeanceAt([])).toBeNull();
    expect(lastSeanceAt([record('a', NOW - DAY), record('b', NOW)])).toBe(NOW);
  });

  it('parses stored records, sorts them and drops invalid ones and duplicates', () => {
    const good = record('a', NOW);
    const older = record('b', NOW - DAY);
    const badStep = structuredClone(good);
    badStep.id = 'x';
    (badStep.plan.steps[0] as unknown as Record<string, unknown>).action = 'summon';
    const parsed = parseHistory([older, { id: 'y', at: 'soon' }, badStep, good, good, 'nope']);
    expect(parsed).toEqual([good, older]);
    expect(parseHistory(undefined)).toEqual([]);
    expect(parseHistory({ id: 'a' })).toEqual([]);
  });

  it('is saved as one setting and survives a JSON backup round trip (R3.1)', async () => {
    const repo = memoryRepository();
    const history = addRecord(addRecord([], record('a', NOW - 7 * DAY)), record('b', NOW));
    await repo.putSetting(SETTING_SEANCE_HISTORY, history);
    const file = serializeBackup(await repo.exportBackup(NOW));
    const checked = validateBackup(file);
    expect(checked.ok).toBe(true);

    const restored = memoryRepository();
    expect((await restored.importBackup(file)).ok).toBe(true);
    expect(parseHistory(await restored.getSetting(SETTING_SEANCE_HISTORY))).toEqual(history);
  });
});
