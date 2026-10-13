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
  maxBuildersPerProject: 8,
  demolitionRefund: 0.5,
  survival: {
    residentsPerRice: 18,
    hungerPerMissedMeal: 14,
    hungerRecovery: 10,
    departureHunger: 40,
    shortageGraceDays: 3,
    droughtIrrigation: 0.25,
    cropFailureStress: 70,
    cropRecoveryStress: 20,
    baseHousing: 60,
  },
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
    description: 'Unlock royal granaries to make each harvest sustain more people.',
  },
  {
    name: 'The temple city',
    year: 1113,
    merit: 600,
    description: 'Unlock architects’ workshops and complete sculpted sanctuaries.',
  },
] as const;
