import { chhing, drone, kongVong, roneat, skor, sralai } from './instruments';
import type { Out } from './instruments';

export type MusicScene = 'menu' | 'game';
export interface MusicMood {
  scene: MusicScene;
  /** Wet season sounds brighter (major pentatonic); the dry season turns minor and slower. */
  wet: boolean;
  /** Construction under way adds the drums. */
  busy: boolean;
  /** A paused kingdom thins the ensemble to its gentlest layers. */
  paused: boolean;
}

const MAJOR = [0, 2, 4, 7, 9];
const MINOR = [0, 3, 5, 7, 10];
/** D4: a warm centre for the roneat; gongs and drone sit below it. */
const TONIC = 293.66;
const BARS = 8;
const STEPS_PER_BAR = 8;
const LOOKAHEAD = 0.4;

function frequency(degree: number, scale: number[], octaveShift = 0) {
  const octave = Math.floor(degree / scale.length);
  const step = scale[((degree % scale.length) + scale.length) % scale.length]!;
  return TONIC * 2 ** ((octave * 12 + step) / 12 + octaveShift);
}

/**
 * Generative pinpeat-inspired music. Each eight-bar section has a gong skeleton melody that the
 * roneat elaborates in eighth notes, with the chhing keeping time; drums, reed, and drone join or
 * fall away with the kingdom's mood. Notes are scheduled slightly ahead on the audio clock.
 */
export class MusicDirector {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private skeleton: number[] = [];
  private melody = 4;
  private section = 0;
  private mood: MusicMood = { scene: 'menu', wet: true, busy: false, paused: false };
  constructor(private readonly out: Out) {}

  get running() {
    return this.timer !== null;
  }
  setMood(mood: MusicMood) {
    this.mood = { ...mood };
  }
  start() {
    if (this.timer) return;
    this.nextTime = this.out.ctx.currentTime + 0.15;
    this.step = 0;
    this.compose();
    this.timer = setInterval(() => this.schedule(), 100);
    this.schedule();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  private get tempo() {
    const { scene, wet, paused } = this.mood;
    if (scene === 'menu') return 76;
    if (paused) return 66;
    return wet ? 96 : 84;
  }
  private get scale() {
    return this.mood.wet || this.mood.scene === 'menu' ? MAJOR : MINOR;
  }
  /** A new skeleton for the next section: a gentle walk across two octaves, home at the end. */
  private compose() {
    const skeleton: number[] = [];
    let degree = this.section % 3 === 2 ? 7 : 5;
    for (let i = 0; i < BARS * 2; i++) {
      degree += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]!;
      degree = Math.max(2, Math.min(10, degree));
      skeleton.push(degree);
    }
    skeleton[skeleton.length - 1] = 5;
    this.skeleton = skeleton;
    this.section++;
  }
  private schedule() {
    const ctx = this.out.ctx;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.play(this.step, this.nextTime);
      this.nextTime += 60 / this.tempo / 2;
      this.step++;
      if (this.step >= BARS * STEPS_PER_BAR) {
        this.step = 0;
        this.compose();
      }
    }
  }
  private play(step: number, t: number) {
    const { scene, busy, paused } = this.mood;
    const scale = this.scale;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const inBar = step % STEPS_PER_BAR;
    const beat = 60 / this.tempo;
    const calm = scene === 'menu' || paused;
    const target = this.skeleton[Math.floor(step / (STEPS_PER_BAR / 2))]!;

    if (step === 0) drone(this.out, t, TONIC / 2, beat * 4 * BARS);
    // Gongs mark the skeleton on each half bar.
    if (inBar % 4 === 0) kongVong(this.out, t, frequency(target, scale, -1), inBar === 0 ? 1 : 0.7);
    // Chhing: closed on the strong beats, ringing on the weak ones.
    if (inBar % 2 === 0) {
      const open = inBar % 4 === 2;
      if (!calm || open) chhing(this.out, t, open, calm ? 0.6 : 0.9);
    }
    // Roneat: walk toward the skeleton note, with rests, rolls, and accents.
    const rest = calm ? 0.35 : 0.15;
    if (Math.random() > rest) {
      const towards = Math.sign(target - this.melody);
      this.melody += Math.random() < 0.7 ? towards : [-1, 1][Math.floor(Math.random() * 2)]!;
      this.melody = Math.max(2, Math.min(12, this.melody));
      const accent = inBar === 0 ? 1 : inBar % 2 === 0 ? 0.8 : 0.6;
      const note = frequency(this.melody, scale);
      roneat(this.out, t, note, (calm ? 0.65 : 0.85) * accent);
      if (!calm && inBar === 6 && Math.random() < 0.4)
        for (let r = 1; r < 4; r++) roneat(this.out, t + (beat / 8) * r, note, 0.45);
    }
    // Skor drums drive the busy kingdom.
    if (busy && !calm) {
      if (inBar === 0 || inBar === 4) skor(this.out, t, inBar === 0 ? 0.9 : 0.7);
      if (inBar === 3 || inBar === 7) skor(this.out, t, 0.45, 118);
    }
    // The sralai sings long skeleton tones in the second half of every other section.
    if (!calm && this.section % 2 === 0 && bar >= BARS / 2 && inBar === 0)
      sralai(this.out, t, frequency(target, scale), beat * 3.6, 0.9);
  }
}
