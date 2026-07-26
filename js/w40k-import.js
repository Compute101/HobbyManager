// w40k-import.js — Warhammer 40,000 app army list parser

function detectModelType(name, section) {
  const n = name.toLowerCase();
  const s = (section || '').toLowerCase();

  if (s === 'characters') return 'character';

  if (/swarm|rippers?/.test(n)) return 'swarm';

  if (/baneblade|banehammer|banesword|doomhammer|hellhammer|shadowsword|stormlord|stormsword|fellblade|typhon|falchion|mastodon|gorgon|thunderhawk|stormsurge|ta'?unar|stompa|gargant|great gargant|mega.?dread|lord of skulls|brass scorpion|warhound|reaver titan|warlord titan/.test(n)) return 'super_heavy_vehicle';

  if (/dreadnought|sentinel|armiger|knight|titan|killa kan|deff dread|gorkanaut|morkanaut/.test(n)) return 'walker';

  if (/rhino|predator|land raider|repulsor|gladiator|impulsor|vindicator|razorback|chimera|hellhound|leman russ|basilisk|manticore|deathstrike|wave serpent|falcon|hammerhead|devilfish|broadside|ghostkeel|defiler|forgefiend|maulerfiend|skorpius|dunecrawler/.test(n)) return 'vehicle';

  // Anti-grav skimmers (checked after the tracked-vehicle list above so
  // "Land Raider" still matches that list's own "land raider" entry first).
  if (/\braider\b|\bravager\b|venom|razorwing|voidraven|tantalus/.test(n)) return 'skimmer';

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

