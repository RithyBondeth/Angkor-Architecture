import { describe, expect, it } from 'vitest';
import { createWorld, footprint, tileAt } from '../src/core/world';
import { foodOutlook, reservoirOutlook } from '../src/simulation/Outlook';
import { kingdomAlerts } from '../src/simulation/KingdomAlerts';
import { waterForecast } from '../src/ui/WaterPlanningUI';
import { foodForecast } from '../src/ui/SurvivalUI';

describe('kingdom outlook', () => {
  it('distinguishes stock reserves from a delivery-adjusted estimate and observes simulation time', () => {
    const state = createWorld();
    state.resources.rice = 100;
    expect(foodOutlook(state)).toMatchObject({ reserveDays: 20, observed: false, netDays: null });
    state.tick = 60;
    state.feedback.receipts = [{ tick: 60, resource: 'rice', amount: 10 }];
    expect(foodOutlook(state)).toMatchObject({ reserveDays: 20, netDays: 25, keepingUp: false });
    const outlook = foodOutlook(state);
    state.speed = 4;
    expect(foodOutlook(state)).toEqual(outlook);
    state.feedback.receipts[0]!.amount = 100;
    expect(foodOutlook(state)).toMatchObject({ keepingUp: true, netDays: null });
    expect(foodForecast(state)).toContain('Trend estimate');
    state.population = 0;
    expect(foodOutlook(state).reserveDays).toBeNull();
  });

  it('forecasts reservoir decline from recent observations without changing water', () => {
    const state = createWorld();
    const baray = state.buildings.find((b) => b.kind === 'baray')!;
    state.day = 14;
    for (const p of footprint(baray)) tileAt(state, p.x, p.y)!.water = 3;
    state.reservoirHistory = [
      {
        id: baray.id,
        samples: [
          { tick: 0, day: 12, depth: 5 },
          { tick: 12, day: 14, depth: 4 },
        ],
      },
    ];
    const before = structuredClone(state);
    expect(reservoirOutlook(state, baray)).toEqual({ daysToLow: 4, trend: 'falling' });
    expect(waterForecast(state, baray)).toContain('About 4 days');
    expect(state).toEqual(before);
    state.day = 20;
    expect(reservoirOutlook(state, baray).trend).toBe('unknown');
  });

  it('does not invent a water trend from a single reading', () => {
    const state = createWorld();
    const baray = state.buildings.find((b) => b.kind === 'baray')!;
    state.reservoirHistory = [{ id: baray.id, samples: [{ tick: 0, day: state.day, depth: 4 }] }];
    expect(reservoirOutlook(state, baray)).toEqual({ daysToLow: null, trend: 'unknown' });
  });
});

describe('actionable kingdom issues', () => {
  it('prioritizes food and groups affected live buildings with concrete remedies', () => {
    const state = createWorld();
    state.resources.rice = 0;
    for (const tile of state.tiles) tile.water = 0;
    const field = state.buildings.find((b) => b.kind === 'paddy')!;
    field.deliveryIssue = 'flooded-route';
    const alerts = kingdomAlerts(state);
    expect(alerts[0]!.id).toBe('food');
    expect(alerts.find((a) => a.id === 'fields')!.sites).toContain(field.id);
    expect(alerts.find((a) => a.id === 'deliveries')!.sites).toContain(field.id);
    field.condition = 0;
    expect(kingdomAlerts(state).find((a) => a.id === 'deliveries')?.sites ?? []).not.toContain(
      field.id,
    );
    expect(kingdomAlerts(state).find((a) => a.id === 'damage')!.sites).toContain(field.id);
  });
});
