// theme.js — theme and terminology switching

import { GAME_SYSTEMS } from './data.js';

let currentTheme = 'theme-default';
let currentSystemId = null;

export function applyTheme(gameSystemId) {
  const system = GAME_SYSTEMS[gameSystemId] || null;
  const themeId = system ? system.theme : 'theme-default';

  document.body.classList.remove('theme-old-world', 'theme-40k', 'theme-default');
  document.body.classList.add(themeId);
  currentTheme = themeId;
  currentSystemId = gameSystemId;

  // Update system badge in header
  const badge = document.getElementById('systemBadge');
  if (badge) {
    badge.textContent = system ? system.shortLabel : '';
    badge.className = 'system-badge ' + (system ? system.theme : '');
  }
}

export function resetTheme() {
  applyTheme(null);
}

export function getTerm(key) {
  const system = GAME_SYSTEMS[currentSystemId];
  return system ? system.terms[key] : { army: 'Army', group: 'Unit', model: 'Model', session: 'Session' }[key];
}

export function getCurrentSystem() {
  return GAME_SYSTEMS[currentSystemId] || null;
}
