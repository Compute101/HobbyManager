// theme.js — theme (global) and terminology (contextual) are now separate

import { GAME_SYSTEMS, appData, saveData } from './data.js';

const THEMES = ['theme-default', 'theme-old-world', 'theme-40k', 'theme-heresy', 'theme-aos'];
const NEUTRAL_TERMS = { army: 'Army', group: 'Unit', model: 'Model', session: 'Session' };

let currentSystemId = null; // for terminology only

// --- THEME (global, persisted) ---

export function applyTheme(themeId) {
  const id = THEMES.includes(themeId) ? themeId : 'theme-default';
  document.body.classList.remove(...THEMES);
  document.body.classList.add(id);
  appData.config.activeTheme = id;
  saveData();
}

export function loadSavedTheme() {
  const saved = appData.config.activeTheme || 'theme-default';
  document.body.classList.remove(...THEMES);
  document.body.classList.add(saved);
}

// --- TERMINOLOGY (contextual, follows current game system) ---

export function setCurrentSystem(gameSystemId) {
  currentSystemId = gameSystemId || null;
}

export function resetCurrentSystem() {
  currentSystemId = null;
}

export function getTerm(key) {
  const system = GAME_SYSTEMS[currentSystemId];
  return system ? (system.terms[key] || NEUTRAL_TERMS[key]) : NEUTRAL_TERMS[key];
}

export function getCurrentSystem() {
  return GAME_SYSTEMS[currentSystemId] || null;
}

// Legacy — kept so any remaining callers don't break
export function resetTheme() {}
