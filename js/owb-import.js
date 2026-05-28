// owb-import.js — Old World Builder army list text parser

import { GAME_SYSTEMS } from './data.js';

const GAME_SYSTEM_PATTERNS = [
  { pattern: /warhammer.*old world/i,  id: 'old_world' },
  { pattern: /age of sigmar/i,          id: 'age_of_sigmar' },
  { pattern: /horus heresy/i,           id: 'horus_heresy' },
  { pattern: /warhammer 40/i,           id: 'wh40k' },
];

function detectGameSystem(line) {
  for (const { pattern, id } of GAME_SYSTEM_PATTERNS) {
    if (pattern.test(line)) return id;
  }
  return 'old_world';
}

function detectModelType(name, section) {
  const n = name.toLowerCase();
  const s = (section || '').toLowerCase();

  if (s.includes('character') || s.includes('lord') || s.includes('hero')) return 'character';

  if (/chariot/.test(n)) return 'chariot';
  if (/war machine|cannon|bolt thrower|mortar|catapult|rocket|stone thrower|organ gun|gyrocopter|gyrobomber|flame cannon/.test(n)) return 'warmachine';
  if (/cavalry|knights?|horsemen|riders?|lancers?/.test(n)) return 'cavalry';
  if (/dragon|hydra|manticore|giant|wyvern|griffon|sphinx|hippogryph|cockatrice|abomination|bone giant|rat ogre|ogre|troll|minotaur/.test(n)) return 'monster';
  if (/swarm/.test(n)) return 'swarm';

  return 'infantry';
}

// Parse Old World Builder exported text.
// Returns { armyName, gameSystemId, units: [{ name, quantity, section, modelTypeId }] }
export function parseOwbList(text) {
  const lines = text.split('\n').map(l => l.trim());

  let armyName = null;
  let gameSystemId = 'old_world';
  let inHeader = false;
  let pastFooter = false;
  let currentSection = null;
  const units = [];

  for (const line of lines) {
    if (!line) continue;
    if (pastFooter) continue;

    // Footer start
    if (line === '---') { pastFooter = true; continue; }

    // Header delimiter
    if (line === '===') {
      inHeader = !inHeader;
      continue;
    }

    // Inside header block
    if (inHeader) {
      const nameMatch = line.match(/^(.+?)\s*\[\d+\s*pts?\]$/);
      if (nameMatch && !armyName) {
        armyName = nameMatch[1].trim();
        continue;
      }
      if (/warhammer|age of sigmar|horus heresy/i.test(line)) {
        gameSystemId = detectGameSystem(line);
      }
      continue;
    }

    // Section header: "++ Section Name [pts] ++"
    const sectionMatch = line.match(/^\+\+\s*(.+?)\s*(?:\[\d+\s*pts?\])?\s*\+\+$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    // Sub-unit option line: "- Nx Name [equipment]"
    // Must have a non-empty [...] block to distinguish from upgrade lines like "- 2x Rune of Shielding"
    const subUnitMatch = line.match(/^-\s+(\d+)x\s+(.+?)\s+\[.+\]$/);
    if (subUnitMatch) {
      const qty = parseInt(subUnitMatch[1], 10);
      const name = subUnitMatch[2].trim();
      units.push({ name, quantity: qty, section: currentSection, modelTypeId: detectModelType(name, currentSection) });
      continue;
    }

    // All other option/upgrade lines (including "- 2x Rune of X", "- Shield", etc.) — skip
    if (line.startsWith('-')) continue;

    // Unit with explicit quantity: "N Name [pts]"
    // Strip trailing OWB constraint annotations like "(0-3 warmachines per 1000 points)"
    const unitQtyMatch = line.match(/^(\d+)\s+(.+?)\s+\[\d+\s*pts?\]$/);
    if (unitQtyMatch) {
      const qty = parseInt(unitQtyMatch[1], 10);
      const name = unitQtyMatch[2].replace(/\s*\(0-\d+[^)]*\)\s*$/, '').trim();
      units.push({ name, quantity: qty, section: currentSection, modelTypeId: detectModelType(name, currentSection) });
      continue;
    }

    // Single model (character): "Name [pts]" — no leading digit
    const charMatch = line.match(/^([A-Za-z].+?)\s+\[\d+\s*pts?\]$/);
    if (charMatch) {
      const name = charMatch[1].trim();
      units.push({ name, quantity: 1, section: currentSection, modelTypeId: detectModelType(name, currentSection) });
    }
  }

  return { armyName: armyName || 'Imported Army', gameSystemId, units };
}
