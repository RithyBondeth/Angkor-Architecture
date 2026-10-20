import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game';
import { createScenario, createWorld } from '../src/core/world';
import { readGameState, validateState } from '../src/core/Persistence';
import { activeCommission } from '../src/core/progressionState';
import { SCENARIOS, SCENARIO_IDS, commissionsFor, scenarioFor } from '../src/data/scenarios';
import { COMMISSIONS } from '../src/data/progression';
import { deliveryRoute } from '../src/simulation/Logistics';
import { remainingDeposit } from '../src/simulation/Deposits';
import { Progression } from '../src/simulation/Progression';
import { campaignPanel, commissionOverview } from '../src/ui/CampaignUI';
import { scenarioDetails, scenarioPicker } from '../src/ui/ScenarioSelection';

describe('scenario worlds', () => {
  it.each(SCENARIO_IDS)(
    'creates a deterministic, valid, supplied %s settlement with working starter routes',
    (id) => {
      const state = createScenario(id),
        def = SCENARIOS[id];
      expect(state).toEqual(createScenario(id));
      expect(state.scenario).toBe(id);
      expect(state.seed).toBe(def.seed);
      expect(state.resources).toEqual(def.resources);
      expect(state.day).toBe(def.day);
      expect(validateState(state)).toBe(true);
      for (const kind of ['paddy', 'lumber', 'quarry', 'lateritepit'] as const) {
        const site = state.buildings.find((b) => b.kind === kind)!;
        expect(deliveryRoute(state, site), `${id} ${kind} delivery`).not.toBeNull();
        if (kind !== 'paddy') expect(remainingDeposit(state, site)).toBeGreaterThan(0);
      }
      // The picker advertises the same resources the player actually receives.
      const details = scenarioDetails(id);
      for (const amount of Object.values(def.resources))
        expect(details).toContain(`>${amount}</dd>`);
      expect(details).toContain(def.commissions[0]!.title);
    },
  );

  it('provides meaningfully different river coverage, slopes, fertility, and supplies', () => {
    const r = createScenario('roluos'),
      f = createScenario('floodplain'),
      h = createScenario('foothills');
    const waters = (s: typeof r) => s.tiles.filter((t) => t.terrain === 'water').length;
    expect(waters(f)).toBeGreaterThan(waters(r));
    expect(waters(h)).toBeLessThan(waters(r));
    expect(Math.max(...h.tiles.map((t) => t.elevation))).toBeGreaterThan(6);
    const fertility = (s: typeof r) =>
      s.tiles.reduce((n, t) => n + t.fertility, 0) / s.tiles.length;
    expect(fertility(f)).toBeGreaterThan(fertility(r));
    expect(fertility(h)).toBeLessThan(fertility(r));
    expect(f.resources.rice).toBeGreaterThan(r.resources.rice);
    expect(h.resources.sandstone).toBeGreaterThan(r.resources.sandstone);
    expect(createWorld()).toEqual(createScenario('roluos'));
  });

  it.each(SCENARIO_IDS)('keeps %s operational through its first ten days', (id) => {
    const game = new Game(createScenario(id));
    for (let i = 0; i < 60; i++) game.step();
    expect(validateState(game.state)).toBe(true);
    expect(game.state.population).toBe(84);
    expect(game.state.survival.hunger).toBe(0);
    expect(
      game.state.buildings
        .filter((b) => b.kind === 'paddy')
        .every((b) => !b.crop?.failed && b.condition > 0),
    ).toBe(true);
    expect(game.state.progression.delivered.rice).toBeGreaterThan(0);
    expect(game.state.progression.delivered.sandstone).toBeGreaterThan(0);
  });
});

describe('scenario campaigns', () => {
  it.each(SCENARIO_IDS)(
    'can earn the opening %s commission through normal building and delivery play',
    (id) => {
      const game = new Game(createScenario(id));
      const place = (kind: Parameters<Game['place']>[0], x: number, y: number) =>
        expect(game.place(kind, { x, y }).ok, `${id} ${kind} at ${x},${y}`).toBe(true);
      if (id === 'floodplain') {
        place('gate', 13, 14);
        place('paddy', 14, 11);
        place('paddy', 14, 15);
      } else {
        if (id === 'foothills')
          expect(game.placeRoute('canal', { x: 14, y: 11 }, { x: 14, y: 16 }).ok).toBe(true);
        else place('canal', 14, 14);
        place('paddy', 14, id === 'foothills' ? 19 : 11);
        place('baray', 1, 10);
      }
      for (let i = 0; i < 240 && !game.state.progression.claimed.length; i++) game.step();
      expect(game.state.progression.claimed).toEqual(['water-foundation']);
      expect(validateState(game.state)).toBe(true);
    },
  );

  it('uses distinct opening requirements and counts deliveries instead of starting supplies', () => {
    const f = createScenario('floodplain'),
      h = createScenario('foothills');
    expect(activeCommission(f)!.goals[0]).toMatchObject({ type: 'build', kind: 'gate', target: 1 });
    expect(activeCommission(h)!.goals[0]).toMatchObject({
      type: 'build',
      kind: 'canal',
      target: 6,
    });
    h.built = { canal: 1, baray: 1, paddy: 1 };
    new Progression().step(h);
    expect(h.progression.claimed).toEqual([]);
    f.built = { gate: 1, paddy: 2 };
    new Progression().step(f);
    expect(f.progression.claimed).toEqual([]);
    f.progression.delivered.rice = 100;
    const merit = f.resources.merit;
    new Progression().step(f);
    expect(f.progression.claimed).toEqual(['water-foundation']);
    expect(f.resources.merit).toBe(merit + 80);
    new Progression().step(f);
    expect(f.resources.merit).toBe(merit + 80);
    expect(activeCommission(f)!.title).toBe('Link the river villages');
  });

  it.each(SCENARIO_IDS)(
    'can complete the five %s chapters in order without repeating rewards',
    (id) => {
      const state = createScenario(id);
      const progression = new Progression();
      for (const chapter of commissionsFor(state)) {
        for (const g of chapter.goals) {
          if (g.type === 'build') state.built[g.kind] = g.target;
          if (g.type === 'delivered') state.progression.delivered[g.resource] = g.target;
          if (g.type === 'stockpile') state.resources[g.resource] = g.target;
          if (g.type === 'population') state.population = g.target;
          if (g.type === 'sustain') state.progression.streakDays = g.target;
          if (g.type === 'temple-level')
            state.buildings.find((b) => b.kind === 'temple')!.level = g.target;
        }
        expect(activeCommission(state)?.id).toBe(chapter.id);
        expect(progression.step(state).some((e) => e.title === chapter.title)).toBe(true);
      }
      expect(state.progression.claimed).toEqual(COMMISSIONS.map((c) => c.id));
      const resources = { ...state.resources };
      progression.step(state);
      expect(state.resources).toEqual(resources);
      expect(commissionOverview(state)).toContain('Campaign complete');
      expect(campaignPanel(state)).toContain('Campaign complete');
    },
  );
});

describe('scenario saves and selection', () => {
  it.each(SCENARIO_IDS)(
    'round-trips %s metadata, terrain, resources, objectives, and progress',
    (id) => {
      const original = new Game(createScenario(id)).state;
      original.progression.claimed = ['water-foundation'];
      const restored = readGameState(JSON.parse(JSON.stringify(original)))!;
      expect(restored).toEqual(original);
      expect(activeCommission(restored)!.title).toBe(SCENARIOS[id].commissions[1]!.title);
      expect(campaignPanel(restored)).toContain(SCENARIOS[id].region);
    },
  );

  it('keeps older saves on the original Roluos campaign and rejects unknown scenarios', () => {
    const state = createWorld();
    delete state.scenario;
    const old = readGameState(state)!;
    expect(scenarioFor(old).id).toBe('roluos');
    expect(commissionsFor(old)).toEqual(COMMISSIONS);
    for (const scenario of [null, 1, 'unknown', '__proto__', 'toString'])
      expect(readGameState({ ...state, scenario })).toBeNull();
  });

  it('does not share mutable initial resources or settlements across restarts', () => {
    const s = createScenario('foothills');
    s.resources.rice = 0;
    s.progression.claimed.push('water-foundation');
    s.tiles[0]!.elevation = 0;
    const again = createScenario('foothills');
    expect(again.resources.rice).toBe(480);
    expect(again.progression.claimed).toEqual([]);
    expect(again.tiles[0]!.elevation).toBeGreaterThan(6);
    const picker = scenarioPicker('foothills');
    expect(picker).toContain('type="radio"');
    expect(picker).toContain('value="foothills" checked');
    expect(picker).toContain('Carry water from the hills');
  });
});
