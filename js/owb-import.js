// owb-import.js — Old World Builder army list text importer

import {
  appData, createCollection, createList, createModel,
  addModelToList, getModelType, GAME_SYSTEMS
} from './data.js';
import { showModal, closeModal, toast } from './ui.js';

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
  if (/war machine|cannon|bolt thrower|mortar|catapult|rocket|stone thrower|organ gun/.test(n)) return 'warmachine';
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

    // Sub-unit option line: "- Nx Name [...]"
    const subUnitMatch = line.match(/^-\s+(\d+)x\s+(.+?)(?:\s*\[.*\])?$/);
    if (subUnitMatch) {
      const qty = parseInt(subUnitMatch[1], 10);
      const name = subUnitMatch[2].trim();
      units.push({ name, quantity: qty, section: currentSection, modelTypeId: detectModelType(name, currentSection) });
      continue;
    }

    // Other option/upgrade lines — skip
    if (line.startsWith('-')) continue;

    // Unit with explicit quantity: "N Name [pts]"
    const unitQtyMatch = line.match(/^(\d+)\s+(.+?)\s+\[\d+\s*pts?\]$/);
    if (unitQtyMatch) {
      const qty = parseInt(unitQtyMatch[1], 10);
      const name = unitQtyMatch[2].trim();
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

function doImport(text) {
  const { armyName, gameSystemId, units } = parseOwbList(text);

  if (!units.length) return null;

  // Find an existing collection for this game system, or create one
  let collectionId = Object.values(appData.collections).find(c => c.gameSystemId === gameSystemId)?.id;
  if (!collectionId) {
    const sys = GAME_SYSTEMS[gameSystemId];
    collectionId = createCollection({ name: sys?.label || 'Imported', gameSystemId });
  }

  const listId = createList({ name: armyName, collectionId });

  for (const unit of units) {
    const typeObj = getModelType(unit.modelTypeId);
    const stages = typeObj ? typeObj.stages.map(s => ({ ...s })) : null;
    const modelId = createModel({
      name: unit.name,
      quantity: unit.quantity,
      gameSystemId,
      modelTypeId: unit.modelTypeId,
      stages,
    });
    addModelToList(listId, modelId);
  }

  return { collectionId, listId, unitCount: units.length, armyName };
}

const TYPE_LABELS = {
  infantry: 'Infantry',
  cavalry: 'Cavalry',
  monster: 'Monster',
  character: 'Character',
  warmachine: 'War Machine',
  chariot: 'Chariot',
  swarm: 'Swarm',
};

// Show the import modal. onSuccess(collectionId, listId) is called after a successful import.
export function showOwbImportModal(onSuccess) {
  const content = document.createElement('div');
  content.innerHTML = `
    <p style="font-size:0.85em;color:var(--text-muted);margin-bottom:0.75em">
      Paste your army list from the Old World Builder app or website. Units are imported into a new army list; characters, cavalry, and war machines are detected automatically.
    </p>
    <textarea id="owbPasteArea" class="form-input" rows="14" placeholder="===
Clan Eshin [748 pts]
Warhammer: The Old World, Skaven...
===

++ Characters [166 pts] ++

Skaven Chieftain [51 pts]
..."></textarea>
    <div id="owbPreview" style="margin-top:0.75em;display:none">
      <div id="owbPreviewContent"></div>
    </div>
    <div class="modal-actions" style="margin-top:1em">
      <button class="btn btn-primary" id="owbImportBtn">Import List</button>
      <button class="btn" id="owbCancelBtn">Cancel</button>
    </div>
  `;

  const textarea = content.querySelector('#owbPasteArea');
  const preview = content.querySelector('#owbPreview');
  const previewContent = content.querySelector('#owbPreviewContent');

  const updatePreview = () => {
    const text = textarea.value.trim();
    if (!text) { preview.style.display = 'none'; return; }
    try {
      const { armyName, gameSystemId, units } = parseOwbList(text);
      if (!units.length) { preview.style.display = 'none'; return; }
      const sys = GAME_SYSTEMS[gameSystemId];
      previewContent.innerHTML = `
        <div style="font-size:0.82em;color:var(--text-muted);margin-bottom:0.4em">
          Preview — <strong style="color:var(--text)">${armyName}</strong>
          &nbsp;<span class="sys-tag ${sys?.theme || ''}">${sys?.shortLabel || gameSystemId}</span>
          &nbsp;· ${units.length} unit${units.length !== 1 ? 's' : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:0.2em;max-height:180px;overflow-y:auto">
          ${units.map(u => `
            <div style="display:flex;gap:0.5em;font-size:0.82em;align-items:center">
              <span style="min-width:2em;text-align:right;color:var(--text-muted)">×${u.quantity}</span>
              <span>${u.name}</span>
              <span style="margin-left:auto;color:var(--text-muted);font-size:0.9em">${TYPE_LABELS[u.modelTypeId] || u.modelTypeId}</span>
            </div>
          `).join('')}
        </div>
      `;
      preview.style.display = '';
    } catch {
      preview.style.display = 'none';
    }
  };

  textarea.addEventListener('input', updatePreview);

  content.querySelector('#owbImportBtn').addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) { toast('Please paste an army list first', 'error'); return; }
    const result = doImport(text);
    if (!result) { toast('No units found — check the list format', 'error'); return; }
    closeModal();
    toast(`Imported "${result.armyName}" — ${result.unitCount} unit${result.unitCount !== 1 ? 's' : ''}`, 'success');
    onSuccess(result.collectionId, result.listId);
  });

  content.querySelector('#owbCancelBtn').addEventListener('click', () => closeModal());

  showModal({ title: 'Import from Old World Builder', content, wide: true });
}
