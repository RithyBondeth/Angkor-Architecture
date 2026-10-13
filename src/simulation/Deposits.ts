import { RESOURCE_INFO } from '../data/buildings';
import type { BuildingKind, GameState, Point, Tile } from '../core/types';
import { BUILDINGS } from '../data/buildings';
import { buildingAt, random } from '../core/world';

/** Distance to the footprint rather than its top-left corner. */
export function siteDistance(p: Point, site: Point & { kind: BuildingKind }): number {
  const size = BUILDINGS[site.kind].size;
  return (
    Math.max(site.x - p.x, 0, p.x - site.x - size + 1) +
    Math.max(site.y - p.y, 0, p.y - site.y - size + 1)
  );
}
/** Separate RNG preserves the established landscape when migrating old saves. */
export function seedDeposits(state: GameState): void {
  const rand = random(state.seed ^ 0x5f27);
  const clusters = [
    { x: 23, y: 6, resource: 'sandstone' },
    { x: 8, y: 3, resource: 'sandstone' },
    { x: 21, y: 24, resource: 'laterite' },
    { x: 6, y: 23, resource: 'laterite' },
    { x: 19, y: 6, resource: 'laterite' },
  ] as const;
  for (const tile of state.tiles) {
    tile.timber = tile.terrain === 'forest' ? 80 + tile.variant * 20 : 0;
    tile.mineral = null;
    if (['water', 'canal', 'reservoir', 'bridge'].includes(tile.terrain)) continue;
    const cluster = clusters.find((c) => Math.abs(tile.x - c.x) + Math.abs(tile.y - c.y) <= 3);
    if (cluster)
      tile.mineral = { resource: cluster.resource, remaining: 80 + Math.floor(rand() * 81) };
  }
}
export function depositTiles(state: GameState, site: Point & { kind: BuildingKind }): Tile[] {
  if (!['quarry', 'lateritepit', 'lumber'].includes(site.kind)) return [];
  const wood = site.kind === 'lumber';
  return state.tiles
    .filter(
      (t) =>
        siteDistance(t, site) <= (wood ? 6 : 3) &&
        (wood
          ? t.terrain === 'forest' && t.timber > 0 && !buildingAt(state, t.x, t.y)
          : !['water', 'canal', 'reservoir', 'bridge'].includes(t.terrain) &&
            t.mineral?.resource === (site.kind === 'quarry' ? 'sandstone' : 'laterite') &&
            t.mineral.remaining > 0),
    )
    .sort((a, b) => siteDistance(a, site) - siteDistance(b, site) || a.y - b.y || a.x - b.x);
}
export function remainingDeposit(state: GameState, site: Point & { kind: BuildingKind }): number {
  return depositTiles(state, site).reduce(
    (n, t) => n + (site.kind === 'lumber' ? t.timber : t.mineral!.remaining),
    0,
  );
}
/** Consume only actual production; blocked or full worksites never spend deposits. */
export function extractDeposit(
  state: GameState,
  site: Point & { kind: BuildingKind },
  requested: number,
): number {
  let left = requested;
  for (const tile of depositTiles(state, site)) {
    const available = site.kind === 'lumber' ? tile.timber : tile.mineral!.remaining;
    const taken = Math.min(left, available);
    if (site.kind === 'lumber') {
      tile.timber = Math.max(0, tile.timber - taken);
      if (tile.timber < 1e-8) {
        tile.timber = 0;
        tile.terrain = 'grass';
      }
    } else tile.mineral!.remaining = Math.max(0, tile.mineral!.remaining - taken);
    left -= taken;
    if (left < 1e-8) break;
  }
  return requested - left;
}

export function resourceDescription(t: Tile): string {
  const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
  const parts = [`Tile ${t.x + 1}, ${t.y + 1}`];
  if (t.mineral)
    parts.push(
      `${RESOURCE_INFO[t.mineral.resource].name}: ${fmt(t.mineral.remaining)} blocks${t.mineral.remaining === 0 ? ' (exhausted)' : ''}`,
    );
  if (t.terrain === 'forest') parts.push(`Timber: ${fmt(t.timber)} logs`);
  if (parts.length === 1) parts.push('No harvestable deposit');
  return parts.join(' · ');
}
