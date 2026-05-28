// import.js — Unified army list importer (OWB + Warhammer 40,000)

import { parseOwbList } from './owb-import.js';
import { parseW40kList } from './w40k-import.js';
import {
  appData, createCollection, createList, createModel,
  addModelToList, getModelType, GAME_SYSTEMS,
  getAllFolders, createFolder
} from './data.js';
import { showModal, closeModal, toast } from './ui.js';

const FORMATS = {
  owb: {
    label: 'Old World Builder',
    description: 'Paste your army list exported from the Old World Builder app or website.',
    placeholder: `===\nClan Eshin [748 pts]\nWarhammer: The Old World, Skaven...\n===\n\n++ Characters [166 pts] ++\n\nSkaven Chieftain [51 pts]\n...`,
    parse: parseOwbList,
  },
  w40k: {
    label: 'Warhammer 40,000',
    description: 'Paste your army list exported from the Warhammer 40,000 app.',
    placeholder: `Niddos (1500 points)\n\nTyranids\nStrike Force (2000 points)\nInvasion Fleet\n\nCHARACTERS\n\nNeurotyrant (125 points)\n  • 1x Neurotyrant claws and lashes\n\nBATTLELINE\n\nHormagaunts (65 points)\n  • 10x Hormagaunt`,
    parse: parseW40kList,
  },
};

const TYPE_LABELS = {
  infantry: 'Infantry',
  cavalry: 'Cavalry',
  monster: 'Monster',
  character: 'Character',
  warmachine: 'War Machine',
  chariot: 'Chariot',
  swarm: 'Swarm',
  vehicle: 'Vehicle',
  walker: 'Walker',
};

function autoDetectFormat(text) {
  if (/created with [""]old world builder[""]/i.test(text) || /old-world-builder\.com/i.test(text)) return 'owb';
  if (/exported with app version:/i.test(text)) return 'w40k';
  if (/^===/.test(text.trim()) || /\[\d+\s*pts?\]/.test(text)) return 'owb';
  if (/\(\d+\s*points?\)/i.test(text)) return 'w40k';
  return null;
}

function doImport(text, format, folderId = null) {
  const { parse } = FORMATS[format];
  const { armyName, gameSystemId, units } = parse(text);

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
      folderId,
    });
    addModelToList(listId, modelId);
  }

  return { collectionId, listId, unitCount: units.length, armyName };
}

export function showImportModal(onSuccess) {
  let currentFormat = 'owb';
  const folders = getAllFolders();

  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display:flex;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:0.9em">
      <button class="import-fmt-btn" data-fmt="owb" style="flex:1;padding:0.45em 0.5em;font-size:0.82em;font-weight:600;border:none;cursor:pointer;transition:background 0.15s,color 0.15s">Old World Builder</button>
      <button class="import-fmt-btn" data-fmt="w40k" style="flex:1;padding:0.45em 0.5em;font-size:0.82em;font-weight:600;border:none;cursor:pointer;transition:background 0.15s,color 0.15s;border-left:1px solid var(--border)">Warhammer 40,000</button>
    </div>
    <p id="importDesc" style="font-size:0.85em;color:var(--text-muted);margin-bottom:0.75em"></p>
    <div class="form-group" style="margin-bottom:0.75em">
      <label style="font-size:0.85em;font-weight:600">Import into folder</label>
      <select id="importFolderSelect" class="form-input">
        <option value="">— Unfiled —</option>
        ${folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
        <option value="__new__">+ New folder...</option>
      </select>
    </div>
    <textarea id="importPasteArea" class="form-input" rows="10" style="font-family:monospace;font-size:0.8em"></textarea>
    <div id="importPreview" style="margin-top:0.75em;display:none">
      <div id="importPreviewContent"></div>
    </div>
    <div class="modal-actions" style="margin-top:1em">
      <button class="btn btn-primary" id="importDoBtn">Import List</button>
      <button class="btn" id="importCancelBtn">Cancel</button>
    </div>
  `;

  const textarea = content.querySelector('#importPasteArea');
  const preview = content.querySelector('#importPreview');
  const previewContent = content.querySelector('#importPreviewContent');
  const desc = content.querySelector('#importDesc');

  function applyFormat(fmt) {
    currentFormat = fmt;
    const fmtData = FORMATS[fmt];
    desc.textContent = fmtData.description;
    textarea.placeholder = fmtData.placeholder;
    content.querySelectorAll('.import-fmt-btn').forEach(btn => {
      const active = btn.dataset.fmt === fmt;
      btn.style.background = active ? 'var(--primary)' : 'transparent';
      btn.style.color = active ? '#fff' : 'var(--text)';
    });
    updatePreview();
  }

  function updatePreview() {
    const text = textarea.value.trim();
    if (!text) { preview.style.display = 'none'; return; }
    try {
      const { parse } = FORMATS[currentFormat];
      const { armyName, gameSystemId, units } = parse(text);
      if (!units.length) { preview.style.display = 'none'; return; }
      const sys = GAME_SYSTEMS[gameSystemId];
      previewContent.innerHTML = `
        <div style="font-size:0.82em;color:var(--text-muted);margin-bottom:0.4em">
          Preview — <strong style="color:var(--text)">${armyName}</strong>
          &nbsp;<span class="sys-tag ${sys?.theme || ''}">${sys?.shortLabel || gameSystemId}</span>
          &nbsp;· ${units.length} unit${units.length !== 1 ? 's' : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:0.2em;max-height:160px;overflow-y:auto">
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
  }

  content.querySelectorAll('.import-fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => applyFormat(btn.dataset.fmt));
  });

  textarea.addEventListener('input', () => {
    const detected = autoDetectFormat(textarea.value);
    if (detected && detected !== currentFormat) applyFormat(detected);
    else updatePreview();
  });

  content.querySelector('#importFolderSelect').addEventListener('change', e => {
    if (e.target.value === '__new__') {
      const name = prompt('New folder name:');
      if (name?.trim()) {
        const fid = createFolder(name.trim());
        const opt = document.createElement('option');
        opt.value = fid;
        opt.textContent = name.trim();
        opt.selected = true;
        e.target.insertBefore(opt, e.target.querySelector('[value="__new__"]'));
        e.target.value = fid;
      } else {
        e.target.value = '';
      }
    }
  });

  content.querySelector('#importDoBtn').addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) { toast('Paste an army list first', 'error'); return; }
    const rawFolder = content.querySelector('#importFolderSelect').value;
    const folderId = rawFolder && rawFolder !== '__new__' ? rawFolder : null;
    const result = doImport(text, currentFormat, folderId);
    if (!result) { toast('No units found — check the list format and selected format type', 'error'); return; }
    closeModal();
    toast(`Imported "${result.armyName}" — ${result.unitCount} unit${result.unitCount !== 1 ? 's' : ''}`, 'success');
    onSuccess(result.collectionId, result.listId);
  });

  content.querySelector('#importCancelBtn').addEventListener('click', () => closeModal());

  showModal({ title: 'Import Army List', content, wide: true });

  // Apply initial format after modal is in DOM
  applyFormat('owb');
}
