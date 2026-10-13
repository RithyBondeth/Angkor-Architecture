export const CONFIG = {
  worldSize: 32,
  tileWidth: 72,
  tileHeight: 36,
  tickMs: 500,
  ticksPerDay: 6,
  seasonDays: 90,
  startingYear: 802,
  autosaveMs: 30_000,
  maxResource: 99_999,
  maxCouriers: 36,
} as const;

/** Inspired by Khmer hydraulic cities; gameplay rates are illustrative, not historical measurements. */
export const ERAS = [
  {
    name: 'The founding of Angkor',
    year: 802,
    merit: 0,
    description: 'Lay the foundations of a city sustained by water.',
  },
  {
    name: 'The great barays',
    year: 889,
    merit: 200,
    description: 'Expand your reservoirs and connect the fertile plain.',
  },
  {
    name: 'The temple city',
    year: 1113,
    merit: 600,
    description: 'Raise monuments to a flourishing civilization.',
  },
] as const;
