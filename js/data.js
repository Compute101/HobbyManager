// data.js — core data model, storage, defaults

export const GAME_SYSTEMS = {
  old_world: {
    id: 'old_world',
    label: 'Warhammer: The Old World',
    shortLabel: 'Old World',
    terms: { army: 'Army', group: 'Regiment', model: 'Warrior', session: 'Campaign' },
    theme: 'theme-old-world'
  },
  wh40k: {
    id: 'wh40k',
    label: 'Warhammer 40,000',
    shortLabel: '40K',
    terms: { army: 'Force', group: 'Squad', model: 'Operative', session: 'Mission' },
    theme: 'theme-40k'
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    shortLabel: 'Custom',
    terms: { army: 'Army', group: 'Unit', model: 'Model', session: 'Session' },
    theme: 'theme-default'
  }
};

export const DEFAULT_STAGES = [
  { id: 's1', name: 'Assembly',  points: 2, phase: 'assembly', skippable: false, threshold: 'table_ready' },
  { id: 's2', name: 'Prime',     points: 1, phase: 'painting', skippable: false, threshold: null },
  { id: 's3', name: 'Basecoat',  points: 2, phase: 'painting', skippable: false, threshold: null },
  { id: 's4', name: 'Shade',     points: 1, phase: 'painting', skippable: false, threshold: null },
  { id: 's5', name: 'Layer',     points: 1, phase: 'painting', skippable: true,  threshold: null },
  { id: 's6', name: 'Highlight', points: 2, phase: 'painting', skippable: true,  threshold: 'painted' },
  { id: 's7', name: 'Basing',    points: 1, phase: 'basing',   skippable: true,  threshold: 'finished' },
];

// Built-in model type presets
export const BUILTIN_MODEL_TYPES = [
  {
    id: 'infantry',
    name: 'Infantry',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 2, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 1, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 1, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 1, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 2, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 1, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'cavalry',
    name: 'Cavalry',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 3, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 4, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 4, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 2, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'monster',
    name: 'Monster / Large',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 4, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 4, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 4, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 3, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'behemoth',
    name: 'Behemoth',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 6, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 6, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 4, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 3, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 6, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 4, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'character',
    name: 'Character / Hero',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',     points: 2, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',        points: 1, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',     points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',        points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',        points: 3, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight',    points: 4, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Face Detail',  points: 3, phase: 'painting', skippable: true,  threshold: null },
      { id: 's8', name: 'Freehand',     points: 4, phase: 'painting', skippable: true,  threshold: null },
      { id: 's9', name: 'OSL',          points: 4, phase: 'painting', skippable: true,  threshold: null },
      { id: 's10', name: 'Basing',      points: 2, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'warmachine',
    name: 'War Machine',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 4, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 1, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 1, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 1, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 2, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 2, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'vehicle',
    name: 'Vehicle (40K)',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 5, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 4, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 1, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 3, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 2, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
];

// Get all model types (built-in + custom)
export function getAllModelTypes() {
  const custom = appData.config.modelTypes || [];
  return [...BUILTIN_MODEL_TYPES, ...custom];
}

export function getModelType(id) {
  return getAllModelTypes().find(t => t.id === id) || null;
}

export function saveCustomModelType(typeObj) {
  if (!appData.config.modelTypes) appData.config.modelTypes = [];
  const idx = appData.config.modelTypes.findIndex(t => t.id === typeObj.id);
  if (idx >= 0) {
    appData.config.modelTypes[idx] = typeObj;
  } else {
    appData.config.modelTypes.push(typeObj);
  }
  saveData();
}

export function deleteCustomModelType(id) {
  if (!appData.config.modelTypes) return;
  appData.config.modelTypes = appData.config.modelTypes.filter(t => t.id !== id);
  saveData();
}

// Thresholds: what milestone each model can reach
export const THRESHOLDS = {
  table_ready: { id: 'table_ready', label: 'Table Ready', icon: '⚔️', color: '#8b7355' },
  painted:     { id: 'painted',     label: 'Painted',     icon: '🎨', color: '#4a9d6f' },
  finished:    { id: 'finished',    label: 'Finished',    icon: '🏆', color: '#c5a028' },
};

export let appData = {
  // Global model pool: id -> model
  models: {},
  // Collections / game systems: id -> collection
  collections: {},
  // Army lists: id -> list
  lists: {},
  // Painting sessions: id -> session
  sessions: [],
  // Global config
  config: {
    stages: [...DEFAULT_STAGES],
    deadline: null,
    activeTheme: 'theme-default',
    modelTypes: []
  }
};

export function loadData() {
  try {
    const raw = localStorage.getItem('hobbymanager_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge to ensure new fields exist
      appData = {
        models: parsed.models || {},
        collections: parsed.collections || {},
        lists: parsed.lists || {},
        sessions: parsed.sessions || [],
        config: {
          stages: parsed.config?.stages || [...DEFAULT_STAGES],
          deadline: parsed.config?.deadline || null,
          activeTheme: parsed.config?.activeTheme || 'theme-default',
          modelTypes: parsed.config?.modelTypes || []
        }
      };
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}

export function saveData() {
  try {
    localStorage.setItem('hobbymanager_v2', JSON.stringify(appData));
  } catch (e) {
    console.error('Failed to save data:', e);
    alert('Could not save data — storage may be full.');
  }
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// --- Model helpers ---

export function getModel(id) { return appData.models[id]; }

export function getAllModels() { return Object.values(appData.models); }

export function createModel({ name, quantity = 1, notes = '', gameSystemId = null, stages = null, skippedStages = [] }) {
  const id = uid();
  const modelStages = stages || appData.config.stages.map(s => ({ ...s }));
  appData.models[id] = {
    id, name, quantity, notes, gameSystemId,
    stages: modelStages,
    skippedStages, // array of stage ids that are skipped for this regiment
    progress: {}, // stageId -> { done: number, lastDate: string }
    sessions: []  // session ids
  };
  saveData();
  return id;
}

export function updateModel(id, fields) {
  if (!appData.models[id]) return;
  Object.assign(appData.models[id], fields);
  saveData();
}

export function deleteModel(id) {
  // Remove from all lists
  Object.values(appData.lists).forEach(list => {
    list.modelIds = list.modelIds.filter(mid => mid !== id);
  });
  delete appData.models[id];
  saveData();
}

export function logProgress(modelId, stageId, done, date) {
  const model = appData.models[modelId];
  if (!model) return;
  if (!model.progress[stageId]) model.progress[stageId] = { done: 0, lastDate: null };
  model.progress[stageId].done = Math.max(0, Math.min(done, model.quantity));
  model.progress[stageId].lastDate = date;
  saveData();
}

// --- Stats helpers ---

export function modelThreshold(model) {
  // Returns highest threshold reached: 'finished' | 'painted' | 'table_ready' | null
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];
  const activeStages = stages.filter(s => !skipped.includes(s.id));

  // Fallback for custom types with no threshold markers defined:
  // if all non-skipped stages are fully done => treat as Finished
  const hasThresholds = stages.some(s => s.threshold);
  if (!hasThresholds) {
    const allDone = activeStages.length > 0 &&
      activeStages.every(s => (model.progress[s.id]?.done || 0) >= model.quantity);
    return allDone ? 'finished' : null;
  }

  // Standard logic: check highest threshold first
  for (const thresh of ['finished', 'painted', 'table_ready']) {
    const threshStageIdx = stages.findIndex(s => s.threshold === thresh);
    if (threshStageIdx === -1) continue;
    const allDone = stages.slice(0, threshStageIdx + 1).every(s => {
      if (skipped.includes(s.id)) return true;
      return (model.progress[s.id]?.done || 0) >= model.quantity;
    });
    if (allDone) return thresh;
  }
  return null;
}

export function modelPoints(model) {
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];
  let total = 0, done = 0;
  stages.forEach(s => {
    if (skipped.includes(s.id)) return;
    const pts = (s.points || 1) * model.quantity;
    const prog = model.progress[s.id] || { done: 0 };
    total += pts;
    done += Math.min(prog.done, model.quantity) * (s.points || 1);
  });
  return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
}

export function listStats(list) {
  const models = (list.modelIds || []).map(id => appData.models[id]).filter(Boolean);
  let totalPts = 0, donePts = 0;
  let tableReady = 0, painted = 0, finished = 0, total = 0;

  models.forEach(m => {
    const pts = modelPoints(m);
    totalPts += pts.total;
    donePts += pts.done;
    total += m.quantity;
    const thresh = modelThreshold(m);
    if (thresh === 'table_ready' || thresh === 'painted' || thresh === 'finished') tableReady += m.quantity;
    if (thresh === 'painted' || thresh === 'finished') painted += m.quantity;
    if (thresh === 'finished') finished += m.quantity;
  });

  return {
    total, tableReady, painted, finished,
    totalPts, donePts,
    pct: totalPts ? Math.round(donePts / totalPts * 100) : 0
  };
}

export function globalStats() {
  const models = getAllModels();
  let totalPts = 0, donePts = 0;
  let tableReady = 0, painted = 0, finished = 0, total = 0;

  models.forEach(m => {
    const pts = modelPoints(m);
    totalPts += pts.total;
    donePts += pts.done;
    total += m.quantity;
    const thresh = modelThreshold(m);
    if (thresh === 'table_ready' || thresh === 'painted' || thresh === 'finished') tableReady += m.quantity;
    if (thresh === 'painted' || thresh === 'finished') painted += m.quantity;
    if (thresh === 'finished') finished += m.quantity;
  });

  return { total, tableReady, painted, finished, totalPts, donePts, pct: totalPts ? Math.round(donePts / totalPts * 100) : 0 };
}

// --- Collection helpers ---

export function createCollection({ name, gameSystemId, deadline = null }) {
  const id = uid();
  appData.collections[id] = { id, name, gameSystemId, deadline, listIds: [] };
  saveData();
  return id;
}

export function deleteCollection(id) {
  const col = appData.collections[id];
  if (col) {
    col.listIds.forEach(lid => delete appData.lists[lid]);
  }
  delete appData.collections[id];
  saveData();
}

// --- List helpers ---

export function createList({ name, collectionId }) {
  const id = uid();
  appData.lists[id] = { id, name, collectionId, modelIds: [] };
  const col = appData.collections[collectionId];
  if (col) col.listIds.push(id);
  saveData();
  return id;
}

export function deleteList(id) {
  const list = appData.lists[id];
  if (list) {
    const col = appData.collections[list.collectionId];
    if (col) col.listIds = col.listIds.filter(lid => lid !== id);
  }
  delete appData.lists[id];
  saveData();
}

export function addModelToList(listId, modelId) {
  const list = appData.lists[listId];
  if (list && !list.modelIds.includes(modelId)) {
    list.modelIds.push(modelId);
    saveData();
  }
}

export function removeModelFromList(listId, modelId) {
  const list = appData.lists[listId];
  if (list) {
    list.modelIds = list.modelIds.filter(id => id !== modelId);
    saveData();
  }
}

// --- Session helpers ---

export function logSession({ date, duration, notes, modelEntries }) {
  // modelEntries: [{modelId, stageId, qty}]
  const id = uid();
  const session = { id, date, duration, notes, modelEntries };
  appData.sessions.push(session);
  // Apply progress
  modelEntries.forEach(({ modelId, stageId, qty }) => {
    logProgress(modelId, stageId, qty, date);
  });
  saveData();
  return id;
}

// --- Export / Import ---

export function exportJSON() {
  const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hobbymanager_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.models || !parsed.collections) throw new Error('Invalid file structure');
        if (!confirm('This will replace all current data. Continue?')) return;
        appData = parsed;
        saveData();
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
