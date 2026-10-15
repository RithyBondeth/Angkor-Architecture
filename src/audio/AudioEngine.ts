import type { BuildingKind } from '../core/types';
import type { AudioPreferences } from './preferences';

type Voice = { oscillator: OscillatorNode; gain: GainNode };
/** Quiet procedural effects and water texture; game time never schedules audio ahead. */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private ambience: GainNode | null = null;
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
      this.apply();
    }
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
  playPlacement(kind: BuildingKind): void {
    if (!this.canCue('placement', 0.09)) return;
    if (['canal', 'moat', 'baray'].includes(kind)) this.tone(440, 0, 0.16, 'sine', 0.18, 160);
    else {
      this.tone(190, 0, 0.09, 'triangle', 0.16, 90);
      this.tone(380, 0.025, 0.07, 'sine', 0.08, 210);
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
    this.stream?.stop();
    this.stream?.disconnect();
    this.filter?.disconnect();
    this.effects?.disconnect();
    this.ambience?.disconnect();
    this.master?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
  }
}
