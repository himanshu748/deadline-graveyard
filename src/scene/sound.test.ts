// Validates: graveyard-scene R4.1, R4.2, R4.3, R4.5. A fake AudioContext records what is created.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSound } from './sound.ts';

class FakeParam {
  value = 0;
  calls: string[] = [];
  setValueAtTime(v: number) {
    this.calls.push(`set ${v}`);
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.calls.push(`ramp ${v}`);
    return this;
  }
  setTargetAtTime(v: number, _t: number, tc: number) {
    this.calls.push(`target ${v} ${tc}`);
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  frequency = new FakeParam();
  gain = new FakeParam();
  type = '';
  buffer: unknown = null;
  loop = false;
  started = 0;
  stopped = 0;
  connect<T>(next: T): T {
    return next;
  }
  start() {
    this.started++;
  }
  stop() {
    this.stopped++;
  }
}

class FakeContext {
  static created = 0;
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  oscillators: FakeNode[] = [];
  gains: FakeNode[] = [];
  closed = false;
  constructor() {
    FakeContext.created++;
  }
  createGain() {
    const n = new FakeNode();
    this.gains.push(n);
    return n;
  }
  createOscillator() {
    const n = new FakeNode();
    this.oscillators.push(n);
    return n;
  }
  createBiquadFilter() {
    return new FakeNode();
  }
  createBufferSource() {
    return new FakeNode();
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  async resume() {}
  async close() {
    this.closed = true;
  }
}

function setup() {
  FakeContext.created = 0;
  const contexts: FakeContext[] = [];
  const sound = createSound(() => {
    const c = new FakeContext();
    contexts.push(c);
    return c as unknown as AudioContext;
  });
  return { sound, contexts };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('sound', () => {
  it('creates no AudioContext before enable() (R4.1)', () => {
    const { sound } = setup();
    expect(sound.enabled).toBe(false);
    sound.chime();
    sound.disable();
    expect(FakeContext.created).toBe(0);
  });

  it('creates exactly one context on enable and starts ambience (R4.2)', async () => {
    const { sound, contexts } = setup();
    await sound.enable();
    await sound.enable();
    expect(FakeContext.created).toBe(1);
    expect(sound.enabled).toBe(true);
    expect(contexts[0]?.oscillators.length).toBeGreaterThan(0);
  });

  it('plays a chime only while enabled (R4.3)', async () => {
    const { sound, contexts } = setup();
    await sound.enable();
    const before = contexts[0]?.oscillators.length ?? 0;
    sound.chime();
    expect(contexts[0]?.oscillators.length).toBe(before + 2);
  });

  it('fades out and closes the context within 200 ms (R4.5)', async () => {
    vi.useFakeTimers();
    const { sound, contexts } = setup();
    await sound.enable();
    const ctx = contexts[0];
    sound.disable();
    expect(sound.enabled).toBe(false);
    const master = ctx?.gains[0];
    expect(master?.gain.calls.at(-1)).toBe('target 0 0.03');
    vi.advanceTimersByTime(200);
    expect(ctx?.closed).toBe(true);
  });
});
