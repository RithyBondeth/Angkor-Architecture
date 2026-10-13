import { CONFIG } from '../data/config';

export class SeasonManager {
  static at(day: number) {
    const dayInYear = (day - 1) % (CONFIG.seasonDays * 2);
    const wet = dayInYear < CONFIG.seasonDays;
    return {
      name: wet ? 'Wet season' : 'Dry season',
      wet,
      progress: (dayInYear % CONFIG.seasonDays) / CONFIG.seasonDays,
      remaining: CONFIG.seasonDays - (dayInYear % CONFIG.seasonDays),
      year: CONFIG.startingYear + Math.floor((day - 1) / (CONFIG.seasonDays * 2)),
      rain: wet ? 0.018 : 0,
      evaporation: wet ? 0.002 : 0.012,
    };
  }
}
