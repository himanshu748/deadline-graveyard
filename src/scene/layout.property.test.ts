// Validates: graveyard-scene R1.5 (every item visible, no overlap) and accessible-list-view R1.1
// (scene and list view contain exactly the same items), for random item lists.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { instantArb, itemArb } from '../domain/arbitraries.ts';
import { deriveViewModel } from '../ui/view-model.ts';
import { layoutScene, type SceneNode } from './layout.ts';

const itemsArb = fc.uniqueArray(itemArb(), { selector: (i) => i.id, maxLength: 60 });

function overlaps(a: SceneNode, b: SceneNode): boolean {
  return a.x - a.w / 2 < b.x + b.w / 2 && b.x - b.w / 2 < a.x + a.w / 2 && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('scene layout properties', () => {
  it('no two slots overlap and every slot is inside the view, for up to 60 items', () => {
    fc.assert(
      fc.property(itemsArb, instantArb, (items, now) => {
        const layout = layoutScene(items, now);
        for (const n of layout.nodes) {
          expect(n.x - n.w / 2).toBeGreaterThanOrEqual(0);
          expect(n.x + n.w / 2).toBeLessThanOrEqual(layout.width);
          expect(n.y).toBeGreaterThanOrEqual(0);
          expect(n.y + n.h).toBeLessThanOrEqual(layout.height);
        }
        for (let i = 0; i < layout.nodes.length; i++) {
          for (let j = i + 1; j < layout.nodes.length; j++) {
            const a = layout.nodes[i];
            const b = layout.nodes[j];
            if (a && b) expect(overlaps(a, b), `${a.id} overlaps ${b.id}`).toBe(false);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it('the scene and the list view hold the same ids with the same statuses', () => {
    fc.assert(
      fc.property(itemsArb, instantArb, (items, now) => {
        const scene = layoutScene(items, now).nodes.map((n) => [n.id, n.status]);
        const list = deriveViewModel(items, now, 'UTC', 'en').entries.map((e) => [e.id, e.status]);
        expect(scene).toEqual(list);
      }),
      { numRuns: 300 },
    );
  });
});
