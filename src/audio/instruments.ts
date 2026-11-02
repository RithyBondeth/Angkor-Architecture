/**
 * Synthesised instruments inspired by a Khmer pinpeat ensemble, plus nature and interface sounds.
 * Every voice builds its own short-lived nodes, schedules them on the audio clock, and releases
 * them when they end. No recordings are used.
 */
export interface Out {
  ctx: AudioContext;
  dest: AudioNode;
}

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 1.5)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}
function release(...nodes: AudioNode[]) {
  return () => nodes.forEach((n) => n.disconnect());
}
/** A shaped oscillator: attack to `peak`, then an exponential decay over `decay` seconds. */
function tone(
  o: Out,
  t: number,
  frequency: number,
  peak: number,
  decay: number,
  type: OscillatorType = 'sine',
  options: { attack?: number; glideTo?: number; dest?: AudioNode } = {},
) {
  const { ctx } = o;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const attack = options.attack ?? 0.004;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  if (options.glideTo)
    osc.frequency.exponentialRampToValueAtTime(options.glideTo, t + attack + decay);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  osc.connect(gain);
  gain.connect(options.dest ?? o.dest);
  osc.onended = release(osc, gain);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
  return osc;
}
/** Filtered noise: the breath of a mallet, a drum skin, rain, or crumbling stone. */
function noise(
  o: Out,
  t: number,
  peak: number,
  decay: number,
  filter: { type: BiquadFilterType; frequency: number; q?: number; sweepTo?: number },
  attack = 0.002,
) {
  const { ctx } = o;
  const source = ctx.createBufferSource();
  const band = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noiseBuffer(ctx);
  band.type = filter.type;
  band.frequency.setValueAtTime(filter.frequency, t);
  if (filter.sweepTo)
    band.frequency.exponentialRampToValueAtTime(filter.sweepTo, t + attack + decay);
  band.Q.value = filter.q ?? 0.8;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  source.connect(band);
  band.connect(gain);
  gain.connect(o.dest);
  source.onended = release(source, band, gain);
  source.start(t);
  source.stop(t + attack + decay + 0.05);
}

// ---------- Pinpeat ensemble ----------
/** Roneat: a bamboo-keyed xylophone with a woody strike and a bright overtone. */
export function roneat(o: Out, t: number, frequency: number, velocity = 1) {
  tone(o, t, frequency, 0.32 * velocity, 0.55);
  tone(o, t, frequency * 3.93, 0.06 * velocity, 0.09);
  tone(o, t, frequency * 2, 0.05 * velocity, 0.18, 'triangle');
  noise(o, t, 0.05 * velocity, 0.025, { type: 'bandpass', frequency: 2600, q: 1.2 });
}
/** Kong vong: a circle of tuned gongs, inharmonic and slowly shimmering. */
export function kongVong(o: Out, t: number, frequency: number, velocity = 1) {
  const partials: [number, number, number][] = [
    [1, 0.22, 1.8],
    [1.004, 0.1, 1.6],
    [2.76, 0.07, 0.9],
    [5.4, 0.03, 0.4],
  ];
  for (const [ratio, peak, decay] of partials)
    tone(o, t, frequency * ratio, peak * velocity, decay, 'sine', { attack: 0.006 });
}
/** A large hanging gong for seasons, milestones, and the start of a reign. */
export function gong(o: Out, t: number, frequency = 98, velocity = 1) {
  const partials: [number, number, number][] = [
    [1, 0.3, 4.2],
    [1.48, 0.12, 3],
    [2.1, 0.08, 2.2],
    [2.66, 0.06, 1.6],
    [3.3, 0.04, 1.1],
  ];
  for (const [ratio, peak, decay] of partials)
    tone(o, t, frequency * ratio, peak * velocity, decay, 'sine', {
      attack: 0.02,
      glideTo: frequency * ratio * 0.985,
    });
  noise(o, t, 0.05 * velocity, 0.6, { type: 'lowpass', frequency: 900, sweepTo: 200 }, 0.05);
}
/** Skor thom: a barrel drum, a falling pitch over a soft thump. */
export function skor(o: Out, t: number, velocity = 1, pitch = 78) {
  tone(o, t, pitch * 1.9, 0.4 * velocity, 0.32, 'sine', { glideTo: pitch });
  noise(o, t, 0.12 * velocity, 0.07, { type: 'lowpass', frequency: 420 });
}
/** Chhing: tiny cymbals. Open rings; closed (chhep) is a short damped clack. */
export function chhing(o: Out, t: number, open: boolean, velocity = 1) {
  const decay = open ? 0.55 : 0.06;
  tone(o, t, 3150, 0.03 * velocity, decay, 'square');
  tone(o, t, 4720, 0.022 * velocity, decay * 0.8, 'square');
  noise(o, t, (open ? 0.03 : 0.07) * velocity, open ? 0.2 : 0.04, {
    type: 'highpass',
    frequency: 5200,
  });
}
/** Sralai: a quadruple-reed oboe, nasal and gently wavering. */
export function sralai(o: Out, t: number, frequency: number, duration: number, velocity = 1) {
  const { ctx } = o;
  const osc = ctx.createOscillator();
  const band = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const vibrato = ctx.createOscillator();
  const depth = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(frequency * 0.985, t);
  osc.frequency.linearRampToValueAtTime(frequency, t + 0.08);
  band.type = 'bandpass';
  band.frequency.value = frequency * 2.4;
  band.Q.value = 1.6;
  vibrato.frequency.value = 5.2;
  depth.gain.value = frequency * 0.012;
  vibrato.connect(depth);
  depth.connect(osc.frequency);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.06 * velocity, t + 0.09);
  gain.gain.setValueAtTime(0.06 * velocity, t + Math.max(0.1, duration - 0.15));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(band);
  band.connect(gain);
  gain.connect(o.dest);
  osc.onended = release(osc, band, gain, vibrato, depth);
  osc.start(t);
  vibrato.start(t);
  osc.stop(t + duration + 0.05);
  vibrato.stop(t + duration + 0.05);
}
/** A soft tonic-and-fifth drone that grounds each section. */
export function drone(o: Out, t: number, frequency: number, duration: number) {
  for (const [ratio, peak] of [
    [1, 0.045],
    [1.5, 0.025],
  ] as [number, number][]) {
    const { ctx } = o;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = frequency * ratio;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 1.2);
    gain.gain.setValueAtTime(peak, t + Math.max(1.3, duration - 1.2));
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.connect(gain);
    gain.connect(o.dest);
    osc.onended = release(osc, gain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }
}

// ---------- Nature ----------
export function birdCall(o: Out, t: number) {
  const base = 2400 + Math.random() * 1600;
  const chirps = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < chirps; i++) {
    const at = t + i * (0.09 + Math.random() * 0.05);
    tone(o, at, base, 0.035, 0.07, 'sine', { glideTo: base * (1.25 + Math.random() * 0.3) });
  }
}
export function cicadas(o: Out, t: number, duration: number) {
  const { ctx } = o;
  const carrier = ctx.createOscillator();
  const pulse = ctx.createOscillator();
  const depth = ctx.createGain();
  const gain = ctx.createGain();
  carrier.type = 'sine';
  carrier.frequency.value = 4800 + Math.random() * 900;
  pulse.frequency.value = 38 + Math.random() * 12;
  depth.gain.value = 0.012;
  pulse.connect(depth);
  depth.connect(gain.gain);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.012, t + duration * 0.3);
  gain.gain.linearRampToValueAtTime(0, t + duration);
  carrier.connect(gain);
  gain.connect(o.dest);
  carrier.onended = release(carrier, pulse, depth, gain);
  carrier.start(t);
  pulse.start(t);
  carrier.stop(t + duration + 0.05);
  pulse.stop(t + duration + 0.05);
}
export function thunder(o: Out, t: number) {
  noise(o, t, 0.16, 3.2, { type: 'lowpass', frequency: 260, sweepTo: 70 }, 0.35);
  noise(o, t + 0.5, 0.08, 2.2, { type: 'lowpass', frequency: 180, sweepTo: 60 }, 0.2);
}
/** A continuous rain bed; returns a function that fades it out. */
export function rain(o: Out, t: number, level: number) {
  const { ctx } = o;
  const source = ctx.createBufferSource();
  const band = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noiseBuffer(ctx);
  source.loop = true;
  band.type = 'bandpass';
  band.frequency.value = 2200;
  band.Q.value = 0.5;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(level, t + 3);
  source.connect(band);
  band.connect(gain);
  gain.connect(o.dest);
  source.start(t);
  return (at: number) => {
    gain.gain.cancelScheduledValues(at);
    gain.gain.setValueAtTime(gain.gain.value, at);
    gain.gain.linearRampToValueAtTime(0, at + 2);
    source.stop(at + 2.1);
    source.onended = release(source, band, gain);
  };
}

// ---------- Interface and building ----------
export function click(o: Out, t: number) {
  tone(o, t, 1500, 0.05, 0.03);
  tone(o, t, 760, 0.04, 0.05, 'triangle');
}
export function select(o: Out, t: number) {
  roneat(o, t, 880, 0.6);
  roneat(o, t + 0.05, 1174.7, 0.45);
}
export function open(o: Out, t: number) {
  noise(o, t, 0.04, 0.16, { type: 'bandpass', frequency: 700, sweepTo: 2400, q: 0.7 }, 0.04);
  roneat(o, t + 0.04, 659.3, 0.4);
}
export function close(o: Out, t: number) {
  noise(o, t, 0.035, 0.14, { type: 'bandpass', frequency: 2200, sweepTo: 600, q: 0.7 }, 0.03);
  roneat(o, t + 0.03, 493.9, 0.35);
}
export function invalid(o: Out, t: number) {
  tone(o, t, 180, 0.12, 0.12, 'triangle', { glideTo: 150 });
  tone(o, t + 0.13, 150, 0.12, 0.16, 'triangle', { glideTo: 120 });
}
export function buildWood(o: Out, t: number) {
  tone(o, t, 220, 0.2, 0.1, 'triangle', { glideTo: 110 });
  noise(o, t, 0.12, 0.05, { type: 'bandpass', frequency: 900, q: 1.4 });
  tone(o, t + 0.09, 260, 0.12, 0.08, 'triangle', { glideTo: 130 });
}
export function buildStone(o: Out, t: number) {
  tone(o, t, 620, 0.1, 0.12, 'sine', { glideTo: 420 });
  noise(o, t, 0.14, 0.06, { type: 'highpass', frequency: 1800 });
  tone(o, t + 0.07, 1240, 0.05, 0.08, 'square');
}
export function buildWater(o: Out, t: number) {
  tone(o, t, 420, 0.14, 0.14, 'sine', { glideTo: 1100 });
  noise(o, t + 0.04, 0.08, 0.22, { type: 'bandpass', frequency: 1400, sweepTo: 500, q: 1 });
}
export function demolish(o: Out, t: number) {
  noise(o, t, 0.22, 0.6, { type: 'lowpass', frequency: 1400, sweepTo: 180 }, 0.01);
  skor(o, t, 0.7, 60);
  for (let i = 1; i < 4; i++)
    noise(o, t + i * 0.09, 0.06, 0.08, { type: 'bandpass', frequency: 900 + i * 300 });
}
export function splash(o: Out, t: number) {
  tone(o, t, 900, 0.03, 0.06, 'sine', { glideTo: 1700 });
  noise(o, t, 0.025, 0.12, { type: 'bandpass', frequency: 1600, q: 1 });
}
