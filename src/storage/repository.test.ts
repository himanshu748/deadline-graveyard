import 'fake-indexeddb/auto';
import fc from 'fast-check';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { itemArb } from '../domain/arbitraries.ts';
import { DAY, DUE, makeItem } from '../domain/test-items.ts';
import { serializeBackup } from './backup.ts';
import { memoryRepository, openRepository, type Repository } from './repository.ts';

const NOW = DUE - 3 * DAY;

beforeEach(() => {
  // A fresh, empty IndexedDB per test (fake-indexeddb README, "Wiping/resetting the indexedDB").
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function open(): Promise<Repository> {
  const { repo, persistent } = await openRepository();
  expect(persistent).toBe(true);
  return repo;
}

describe('IndexedDB repository', () => {
  // Validates: deadline-engine R5.1, R5.2
  it('persists items so a newly opened repository loads them', async () => {
    const first = await open();
    const a = makeItem({ id: 'a', title: 'Kiroween 2026' });
    const b = makeItem({ id: 'b', title: 'Course essay', url: 'https://example.com/essay', notes: 'draft' });
    await first.put(b);
    await first.put(a);
    await first.put({ ...a, title: 'Kiroween 2026 (edited)' });
    await first.putSetting('motion', 'reduced');

    const second = await open();
    expect(await second.list()).toEqual([{ ...a, title: 'Kiroween 2026 (edited)' }, b]);
    expect(await second.getSetting('motion')).toBe('reduced');
    expect(await second.getSetting('missing')).toBeUndefined();

    await second.remove('a');
    expect((await (await open()).list()).map((i) => i.id)).toEqual(['b']);
  });

  // Validates: deadline-engine R5.3
  it('exports a versioned backup with every item and setting', async () => {
    const repo = await open();
    await repo.put(makeItem({ id: 'z' }));
    await repo.put(makeItem({ id: 'm', demo: true }));
    await repo.putSetting('sound', false);
    const backup = await repo.exportBackup(NOW);
    expect(backup).toMatchObject({ format: 'deadline-graveyard-backup', version: 1, exportedAt: NOW });
    expect(backup.items.map((i) => i.id)).toEqual(['m', 'z']);
    expect(backup.settings).toEqual([{ key: 'sound', value: false }]);
  });

  // Validates: deadline-engine R5.5
  it('restores its own export so the next export is equal (generated items)', async () => {
    const itemsArb = fc.uniqueArray(itemArb(), { selector: (i) => i.id, maxLength: 15 });
    const settingsArb = fc.uniqueArray(
      fc.record({ key: fc.string({ minLength: 1, maxLength: 20 }).filter((k) => k.trim() !== ''), value: fc.jsonValue({ maxDepth: 3 }) }),
      { selector: (s) => s.key, maxLength: 5 },
    );
    await fc.assert(
      fc.asyncProperty(itemsArb, settingsArb, async (items, settings) => {
        globalThis.indexedDB = new IDBFactory();
        const source = await open();
        for (const item of items) await source.put(item);
        for (const s of settings) await source.putSetting(s.key, s.value as never);
        const exported = await source.exportBackup(NOW);

        globalThis.indexedDB = new IDBFactory();
        const target = await open();
        await target.put(makeItem({ id: 'to-be-replaced' }));
        // Round trip through the file text, as a real restore does.
        const result = await target.importBackup(serializeBackup(exported));
        expect(result).toEqual({ ok: true, value: items.length });
        expect(await target.exportBackup(NOW)).toEqual(JSON.parse(serializeBackup(exported)));
      }),
      { numRuns: 50 },
    );
  });

  // Validates: deadline-engine R5.4
  it('rejects an invalid backup with the failing path and keeps current data', async () => {
    const repo = await open();
    const kept = makeItem({ id: 'kept' });
    await repo.put(kept);
    const backup = await repo.exportBackup(NOW);
    const bad = structuredClone(backup);
    bad.items.push({ ...makeItem({ id: 'x' }), dueAt: 'tomorrow' as never });

    expect(await repo.importBackup(bad)).toEqual({
      ok: false,
      error: { code: 'invalid-backup', path: 'items[1].dueAt', reason: 'must be an integer of epoch milliseconds' },
    });
    expect(await repo.importBackup('{ not json')).toMatchObject({ ok: false, error: { path: '$' } });
    expect(await repo.list()).toEqual([kept]);
  });
});

describe('fallback without IndexedDB', () => {
  // Validates: deadline-engine R5.6
  it('works in memory and reports persistent: false when indexedDB is undefined', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const { repo, persistent } = await openRepository();
    expect(persistent).toBe(false);
    await repo.put(makeItem({ id: 'mem' }));
    expect((await repo.list()).map((i) => i.id)).toEqual(['mem']);
  });

  it('falls back when opening the database fails', async () => {
    vi.stubGlobal('indexedDB', {
      open() {
        throw new DOMException('disabled', 'InvalidStateError');
      },
    });
    const { persistent } = await openRepository();
    expect(persistent).toBe(false);
  });

  it('memory repository round-trips a backup and does not share references', async () => {
    const repo = memoryRepository();
    const item = makeItem({ id: 'm1', epitaph: 'Ship smaller.' });
    await repo.put(item);
    await repo.putSetting('motion', { mode: 'full' });
    const exported = await repo.exportBackup(NOW);
    exported.items[0]!.title = 'mutated outside';
    expect((await repo.list())[0]?.title).toBe(item.title);

    const other = memoryRepository();
    expect(await other.importBackup(await repo.exportBackup(NOW))).toEqual({ ok: true, value: 1 });
    expect(await other.exportBackup(NOW)).toEqual(await repo.exportBackup(NOW));
    expect(await other.importBackup({ format: 'nope' })).toMatchObject({ ok: false, error: { path: 'format' } });
  });
});
