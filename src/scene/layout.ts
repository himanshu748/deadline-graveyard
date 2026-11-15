// Pure scene layout (graveyard-scene design.md). Places every item in a band for its kind,
// in due order, wrapping into extra rows instead of overlapping (R1.5, tested with fast-check).
import { deriveStatus } from '../domain/status.ts';
import type { EpochMs, Item, Status } from '../domain/types.ts';
import { flicker, ghostDistance, waxFraction } from '../domain/visual.ts';

export type SceneKind = 'candle' | 'tombstone' | 'lantern' | 'ghost';

export interface SceneNode {
  id: string;
  kind: SceneKind;
  status: Status;
  /** Centre of the slot, in viewBox units. */
  x: number;
  /** Top of the slot, in viewBox units. */
  y: number;
  /** Slot size. Everything the element draws stays inside its slot. */
  w: number;
  h: number;
  /** Candles: remaining wax, 0.05 to 1. Other kinds: 0. */
  wax: number;
  flicker: { speed: 'slow' | 'fast'; urgency: number } | null;
  /** Ghosts: 0 at 7 days without activity, 1 at 30 days. Other kinds: 0. */
  ghostDistance: number;
  title: string;
  epitaph?: string;
  demo: boolean;
}

export interface SceneLayout {
  width: number;
  height: number;
  /** Top rail of the iron fence, where lanterns hang. */
  fenceY: number;
  /** Where the graveyard ground starts. */
  groundY: number;
  /** Every item exactly once, in due order (the keyboard order, accessible-list-view R2.1). */
  nodes: SceneNode[];
}

export const VIEW_WIDTH = 1600;
export const BASE_HEIGHT = 900;
const MARGIN = 60;

export const SLOTS: Record<SceneKind, { w: number; h: number }> = {
  ghost: { w: 130, h: 170 },
  lantern: { w: 100, h: 130 },
  candle: { w: 120, h: 230 },
  tombstone: { w: 120, h: 230 },
};

const GHOST_TOP = 230;

export function kindOf(status: Status): SceneKind {
  switch (status) {
    case 'active':
    case 'due-soon':
      return 'candle';
    case 'missed':
    case 'buried':
      return 'tombstone';
    case 'submitted':
      return 'lantern';
    case 'ghost':
      return 'ghost';
  }
}

/** Due order, ties broken by id so the order is total and stable. */
export function byDue(a: Item, b: Item): number {
  return a.dueAt - b.dueAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function columns(slotW: number, width: number): number {
  return Math.max(1, Math.floor((width - 2 * MARGIN) / slotW));
}

/** Rows a band needs; at least one so the composition keeps its shape when a band is empty. */
function rowsFor(count: number, slotW: number, width: number): number {
  return Math.max(1, Math.ceil(count / columns(slotW, width)));
}

/** x centres and row index for `count` slots, centred, spread out when a row has few items. */
function placeRow(count: number, slotW: number, width: number): Array<{ x: number; row: number }> {
  const cols = columns(slotW, width);
  const usable = width - 2 * MARGIN;
  const out: Array<{ x: number; row: number }> = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = Math.min(cols, count - row * cols);
    const gap = Math.min(slotW * 1.8, usable / inRow);
    out.push({ x: width / 2 + (col - (inRow - 1) / 2) * gap, row });
  }
  return out;
}

export function layoutScene(items: readonly Item[], now: EpochMs, width: number = VIEW_WIDTH): SceneLayout {
  const sorted = [...items].sort(byDue);
  const base = sorted.map((item) => {
    const status = deriveStatus(item, now);
    return { item, status, kind: kindOf(status) };
  });
  const ofKind = (k: SceneKind) => base.filter((b) => b.kind === k);
  const ghosts = ofKind('ghost');
  const lanterns = ofKind('lantern');
  const ground = base.filter((b) => b.kind === 'candle' || b.kind === 'tombstone');

  const ghostRows = rowsFor(ghosts.length, SLOTS.ghost.w, width);
  const fenceY = GHOST_TOP + ghostRows * SLOTS.ghost.h + 20;
  const lanternRows = rowsFor(lanterns.length, SLOTS.lantern.w, width);
  const groundY = fenceY + lanternRows * SLOTS.lantern.h + 10;
  const groundRows = rowsFor(ground.length, SLOTS.candle.w, width);
  const height = Math.max(BASE_HEIGHT, groundY + 30 + groundRows * SLOTS.candle.h + 40);

  const positions = new Map<string, { x: number; y: number }>();
  const band = (list: typeof base, slot: { w: number; h: number }, top: number) => {
    placeRow(list.length, slot.w, width).forEach((p, i) => {
      const entry = list[i];
      if (entry) positions.set(entry.item.id, { x: p.x, y: top + p.row * slot.h });
    });
  };
  band(ghosts, SLOTS.ghost, GHOST_TOP);
  band(lanterns, SLOTS.lantern, fenceY);
  band(ground, SLOTS.candle, groundY + 30);

  const nodes = base.map(({ item, status, kind }): SceneNode => {
    const pos = positions.get(item.id) ?? { x: 0, y: 0 };
    const node: SceneNode = {
      id: item.id,
      kind,
      status,
      x: pos.x,
      y: pos.y,
      w: SLOTS[kind].w,
      h: SLOTS[kind].h,
      wax: waxFraction(item, now),
      flicker: flicker(item, now),
      ghostDistance: ghostDistance(item, now),
      title: item.title,
      demo: item.demo,
    };
    if (item.epitaph !== undefined) node.epitaph = item.epitaph;
    return node;
  });

  return { width, height, fenceY, groundY, nodes };
}

/** Shortens text to `max` characters with an ellipsis, for labels drawn inside a slot. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1)).trimEnd()}\u2026`;
}

/** Splits text into at most `lines` lines of about `perLine` characters, for engraved epitaphs. */
export function wrapText(text: string, perLine: number, lines: number): string[] {
  const words = text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => truncate(w, perLine));
  const out: string[] = [];
  let current = '';
  let clipped = false;
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= perLine) {
      current = next;
      continue;
    }
    out.push(current);
    current = word;
    if (out.length === lines) {
      clipped = true;
      break;
    }
  }
  if (!clipped && current) out.push(current);
  const last = out.length - 1;
  if (clipped && last >= 0) {
    const line = out[last] ?? '';
    out[last] = `${line.length < perLine ? line : line.slice(0, perLine - 1)}\u2026`;
  }
  return out;
}
