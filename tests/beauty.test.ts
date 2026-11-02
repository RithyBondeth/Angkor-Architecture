import { describe, expect, it } from 'vitest';
import { completedBuilding } from '../src/core/buildingState';
import { createWorld } from '../src/core/world';
import { readGameState } from '../src/core/Persistence';
import { Game } from '../src/core/Game';
import { BUILDINGS, DECOR_KINDS } from '../src/data/buildings';
import {
  BEAUTY_CAP,
  beauty,
  contentmentGain,
  growthInterval,
  homesNear,
  shortageLossFactor,
} from '../src/simulation/Beauty';
import { placementAdvice } from '../src/simulation/PlacementAdvice';
import { Survival } from '../src/simulation/Survival';
import { nextStep } from '../src/ui/NextStepUI';
import type { Building, GameState } from '../src/core/types';

function world() {
  const s = createWorld();
  s.buildings = [];
  s.couriers = [];
  s.tutorial = undefined;
  s.tiles.forEach((t) => {
    t.water = 0;
    t.terrain = 'grass';
    t.elevation = 2.6;
  });
  return s;
}
function add(s: GameState, kind: Building['kind'], x: number, y: number) {
  const b = completedBuilding(s, kind, x, y);
  s.buildings.push(b);
  return b;
}

describe('decorations', () => {
  it('are cheap, unstaffed, and appealing', () => {
    expect(DECOR_KINDS).toEqual(['garden', 'palmgrove', 'shrine', 'naga', 'lotuspond', 'market']);
    for (const kind of DECOR_KINDS) {
      expect(BUILDINGS[kind].workers).toBe(0);
      expect(BUILDINGS[kind].appeal).toBeGreaterThan(0);
      expect(BUILDINGS[kind].production).toBeUndefined();
    }
  });

  it('count only near a standing dwelling', () => {
    const s = world();
    const garden = add(s, 'garden', 10, 10);
    expect(beauty(s)).toBe(0);
    const home = add(s, 'house', 12, 12);
    expect(homesNear(s, garden)).toBe(1);
    expect(beauty(s)).toBe(BUILDINGS.garden.appeal);
    home.condition = 0;
    expect(beauty(s)).toBe(0);
    home.condition = 100;
    add(s, 'house', 20, 20);
    expect(homesNear(s, garden)).toBe(1);
  });

  it('ignore unfinished decorations and cap the total', () => {
    const s = world();
    add(s, 'house', 10, 10);
    const pond = add(s, 'lotuspond', 12, 10);
    pond.construction = {
      type: 'build',
      workDone: 0,
      workRequired: 10,
      builders: 1,
      paused: false,
      cost: {},
    };
    expect(beauty(s)).toBe(0);
    pond.construction = null;
    for (let i = 0; i < 6; i++) add(s, 'market', 8 + (i % 3) * 2, 13 + Math.floor(i / 3) * 2);
    expect(beauty(s)).toBe(BEAUTY_CAP);
  });

  it('raise contentment, soften shortages, and speed settlement', () => {
    expect(contentmentGain(0)).toBeCloseTo(0.1);
    expect(contentmentGain(20)).toBeCloseTo(0.3);
    expect(shortageLossFactor(0)).toBe(1);
    expect(shortageLossFactor(BEAUTY_CAP)).toBe(0.5);
    expect(growthInterval(0)).toBe(3);
    expect(growthInterval(10)).toBe(2);
  });

  it('make a fed city happier than a plain one', () => {
    const plain = world();
    const pretty = world();
    for (const s of [plain, pretty]) {
      add(s, 'house', 10, 10);
      s.population = 8;
      s.resources.rice = 500;
      s.happiness = 60;
    }
    add(pretty, 'market', 12, 10);
    const survival = new Survival();
    for (let d = 0; d < 10; d++)
      for (const s of [plain, pretty]) {
        s.tick += 6;
        survival.food(s);
      }
    expect(pretty.happiness).toBeGreaterThan(plain.happiness);
  });

  it('advise placing them near homes', () => {
    const s = world();
    expect(placementAdvice(s, 'shrine', { x: 10, y: 10 })[0]).toMatchObject({ warning: true });
    add(s, 'house', 12, 12);
    expect(placementAdvice(s, 'shrine', { x: 10, y: 10 })[0]).toMatchObject({
      warning: false,
      message: expect.stringContaining('Delights 1 home'),
    });
  });

  it('can be placed on clear land and survive a save round trip', () => {
    const s = world();
    s.resources.sandstone = 100;
    const game = new Game(s);
    expect(game.place('naga', { x: 10, y: 10 }).ok).toBe(true);
    expect(readGameState(JSON.parse(JSON.stringify(s)))?.buildings.at(-1)?.kind).toBe('naga');
  });
});

describe('next step guide', () => {
  it('stays out of the way during the tutorial', () => {
    const s = world();
    s.tutorial = {
      status: 'active',
      step: 0,
      canalId: null,
      paddyId: null,
      inspected: false,
      delivered: false,
    };
    expect(nextStep(s)).toBeNull();
  });

  it('points at the first unmet commission goal with a building to place', () => {
    const s = world();
    const step = nextStep(s)!;
    expect(step.kind).toBe('canal');
    expect(step.action).toContain('data-kind="canal"');
    expect(step.value).toBe(0);
  });
});
