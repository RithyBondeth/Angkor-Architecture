import type { GameState, Point } from '../core/types';
import { buildingAt, neighbors, tileAt } from '../core/world';

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
export function traversable(state: GameState, p: Point, mode: TravelMode): boolean {
  const t = tileAt(state, p.x, p.y);
  if (!t) return false;
  const building = buildingAt(state, p.x, p.y);
  const bridge = t.terrain === 'road' && t.elevation < 0;
  if (mode === 'barge')
    return (
      (['water', 'canal', 'reservoir'].includes(t.terrain) || bridge) &&
      t.water >= 0.45 &&
      !(building?.kind === 'gate' && !building.enabled)
    );
  if (bridge) return true;
  return (
    !['water', 'reservoir'].includes(t.terrain) &&
    t.water < 0.8 &&
    (!building || ['paddy', 'dock', 'house', 'lumber', 'quarry'].includes(building.kind))
  );
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
  const heuristic = (p: Point) => Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);
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
      const t = tileAt(state, p.x, p.y)!;
      const g = current.g + (mode === 'worker' && t.terrain === 'forest' ? 2 : 1);
      const k = key(p);
      if (g >= (costs.get(k) ?? Infinity)) continue;
      costs.set(k, g);
      parents.set(k, currentKey);
      open.push({ point: p, g, f: g + heuristic(p) });
    }
  }
  return null;
}
