// w40k-import.js — Warhammer 40,000 app army list importer

import {
  appData, createCollection, createList, createModel,
  addModelToList, getModelType, GAME_SYSTEMS
} from './data.js';
import { showModal, closeModal, toast } from './ui.js';

function detectModelType(name, section) {
  const n = name.toLowerCase();
  const s = (section || '').toLowerCase();

  if (s === 'characters') return 'character';

  if (/swarm|rippers?/.test(n)) return 'swarm';

  if (/dreadnought|sentinel|armiger|knight|titan|killa kan|deff dread|gorkanaut|morkanaut/.test(n)) return 'walker';

  if (/rhino|predator|land raider|repulsor|gladiator|impulsor|vindicator|razorback|chimera|hellhound|leman russ|basilisk|manticore|deathstrike|wave serpent|falcon|hammerhead|devilfish|broadside|ghostkeel|defiler|forgefiend|maulerfiend|skorpius|dunecrawler/.test(n)) return 'vehicle';

  if (/tyrannofex|screamer.killer|hive tyrant|carnifex|tervigon|trygon|mawloc|haruspex|exocrine|maleceptor|toxicrene|psychophage|norn emissary|daemon prince|great unclean|bloodthirster|lord of change|keeper of secrets|neurotyrant/.test(n)) return 'monster';

  return 'infantry';
}

// Sum model counts from first-level bullet lines (2 leading spaces + bullet + Nx).
// Deeper-indented lines (equipment, weapons) are ignored.
function calculateQuantity(lines) {
  let total = 0;
  for (const line of lines) {
    const m = line.match(/^ {2}[•·]\s+(\d+)x\s+/);
    if (m) total += parseInt(m[1], 10);
  }
  return total > 0 ? total : 1;
}

// Parse Warhammer 40,000 app exported text.
// Returns { armyName, gameSystemId, units: [{ name, quantity, section, modelTypeId }] }
export function parseW40kList(text) {
  const lines = text.split('\n');

  let armyName = null;
  let inUnitSection = false;
  let currentSection = null;
  let currentUnit = null;
  const collectedUnits = [];

  const finalizeUnit = () => {
    if (!currentUnit) return;
    collectedUnits.push({
      name: currentUnit.name,
      quantity: calculateQuantity(currentUnit.lines),
      section: currentUnit.section,
      modelTypeId: detectModelType(currentUnit.name, currentUnit.section),
    });
    currentUnit = null;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    if (trimmed.startsWith('Exported with App Version:')) break;

    // First non-empty line is the army name
    if (!armyName) {
      const m = trimmed.match(/^(.+?)\s*\(\d+\s*points?\)$/i);
      armyName = m ? m[1].trim() : trimmed;
      continue;
    }

    // Section headers are all-uppercase words (e.g. CHARACTERS, BATTLELINE, OTHER DATASHEETS)
    if (/^[A-Z][A-Z\s\-/]+$/.test(trimmed)) {
      finalizeUnit();
      currentSection = trimmed;
      inUnitSection = true;
      continue;
    }

    if (!inUnitSection) continue;

    // Unit entry: no leading whitespace + "Name (N points)"
    if (!rawLine.startsWith(' ') && !rawLine.startsWith('\t')) {
      const unitMatch = trimmed.match(/^(.+?)\s*\(\d+\s*points?\)\s*$/i);
      if (unitMatch) {
        finalizeUnit();
        currentUnit = { name: unitMatch[1].trim(), section: currentSection, lines: [] };
        continue;
      }
    }

    // Indented detail lines belong to the current unit
    if (currentUnit && (rawLine.startsWith(' ') || rawLine.startsWith('\t'))) {
      currentUnit.lines.push(rawLine);
    }
  }

  finalizeUnit();

  return { armyName: armyName || 'Imported Army', gameSystemId: 'wh40k', units: collectedUnits };
}

function doImport(text) {
  const { armyName, gameSystemId, units } = parseW40kList(text);

  if (!units.length) return null;

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
  character: 'Character',
  infantry: 'Infantry',
  monster: 'Monster',
  vehicle: 'Vehicle',
  walker: 'Walker',
  swarm: 'Swarm',
  cavalry: 'Cavalry',
};

// Show the import modal. onSuccess(collectionId, listId) is called after a successful import.
export function showW40kImportModal(onSuccess) {
  const content = document.createElement('div');
  content.innerHTML = `
    <p style="font-size:0.85em;color:var(--text-muted);margin-bottom:0.75em">
      Paste your army list from the Warhammer 40,000 app. Units are imported into a new army list; characters, monsters, and vehicles are detected automatically.
    </p>
    <textarea id="w40kPasteArea" class="form-input" rows="14" placeholder="Niddos (1500 points)

Tyranids
Strike Force (2000 points)
Invasion Fleet

CHARACTERS

Neurotyrant (125 points)
  • Warlord
  • 1x Neurotyrant claws and lashes

BATTLELINE

Hormagaunts (65 points)
  • 10x Hormagaunt
    • 10x Hormagaunt talons

Exported with App Version: v1.53.0 (119), Data Version: v780"></textarea>
    <div id="w40kPreview" style="margin-top:0.75em;display:none">
      <div id="w40kPreviewContent"></div>
    </div>
    <div class="modal-actions" style="margin-top:1em">
      <button class="btn btn-primary" id="w40kImportBtn">Import List</button>
      <button class="btn" id="w40kCancelBtn">Cancel</button>
    </div>
  `;

  const textarea = content.querySelector('#w40kPasteArea');
  const preview = content.querySelector('#w40kPreview');
  const previewContent = content.querySelector('#w40kPreviewContent');

  const updatePreview = () => {
    const text = textarea.value.trim();
    if (!text) { preview.style.display = 'none'; return; }
    try {
      const { armyName, gameSystemId, units } = parseW40kList(text);
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

  content.querySelector('#w40kImportBtn').addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) { toast('Please paste an army list first', 'error'); return; }
    const result = doImport(text);
    if (!result) { toast('No units found — check the list format', 'error'); return; }
    closeModal();
    toast(`Imported "${result.armyName}" — ${result.unitCount} unit${result.unitCount !== 1 ? 's' : ''}`, 'success');
    onSuccess(result.collectionId, result.listId);
  });

  content.querySelector('#w40kCancelBtn').addEventListener('click', () => closeModal());

  showModal({ title: 'Import from Warhammer 40,000 App', content, wide: true });
}
