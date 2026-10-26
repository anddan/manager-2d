// Basic match sounds, made in the browser with Web Audio (no sound files):
// the referee's whistle, the ball being kicked, and the crowd (a murmur that
// follows how full the ground is, a roar for goals, an "ooh" for near things).
// Muted is remembered on this device. Browsers only let sound start after a
// tap or click, which is how every match is opened.

const MUTE_KEY = "manager2d.muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = readMuted();
const listeners = new Set<(muted: boolean) => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Only for now.
  }
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, 0.05);
  listeners.forEach((l) => l(value));
}

/** Told when sound is switched on or off (for buttons showing it). */
export function onMutedChange(listener: (muted: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The audio graph, made on first use. Null where there's no Web Audio. */
function audio(): {ctx: AudioContext; out: GainNode} | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    // Two seconds of white noise, the stuff crowds and kicks are made of.
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return {ctx, out: master!};
}

/** A burst of filtered noise: a crowd sound or the thud of a kick. */
function noiseBurst(opts: {freq: number; q?: number; type?: BiquadFilterType; gain: number; attack: number; hold: number; release: number; delay?: number}): void {
  const a = audio();
  if (!a || !noise || muted) return;
  const t0 = a.ctx.currentTime + (opts.delay ?? 0);
  const src = a.ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = a.ctx.createBiquadFilter();
  filter.type = opts.type ?? "bandpass";
  filter.frequency.value = opts.freq;
  filter.Q.value = opts.q ?? 0.8;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain, t0 + opts.attack);
  g.gain.setValueAtTime(opts.gain, t0 + opts.attack + opts.hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.attack + opts.hold + opts.release);
  src.connect(filter).connect(g).connect(a.out);
  src.start(t0, Math.random());
  src.stop(t0 + opts.attack + opts.hold + opts.release + 0.05);
}

/** One blast of a pea whistle: a high tone with the pea's trill. */
function blast(at: number, length: number, gain = 0.12): void {
  const a = audio();
  if (!a || muted) return;
  const t0 = a.ctx.currentTime + at;
  const osc = a.ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = 2900;
  // The pea rattling: a fast wobble in pitch.
  const trill = a.ctx.createOscillator();
  trill.frequency.value = 38;
  const depth = a.ctx.createGain();
  depth.gain.value = 120;
  trill.connect(depth).connect(osc.frequency);
  const filter = a.ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 3000;
  filter.Q.value = 3;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.setValueAtTime(gain, t0 + length - 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  osc.connect(filter).connect(g).connect(a.out);
  osc.start(t0);
  trill.start(t0);
  osc.stop(t0 + length + 0.02);
  trill.stop(t0 + length + 0.02);
}

/** The referee: one short blast (kick-off, a foul), or two short and a long one (half-time, full time). */
export function whistle(kind: "short" | "end" = "short"): void {
  if (kind === "short") blast(0, 0.32);
  else {
    blast(0, 0.22);
    blast(0.32, 0.22);
    blast(0.64, 0.9);
  }
}

/** The ball struck: a deep thud for a shot, a soft tap for a pass. */
export function kick(power: "shot" | "pass" = "pass"): void {
  const a = audio();
  if (!a || muted) return;
  const shot = power === "shot";
  // The boot on the ball: a quick low thump...
  const t0 = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(shot ? 150 : 210, t0);
  osc.frequency.exponentialRampToValueAtTime(shot ? 45 : 90, t0 + 0.12);
  const g = a.ctx.createGain();
  const level = shot ? 0.5 : 0.12;
  g.gain.setValueAtTime(level, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + (shot ? 0.18 : 0.09));
  osc.connect(g).connect(a.out);
  osc.start(t0);
  osc.stop(t0 + 0.2);
  // ...and the slap of leather.
  noiseBurst({freq: shot ? 1400 : 2200, q: 1.2, gain: shot ? 0.18 : 0.04, attack: 0.002, hold: 0.01, release: shot ? 0.08 : 0.04});
}

/** The crowd goes up: a goal (a long roar), a near thing ("ooh"), or a big moment (Forza!). */
export function crowd(kind: "goal" | "ooh" | "rally"): void {
  if (kind === "goal") {
    // Voices: a few overlapping "yeah"s in the low mids, each swelling and falling away.
    [380, 520, 700, 460].forEach((freq, i) => noiseBurst({freq, q: 2.2, gain: 0.16, attack: 0.18 + i * 0.05, hold: 0.9, release: 1.6, delay: i * 0.12}));
    // Applause: lots of short claps at random, thinning out.
    for (let i = 0; i < 70; i++) {
      const at = 0.15 + Math.pow(Math.random(), 1.6) * 2.8;
      noiseBurst({freq: 1800 + Math.random() * 1600, q: 1.5, gain: 0.05 + Math.random() * 0.05, attack: 0.002, hold: 0.004, release: 0.05, delay: at});
    }
  } else if (kind === "ooh") {
    noiseBurst({freq: 520, q: 1.4, gain: 0.25, attack: 0.15, hold: 0.25, release: 0.9});
  } else {
    noiseBurst({freq: 750, q: 0.6, gain: 0.3, attack: 0.2, hold: 0.8, release: 1.2});
  }
}

/** Something good: a little rising chime (diamonds, a pack). */
export function chime(): void {
  const a = audio();
  if (!a || muted) return;
  [880, 1175, 1568].forEach((f, i) => {
    const t0 = a.ctx.currentTime + i * 0.09;
    const osc = a.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    osc.connect(g).connect(a.out);
    osc.start(t0);
    osc.stop(t0 + 0.4);
  });
}

/**
 * The crowd's murmur under the match, louder the fuller the ground (0–1).
 * Returns a function that fades it out and stops it.
 */
export function crowdMurmur(fill: number): () => void {
  const a = audio();
  if (!a || !noise) return () => undefined;
  const src = a.ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const low = a.ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 700;
  const band = a.ctx.createBiquadFilter();
  band.type = "peaking";
  band.frequency.value = 400;
  band.gain.value = 6;
  const g = a.ctx.createGain();
  const level = 0.02 + Math.max(0, Math.min(1, fill)) * 0.06;
  g.gain.setValueAtTime(0.0001, a.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(level, a.ctx.currentTime + 1.5);
  src.connect(low).connect(band).connect(g).connect(a.out);
  src.start();
  return () => {
    if (!ctx) return;
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
    src.stop(ctx.currentTime + 1.2);
  };
}

/**
 * The manager shouting: a cartoon "blah-blah-blah", a burst of quick syllables
 * through a mouth-like filter, longer for a longer shout.
 */
export function chatter(textLength = 20): void {
  const a = audio();
  if (!a || muted) return;
  const syllables = Math.max(3, Math.min(9, Math.round(textLength / 6)));
  const base = 170 + Math.random() * 60;
  let at = a.ctx.currentTime + 0.02;
  for (let i = 0; i < syllables; i++) {
    const len = 0.07 + Math.random() * 0.05;
    const osc = a.ctx.createOscillator();
    osc.type = "sawtooth";
    // Up and down like talking, a little higher at the end of the shout.
    osc.frequency.setValueAtTime(base * (0.85 + Math.random() * 0.4) * (i === syllables - 1 ? 1.25 : 1), at);
    osc.frequency.linearRampToValueAtTime(base * (0.8 + Math.random() * 0.3), at + len);
    // "bla": the mouth opening and closing (two formants).
    const f1 = a.ctx.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.setValueAtTime(450, at);
    f1.frequency.linearRampToValueAtTime(800 + Math.random() * 200, at + len * 0.5);
    f1.Q.value = 4;
    const f2 = a.ctx.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.value = 1200 + Math.random() * 300;
    f2.Q.value = 5;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.35, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(f1).connect(g);
    osc.connect(f2).connect(g);
    g.connect(a.out);
    osc.start(at);
    osc.stop(at + len + 0.02);
    at += len + 0.025 + Math.random() * 0.03;
  }
}
