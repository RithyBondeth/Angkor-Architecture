import type { Courier, GameState, Point } from '../core/types';
import { buildingAt, neighbors, tileAt } from '../core/world';
import { productivity } from './survivalRules';

interface Node {
  point: Point;
  g: number;
  f: number;
}
class MinHeap {
  private nodes: Node[] = [];
  get length() {
    return this.nodes.length;
  }
  push(node: Node) {
    this.nodes.push(node);
    let i = this.nodes.length - 1;
    while (i > 0) {
      const parent = (i - 1) >>> 1;
      if (this.nodes[parent]!.f <= node.f) break;
      this.nodes[i] = this.nodes[parent]!;
      i = parent;
    }
    this.nodes[i] = node;
  }
  pop(): Node | undefined {
    const first = this.nodes[0];
    const last = this.nodes.pop();
    if (!this.nodes.length || !last) return first;
    let i = 0;
    while (i * 2 + 1 < this.nodes.length) {
      let child = i * 2 + 1;
      if (child + 1 < this.nodes.length && this.nodes[child + 1]!.f < this.nodes[child]!.f) child++;
      if (last.f <= this.nodes[child]!.f) break;
      this.nodes[i] = this.nodes[child]!;
      i = child;
    }
    this.nodes[i] = last;
    return first;
  }
}
export type TravelMode = 'worker' | 'barge';
export interface RouteOptions {
  ignoreFlooding?: boolean;
  ignoreClosedGates?: boolean;
  ignoreShallows?: boolean;
  ignoreRuins?: boolean;
}
export function traversable(
  state: GameState,
  p: Point,
  mode: TravelMode,
  options: RouteOptions = {},
): boolean {
  const t = tileAt(state, p.x, p.y);
  if (!t) return false;
  const building = buildingAt(state, p.x, p.y);
  const bridge = t.terrain === 'bridge';
  if (mode === 'barge')
    return (
      (['water', 'moat', 'canal', 'reservoir'].includes(t.terrain) || bridge) &&
      (options.ignoreShallows || t.water >= 0.45) &&
      !(
        !options.ignoreClosedGates &&
        building?.kind === 'gate' &&
        building.construction?.type !== 'build' &&
        building.condition > 0 &&
        !building.enabled
      )
    );
  if (bridge) return options.ignoreRuins || !building || building.condition > 0;
  if (!options.ignoreRuins && building?.kind === 'road' && building.condition === 0) return false;
  if (building?.construction?.type === 'build') return false;
  return (
    !['water', 'reservoir'].includes(t.terrain) &&
    (options.ignoreFlooding || t.water < 0.8) &&
    (!building ||
      [
        'paddy',
        'dock',
        'house',
        'lumber',
        'quarry',
        'lateritepit',
        'warehouse',
        'road',
        'moat',
        'canal',
      ].includes(building.kind))
  );
}
export function traversalCost(state: GameState, p: Point, mode: TravelMode) {
  const t = tileAt(state, p.x, p.y)!;
  return mode === 'barge'
    ? 1
    : ['road', 'bridge'].includes(t.terrain)
      ? 0.65
      : t.terrain === 'forest'
        ? 2
        : 1;
}
export function movementRate(state: GameState, c: Courier) {
  if (c.kind === 'barge') return 0.23 * productivity(state);
  const next = c.path[Math.min(Math.floor(c.progress) + 1, c.path.length - 1)]!;
  return (0.42 * productivity(state)) / traversalCost(state, next, 'worker');
}
/** Manhattan A* with a binary heap and per-node cost; returns null for unreachable destinations. */
export function findPath(
  state: GameState,
  start: Point,
  goal: Point,
  mode: TravelMode,
): Point[] | null {
  if (!traversable(state, start, mode) || !traversable(state, goal, mode)) return null;
  const key = (p: Point) => p.y * state.width + p.x;
  const heuristic = (p: Point) =>
    (Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y)) * (mode === 'worker' ? 0.65 : 1);
  const open = new MinHeap();
  const costs = new Map<number, number>([[key(start), 0]]);
  const parents = new Map<number, number>();
  open.push({ point: start, g: 0, f: heuristic(start) });
  while (open.length) {
    const current = open.pop()!;
    const currentKey = key(current.point);
    if (current.g > costs.get(currentKey)!) continue;
    if (currentKey === key(goal)) {
      const path: Point[] = [goal];
      let k = currentKey;
      while (parents.has(k)) {
        k = parents.get(k)!;
        path.push({ x: k % state.width, y: Math.floor(k / state.width) });
      }
      return path.reverse();
    }
    for (const p of neighbors(current.point)) {
      if (!traversable(state, p, mode)) continue;
      const g = current.g + traversalCost(state, p, mode);
      const k = key(p);
      if (g >= (costs.get(k) ?? Infinity)) continue;
      costs.set(k, g);
      parents.set(k, currentKey);
      open.push({ point: p, g, f: g + heuristic(p) });
    }
  }
  return null;
}

/** Dijkstra with multiple loading cells and destinations; finds the cheapest reachable receiver. */
export function findPathBetween(
  state: GameState,
  starts: Point[],
  goals: Point[],
  mode: TravelMode,
  options: RouteOptions = {},
): Point[] | null {
  const key = (p: Point) => p.y * state.width + p.x;
  const destinations = new Set(goals.map(key));
  const open = new MinHeap();
  const costs = new Map<number, number>();
  const parents = new Map<number, number>();
  // Cache occupancy and traversability for this search, including negative results.
  const allowed = new Map<number, boolean>();
  const canUse = (p: Point) => {
    if (p.x < 0 || p.y < 0 || p.x >= state.width || p.y >= state.height) return false;
    const k = key(p);
    if (!allowed.has(k)) allowed.set(k, traversable(state, p, mode, options));
    return allowed.get(k)!;
  };
  for (const p of starts)
    if (canUse(p)) {
      costs.set(key(p), 0);
      open.push({ point: p, g: 0, f: 0 });
    }
  while (open.length) {
    const current = open.pop()!;
    const k = key(current.point);
    if (current.g > costs.get(k)!) continue;
    if (destinations.has(k)) {
      const path = [current.point];
      let parent = k;
      while (parents.has(parent)) {
        parent = parents.get(parent)!;
        path.push({ x: parent % state.width, y: Math.floor(parent / state.width) });
      }
      return path.reverse();
    }
    for (const p of neighbors(current.point)) {
      if (!canUse(p)) continue;
      const next = key(p),
        g = current.g + traversalCost(state, p, mode);
      if (g >= (costs.get(next) ?? Infinity)) continue;
      costs.set(next, g);
      parents.set(next, k);
      open.push({ point: p, g, f: g });
    }
  }
  return null;
}
