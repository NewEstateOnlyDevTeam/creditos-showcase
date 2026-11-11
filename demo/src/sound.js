// Tiny WebAudio synth — glassy UI tones. Silent until the first user gesture.
let ctx = null;
let enabled = true;
let lastHover = 0;

export function setSound(on) { enabled = on; }

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, at = 0, dur = 0.5, type = 'sine', gain = 0.04) {
  if (!enabled) return;
  const c = ac(), t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(at = 0, dur = 0.6, gain = 0.03, freq = 3000) {
  if (!enabled) return;
  const c = ac(), t = c.currentTime + at;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf;
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export const sfx = {
  hover() { const n = performance.now(); if (n - lastHover < 90) return; lastHover = n; tone(1760, 0, 0.12, 'sine', 0.008); },
  select() { tone(880, 0, 0.35, 'sine', 0.03); tone(1320, 0.05, 0.4, 'sine', 0.018); },
  tick() { tone(2400, 0, 0.04, 'triangle', 0.006); },
  whoosh() { noise(0, 0.35, 0.02, 1200); },
  win() {
    noise(0, 0.7, 0.05, 4200);
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.05 + i * 0.07, 1.1, 'triangle', 0.03));
    tone(2093, 0.45, 1.4, 'sine', 0.012);
  },
};

// Score for the Ascension cinematic (~10 s): a drone that opens up, a bell per
// house igniting, a riser into Athena's impact, then a choir into the title chord.
// Timings match CUT in ascension.js. Returns { stop } to fade it out on skip.
export function ascensionScore(houses = 12) {
  if (!enabled) return { stop() {} };
  const c = ac(), t0 = c.currentTime + 0.03;
  const master = c.createGain();
  master.gain.value = 0.9;
  master.connect(c.destination);
  const verb = c.createConvolver(), wet = c.createGain();
  const len = c.sampleRate * 3.2, ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  verb.buffer = ir; wet.gain.value = 0.5;
  verb.connect(wet).connect(master);
  const bus = c.createGain();
  bus.connect(master); bus.connect(verb);

  // one voice: oscillator → optional filter → envelope → bus
  const voice = (type, freq, at, dur, peak, { to, attack = 0.02, filter, q = 0.7, fTo } = {}) => {
    const o = c.createOscillator(), g = c.createGain(), s = t0 + at;
    o.type = type;
    o.frequency.setValueAtTime(freq, s);
    if (to) o.frequency.exponentialRampToValueAtTime(to, s + dur);
    let node = o;
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = filter.type; f.frequency.setValueAtTime(filter.freq, s); f.Q.value = q;
      if (fTo) f.frequency.exponentialRampToValueAtTime(fTo, s + dur * 0.8);
      node = node.connect(f);
    }
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(peak, s + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    node.connect(g).connect(bus);
    o.start(s); o.stop(s + dur + 0.1);
  };
  const hiss = (at, dur, peak, from, to, type = 'bandpass') => {
    const s = t0 + at, buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = type; f.Q.value = 0.9;
    f.frequency.setValueAtTime(from, s); f.frequency.exponentialRampToValueAtTime(to, s + dur);
    g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(peak, s + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(s);
  };
  const burst = (at, dur, peak, freq) => {
    const s = t0 + at, buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = peak;
    src.connect(f).connect(g).connect(bus);
    src.start(s);
  };

  // 1 · drone that opens up toward the impact
  for (const f of [55, 55.4, 82.4]) voice('sawtooth', f, 0, 8.6, 0.035, { attack: 1.2, filter: { type: 'lowpass', freq: 180 }, fTo: 1600 });
  // bells as each house ignites (major pentatonic, climbing)
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32];
  for (let i = 0; i < houses; i++) {
    const at = 0.25 + (i / houses) * 1.75, f = scale[i % 12];
    voice('sine', f, at, 1.4, 0.05, { attack: 0.005 });
    voice('sine', f * 2.76, at, 0.6, 0.012, { attack: 0.005 });
  }
  // 2 · the climb: wind + riser
  hiss(2.3, 2.9, 0.16, 300, 5200);
  voice('sawtooth', 110, 2.3, 3.0, 0.03, { to: 440, attack: 1.5, filter: { type: 'lowpass', freq: 600 }, fTo: 3200 });
  // 3 · Athena: sub drop, impact, the big chord
  voice('sine', 90, 5.3, 1.6, 0.55, { to: 28, attack: 0.01 });
  burst(5.3, 1.8, 0.35, 1400);
  for (const f of [65.41, 130.81, 196, 261.63, 329.63, 392, 523.25]) {
    voice('triangle', f, 5.3, 3.4, 0.05, { attack: 0.04 });
    voice('sawtooth', f * 1.003, 5.3, 3.2, 0.018, { attack: 0.06, filter: { type: 'lowpass', freq: 2400 }, fTo: 900 });
  }
  // 4 · ascension: choir "aah" (detuned saws through vowel formants) + shimmer
  for (const f of [261.63, 329.63, 392, 493.88, 587.33]) {
    for (const det of [0.996, 1, 1.004]) {
      for (const [fq, pk] of [[720, 0.02], [1150, 0.011]]) voice('sawtooth', f * det, 6.9, 3.6, pk, { attack: 1.4, filter: { type: 'bandpass', freq: fq }, q: 6 });
    }
  }
  for (const f of [1046.5, 1318.51, 1567.98, 2093]) voice('sine', f, 7.2, 3.2, 0.014, { to: f * 1.02, attack: 1.1 });
  hiss(7.0, 1.9, 0.12, 900, 9000, 'highpass');
  // 5 · title: a bell chord that rings out
  for (const f of [523.25, 783.99, 1046.5, 1318.51]) { voice('sine', f, 8.9, 3.2, 0.05, { attack: 0.005 }); voice('sine', f * 2.76, 8.9, 1.2, 0.01, { attack: 0.005 }); }
  voice('sine', 65.41, 8.9, 2.6, 0.12, { attack: 0.02 });

  return {
    stop() {
      const now = c.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.5);
      setTimeout(() => master.disconnect(), 800);
    },
  };
}
