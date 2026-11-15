// Optional sound (graveyard-scene R4.1 to R4.5). Everything is synthesised with the Web Audio API,
// so there are no audio files to license. Nothing is created until enable() runs, which the UI calls
// from the click handler of the sound switch (MDN autoplay policy: create the context in a user gesture).
// APIs confirmed on MDN: AudioContext, createBuffer/createBufferSource (looped noise), createBiquadFilter,
// createOscillator, createGain, AudioParam.setValueAtTime/setTargetAtTime/linearRampToValueAtTime,
// AudioContext.close().

export interface Sound {
  /** Creates the AudioContext on first use and starts low wind ambience. */
  enable(): Promise<void>;
  /** Fades to silence in about 100 ms and closes the context (R4.5: within 200 ms). */
  disable(): void;
  /** One short chime, used when a lantern lights (R4.3). Does nothing while disabled. */
  chime(): void;
  readonly enabled: boolean;
}

type ContextFactory = () => AudioContext;

export function isSoundSupported(): boolean {
  return typeof globalThis.AudioContext === 'function';
}

const AMBIENCE_GAIN = 0.05;

export function createSound(factory: ContextFactory = () => new AudioContext()): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let stopAmbience: (() => void) | null = null;

  function startWind(c: AudioContext, out: AudioNode): () => void {
    const seconds = 2;
    const buffer = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const data = buffer.getChannelData(0);
    // Brown-ish noise: integrated white noise sounds softer than white noise.
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;

    // Slow gusts: a 0.08 Hz oscillator moves the filter cutoff.
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoDepth = c.createGain();
    lfoDepth.gain.value = 180;
    lfo.connect(lfoDepth).connect(filter.frequency);

    const level = c.createGain();
    level.gain.value = AMBIENCE_GAIN;
    noise.connect(filter).connect(level).connect(out);
    noise.start();
    lfo.start();
    return () => {
      noise.stop();
      lfo.stop();
    };
  }

  return {
    get enabled() {
      return ctx !== null;
    },
    async enable() {
      if (ctx) return;
      const c = factory();
      ctx = c;
      master = c.createGain();
      master.gain.setValueAtTime(0, c.currentTime);
      master.gain.linearRampToValueAtTime(1, c.currentTime + 1.5);
      master.connect(c.destination);
      stopAmbience = startWind(c, master);
      if (c.state === 'suspended') await c.resume();
    },
    disable() {
      const c = ctx;
      const m = master;
      ctx = null;
      master = null;
      const stop = stopAmbience;
      stopAmbience = null;
      if (!c || !m) return;
      // setTargetAtTime reaches 95% of the target after 3 time constants: 3 x 30 ms = 90 ms.
      m.gain.cancelScheduledValues(c.currentTime);
      m.gain.setTargetAtTime(0, c.currentTime, 0.03);
      setTimeout(() => {
        stop?.();
        void c.close();
      }, 150);
    },
    chime() {
      const c = ctx;
      const m = master;
      if (!c || !m) return;
      const t = c.currentTime;
      for (const [freq, peak] of [
        [880, 0.12],
        [1318.5, 0.06],
      ] as const) {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const env = c.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(peak, t + 0.02);
        env.gain.setTargetAtTime(0, t + 0.05, 0.35);
        osc.connect(env).connect(m);
        osc.start(t);
        osc.stop(t + 2);
      }
    },
  };
}
