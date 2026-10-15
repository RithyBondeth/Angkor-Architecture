import type { Building, GameState } from '../core/types';
import { RESERVOIR_DEPTH, reservoirDepth } from '../simulation/ReservoirHistory';
import { icon } from './icons';

export function waterPlanningTools(): string {
  return `<section class="water-planning" aria-label="Water planning tools"><h3>Plan the water</h3><div class="water-tool-buttons"><button class="secondary-button" data-action="overlay" data-overlay="water" aria-pressed="false">${icon('drop')}Depth <kbd>W</kbd></button><button class="secondary-button" data-action="overlay" data-overlay="flow" aria-pressed="false">${icon('arrows-out-line-horizontal')}Flow <kbd>F</kbd></button><button class="secondary-button" data-action="overlay" data-overlay="elevation" aria-pressed="false">${icon('mountains')}Elevation <kbd>E</kbd></button></div><p>Flow arrows show each tile’s strongest expected outflow next tick. Thicker arrows mean more water; transfers below 0.001 are hidden. Rain and evaporation are excluded. Elevation shades ground from blue (low) to gold (high). Tap a tile for ground, depth, and surface readings; water follows surface pressure.</p></section>`;
}

export function reservoirHistoryChart(state: GameState, b: Building): string {
  const samples = state.reservoirHistory?.find((h) => h.id === b.id)?.samples ?? [];
  if (!samples.length)
    return '<section class="reservoir-history"><h3>Reservoir history</h3><p>Readings begin when this completed reservoir is simulated.</p></section>';
  const first = samples[0]!,
    last = samples.at(-1)!;
  const percent = (depth: number) => (100 * depth) / RESERVOIR_DEPTH;
  const max = Math.max(100, ...samples.map((s) => Math.ceil(percent(s.depth) / 25) * 25));
  const x = (day: number) => 28 + ((day - first.day) / Math.max(1, last.day - first.day)) * 212;
  const y = (depth: number) => 104 - (percent(depth) / max) * 80;
  const points = samples.map((s) => `${x(s.day).toFixed(2)},${y(s.depth).toFixed(2)}`).join(' ');
  const delta = percent(last.depth - first.depth);
  const summary =
    samples.length === 1
      ? 'First reading recorded. The next daily reading will reveal the trend.'
      : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} percentage points over ${last.day - first.day} ${last.day - first.day === 1 ? 'day' : 'days'}.`;
  return `<section class="reservoir-history"><h3>Reservoir history</h3><p class="history-summary">${summary}</p><svg viewBox="0 0 264 136" role="img" aria-label="Reservoir storage from day ${first.day} to ${last.day}: ${percent(first.depth).toFixed(1)}% to ${percent(last.depth).toFixed(1)}% of nominal capacity"><line x1="28" y1="24" x2="240" y2="24"/><line x1="28" y1="104" x2="240" y2="104"/><text x="2" y="20">${max}%</text><text x="2" y="108">0%</text><polyline points="${points}"/><circle cx="${x(last.day).toFixed(2)}" cy="${y(last.depth).toFixed(2)}" r="3"/><text x="28" y="128">Day ${first.day}</text><text x="240" y="128" text-anchor="end">Day ${last.day}</text></svg><p>Up to 60 daily readings. 100% is nominal storage (6 depth); overflow can exceed it. Observations, not a forecast.</p><details data-reservoir-history="${b.id}"><summary>Daily readings (${samples.length})</summary><table><caption class="sr-only">Daily reservoir storage readings</caption><thead><tr><th scope="col">Day</th><th scope="col">Stored</th><th scope="col">Depth</th></tr></thead><tbody>${samples
    .slice()
    .reverse()
    .map(
      (s) =>
        `<tr><th scope="row">${s.day}</th><td>${percent(s.depth).toFixed(1)}%</td><td>${s.depth.toFixed(2)}</td></tr>`,
    )
    .join('')}</tbody></table></details></section>`;
}

export function reservoirList(state: GameState): string {
  const reservoirs = state.buildings.filter(
    (b) => b.kind === 'baray' && b.construction?.type !== 'build',
  );
  return `<section class="water-planning"><h3>Reservoir readings</h3>${reservoirs.length ? reservoirs.map((b) => `<button class="survival-site" data-action="select-building" data-id="${b.id}"><span>${icon('waves')}<strong>Baray · tile ${b.x + 1}, ${b.y + 1}</strong><small>${((reservoirDepth(state, b) / RESERVOIR_DEPTH) * 100).toFixed(1)}% stored · inspect history</small></span>${icon('arrow-right')}</button>`).join('') : '<p>Complete a baray to start its history.</p>'}</section>`;
}
