export interface AudioPreferences {
  master: number;
  effects: number;
  ambience: number;
  muted: boolean;
}
export type VolumeChannel = 'master' | 'effects' | 'ambience';
export const AUDIO_DEFAULTS: Readonly<AudioPreferences> = {
  master: 0.6,
  effects: 0.7,
  ambience: 0.25,
  muted: false,
};
export const AUDIO_KEY = 'angkor-architect:audio:v1';

export function readAudioPreferences(storage: Pick<Storage, 'getItem'>): AudioPreferences {
  const preferences = { ...AUDIO_DEFAULTS };
  try {
    const value: unknown = JSON.parse(storage.getItem(AUDIO_KEY) ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return preferences;
    const saved = value as Record<string, unknown>;
    for (const key of ['master', 'effects', 'ambience'] as const) {
      const n = saved[key];
      if (typeof n === 'number' && Number.isFinite(n))
        preferences[key] = Math.max(0, Math.min(1, n));
    }
    if (typeof saved.muted === 'boolean') preferences.muted = saved.muted;
  } catch {
    /* Audio remains usable without browser storage. */
  }
  return preferences;
}
export function saveAudioPreferences(
  storage: Pick<Storage, 'setItem'>,
  preferences: AudioPreferences,
): void {
  try {
    storage.setItem(AUDIO_KEY, JSON.stringify(preferences));
  } catch {
    /* Optional device preference. */
  }
}
