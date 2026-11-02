import type { BuildingKind } from '../core/types';
import { BUILDINGS } from '../data/buildings';
import * as play from './instruments';
import type { Out } from './instruments';
import { MusicDirector } from './Music';
import type { MusicMood, MusicScene } from './Music';
import { NatureDirector } from './Nature';
import type { AudioPreferences } from './preferences';

export type Cue =
  | 'click'
  | 'select'
  | 'open'
  | 'close'
  | 'invalid'
  | 'demolish'
  | 'upgrade'
  | 'milestone'
  | 'season'
  | 'start';
const CUE_GAP: Record<Cue, number> = {
  click: 0.04,
  select: 0.08,
  open: 0.08,
  close: 0.08,
  invalid: 0.25,
  demolish: 0.4,
  upgrade: 0.6,
  milestone: 1.2,
  season: 2,
  start: 1,
};
const WATER_WORKS: BuildingKind[] = ['canal', 'moat', 'baray', 'gate', 'lotuspond', 'lotusraft'];
const STONE_WORKS: BuildingKind[] = [
  'temple',
  'quarry',
  'lateritepit',
  'naga',
  'singha',
  'gopura',
  'elephant',
  'facetower',
  'brazier',
];

type Voice = { oscillator: OscillatorNode; gain: GainNode };
/**
 * Procedural sound for the whole game: pinpeat-inspired music, water and nature ambience, and
 * interface and building effects. Music is scheduled a moment ahead on the audio clock; game time
 * never schedules audio.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private ambience: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private natureBus: GainNode | null = null;
  private music: MusicDirector | null = null;
  private nature: NatureDirector | null = null;
  private scene: MusicScene | null = null;
  private mood: Omit<MusicMood, 'scene'> = { wet: true, busy: false, paused: false };
  private stream: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private readonly voices = new Set<Voice>();
  private readonly lastCue = new Map<string, number>();
  private visible = true;
  private playing = false;
  private wet = true;
  private unavailable = false;
  private destroyed = false;
  private resuming: Promise<boolean> | null = null;
  constructor(
    private preferences: AudioPreferences,
    private readonly createContext: () => AudioContext = () => new AudioContext(),
  ) {}

  get status(): string {
    if (this.unavailable)
      return 'Audio is unavailable in this browser. Your volume preferences are still saved.';
    if (this.preferences.muted || this.preferences.master === 0) return 'Sound is muted.';
    return this.context?.state === 'running'
      ? 'Sound ready.'
      : 'Sound starts after a click, tap, or key press.';
  }
  /** Invoke during a trusted interaction; blocked audio is retried on the next interaction. */
  async unlock(): Promise<boolean> {
    if (
      this.destroyed ||
      this.unavailable ||
      !this.visible ||
      this.preferences.muted ||
      this.preferences.master === 0
    )
      return false;
    if (!this.context) {
      try {
        this.context = this.createContext();
        this.master = this.context.createGain();
        this.effects = this.context.createGain();
        this.ambience = this.context.createGain();
        this.master.gain.value = 0;
        this.effects.gain.value = 0;
        this.ambience.gain.value = 0;
        this.effects.connect(this.master);
        this.ambience.connect(this.master);
        this.master.connect(this.context.destination);
        this.musicBus = this.context.createGain();
        this.natureBus = this.context.createGain();
        this.musicBus.gain.value = 0;
        this.natureBus.gain.value = 0;
        this.musicBus.connect(this.master);
        this.natureBus.connect(this.master);
        this.music = new MusicDirector({ ctx: this.context, dest: this.musicBus });
        this.nature = new NatureDirector(
          { ctx: this.context, dest: this.natureBus },
          () => this.scene === 'game',
        );
      } catch {
        this.unavailable = true;
        void this.context?.close().catch(() => {});
        return false;
      }
    }
    if (this.context.state === 'running') {
      this.apply();
      return true;
    }
    if (this.resuming) return this.resuming;
    this.resuming = this.context
      .resume()
      .then(() => {
        if (this.destroyed || !this.visible) return false;
        this.apply();
        return this.context?.state === 'running';
      })
      .catch(() => false)
      .finally(() => {
        this.resuming = null;
      });
    return this.resuming;
  }
  setPreferences(preferences: AudioPreferences): void {
    this.preferences = { ...preferences };
    if (preferences.muted || preferences.master === 0 || preferences.effects === 0)
      this.stopVoices();
    this.apply();
  }
  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.apply();
  }
  setWet(wet: boolean): void {
    if (wet !== this.wet) {
      this.wet = wet;
      this.mood.wet = wet;
      this.nature?.setWet(wet);
      this.music?.setMood(this.fullMood());
      this.apply();
    }
  }
  /** Which music plays: the menu theme, the kingdom, or none. */
  setScene(scene: MusicScene | null): void {
    if (scene === this.scene) return;
    this.scene = scene;
    // A new scene starts a fresh piece rather than continuing mid-phrase.
    this.music?.stop();
    this.music?.setMood(this.fullMood());
    this.apply();
  }
  setMood(mood: Partial<Omit<MusicMood, 'scene'>>): void {
    this.mood = { ...this.mood, ...mood };
    this.music?.setMood(this.fullMood());
  }
  private fullMood(): MusicMood {
    return { ...this.mood, scene: this.scene ?? 'menu' };
  }
  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) {
      this.stopVoices();
      this.apply();
      if (this.context?.state === 'running')
        void this.context
          .suspend()
          .then(() => {
            if (this.visible && !this.destroyed) void this.unlock().catch(() => {});
          })
          .catch(() => {});
    } else if (this.context) void this.unlock().catch(() => {});
  }
  private ramp(param: AudioParam, value: number): void {
    const now = this.context!.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, 0.025);
  }
  private apply(): void {
    if (
      !this.context ||
      !this.master ||
      !this.effects ||
      !this.ambience ||
      this.destroyed ||
      this.unavailable
    )
      return;
    this.ramp(
      this.master.gain,
      this.visible && !this.preferences.muted ? this.preferences.master : 0,
    );
    this.ramp(this.effects.gain, this.preferences.effects);
    this.ramp(
      this.ambience.gain,
      this.playing && this.visible ? this.preferences.ambience * (this.wet ? 0.22 : 0.13) : 0,
    );
    if (this.filter) this.ramp(this.filter.frequency, this.wet ? 1200 : 650);
    const audible =
      this.visible &&
      !this.preferences.muted &&
      this.preferences.master > 0 &&
      this.context.state === 'running' &&
      this.scene !== null;
    if (this.musicBus) this.ramp(this.musicBus.gain, audible ? this.preferences.music * 0.6 : 0);
    if (this.natureBus)
      this.ramp(this.natureBus.gain, audible ? this.preferences.ambience * 0.9 : 0);
    if (audible && this.preferences.music > 0) this.music?.start();
    else this.music?.stop();
    if (audible && this.preferences.ambience > 0) this.nature?.start();
    else this.nature?.stop();
    if (
      !this.stream &&
      this.playing &&
      this.visible &&
      !this.preferences.muted &&
      this.preferences.master > 0 &&
      this.preferences.ambience > 0 &&
      this.context.state === 'running'
    )
      this.startStream();
  }
  private startStream(): void {
    const ctx = this.context!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < data.length; i++) {
      previous = (previous + (Math.random() * 2 - 1) * 0.06) / 1.02;
      data[i] = previous;
    }
    this.stream = ctx.createBufferSource();
    this.stream.buffer = buffer;
    this.stream.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.wet ? 1200 : 650;
    this.filter.Q.value = 0.4;
    this.stream.connect(this.filter);
    this.filter.connect(this.ambience!);
    this.stream.start();
  }
  private canCue(key: string, gap: number): boolean {
    if (
      !this.context ||
      this.context.state !== 'running' ||
      !this.visible ||
      this.destroyed ||
      this.unavailable ||
      this.preferences.muted ||
      this.preferences.master <= 0 ||
      this.preferences.effects <= 0
    )
      return false;
    const now = this.context.currentTime;
    if (now - (this.lastCue.get(key) ?? -Infinity) < gap) return false;
    this.lastCue.set(key, now);
    return true;
  }
  private tone(
    frequency: number,
    delay: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency = frequency,
  ): void {
    if (this.voices.size >= 12) return;
    const ctx = this.context!,
      oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    const now = ctx.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.effects!);
    const voice = { oscillator, gain };
    this.voices.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
  private get out(): Out {
    return { ctx: this.context!, dest: this.effects! };
  }
  /** Building sounds follow the material: timber knocks, stone clacks, water splashes. */
  playPlacement(kind: BuildingKind): void {
    if (!this.canCue('placement', 0.09)) return;
    const t = this.context!.currentTime;
    if (WATER_WORKS.includes(kind) || BUILDINGS[kind].onWater) play.buildWater(this.out, t);
    else if (STONE_WORKS.includes(kind)) play.buildStone(this.out, t);
    else play.buildWood(this.out, t);
  }
  /** A finished project: a gong and a short rising roneat phrase. */
  playCompletion(): void {
    if (!this.canCue('completion', 0.6)) return;
    const t = this.context!.currentTime;
    play.kongVong(this.out, t, 196, 0.8);
    [587.3, 659.3, 880].forEach((f, i) => play.roneat(this.out, t + 0.08 + i * 0.09, f, 0.7));
  }
  cue(name: Cue): void {
    if (!this.canCue(name, CUE_GAP[name])) return;
    const t = this.context!.currentTime;
    const o = this.out;
    if (name === 'click') play.click(o, t);
    else if (name === 'select') play.select(o, t);
    else if (name === 'open') play.open(o, t);
    else if (name === 'close') play.close(o, t);
    else if (name === 'invalid') play.invalid(o, t);
    else if (name === 'demolish') play.demolish(o, t);
    else if (name === 'upgrade')
      [196, 246.9, 293.7].forEach((f, i) => play.kongVong(o, t + i * 0.18, f, 0.9));
    else if (name === 'milestone') {
      play.gong(o, t, 110, 0.7);
      [587.3, 659.3, 740, 880, 987.8, 1174.7].forEach((f, i) =>
        play.roneat(o, t + 0.1 + i * 0.08, f, 0.75),
      );
    } else if (name === 'season') play.gong(o, t, 98, 1);
    else if (name === 'start') {
      play.gong(o, t, 110, 0.8);
      [440, 493.9, 587.3, 659.3, 880].forEach((f, i) =>
        play.roneat(o, t + 0.05 + i * 0.06, f, 0.7),
      );
    }
  }
  playDelivery(mode: 'worker' | 'barge'): void {
    if (!this.playing || !this.canCue('delivery', 0.7)) return;
    const base = mode === 'barge' ? 330 : 660;
    this.tone(base, 0, 0.13, 'sine', 0.08);
    this.tone((base * 4) / 3, 0.09, 0.16, 'sine', 0.07);
  }
  testSound(): void {
    if (this.canCue('test', 0.4)) {
      this.tone(440, 0, 0.16, 'sine', 0.12);
      this.tone(660, 0.1, 0.18, 'sine', 0.1);
    }
  }
  private stopVoices(): void {
    for (const voice of this.voices) {
      try {
        voice.oscillator.stop();
      } catch {
        /* An ended voice may still await its callback. */
      }
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    this.voices.clear();
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopVoices();
    this.music?.stop();
    this.nature?.stop();
    this.musicBus?.disconnect();
    this.natureBus?.disconnect();
    this.stream?.stop();
    this.stream?.disconnect();
    this.filter?.disconnect();
    this.effects?.disconnect();
    this.ambience?.disconnect();
    this.master?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
  }
}
