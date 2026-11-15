// One polite live region for status changes (accessible-list-view R3.2, R3.3).
// Identical messages within 1 s are dropped so a re-render cannot announce twice.

export interface Announcer {
  announce(text: string): void;
}

export function createAnnouncer(el: HTMLElement, clock: () => number = () => Date.now()): Announcer {
  let lastText = '';
  let lastAt = -Infinity;
  return {
    announce(text) {
      const at = clock();
      if (text === lastText && at - lastAt < 1000) return;
      lastText = text;
      lastAt = at;
      // Clearing first makes screen readers announce a repeated message after the window.
      el.textContent = '';
      setTimeout(() => {
        el.textContent = text;
      }, 50);
    },
  };
}
