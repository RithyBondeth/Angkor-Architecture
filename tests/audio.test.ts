import { describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../src/audio/AudioEngine';
import {
  AUDIO_DEFAULTS,
  AUDIO_KEY,
  readAudioPreferences,
  saveAudioPreferences,
} from '../src/audio/preferences';
import { Game } from '../src/core/Game';
import { createWorld } from '../src/core/world';

class Param {
  value = 0;
  cancelScheduledValues = vi.fn();
  setTargetAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  setValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class Node {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
function context() {
  const gains: Node[] = [],
    oscillators: Node[] = [],
    streams: Node[] = [];
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 100,
    destination: new Node(),
    createGain: () => {
      const n = new Node();
      gains.push(n);
      return n;
    },
    createOscillator: () => {
      const n = new Node();
      oscillators.push(n);
      return n;
    },
    createBufferSource: () => {
      const n = new Node();
      streams.push(n);
      return n;
    },
    createBiquadFilter: () => new Node(),
    createBuffer: () => ({ getChannelData: () => new Float32Array(300) }),
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
    suspend: vi.fn(async () => {
      ctx.state = 'suspended';
    }),
    close: vi.fn(async () => {
      ctx.state = 'closed';
    }),
  };
  return { ctx, gains, oscillators, streams };
}
function setup() {
  const mock = context(),
    create = vi.fn(() => mock.ctx as unknown as AudioContext);
  const engine = new AudioEngine({ ...AUDIO_DEFAULTS }, create);
  return { ...mock, create, engine };
}

describe('device audio preferences', () => {
  it('clamps valid channels and ignores invalid fields or corrupt storage', () => {
    expect(readAudioPreferences({ getItem: () => '{broken' })).toEqual(AUDIO_DEFAULTS);
    expect(
      readAudioPreferences({
        getItem: () => JSON.stringify({ master: 8, effects: -1, ambience: '0', muted: true }),
      }),
    ).toEqual({ ...AUDIO_DEFAULTS, master: 1, effects: 0, muted: true });
    expect(
      readAudioPreferences({
        getItem: () => {
          throw Error();
        },
      }),
    ).toEqual(AUDIO_DEFAULTS);
    const setItem = vi.fn();
    saveAudioPreferences({ setItem }, { ...AUDIO_DEFAULTS, ambience: 0.1 });
    expect(setItem).toHaveBeenCalledWith(
      AUDIO_KEY,
      JSON.stringify({ ...AUDIO_DEFAULTS, ambience: 0.1 }),
    );
    expect(() =>
      saveAudioPreferences(
        {
          setItem: () => {
            throw Error();
          },
        },
        { ...AUDIO_DEFAULTS },
      ),
    ).not.toThrow();
  });
});

describe('procedural audio lifecycle', () => {
  it('creates no audio until unlocked and does not replay old effects', async () => {
    const { engine, create, oscillators } = setup();
    engine.setPlaying(true);
    engine.playPlacement('road');
    engine.playDelivery('worker');
    expect(create).not.toHaveBeenCalled();
    await engine.unlock();
    expect(oscillators).toHaveLength(0);
    engine.playPlacement('road');
    expect(oscillators).toHaveLength(2);
    engine.destroy();
  });
  it('routes independent volumes through master and changes water by season', async () => {
    const { engine, gains, streams } = setup();
    await engine.unlock();
    expect(streams).toHaveLength(0);
    engine.setPlaying(true);
    expect(streams).toHaveLength(1);
    expect(gains[1]!.connect).toHaveBeenCalledWith(gains[0]);
    expect(gains[2]!.connect).toHaveBeenCalledWith(gains[0]);
    engine.setPreferences({ ...AUDIO_DEFAULTS, master: 0.4, effects: 0.3, ambience: 0.8 });
    // Music and nature buses stay silent until a menu or kingdom scene is chosen.
    expect(gains.map((n) => n.gain.value)).toEqual([0.4, 0.3, 0.8 * 0.22, 0, 0]);
    engine.setWet(false);
    expect(gains[2]!.gain.value).toBe(0.8 * 0.13);
    engine.setPlaying(false);
    expect(gains[2]!.gain.value).toBe(0);
    engine.destroy();
  });
  it('coalesces bursts, differentiates deliveries, and keeps muted effects silent', async () => {
    const { engine, ctx, oscillators, gains } = setup();
    await engine.unlock();
    engine.setPlaying(true);
    for (let i = 0; i < 100; i++) engine.playDelivery('worker');
    expect(oscillators).toHaveLength(2);
    expect(oscillators[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(660, 0);
    ctx.currentTime = 1;
    engine.playDelivery('barge');
    expect(oscillators[2]!.frequency.setValueAtTime).toHaveBeenCalledWith(330, 1);
    engine.setPreferences({ ...AUDIO_DEFAULTS, muted: true });
    expect(gains[0]!.gain.value).toBe(0);
    expect(oscillators.every((n) => n.stop.mock.calls.length === 2)).toBe(true);
    ctx.currentTime = 2;
    engine.playPlacement('canal');
    engine.testSound();
    expect(oscillators).toHaveLength(4);
    engine.destroy();
  });
  it('suspends in the background, resumes, and releases all nodes on teardown', async () => {
    const { engine, ctx, oscillators, streams } = setup();
    await engine.unlock();
    engine.setPlaying(true);
    engine.playPlacement('canal');
    engine.setVisible(false);
    expect(ctx.suspend).toHaveBeenCalledOnce();
    engine.playPlacement('road');
    expect(oscillators).toHaveLength(1);
    await Promise.resolve();
    engine.setVisible(true);
    await engine.unlock();
    expect(ctx.state).toBe('running');
    // One looping water bed; the canal's splash is a short, separate noise burst.
    expect(streams.filter((n) => (n as unknown as { loop?: boolean }).loop)).toHaveLength(1);
    engine.destroy();
    engine.destroy();
    expect(ctx.close).toHaveBeenCalledOnce();
    expect(streams[0]!.stop).toHaveBeenCalledOnce();
  });
  it('retries blocked autoplay and tolerates unsupported audio', async () => {
    const { engine, ctx } = setup();
    ctx.resume.mockRejectedValueOnce(Error('blocked'));
    expect(await engine.unlock()).toBe(false);
    expect(await engine.unlock()).toBe(true);
    engine.destroy();
    const unsupported = new AudioEngine({ ...AUDIO_DEFAULTS }, () => {
      throw Error();
    });
    expect(await unsupported.unlock()).toBe(false);
    expect(unsupported.status).toContain('unavailable');
    expect(() => unsupported.playPlacement('road')).not.toThrow();
  });
});

describe('transient placement feedback', () => {
  it('emits only successful commands, once per route, with removable listeners', () => {
    const state = createWorld();
    state.buildings = [];
    state.couriers = [];
    state.tiles.forEach((t) => {
      t.terrain = 'grass';
      t.elevation = 2.6;
      t.water = 0;
    });
    const game = new Game(state),
      listener = vi.fn(),
      off = game.onEvent(listener);
    expect(listener).not.toHaveBeenCalled();
    game.previewRoute('road', { x: 5, y: 5 }, { x: 8, y: 5 });
    expect(listener).not.toHaveBeenCalled();
    game.placeRoute('road', { x: 5, y: 5 }, { x: 8, y: 5 });
    expect(listener).toHaveBeenCalledExactlyOnceWith({ type: 'placement', kind: 'road', count: 4 });
    game.place('road', { x: 5, y: 5 });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    game.place('canal', { x: 9, y: 5 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('music, nature, and interface sounds', () => {
  it('play pinpeat music only once a scene is chosen, and stop when muted or hidden', async () => {
    vi.useFakeTimers();
    try {
      const { engine, ctx, oscillators, gains } = setup();
      await engine.unlock();
      vi.advanceTimersByTime(1000);
      expect(oscillators).toHaveLength(0);
      engine.setScene('menu');
      expect(oscillators.length).toBeGreaterThan(0);
      expect(gains[3]!.gain.value).toBeCloseTo(AUDIO_DEFAULTS.music * 0.6);
      engine.setPreferences({ ...AUDIO_DEFAULTS, muted: true });
      const before = oscillators.length;
      ctx.currentTime = 30;
      vi.advanceTimersByTime(5000);
      expect(oscillators).toHaveLength(before);
      expect(gains[3]!.gain.value).toBe(0);
      engine.setPreferences({ ...AUDIO_DEFAULTS });
      engine.setVisible(false);
      const hidden = oscillators.length;
      ctx.currentTime = 60;
      vi.advanceTimersByTime(5000);
      expect(oscillators).toHaveLength(hidden);
      engine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('respects mute and pacing for interface and building cues', async () => {
    const { engine, ctx, oscillators } = setup();
    await engine.unlock();
    engine.cue('click');
    engine.cue('click');
    const once = oscillators.length;
    expect(once).toBeGreaterThan(0);
    ctx.currentTime = 1;
    engine.cue('milestone');
    engine.playPlacement('temple');
    engine.playPlacement('lotusraft');
    expect(oscillators.length).toBeGreaterThan(once);
    engine.setPreferences({ ...AUDIO_DEFAULTS, muted: true });
    const muted = oscillators.length;
    ctx.currentTime = 5;
    engine.cue('season');
    engine.playCompletion();
    expect(oscillators).toHaveLength(muted);
    engine.destroy();
  });

  it('saves a separate, clamped music volume', () => {
    expect(readAudioPreferences({ getItem: () => JSON.stringify({ music: 3 }) })).toEqual({
      ...AUDIO_DEFAULTS,
      music: 1,
    });
    expect(readAudioPreferences({ getItem: () => JSON.stringify({ music: 'loud' }) }).music).toBe(
      AUDIO_DEFAULTS.music,
    );
  });
});
