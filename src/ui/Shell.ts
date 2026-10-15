import { RESOURCE_INFO } from '../data/buildings';
import type { Category, Resource } from '../core/types';
import { icon } from './icons';
import { angkorEmblem } from './emblem';

const VIEWS = [
  ['tutorial', 'book-open-text', 'Interactive tutorial'],
  ['overview', 'squares-four', 'Kingdom overview'],
  ['water', 'waves', 'Water management'],
  ['workforce', 'users-three', 'People & logistics'],
  ['survival', 'bowl-food', 'Food & resilience'],
  ['construction', 'hammer', 'Construction projects'],
  ['campaign', 'flag-pennant', 'Royal commissions'],
  ['monuments', 'bank', 'Monuments'],
  ['chronicle', 'scroll', 'City chronicle'],
] as const;

export function createShell(root: HTMLElement) {
  root.innerHTML = `<div class="game-shell">
    <a class="skip-link" href="#world">Skip to kingdom map</a>
    <main class="map-area" aria-label="Your kingdom">
      <div id="world" tabindex="-1"><div class="world-loading"><span class="loading-temple">${icon('bank')}</span><span class="eyebrow">THE AGE OF ANGKOR</span><strong>A kingdom awakens.</strong><span>The waters are finding their way.</span></div></div>
      <header class="command-bar">
        <button class="game-brand" data-action="settings" aria-label="Open game menu" title="Game menu (Esc)"><span class="royal-mark">${angkorEmblem()}</span><span>ANGKOR<small>ARCHITECT</small></span></button>
        <section class="resource-bar" aria-label="Kingdom resources">${(Object.keys(RESOURCE_INFO) as Resource[]).map((r) => `<div class="resource" title="${RESOURCE_INFO[r].name}"><span class="resource-icon ${r}">${icon(RESOURCE_INFO[r].icon)}</span><div><span class="resource-label">${RESOURCE_INFO[r].name}</span><strong id="resource-${r}">—</strong><small id="rate-${r}"></small></div></div>`).join('')}<div class="resource population-resource"><span class="resource-icon people">${icon('users-three')}</span><div><span class="resource-label">People</span><strong id="population">—</strong><small id="happiness"></small></div></div></section>
        <div class="command-actions"><button class="icon-button" data-action="save" aria-label="Save game" title="Save game">${icon('floppy-disk')}</button><button class="icon-button" data-action="guide" aria-label="Open builder’s guide" title="Builder’s guide (H)">${icon('question')}</button><button class="icon-button" data-action="settings" aria-label="Open settings" title="Game settings">${icon('gear-six')}</button></div>
      </header>
      <div class="world-heading"><span class="region-label">THE KHMER EMPIRE <span id="game-date">802 CE</span></span><h1><span id="region-name">Roluos</span> <em>settlement</em></h1><span class="era-caption" id="era-name">The founding of Angkor</span></div>
      <div class="season-card"><div class="weather-badge"><span id="season-icon">${icon('cloud-rain')}</span><div><strong id="season-name">Wet season</strong><small id="season-detail">The monsoon is here</small></div></div><div class="season-track"><span id="season-progress"></span></div><span id="sidebar-season"></span></div>
      <div class="mobile-camera-controls" aria-label="Camera controls"><button class="icon-button" data-action="zoom-out" aria-label="Zoom out">${icon('minus')}</button><button class="icon-button" data-action="zoom-in" aria-label="Zoom in">${icon('plus')}</button><button class="icon-button" data-action="recenter" aria-label="Recenter map">${icon('corners-out')}</button></div>
      <nav class="kingdom-nav" aria-label="Kingdom views">${VIEWS.map(([panel, symbol, label]) => `<button class="nav-item ${panel === 'overview' ? 'active' : ''}" data-action="panel" data-panel="${panel}" aria-label="${label}" aria-pressed="${panel === 'overview'}" title="${label}">${icon(symbol)}<span class="nav-tooltip">${label}</span>${panel === 'water' ? '<small id="lowwater-count"></small>' : panel === 'workforce' ? '<small id="logistics-count"></small><span id="idle-count" class="sr-only"></span>' : panel === 'construction' ? '<small id="projects-count">0</small>' : ''}</button>`).join('')}</nav>
      <div class="inspector-shell is-open"><div class="inspector-frame-heading"><span>${icon('compass')} KINGDOM INTELLIGENCE</span><button class="icon-button" data-action="close-inspector" aria-label="Hide kingdom information" title="Hide panel (Esc)">${icon('x')}</button></div><aside id="inspector" class="inspector" aria-label="Kingdom information"></aside></div>
      <div class="map-top-controls"><div class="map-view-buttons" aria-label="Map overlays">${[
        ['water', 'drop', 'Water depth (W)'],
        ['flow', 'arrows-out-line-horizontal', 'Water flow (F)'],
        ['elevation', 'mountains', 'Ground elevation (E)'],
        ['logistics', 'path', 'Delivery routes (L)'],
        ['resources', 'mountains', 'Resource deposits (R)'],
        ['grid', 'grid-four', 'Construction grid (G)'],
      ]
        .map(
          ([overlay, symbol, label]) =>
            `<button class="icon-button" data-action="overlay" data-overlay="${overlay}" aria-label="Toggle ${overlay} overlay" aria-pressed="false" title="${label}">${icon(symbol!)}</button>`,
        )
        .join(
          '',
        )}<span class="time-divider"></span><button class="icon-button demolition-tool" data-action="demolish-mode" aria-label="Toggle demolition tool" aria-pressed="false" title="Remove structures (X)">${icon('trash')}</button></div><span id="overlay-label" hidden></span></div>
      <div class="map-bottom-controls"><div class="time-controls"><button class="icon-button" data-action="pause" aria-label="Pause simulation">${icon('pause')}</button><span class="time-divider"></span><button data-action="speed" data-speed="1" class="active" aria-label="Normal simulation speed">1×</button><button data-action="speed" data-speed="2" aria-label="Double simulation speed">2×</button><button data-action="speed" data-speed="4" aria-label="Quadruple simulation speed">4×</button><span class="time-divider"></span><span id="game-day">Day 12</span></div><span class="map-hint" id="map-hint">Drag to explore · Scroll to zoom</span><span class="save-indicator">${icon('check-circle')}<span id="save-status">Local kingdom</span></span></div>
      <div class="minimap-card"><span>${icon('compass')} KINGDOM MAP <small>N ↑</small></span><canvas id="minimap" aria-label="Settlement minimap. Click a location to move the camera." title="Click to navigate"></canvas><div class="zoom-controls"><button class="icon-button" data-action="zoom-out" aria-label="Zoom out">${icon('minus')}</button><span id="zoom-value">72%</span><button class="icon-button" data-action="zoom-in" aria-label="Zoom in">${icon('plus')}</button><button class="icon-button" data-action="recenter" aria-label="Recenter map" title="Recenter map">${icon('corners-out')}</button></div></div>
      <div id="placement-banner" class="placement-banner" hidden></div>
      <section class="build-tray" aria-label="Building selection"><div class="build-tray-header"><h2>${icon('hammer')}Build your kingdom</h2><div class="build-tabs" role="tablist" aria-label="Building categories">${(['all', 'water', 'production', 'civic', 'infrastructure'] as Category[]).map((c) => `<button role="tab" data-action="category" data-category="${c}" aria-selected="${c === 'all'}" class="${c === 'all' ? 'active' : ''}">${c === 'all' ? 'All' : c === 'water' ? 'Waterworks' : c === 'production' ? 'Production' : c === 'infrastructure' ? 'Paths & bridges' : 'Civic & sacred'}</button>`).join('')}</div><button class="icon-button dock-toggle" data-action="toggle-build" aria-expanded="true" aria-controls="building-list" aria-label="Hide building dock" title="Toggle building dock">${icon('caret-down')}</button></div><div id="building-list" class="building-list"></div></section>
      <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
    </main>
  </div><dialog aria-label="Game guide and settings"></dialog><input type="file" id="import-file" accept=".json,application/json" hidden />`;
}
