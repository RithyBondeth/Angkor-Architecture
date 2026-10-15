import type { GameState } from '../core/types';
import { escapeHtml, icon } from './icons';
import { ISSUE_TEXT } from '../simulation/logisticsRules';

const STEPS = [
  [
    'Read the water',
    'Open the water overlay. Blue tiles show water depth. Drag to explore and scroll to zoom.',
    'Show water',
  ],
  [
    'Connect a canal',
    'Build a canal beside a filled canal, river, or reservoir. Let builders finish and wait for water to reach it. The outlined site is a suggestion; you can build elsewhere.',
    'Find a canal site',
  ],
  [
    'Plan a rice field',
    'Place a new rice paddy near water. Its entire 2 × 2 footprint must be clear. Keep a dry path to a dwelling or warehouse for deliveries.',
    'Find a paddy site',
  ],
  [
    'Meet your builders',
    'Inspect your new paddy. Projects receive an available crew automatically. Use + and − to change the crew, or release workers from another site if none are free.',
    'Inspect the paddy',
  ],
  [
    'Bring the field to life',
    'Finish construction and reach at least 50% irrigation. Keep a filled waterway within two tiles. If paused, use the time controls to resume.',
    'Inspect irrigation',
  ],
  [
    'Bring the harvest home',
    'Wait for rice from your new paddy to arrive at a dwelling or staffed warehouse. Keep the field staffed and its land route dry. Goods count only when received.',
    'Inspect deliveries',
  ],
] as const;

export function tutorialPanel(state: GameState): string {
  const t = state.tutorial;
  if (!t || t.status !== 'active')
    return `<div class="panel-eyebrow">The royal builder’s lesson ${icon('book-open-text')}</div><h2>${t?.status === 'completed' ? 'A builder is born.' : 'Learn by building.'}</h2><p class="building-description">${t?.status === 'completed' ? 'You connected water, managed builders, irrigated a field, and brought its rice home. Continue with Royal commissions.' : 'Follow six short lessons in your current kingdom. You can skip at any time; your city keeps running.'}</p><button class="primary-button full-width" data-action="tutorial-start">${t?.status === 'completed' ? 'Restart tutorial' : 'Start tutorial'}</button><button class="secondary-button full-width" data-action="panel" data-panel="campaign">Royal commissions</button>`;
  const [title, description, action] = STEPS[t.step]!;
  const site = state.buildings.find((b) => b.id === (t.step === 1 ? t.canalId : t.paddyId));
  const issue = site?.deliveryIssue ? ISSUE_TEXT[site.deliveryIssue] : null;
  return `<div class="panel-eyebrow">Interactive tutorial · ${t.step + 1} / 6</div><h2>${title}</h2><progress class="tutorial-progress" max="6" value="${t.step}" aria-label="Completed tutorial lessons"></progress><p class="building-description">${description}</p>${site ? `<p class="tutorial-status">${site.construction ? `Construction: ${Math.floor((100 * site.construction.workDone) / site.construction.workRequired)}% · ${site.construction.builders} builders${site.construction.paused ? ' · Paused' : ''}` : 'Construction complete'}${issue ? `<br>${escapeHtml(issue.title + ': ' + issue.remedy)}` : ''}</p>` : ''}<button class="primary-button full-width" data-action="tutorial-help">${action}</button>${t.step === 1 && site ? '<button class="secondary-button full-width" data-action="tutorial-retry">Track another canal</button>' : ''}<p class="panel-subtitle">Lessons advance when you complete each action. Open this lesson again with the book button in Kingdom views.</p><button class="text-button" data-action="tutorial-skip">Skip tutorial</button>`;
}
