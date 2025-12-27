/* global JSZip */

const STORAGE_KEY = "hero_gear_builder_v1";
const DEF_INDEX_KEY = "lanternscore_defindex_v1";

let DEF_INDEX_MEM = null;

function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function qsa(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function escapeXml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isValidDefName(value) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(value);
}

function isValidPackageId(value) {
  return /^[a-z0-9][a-z0-9.]*[a-z0-9]$/.test(value);
}

function isValidDependencyPackageId(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(value || "").trim());
}

function normalizeRgba(text) {
  const trimmed = String(text).trim();
  if (!trimmed) return "";
  if (/^\(\s*[-0-9.]+\s*,\s*[-0-9.]+\s*,\s*[-0-9.]+\s*,\s*[-0-9.]+\s*\)$/.test(trimmed)) return trimmed;
  return trimmed;
}

function toNum(input, fallback) {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

function toMaybeNum(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function xmlList(items, indent) {
  const pad = " ".repeat(indent);
  return items.map((x) => `${pad}<li>${escapeXml(x)}</li>`).join("\n");
}

function xmlListDefs(items, indent) {
  const pad = " ".repeat(indent);
  return items.map((x) => `${pad}<li>${x}</li>`).join("\n");
}

function buildAbilityEditor(abilityKey) {
  const base = abilityBaseInfo(abilityKey);
  const wrap = document.createElement("div");
  wrap.className = "card";
  wrap.dataset.ability = abilityKey;

  wrap.innerHTML = `
    <div class="card__title">
      <strong>${base.label}</strong>
      <span>${base.parent}</span>
    </div>
    <div class="grid">
      <label class="field">
        <span>Ability defName</span>
        <input type="text" data-field="defName" placeholder="${base.defaultDefName}" />
      </label>
      <label class="field">
        <span>Ability label</span>
        <input type="text" data-field="label" placeholder="${base.defaultLabel}" />
      </label>
      <label class="field">
        <span>Icon path (no extension)</span>
        <input type="text" data-field="iconPath" placeholder="${base.defaultIconPath}" />
        <small>Points to \`Textures/&lt;iconPath&gt;.png\`</small>
      </label>
      <label class="field">
        <span>Cost (0..1)</span>
        <input type="number" min="0" max="1" step="0.01" data-field="cost" />
      </label>
      <label class="field">
        <span>Extra cooldown ticks (optional)</span>
        <input type="number" min="0" step="1" data-field="cooldownTicks" />
        <small>0 = no extra cooldown.</small>
      </label>
      <label class="field">
        <span>Max casts per day (optional)</span>
        <input type="number" min="0" step="1" data-field="maxCastsPerDay" />
        <small>0 = unlimited.</small>
      </label>
      <label class="field">
        <span>Targeting rule (optional)</span>
        <select data-field="targetRule">
          <option value="Any">Any</option>
          <option value="HostilesOnly">Hostiles only</option>
          <option value="AlliesOnly">Allies only</option>
          <option value="NonHostilesOnly">Non-hostiles only</option>
          <option value="SelfOnly">Self only</option>
        </select>
        <small data-hint="targetRule"></small>
      </label>
      <label class="field">
        <span>Range override (optional)</span>
        <input type="number" min="0" step="0.1" data-field="range" />
        <small>Blank = use parent ability range.</small>
      </label>
      <label class="field">
        <span>Pause on click</span>
        <select data-field="pauseOnClick">
          <option value="false">False</option>
          <option value="true">True</option>
        </select>
        <small>Pauses the game when you click the ability gizmo.</small>
      </label>
      ${abilityExtraFieldsHtml(abilityKey)}
      <label class="field field--wide">
        <span>Description (optional)</span>
        <textarea rows="2" data-field="description" placeholder=""></textarea>
      </label>
    </div>
  `;

  const targetRuleEl = wrap.querySelector('select[data-field="targetRule"]');
  const targetRuleHint = wrap.querySelector('[data-hint="targetRule"]');
  if (targetRuleEl && targetRuleHint) {
    const apply = () => {
      const v = targetRuleEl.value;
      const map = {
        Any: "No extra restrictions (uses RimWorld targeting rules).",
        HostilesOnly: "Blocks allies/neutrals and only allows hostile targets.",
        AlliesOnly: "Blocks hostiles and only allows your faction.",
        NonHostilesOnly: "Blocks hostiles and allows self/allies/neutrals.",
        SelfOnly: "Only allows casting on the caster.",
      };
      targetRuleHint.textContent = map[v] || "";
    };
    targetRuleEl.addEventListener("change", apply);
    apply();
  }

  return wrap;
}

function abilityExtraFieldsHtml(key) {
  switch (key) {
    case "Blast":
      return `
        <label class="field">
          <span>Cast sound override (SoundDef, optional)</span>
          <input type="text" data-field="soundCastOverride" placeholder="Shot_Pistol" />
          <small>Blank = use the parent ability sound.</small>
        </label>
        <label class="field">
          <span>Mute cast sound</span>
          <select data-field="muteSoundCast">
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
          <small>Lets you turn off the default laser-like sound for blasts.</small>
        </label>
      `;
    case "Heal":
      return `
        <label class="field">
          <span>Heal amount</span>
          <input type="number" min="0" step="0.1" data-field="healAmount" />
        </label>
        <label class="field">
          <span>AOE radius (0 = single)</span>
          <input type="number" min="0" step="0.1" data-field="radius" />
        </label>
      `;
    case "Stun":
      return `
        <label class="field">
          <span>Stun ticks</span>
          <input type="number" min="1" step="1" data-field="stunTicks" />
        </label>
        <label class="field">
          <span>AOE radius (0 = single)</span>
          <input type="number" min="0" step="0.1" data-field="radius" />
        </label>
        <label class="field">
          <span>Affect hostiles only</span>
          <select data-field="affectHostilesOnly">
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </label>
      `;
    case "Barrier":
      return `
        <label class="field">
          <span>Shield max HP</span>
          <input type="number" min="1" step="1" data-field="shieldMaxHp" />
        </label>
        <label class="field">
          <span>AOE radius (0 = single)</span>
          <input type="number" min="0" step="0.1" data-field="radius" />
        </label>
      `;
    case "Aura":
      return `
        <label class="field">
          <span>Severity per cast</span>
          <input type="number" min="0" step="0.01" data-field="severity" />
        </label>
        <label class="field">
          <span>Radius</span>
          <input type="number" min="0" step="0.1" data-field="radius" />
        </label>
        <label class="field">
          <span>Duration ticks</span>
          <input type="number" min="0" step="1" data-field="durationTicks" />
        </label>
      `;
    case "Construct":
      return `
        <label class="field">
          <span>ThingDef to spawn</span>
          <input type="text" data-field="thingDef" placeholder="Sandbags" list="defs_ThingDef" />
        </label>
        <label class="field">
          <span>Duration ticks (0 = permanent)</span>
          <input type="number" min="0" step="1" data-field="durationTicks" />
        </label>
        <label class="field">
          <span>Spawn count</span>
          <input type="number" min="1" step="1" data-field="spawnCount" />
        </label>
      `;
    case "Summon":
      return `
        <label class="field">
          <span>PawnKindDef to summon</span>
          <input type="text" data-field="pawnKind" placeholder="Colonist" list="defs_PawnKindDef" />
        </label>
        <label class="field">
          <span>Count</span>
          <input type="number" min="1" step="1" data-field="count" />
        </label>
        <label class="field">
          <span>Duration ticks (0 = permanent)</span>
          <input type="number" min="0" step="1" data-field="durationTicks" />
        </label>
      `;
    case "Teleport":
      return `
        <label class="field">
          <span>Allow roofed</span>
          <select data-field="allowRoofed">
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </label>
        <label class="field">
          <span>Allow occupied</span>
          <select data-field="allowOccupied">
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        </label>
        <label class="field">
          <span>Spawn gas at origin</span>
          <select data-field="spawnGasAtOrigin">
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        </label>
        <label class="field">
          <span>Spawn gas at destination</span>
          <select data-field="spawnGasAtDestination">
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        </label>
        <label class="field">
          <span>Gas type</span>
          <input type="text" data-field="gasType" placeholder="BlindSmoke" />
        </label>
        <label class="field">
          <span>Gas radius</span>
          <input type="number" min="0" step="0.1" data-field="gasRadius" />
        </label>
        <label class="field">
          <span>Gas amount</span>
          <input type="number" min="0" step="1" data-field="gasAmount" />
        </label>
        <label class="field">
          <span>Gas duration ticks (0 = vanilla)</span>
          <input type="number" min="0" step="1" data-field="gasDurationTicks" />
        </label>
      `;
    case "Conditional":
      return `
        <label class="field">
          <span>Flesh outcome</span>
          <select data-field="fleshOutcome">
            <option value="Down">Down</option>
            <option value="Kill">Kill</option>
            <option value="None">None</option>
          </select>
        </label>
        <label class="field">
          <span>Mech outcome</span>
          <select data-field="mechOutcome">
            <option value="Kill">Kill</option>
            <option value="Down">Down</option>
            <option value="None">None</option>
          </select>
        </label>
        <label class="field">
          <span>Anomaly outcome</span>
          <select data-field="anomalyOutcome">
            <option value="Kill">Kill</option>
            <option value="Down">Down</option>
            <option value="None">None</option>
          </select>
        </label>
        <label class="field">
          <span>Other outcome</span>
          <select data-field="otherOutcome">
            <option value="None">None</option>
            <option value="Down">Down</option>
            <option value="Kill">Kill</option>
          </select>
        </label>
      `;
    case "Displace":
      return `
        <label class="field">
          <span>Distance</span>
          <input type="number" min="0" step="1" data-field="distance" />
        </label>
        <label class="field">
          <span>Pull towards caster</span>
          <select data-field="pullTowardsCaster">
            <option value="false">False (push)</option>
            <option value="true">True (pull)</option>
          </select>
        </label>
        <label class="field">
          <span>Require line of sight</span>
          <select data-field="requireLineOfSight">
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        </label>
      `;
    default:
      return "";
  }
}

function abilityBaseInfo(key) {
  switch (key) {
    case "Blast":
      return {
        label: "Blast",
        parent: "Lantern_Ability_BlastBase",
        defaultDefName: "MyHeroGear_Ability_Blast",
        defaultLabel: "blast",
        defaultIconPath: "MyHeroGear/UI/Blast",
      };
    case "Heal":
      return {
        label: "Heal",
        parent: "Lantern_Ability_HealBase",
        defaultDefName: "MyHeroGear_Ability_Heal",
        defaultLabel: "heal",
        defaultIconPath: "MyHeroGear/UI/Heal",
      };
    case "Stun":
      return {
        label: "Stun/Bind",
        parent: "Lantern_Ability_StunBase",
        defaultDefName: "MyHeroGear_Ability_Bind",
        defaultLabel: "bind",
        defaultIconPath: "MyHeroGear/UI/Bind",
      };
    case "Barrier":
      return {
        label: "Barrier",
        parent: "Lantern_Ability_BarrierBase",
        defaultDefName: "MyHeroGear_Ability_Barrier",
        defaultLabel: "barrier",
        defaultIconPath: "MyHeroGear/UI/Barrier",
      };
    case "Construct":
      return {
        label: "Construct",
        parent: "Lantern_Ability_ConstructBase",
        defaultDefName: "MyHeroGear_Ability_Construct",
        defaultLabel: "construct",
        defaultIconPath: "MyHeroGear/UI/Construct",
      };
    case "Summon":
      return {
        label: "Summon",
        parent: "Lantern_Ability_SummonBase",
        defaultDefName: "MyHeroGear_Ability_Summon",
        defaultLabel: "summon",
        defaultIconPath: "MyHeroGear/UI/Summon",
      };
    case "Aura":
      return {
        label: "Aura",
        parent: "Lantern_Ability_AuraBase",
        defaultDefName: "MyHeroGear_Ability_Aura",
        defaultLabel: "aura",
        defaultIconPath: "MyHeroGear/UI/Aura",
      };
    case "Flight":
      return {
        label: "Flight",
        parent: "Lantern_Ability_FlightBase",
        defaultDefName: "MyHeroGear_Ability_Flight",
        defaultLabel: "flight",
        defaultIconPath: "MyHeroGear/UI/Flight",
      };
    case "Teleport":
      return {
        label: "Teleport",
        parent: "Lantern_Ability_TeleportBase",
        defaultDefName: "MyHeroGear_Ability_Teleport",
        defaultLabel: "teleport",
        defaultIconPath: "MyHeroGear/UI/Teleport",
      };
    case "Displace":
      return {
        label: "Displace",
        parent: "Lantern_Ability_DisplaceBase",
        defaultDefName: "MyHeroGear_Ability_Displace",
        defaultLabel: "displace",
        defaultIconPath: "MyHeroGear/UI/Displace",
      };
    case "Conditional":
      return {
        label: "Conditional down/kill",
        parent: "Lantern_Ability_PawnEffectBase",
        defaultDefName: "MyHeroGear_Ability_Conditional",
        defaultLabel: "conditional",
        defaultIconPath: "MyHeroGear/UI/Conditional",
      };
    default:
      throw new Error(`Unknown ability key: ${key}`);
  }
}

function loadDefIndex() {
  const raw = localStorage.getItem(DEF_INDEX_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    if (!data.byType || typeof data.byType !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

function saveDefIndex(index) {
  localStorage.setItem(DEF_INDEX_KEY, JSON.stringify(index));
}

function clearDefIndex() {
  localStorage.removeItem(DEF_INDEX_KEY);
  DEF_INDEX_MEM = null;
}

function setImportStatus(text) {
  const el = document.getElementById("importStatus");
  if (el) el.textContent = text;
}

function getOrCreateIndex() {
  if (DEF_INDEX_MEM) return DEF_INDEX_MEM;

  const loaded = loadDefIndex();
  if (loaded) {
    DEF_INDEX_MEM = loaded;
    return loaded;
  }

  DEF_INDEX_MEM = {
    importedAt: null,
    sources: [],
    byType: {},
    // defOrigins[type][defName] -> packageId
    defOrigins: {},
    // packageMeta[packageId] -> { displayName }
    packageMeta: {},
  };
  return DEF_INDEX_MEM;
}

function ensureType(index, type) {
  if (!index.byType[type]) index.byType[type] = [];
  return index.byType[type];
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
}

function applyDefIndexToDatalists(index) {
  const thingDefs = uniqueSorted(index?.byType?.ThingDef || []);
  const apparelDefs = uniqueSorted(index?.byType?.ApparelDef || []);
  const pawnKinds = uniqueSorted(index?.byType?.PawnKindDef || []);
  const hediffDefs = uniqueSorted(index?.byType?.HediffDef || []);
  const traitDefs = uniqueSorted(index?.byType?.TraitDef || []);
  const needDefs = uniqueSorted(index?.byType?.NeedDef || []);
  const statDefs = uniqueSorted(index?.byType?.StatDef || []);
  const skillDefs = uniqueSorted(index?.byType?.SkillDef || []);
  const thoughtDefs = uniqueSorted(index?.byType?.ThoughtDef || []);
  const mentalStateDefs = uniqueSorted(index?.byType?.MentalStateDef || []);
  const damageDefs = uniqueSorted(index?.byType?.DamageDef || []);
  const recordDefs = uniqueSorted(index?.byType?.RecordDef || []);
  const memeDefs = uniqueSorted(index?.byType?.MemeDef || []);
  const preceptDefs = uniqueSorted(index?.byType?.PreceptDef || []);
  const geneDefs = uniqueSorted(index?.byType?.GeneDef || []);
  const letterDefs = uniqueSorted(index?.byType?.LetterDef || []);

  hydrateDatalist("defs_ThingDef", thingDefs, 20000);
  hydrateDatalist("defs_ApparelDef", apparelDefs, 20000);
  hydrateDatalist("defs_PawnKindDef", pawnKinds, 20000);
  hydrateDatalist("defs_HediffDef", hediffDefs, 20000);
  hydrateDatalist("defs_TraitDef", traitDefs, 20000);
  hydrateDatalist("defs_NeedDef", needDefs, 20000);
  hydrateDatalist("defs_StatDef", statDefs, 20000);
  hydrateDatalist("defs_SkillDef", skillDefs, 20000);
  hydrateDatalist("defs_ThoughtDef", thoughtDefs, 20000);
  hydrateDatalist("defs_MentalStateDef", mentalStateDefs, 20000);
  hydrateDatalist("defs_DamageDef", damageDefs, 20000);
  hydrateDatalist("defs_RecordDef", recordDefs, 20000);
  hydrateDatalist("defs_MemeDef", memeDefs, 20000);
  hydrateDatalist("defs_PreceptDef", preceptDefs, 20000);
  hydrateDatalist("defs_GeneDef", geneDefs, 20000);
  hydrateDatalist("defs_LetterDef", letterDefs, 20000);

  const sources = (index?.sources || []).length ? index.sources.map((s) => `- ${s}`).join("\n") : "- (none)";

  const summary = [
    `Imported at: ${index?.importedAt || "never"}`,
    `Sources:\n${sources}`,
    "",
    "Counts:",
    `- ThingDef: ${thingDefs.length}`,
    `- Apparel ThingDef: ${apparelDefs.length}`,
    `- PawnKindDef: ${pawnKinds.length}`,
    `- HediffDef: ${hediffDefs.length}`,
    `- TraitDef: ${traitDefs.length}`,
    `- NeedDef: ${needDefs.length}`,
    `- StatDef: ${statDefs.length}`,
    `- SkillDef: ${skillDefs.length}`,
    `- ThoughtDef: ${thoughtDefs.length}`,
    `- MentalStateDef: ${mentalStateDefs.length}`,
    `- DamageDef: ${damageDefs.length}`,
    `- RecordDef: ${recordDefs.length}`,
    `- MemeDef: ${memeDefs.length}`,
    `- PreceptDef: ${preceptDefs.length}`,
    `- GeneDef: ${geneDefs.length}`,
    `- LetterDef: ${letterDefs.length}`,
  ].join("\n");

  setImportStatus(summary);
}

function hydrateDatalist(id, values, limit) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = "";
  const max = Math.min(values.length, limit);
  for (let i = 0; i < max; i++) {
    const opt = document.createElement("option");
    opt.value = values[i];
    el.appendChild(opt);
  }
}

async function chooseFolderHandle() {
  if (!window.showDirectoryPicker) {
    alert("This browser doesn't support folder picking. Use Edge or Chrome on Windows.");
    return null;
  }
  return await window.showDirectoryPicker({ mode: "read" });
}

async function* walkDir(handle, pathParts = []) {
  for await (const entry of handle.values()) {
    const entryPath = [...pathParts, entry.name];
    if (entry.kind === "file") {
      yield { fileHandle: entry, path: entryPath.join("/") };
    } else if (entry.kind === "directory") {
      yield* walkDir(entry, entryPath);
    }
  }
}

function classifyDefTag(tagName) {
  // Most RimWorld defs are like ThingDef, HediffDef, PawnKindDef, etc.
  // Some are custom defs (with dots). We only need a few types for autocomplete right now.
  if (!tagName) return null;
  if (tagName === "ThingDef") return "ThingDef";
  if (tagName === "PawnKindDef") return "PawnKindDef";
  if (tagName === "HediffDef") return "HediffDef";
  if (tagName === "TraitDef") return "TraitDef";
  if (tagName === "NeedDef") return "NeedDef";
  if (tagName === "StatDef") return "StatDef";
  if (tagName === "SkillDef") return "SkillDef";
  if (tagName === "ThoughtDef") return "ThoughtDef";
  if (tagName === "MentalStateDef") return "MentalStateDef";
  if (tagName === "DamageDef") return "DamageDef";
  if (tagName === "RecordDef") return "RecordDef";
  if (tagName === "MemeDef") return "MemeDef";
  if (tagName === "PreceptDef") return "PreceptDef";
  if (tagName === "GeneDef") return "GeneDef";
  if (tagName === "LetterDef") return "LetterDef";
  return null;
}

function shouldIgnorePackageIdForDependency(packageId) {
  if (!packageId) return true;
  const p = String(packageId).trim();
  if (!p) return true;
  if (p === "DrAke.LanternsCore") return true;

  // Vanilla/DLC packageIds (skip auto-deps; these aren't workshop mods).
  const lower = p.toLowerCase();
  if (lower === "ludeon.rimworld") return true;
  if (lower === "ludeon.rimworld.royalty") return true;
  if (lower === "ludeon.rimworld.ideology") return true;
  if (lower === "ludeon.rimworld.biotech") return true;
  if (lower === "ludeon.rimworld.anomaly") return true;
  return false;
}

function ensureOriginType(index, type) {
  if (!index.defOrigins) index.defOrigins = {};
  if (!index.defOrigins[type]) index.defOrigins[type] = {};
  return index.defOrigins[type];
}

function registerDefOrigin(index, type, defName, packageId) {
  if (!packageId || shouldIgnorePackageIdForDependency(packageId)) return;
  const map = ensureOriginType(index, type);
  if (!(defName in map)) map[defName] = packageId;
}

function collectDefsFromXmlText(xmlText, index, source = null) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return;

  const root = doc.documentElement;
  if (!root) return;

  // Most def files are <Defs> with children that have <defName>.
  const children = Array.from(root.children || []);
  for (const child of children) {
    const type = classifyDefTag(child.tagName);
    if (!type) continue;
    const defNameEl = child.querySelector("defName");
    const defName = defNameEl?.textContent?.trim();
    if (!defName) continue;
    ensureType(index, type).push(defName);
    registerDefOrigin(index, type, defName, source?.packageId);

    if (type === "ThingDef") {
      const isApparel = !!child.querySelector("apparel");
      if (isApparel) {
        ensureType(index, "ApparelDef").push(defName);
        registerDefOrigin(index, "ApparelDef", defName, source?.packageId);
      }
    }
  }
}

function safePersistDefIndex(index) {
  try {
    DEF_INDEX_MEM = index;
    saveDefIndex(index);
  } catch (e) {
    // localStorage can be too small if importing a large Mods folder.
    console.warn("Failed to persist def index; using in-memory only.", e);
    try {
      // Keep a small status record so the user knows persistence failed.
      const minimal = {
        importedAt: index.importedAt,
        sources: index.sources?.slice(-5) || [],
        byType: {
          ThingDef: (index.byType?.ThingDef || []).slice(0, 2000),
          PawnKindDef: (index.byType?.PawnKindDef || []).slice(0, 2000),
          ApparelDef: (index.byType?.ApparelDef || []).slice(0, 2000),
          HediffDef: (index.byType?.HediffDef || []).slice(0, 2000),
          TraitDef: (index.byType?.TraitDef || []).slice(0, 2000),
          NeedDef: (index.byType?.NeedDef || []).slice(0, 2000),
          StatDef: (index.byType?.StatDef || []).slice(0, 2000),
          SkillDef: (index.byType?.SkillDef || []).slice(0, 2000),
          ThoughtDef: (index.byType?.ThoughtDef || []).slice(0, 2000),
          MentalStateDef: (index.byType?.MentalStateDef || []).slice(0, 2000),
          DamageDef: (index.byType?.DamageDef || []).slice(0, 2000),
          RecordDef: (index.byType?.RecordDef || []).slice(0, 2000),
          MemeDef: (index.byType?.MemeDef || []).slice(0, 2000),
          PreceptDef: (index.byType?.PreceptDef || []).slice(0, 2000),
          GeneDef: (index.byType?.GeneDef || []).slice(0, 2000),
          LetterDef: (index.byType?.LetterDef || []).slice(0, 2000),
        },
        truncated: true,
      };
      saveDefIndex(minimal);
    } catch {
      // ignore
    }
  }
}

async function tryReadAboutXmlFromDir(dirHandle) {
  try {
    const aboutDir = await dirHandle.getDirectoryHandle("About");
    const aboutFileHandle = await aboutDir.getFileHandle("About.xml");
    const file = await aboutFileHandle.getFile();
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) return null;
    const root = doc.documentElement;
    if (!root) return null;
    const packageId = root.querySelector("packageId")?.textContent?.trim() || "";
    const displayName = root.querySelector("name")?.textContent?.trim() || "";
    if (!packageId) return null;
    return { packageId, displayName: displayName || packageId };
  } catch {
    return null;
  }
}

async function resolveSourceForPath(rootHandle, isSingleModFolder, path) {
  const index = getOrCreateIndex();
  if (!index.packageMeta) index.packageMeta = {};
  index._modKeyCache = index._modKeyCache || {};

  const parts = String(path || "").split("/").filter(Boolean);
  const modKey = isSingleModFolder ? "" : parts[0] || "";
  if (modKey in index._modKeyCache) return index._modKeyCache[modKey];

  try {
    const dirHandle = isSingleModFolder ? rootHandle : await rootHandle.getDirectoryHandle(modKey);
    const meta = await tryReadAboutXmlFromDir(dirHandle);
    if (meta && meta.packageId) {
      index.packageMeta[meta.packageId] = { displayName: meta.displayName || meta.packageId };
      index._modKeyCache[modKey] = meta;
      return meta;
    }
  } catch {
    // ignore
  }

  index._modKeyCache[modKey] = null;
  return null;
}

async function importFromFolder() {
  const handle = await chooseFolderHandle();
  if (!handle) return;

  const index = getOrCreateIndex();
  index.sources = index.sources || [];
  index.sources.push(`Folder import: ${handle.name}`);

  let scanned = 0;
  let xmlFiles = 0;
  let parsed = 0;
  let skipped = 0;

  const isSingleModFolder = (await tryReadAboutXmlFromDir(handle)) != null;

  setImportStatus("Importing...");

  for await (const { fileHandle, path } of walkDir(handle)) {
    scanned++;
    if (!path.toLowerCase().endsWith(".xml")) continue;
    xmlFiles++;

    try {
      const file = await fileHandle.getFile();
      // skip extremely large xml files to keep the app responsive
      if (file.size > 5_000_000) {
        skipped++;
        continue;
      }
      const text = await file.text();
      const source = await resolveSourceForPath(handle, isSingleModFolder, path);
      collectDefsFromXmlText(text, index, source);
      parsed++;
    } catch {
      skipped++;
    }

    if (xmlFiles % 50 === 0) {
      setImportStatus(
        `Importing...\n` +
          `Scanned entries: ${scanned}\n` +
          `XML files seen: ${xmlFiles}\n` +
          `Parsed XML: ${parsed}\n` +
          `Skipped: ${skipped}\n`
      );
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Deduplicate + sort stored lists
  for (const k of Object.keys(index.byType || {})) {
    index.byType[k] = uniqueSorted(index.byType[k] || []);
  }
  index.importedAt = new Date().toISOString();

  safePersistDefIndex(index);

  applyDefIndexToDatalists(index);
}

function getState() {
  return {
    modName: byId("modName").value.trim(),
    modAuthor: byId("modAuthor").value.trim(),
    packageId: byId("packageId").value.trim(),
    modDesc: byId("modDesc").value.trim(),
    autoAddDependencies: byId("autoAddDependencies")?.checked ?? true,
    extraDependencies: (byId("extraDependencies")?.value || "").trim(),

    gearParent: byId("gearParent")?.value || "Lantern_RingBase",
    gearParentCustom: byId("gearParentCustom")?.value.trim() || "",
    gearGraphicClass: byId("gearGraphicClass")?.value || "Graphic_Single",

    ringDefName: byId("ringDefName").value.trim(),
    ringLabel: byId("ringLabel").value.trim(),
    ringDesc: byId("ringDesc").value.trim(),
    ringColor: normalizeRgba(byId("ringColor").value),
    resourceLabel: byId("resourceLabel").value.trim(),
    showChargeGizmo: byId("showChargeGizmo")?.value !== "false",
    ringTexPath: byId("ringTexPath").value.trim(),
    marketValue: toNum(byId("marketValue").value, 5000),
    mass: toNum(byId("mass").value, 0.1),
    techLevel: byId("techLevel")?.value || "default",
    smeltable: byId("smeltable")?.value || "default",
    careIfWornByCorpse: byId("careIfWornByCorpse")?.value || "default",
    careIfDamaged: byId("careIfDamaged")?.value || "default",
    countsAsClothingForNudity: byId("countsAsClothingForNudity")?.value || "default",
    flammability: toMaybeNum(byId("flammability")?.value),
    equipDelay: toMaybeNum(byId("equipDelay")?.value),
    deteriorationRate: toMaybeNum(byId("deteriorationRate")?.value),
    gearBodyPartGroups: readGearBodyPartGroups(),
    gearLayers: readGearLayers(),
    gearTags: readGearTags(),

    enableCostume: byId("enableCostume")?.value === "yes",
    associatedHediff: byId("associatedHediff")?.value.trim() || "",

    transformationAllowMaleGender: byId("transformationAllowMaleGender")?.checked ?? true,
    transformationAllowFemaleGender: byId("transformationAllowFemaleGender")?.checked ?? true,
    transformationAllowNoneGender: byId("transformationAllowNoneGender")?.checked ?? true,
    transformationDisallowBodyTypeThin: byId("transformationDisallowBodyTypeThin")?.checked || false,
    transformationDisallowBodyTypeFat: byId("transformationDisallowBodyTypeFat")?.checked || false,
    transformationDisallowBodyTypeHulk: byId("transformationDisallowBodyTypeHulk")?.checked || false,

    transformationOnlyWhenDrafted: byId("transformationOnlyWhenDrafted")?.checked || false,
    transformationSkipConflictingApparel: byId("transformationSkipConflictingApparel")?.checked || false,
    transformationMissingGraphicBehavior: byId("transformationMissingGraphicBehavior")?.value || "none",
    transformationToggleGizmo: byId("transformationToggleGizmo")?.value === "yes",
    transformationToggleDefaultOn: byId("transformationToggleDefaultOn")?.value !== "no",

    transformationOverrideBodyType: byId("transformationOverrideBodyType")?.value === "yes",
    transformationOverrideBodyTypeOnlyIfMissing: byId("transformationOverrideBodyTypeOnlyIfMissing")?.value !== "no",
    transformationBodyTypeOverride:
      byId("transformationBodyTypeOverride")?.value === "custom"
        ? (byId("transformationBodyTypeOverrideCustom")?.value.trim() || "")
        : (byId("transformationBodyTypeOverride")?.value || "Male"),
    allowBatteryManifest: byId("allowBatteryManifest")?.checked || false,
    batteryDef: byId("batteryDef")?.value.trim() || "",
    batteryManifestCost: toNum(byId("batteryManifestCost")?.value, 0.5),

    reactiveEvadeProjectiles: byId("reactiveEvadeProjectiles")?.value === "true",
    reactiveEvadeProjectilesCost: toNum(byId("reactiveEvadeProjectilesCost")?.value, 0.02),
    reactiveEvadeProjectilesCooldownTicks: toNum(byId("reactiveEvadeProjectilesCooldownTicks")?.value, 60),
    reactiveEvadeAllowExplosiveProjectiles: byId("reactiveEvadeAllowExplosiveProjectiles")?.value === "true",
    reactiveEvadeToggleGizmo: byId("reactiveEvadeToggleGizmo")?.value === "true",
    reactiveEvadeDefaultEnabled: byId("reactiveEvadeDefaultEnabled")?.value !== "false",
    reactiveEvadeGasType: (byId("reactiveEvadeGasType")?.value || "").trim() || "BlindSmoke",
    reactiveEvadeGasRadius: toNum(byId("reactiveEvadeGasRadius")?.value, 2.4),
    reactiveEvadeGasAmount: toNum(byId("reactiveEvadeGasAmount")?.value, 60),

    enableStealth: byId("enableStealth")?.value === "yes",
    stealthHediff: byId("stealthHediff")?.value.trim() || "",
    stealthToggleGizmo: byId("stealthToggleGizmo")?.value !== "no",
    stealthDefaultOn: byId("stealthDefaultOn")?.value === "yes",
    stealthBreakOnAttack: byId("stealthBreakOnAttack")?.value === "true",
    stealthPreventTargeting: byId("stealthPreventTargeting")?.value !== "false",
    stealthGizmoIconPath: byId("stealthGizmoIconPath")?.value.trim() || "",
    stealthGizmoLabelKey: byId("stealthGizmoLabelKey")?.value.trim() || "",
    stealthGizmoDescKey: byId("stealthGizmoDescKey")?.value.trim() || "",
    stealthShowEnergyGizmo: byId("stealthShowEnergyGizmo")?.value === "true",
    stealthEnergyLabel: byId("stealthEnergyLabel")?.value.trim() || "",
    stealthEnergyColor: normalizeRgba(byId("stealthEnergyColor")?.value || ""),
    stealthEnergyMax: toNum(byId("stealthEnergyMax")?.value, 1),
    stealthEnergyStartPercent: toNum(byId("stealthEnergyStartPercent")?.value, 1),
    stealthEnergyDrainPerSecond: toNum(byId("stealthEnergyDrainPerSecond")?.value, 0),
    stealthEnergyRegenPerDay: toNum(byId("stealthEnergyRegenPerDay")?.value, 1),
    stealthSeeThroughPawnKinds: readStealthSeeThroughPawnKinds(),
    stealthSeeThroughHediffs: readStealthSeeThroughHediffs(),

    corruptionHediff: byId("corruptionHediff")?.value.trim() || "",
    corruptionInitialSeverity: toNum(byId("corruptionInitialSeverity")?.value, 0.01),
    corruptionGainPerDay: toNum(byId("corruptionGainPerDay")?.value, 0.05),
    corruptionTickIntervalSeconds: toNum(byId("corruptionTickIntervalSeconds")?.value, 1),
    corruptionStealthMultiplier: toNum(byId("corruptionStealthMultiplier")?.value, 1),
    attentionMultiplier: toNum(byId("attentionMultiplier")?.value, 1),
    corruptionMentalStates: readCorruptionMentalStates(),

    ambientInfluenceEnabled: byId("ambientInfluenceEnabled")?.value === "yes",
    ambientInfluenceHediff: byId("ambientInfluenceHediff")?.value.trim() || "",
    ambientInfluenceOnlyWhenUnworn: byId("ambientInfluenceOnlyWhenUnworn")?.value !== "false",
    ambientInfluenceOnlyWhenBuried: byId("ambientInfluenceOnlyWhenBuried")?.value === "true",
    ambientInfluenceSkipWearers: byId("ambientInfluenceSkipWearers")?.value !== "false",
    ambientInfluenceAffectsColonistsOnly: byId("ambientInfluenceAffectsColonistsOnly")?.value !== "false",
    ambientInfluenceAffectsHumanlikeOnly: byId("ambientInfluenceAffectsHumanlikeOnly")?.value !== "false",
    ambientInfluenceRadius: toNum(byId("ambientInfluenceRadius")?.value, 0),
    ambientInfluenceIntervalSeconds: toNum(byId("ambientInfluenceIntervalSeconds")?.value, 4),
    ambientInfluenceInitialSeverity: toNum(byId("ambientInfluenceInitialSeverity")?.value, 0.02),
    ambientInfluenceSeverityPerTick: toNum(byId("ambientInfluenceSeverityPerTick")?.value, 0.002),
    ambientInfluenceBreakThreshold: toNum(byId("ambientInfluenceBreakThreshold")?.value, 0.8),
    ambientInfluenceBreakChance: toNum(byId("ambientInfluenceBreakChance")?.value, 0.05),
    ambientInfluenceMentalState: byId("ambientInfluenceMentalState")?.value.trim() || "",

    wearerInfluenceEnabled: byId("wearerInfluenceEnabled")?.value === "yes",
    wearerInfluenceHediff: byId("wearerInfluenceHediff")?.value.trim() || "",
    wearerInfluenceAffectsColonistsOnly: byId("wearerInfluenceAffectsColonistsOnly")?.value !== "false",
    wearerInfluenceAffectsHumanlikeOnly: byId("wearerInfluenceAffectsHumanlikeOnly")?.value !== "false",
    wearerInfluenceSkipWearer: byId("wearerInfluenceSkipWearer")?.value !== "false",
    wearerInfluenceRadius: toNum(byId("wearerInfluenceRadius")?.value, 10),
    wearerInfluenceIntervalSeconds: toNum(byId("wearerInfluenceIntervalSeconds")?.value, 4),
    wearerInfluenceInitialSeverity: toNum(byId("wearerInfluenceInitialSeverity")?.value, 0.05),
    wearerInfluenceSeverityPerTick: toNum(byId("wearerInfluenceSeverityPerTick")?.value, 0.01),
    wearerInfluenceBreakThreshold: toNum(byId("wearerInfluenceBreakThreshold")?.value, 0.8),
    wearerInfluenceBreakChance: toNum(byId("wearerInfluenceBreakChance")?.value, 0.05),
    wearerInfluenceMentalState: byId("wearerInfluenceMentalState")?.value.trim() || "",
    wearerInfluenceTraitModifiers: readWearerInfluenceTraitModifiers(),

    autoEquipEnabled: byId("autoEquipEnabled")?.value === "yes",
    autoEquipChance: toNum(byId("autoEquipChance")?.value, 1),
    autoEquipScoreBonus: toNum(byId("autoEquipScoreBonus")?.value, 0),
    autoEquipAllowDrafted: byId("autoEquipAllowDrafted")?.checked ?? false,
    autoEquipTraitBonuses: readAutoEquipTraitBonuses(),
    autoEquipHediffBonuses: readAutoEquipHediffBonuses(),

    refuseRemoval: byId("refuseRemoval")?.value === "yes",
    refuseRemovalHediff: byId("refuseRemovalHediff")?.value.trim() || "",
    refuseRemovalMinSeverity: toNum(byId("refuseRemovalMinSeverity")?.value, 0.5),
    refuseRemovalMessageKey: byId("refuseRemovalMessageKey")?.value.trim() || "",
    forceDropOnWearerDeath: byId("forceDropOnWearerDeath")?.checked ?? false,
    forceDropOnCorpseDestroy: byId("forceDropOnCorpseDestroy")?.checked ?? false,
    forceDropOnGraveEject: byId("forceDropOnGraveEject")?.checked ?? false,

    costume_existingApparel: readExistingCostumeList(),
    costume_generatedApparel: readGeneratedCostumeList(),
    statBuffs: readStatBuffs(),

    maxCharge: toNum(byId("maxCharge").value, 1),
    passiveRegenPerDay: toNum(byId("passiveRegenPerDay").value, 0),
    passiveDrainPerDay: toNum(byId("passiveDrainPerDay").value, 0),

    regenFromMood: byId("regenFromMood").checked,
    moodMin: toNum(byId("moodMin").value, 0.8),
    moodRegenPerDay: toNum(byId("moodRegenPerDay").value, 0.1),

    regenFromPain: byId("regenFromPain").checked,
    painMin: toNum(byId("painMin").value, 0.2),
    painRegenPerDay: toNum(byId("painRegenPerDay").value, 0.1),

    regenFromSunlight: byId("regenFromSunlight").checked,
    sunlightMinGlow: toNum(byId("sunlightMinGlow").value, 0.5),
    sunlightRegenPerDay: toNum(byId("sunlightRegenPerDay").value, 0.1),

    regenFromPsyfocus: byId("regenFromPsyfocus").checked,
    psyfocusMin: toNum(byId("psyfocusMin").value, 0.5),
    psyfocusRegenPerDay: toNum(byId("psyfocusRegenPerDay").value, 0.1),

    regenFromNearbyAllies: byId("regenFromNearbyAllies").checked,
    alliesRadius: toNum(byId("alliesRadius").value, 10),
    alliesMaxCount: toNum(byId("alliesMaxCount").value, 5),
    alliesRegenPerDayEach: toNum(byId("alliesRegenPerDayEach").value, 0.02),

    abilities: readAbilityEditors(),

    enableSelection: byId("enableSelection").value === "yes",
    selectionDefName: byId("selectionDefName").value.trim(),
    selectionTrigger: byId("selectionTrigger").value,
    excludeIfHasAnyLanternRing: byId("excludeIfHasAnyLanternRing").value === "true",

    sel_allowColonists: byId("sel_allowColonists")?.checked ?? true,
    sel_allowPrisoners: byId("sel_allowPrisoners")?.checked ?? false,
    sel_allowSlaves: byId("sel_allowSlaves")?.checked ?? false,
    sel_allowGuests: byId("sel_allowGuests")?.checked ?? false,
    sel_allowAnimals: byId("sel_allowAnimals")?.checked ?? false,
    sel_allowMechs: byId("sel_allowMechs")?.checked ?? false,
    sel_allowHostiles: byId("sel_allowHostiles")?.checked ?? false,
    sel_allowDead: byId("sel_allowDead")?.checked ?? false,
    sel_allowDowned: byId("sel_allowDowned")?.checked ?? false,
    sel_requireViolenceCapable: byId("sel_requireViolenceCapable")?.checked ?? true,

    enableDiscoveryEvent: byId("enableDiscoveryEvent")?.value === "yes",
    discoveryIncidentDefName: byId("discoveryIncidentDefName")?.value.trim() || "",
    discoveryIncidentCategory: byId("discoveryIncidentCategory")?.value.trim() || "",
    discoveryIncidentBaseChance: toNum(byId("discoveryIncidentBaseChance")?.value, 0.1),
    discoveryMinRefireDays: toMaybeNum(byId("discoveryMinRefireDays")?.value),
    discoveryPointsScaleable: byId("discoveryPointsScaleable")?.value || "default",
    discoverySendLetter: byId("discoverySendLetter")?.value !== "no",
    discoveryLetterLabel: byId("discoveryLetterLabel")?.value.trim() || "",
    discoveryLetterText: byId("discoveryLetterText")?.value.trim() || "",
    discoveryLetterLabelKey: byId("discoveryLetterLabelKey")?.value.trim() || "",
    discoveryLetterTextKey: byId("discoveryLetterTextKey")?.value.trim() || "",
    discoveryLetterDef: byId("discoveryLetterDef")?.value.trim() || "",
    discoveryTargetType: byId("discoveryTargetType")?.value || "WorldSite",
    discoveryTargetTags: parseCsvList(byId("discoveryTargetTags")?.value),

    discoverySiteLabel: byId("discoverySiteLabel")?.value.trim() || "",
    discoverySiteDescription: byId("discoverySiteDescription")?.value.trim() || "",
    discoverySiteTimeoutDays: toNum(byId("discoverySiteTimeoutDays")?.value, 15),
    discoveryMinDistanceTiles: Math.max(0, Math.floor(toNum(byId("discoveryMinDistanceTiles")?.value, 6))),
    discoveryMaxDistanceTiles: Math.max(0, Math.floor(toNum(byId("discoveryMaxDistanceTiles")?.value, 40))),
    discoveryMapDropRadius: Math.max(0, Math.floor(toNum(byId("discoveryMapDropRadius")?.value, 10))),
    discoveryMapDropPreferColony: byId("discoveryMapDropPreferColony")?.checked ?? true,

    discoveryGearPlacement: byId("discoveryGearPlacement")?.value || "PawnWorn",
    discoveryGearReceiver: byId("discoveryGearReceiver")?.value || "PreferAlive",
    discoveryGearCount: Math.max(1, Math.floor(toNum(byId("discoveryGearCount")?.value, 1))),

    discoveryPawnKind: byId("discoveryPawnKind")?.value.trim() || "",
    discoveryPawnFaction: byId("discoveryPawnFaction")?.value.trim() || "",
    discoveryAliveMin: Math.max(0, Math.floor(toNum(byId("discoveryAliveMin")?.value, 0))),
    discoveryAliveMax: Math.max(0, Math.floor(toNum(byId("discoveryAliveMax")?.value, 0))),
    discoveryDeadMin: Math.max(0, Math.floor(toNum(byId("discoveryDeadMin")?.value, 1))),
    discoveryDeadMax: Math.max(0, Math.floor(toNum(byId("discoveryDeadMax")?.value, 1))),
    discoveryAliveDowned: byId("discoveryAliveDowned")?.value !== "false",
    discoveryPawnScatterRadius: toNum(byId("discoveryPawnScatterRadius")?.value, 8),
    discoverySpawnPawnsInDropPods: byId("discoverySpawnPawnsInDropPods")?.value !== "false",
    discoveryDropPodOpenDelaySeconds: toNum(byId("discoveryDropPodOpenDelaySeconds")?.value, 2),

    discoverySpawnCrashDebris: byId("discoverySpawnCrashDebris")?.value !== "false",
    discoveryCrashChunkDef: byId("discoveryCrashChunkDef")?.value.trim() || "",
    discoveryCrashDebrisDef: byId("discoveryCrashDebrisDef")?.value.trim() || "",
    discoveryCrashDebrisCount: Math.max(0, Math.floor(toNum(byId("discoveryCrashDebrisCount")?.value, 6))),
    discoveryCrashDebrisRadius: toNum(byId("discoveryCrashDebrisRadius")?.value, 6),

    enableTimedIncident: byId("enableTimedIncident")?.value === "yes",
    timedIncidentMinDays: toNum(byId("timedIncidentMinDays")?.value, 1),
    timedIncidentMaxDays: toNum(byId("timedIncidentMaxDays")?.value, 2),
    timedIncidentRetryHours: toNum(byId("timedIncidentRetryHours")?.value, 1),
    timedIncidentFireOnce: byId("timedIncidentFireOnce")?.value !== "no",
    timedIncidentForce: byId("timedIncidentForce")?.value !== "no",
    timedIncidentTarget: byId("timedIncidentTarget")?.value || "PlayerHomeMap",

    sel_conditions: readSelectionConditions(),
  };
}

function readSelectionConditions() {
  const el = document.getElementById("conditionList");
  const raw = el?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeSelectionConditions(items) {
  const el = document.getElementById("conditionList");
  if (!el) return;
  el.dataset.items = JSON.stringify(items);
  renderSelectionConditions();
}

function renderSelectionConditions() {
  const el = document.getElementById("conditionList");
  if (!el) return;
  const items = readSelectionConditions();
  el.innerHTML = "";

  items.forEach((it) => {
    const card = document.createElement("div");
    card.className = "miniCard";
    const defPart = it.def ? ` <span class="muted">(${escapeXml(it.def)})</span>` : "";
    card.innerHTML = `
      <div class="miniCard__main">
        <div><strong>${escapeXml(it.type)}</strong>${defPart}</div>
        <div><span class="muted">params:</span> <code>${escapeXml(Object.entries(it.params || {}).map(([k, v]) => `${k}=${v}`).join(", ")) || "(defaults)"}</code></div>
      </div>
      <div class="miniCard__actions"><button type="button">Remove</button></div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      writeSelectionConditions(items.filter((x) => x !== it));
      saveState();
      renderExportPanel();
    });
    el.appendChild(card);
  });
}

function parseKeyValueParams(text) {
  const out = {};
  const raw = String(text || "").trim();
  if (!raw) return out;
  const parts = raw.split(",").map((x) => x.trim()).filter(Boolean);
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx <= 0) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = v;
  }
  return out;
}

function readExistingCostumeList() {
  const raw = byId("existingApparelList")?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeExistingCostumeList(items) {
  const el = byId("existingApparelList");
  const uniq = Array.from(new Set(items.map((x) => x.trim()).filter(Boolean)));
  el.dataset.items = JSON.stringify(uniq);
  renderExistingCostumeList();
}

function renderExistingCostumeList() {
  const el = byId("existingApparelList");
  const items = readExistingCostumeList();
  el.innerHTML = "";
  items.forEach((name) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.innerHTML = `<span><code>${escapeXml(name)}</code></span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Remove";
    btn.textContent = "×";
    btn.addEventListener("click", () => {
      writeExistingCostumeList(items.filter((x) => x !== name));
      saveState();
      renderExportPanel();
    });
    pill.appendChild(btn);
    el.appendChild(pill);
  });
}

function readGeneratedCostumeList() {
  const raw = byId("generatedApparelList")?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeGeneratedCostumeList(items) {
  const el = byId("generatedApparelList");
  el.dataset.items = JSON.stringify(items);
  renderGeneratedCostumeList();
}

function renderGeneratedCostumeList() {
  const el = byId("generatedApparelList");
  const items = readGeneratedCostumeList();
  el.innerHTML = "";
  items.forEach((it) => {
    const card = document.createElement("div");
    card.className = "miniCard";
    card.innerHTML = `
      <div class="miniCard__main">
        <div><strong>${escapeXml(it.label || it.defName)}</strong> <span class="muted">(${escapeXml(it.defName)})</span></div>
        <div><span class="muted">tex:</span> <code>${escapeXml(it.texPath)}</code></div>
        <div><span class="muted">layers:</span> <code>${escapeXml(it.layers.join(", "))}</code> <span class="muted">parts:</span> <code>${escapeXml(it.bodyParts.join(", "))}</code></div>
      </div>
      <div class="miniCard__actions">
        <button type="button">Remove</button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      writeGeneratedCostumeList(items.filter((x) => x.defName !== it.defName));
      saveState();
      renderExportPanel();
    });
    el.appendChild(card);
  });
}

function readStatBuffs() {
  const el = document.getElementById("statBuffList");
  const raw = el?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeStatBuffs(items) {
  const el = document.getElementById("statBuffList");
  if (!el) return;
  el.dataset.items = JSON.stringify(items);
  renderStatBuffs();
}

function renderStatBuffs() {
  const el = document.getElementById("statBuffList");
  if (!el) return;
  const items = readStatBuffs();
  el.innerHTML = "";

  items.forEach((it) => {
    const card = document.createElement("div");
    card.className = "miniCard";
    card.innerHTML = `
      <div class="miniCard__main">
        <div><strong>${escapeXml(it.stat)}</strong> <span class="muted">offset</span> <code>${escapeXml(String(it.offset))}</code></div>
      </div>
      <div class="miniCard__actions"><button type="button">Remove</button></div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      writeStatBuffs(items.filter((x) => x !== it));
      saveState();
      renderExportPanel();
    });
    el.appendChild(card);
  });
}

function readGearBodyPartGroups() {
  const raw = byId("gearBodyPartGroupList")?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeGearBodyPartGroups(items) {
  const el = byId("gearBodyPartGroupList");
  if (!el) return;
  const uniq = Array.from(new Set(items.map((x) => x.trim()).filter(Boolean)));
  el.dataset.items = JSON.stringify(uniq);
  renderGearBodyPartGroups();
}

function renderGearBodyPartGroups() {
  const el = byId("gearBodyPartGroupList");
  if (!el) return;
  const items = readGearBodyPartGroups();
  el.innerHTML = "";
  items.forEach((name) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.innerHTML = `<span><code>${escapeXml(name)}</code></span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Remove";
    btn.textContent = "A-";
    btn.addEventListener("click", () => {
      writeGearBodyPartGroups(items.filter((x) => x !== name));
      saveState();
      renderExportPanel();
    });
    pill.appendChild(btn);
    el.appendChild(pill);
  });
}

function readGearLayers() {
  const raw = byId("gearLayerList")?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeGearLayers(items) {
  const el = byId("gearLayerList");
  if (!el) return;
  const uniq = Array.from(new Set(items.map((x) => x.trim()).filter(Boolean)));
  el.dataset.items = JSON.stringify(uniq);
  renderGearLayers();
}

function renderGearLayers() {
  const el = byId("gearLayerList");
  if (!el) return;
  const items = readGearLayers();
  el.innerHTML = "";
  items.forEach((name) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.innerHTML = `<span><code>${escapeXml(name)}</code></span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Remove";
    btn.textContent = "A-";
    btn.addEventListener("click", () => {
      writeGearLayers(items.filter((x) => x !== name));
      saveState();
      renderExportPanel();
    });
    pill.appendChild(btn);
    el.appendChild(pill);
  });
}

function readGearTags() {
  const raw = byId("gearTagList")?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeGearTags(items) {
  const el = byId("gearTagList");
  if (!el) return;
  const uniq = Array.from(new Set(items.map((x) => x.trim()).filter(Boolean)));
  el.dataset.items = JSON.stringify(uniq);
  renderGearTags();
}

function renderGearTags() {
  const el = byId("gearTagList");
  if (!el) return;
  const items = readGearTags();
  el.innerHTML = "";
  items.forEach((name) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.innerHTML = `<span><code>${escapeXml(name)}</code></span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Remove";
    btn.textContent = "A-";
    btn.addEventListener("click", () => {
      writeGearTags(items.filter((x) => x !== name));
      saveState();
      renderExportPanel();
    });
    pill.appendChild(btn);
    el.appendChild(pill);
  });
}

function readStealthSeeThroughPawnKinds() {
  const raw = byId("stealthSeeThroughPawnKindsList")?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeStealthSeeThroughPawnKinds(items) {
  const el = byId("stealthSeeThroughPawnKindsList");
  if (!el) return;
  const uniq = Array.from(new Set(items.map((x) => x.trim()).filter(Boolean)));
  el.dataset.items = JSON.stringify(uniq);
  renderStealthSeeThroughPawnKinds();
}

function renderStealthSeeThroughPawnKinds() {
  const el = byId("stealthSeeThroughPawnKindsList");
  if (!el) return;
  const items = readStealthSeeThroughPawnKinds();
  el.innerHTML = "";
  items.forEach((name) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.innerHTML = `<span><code>${escapeXml(name)}</code></span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Remove";
    btn.textContent = "A-";
    btn.addEventListener("click", () => {
      writeStealthSeeThroughPawnKinds(items.filter((x) => x !== name));
      saveState();
      renderExportPanel();
    });
    pill.appendChild(btn);
    el.appendChild(pill);
  });
}

function readStealthSeeThroughHediffs() {
  const raw = byId("stealthSeeThroughHediffsList")?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeStealthSeeThroughHediffs(items) {
  const el = byId("stealthSeeThroughHediffsList");
  if (!el) return;
  const uniq = Array.from(new Set(items.map((x) => x.trim()).filter(Boolean)));
  el.dataset.items = JSON.stringify(uniq);
  renderStealthSeeThroughHediffs();
}

function renderStealthSeeThroughHediffs() {
  const el = byId("stealthSeeThroughHediffsList");
  if (!el) return;
  const items = readStealthSeeThroughHediffs();
  el.innerHTML = "";
  items.forEach((name) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.innerHTML = `<span><code>${escapeXml(name)}</code></span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Remove";
    btn.textContent = "A-";
    btn.addEventListener("click", () => {
      writeStealthSeeThroughHediffs(items.filter((x) => x !== name));
      saveState();
      renderExportPanel();
    });
    pill.appendChild(btn);
    el.appendChild(pill);
  });
}

function readCorruptionMentalStates() {
  const el = document.getElementById("corruptionMentalStateList");
  const raw = el?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeCorruptionMentalStates(items) {
  const el = document.getElementById("corruptionMentalStateList");
  if (!el) return;
  el.dataset.items = JSON.stringify(items);
  renderCorruptionMentalStates();
}

function renderCorruptionMentalStates() {
  const el = document.getElementById("corruptionMentalStateList");
  if (!el) return;
  const items = readCorruptionMentalStates();
  el.innerHTML = "";

  items.forEach((it) => {
    const card = document.createElement("div");
    card.className = "miniCard";
    card.innerHTML = `
      <div class="miniCard__main">
        <div><strong>${escapeXml(it.mentalState)}</strong></div>
        <div><span class="muted">sev:</span> <code>${escapeXml(`${it.minSeverity}..${it.maxSeverity}`)}</code></div>
        <div><span class="muted">chance:</span> <code>${escapeXml(String(it.chancePerCheck))}</code> <span class="muted">interval:</span> <code>${escapeXml(String(it.checkIntervalTicks))}</code></div>
      </div>
      <div class="miniCard__actions"><button type="button">Remove</button></div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      writeCorruptionMentalStates(items.filter((x) => x !== it));
      saveState();
      renderExportPanel();
    });
    el.appendChild(card);
  });
}

function readAutoEquipTraitBonuses() {
  const el = document.getElementById("autoEquipTraitList");
  const raw = el?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAutoEquipTraitBonuses(items) {
  const el = document.getElementById("autoEquipTraitList");
  if (!el) return;
  el.dataset.items = JSON.stringify(items);
  renderAutoEquipTraitBonuses();
}

function renderAutoEquipTraitBonuses() {
  const el = document.getElementById("autoEquipTraitList");
  if (!el) return;
  const items = readAutoEquipTraitBonuses();
  el.innerHTML = "";

  items.forEach((it) => {
    const card = document.createElement("div");
    card.className = "miniCard";
    card.innerHTML = `
      <div class="miniCard__main">
        <div><strong>${escapeXml(it.trait)}</strong> <span class="muted">degree</span> <code>${escapeXml(String(it.degree))}</code></div>
        <div><span class="muted">score:</span> <code>${escapeXml(String(it.scoreOffset))}</code></div>
      </div>
      <div class="miniCard__actions"><button type="button">Remove</button></div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      writeAutoEquipTraitBonuses(items.filter((x) => x !== it));
      saveState();
      renderExportPanel();
    });
    el.appendChild(card);
  });
}

function readAutoEquipHediffBonuses() {
  const el = document.getElementById("autoEquipHediffList");
  const raw = el?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAutoEquipHediffBonuses(items) {
  const el = document.getElementById("autoEquipHediffList");
  if (!el) return;
  el.dataset.items = JSON.stringify(items);
  renderAutoEquipHediffBonuses();
}

function renderAutoEquipHediffBonuses() {
  const el = document.getElementById("autoEquipHediffList");
  if (!el) return;
  const items = readAutoEquipHediffBonuses();
  el.innerHTML = "";

  items.forEach((it) => {
    const card = document.createElement("div");
    card.className = "miniCard";
    card.innerHTML = `
      <div class="miniCard__main">
        <div><strong>${escapeXml(it.hediff)}</strong></div>
        <div><span class="muted">sev:</span> <code>${escapeXml(`${it.minSeverity}..${it.maxSeverity}`)}</code></div>
        <div><span class="muted">score:</span> <code>${escapeXml(String(it.scoreOffset))}</code> <span class="muted">mult:</span> <code>${escapeXml(String(it.severityMultiplier))}</code></div>
      </div>
      <div class="miniCard__actions"><button type="button">Remove</button></div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      writeAutoEquipHediffBonuses(items.filter((x) => x !== it));
      saveState();
      renderExportPanel();
    });
    el.appendChild(card);
  });
}

function readWearerInfluenceTraitModifiers() {
  const el = document.getElementById("wearerInfluenceTraitList");
  const raw = el?.dataset.items;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeWearerInfluenceTraitModifiers(items) {
  const el = document.getElementById("wearerInfluenceTraitList");
  if (!el) return;
  el.dataset.items = JSON.stringify(items);
  renderWearerInfluenceTraitModifiers();
}

function renderWearerInfluenceTraitModifiers() {
  const el = document.getElementById("wearerInfluenceTraitList");
  if (!el) return;
  const items = readWearerInfluenceTraitModifiers();
  el.innerHTML = "";

  items.forEach((it) => {
    const card = document.createElement("div");
    card.className = "miniCard";
    card.innerHTML = `
      <div class="miniCard__main">
        <div><strong>${escapeXml(it.trait)}</strong> <span class="muted">degree</span> <code>${escapeXml(String(it.degree))}</code></div>
        <div><span class="muted">mult:</span> <code>${escapeXml(String(it.severityMultiplier))}</code> <span class="muted">offset:</span> <code>${escapeXml(String(it.severityOffset))}</code></div>
      </div>
      <div class="miniCard__actions"><button type="button">Remove</button></div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      writeWearerInfluenceTraitModifiers(items.filter((x) => x !== it));
      saveState();
      renderExportPanel();
    });
    el.appendChild(card);
  });
}

function readAbilityEditors() {
  const editors = qsa("#abilityEditors .card");
  return editors.map((card) => {
    const key = card.dataset.ability;
    const base = abilityBaseInfo(key);

    const fields = {};
    card.querySelectorAll("[data-field]").forEach((el) => {
      const k = el.dataset.field;
      if (el.tagName === "SELECT") fields[k] = el.value;
      else fields[k] = el.value;
    });

    const defName = (fields.defName ?? "").trim() || base.defaultDefName;
    const label = (fields.label ?? "").trim() || base.defaultLabel;
    const iconPath = (fields.iconPath ?? "").trim() || base.defaultIconPath;
    const cost = toNum(fields.cost, 0.05);
    const description = (fields.description ?? "").trim();
    const cooldownTicks = Math.max(0, Math.floor(toNum(fields.cooldownTicks, 0)));
    const maxCastsPerDay = Math.max(0, Math.floor(toNum(fields.maxCastsPerDay, 0)));
    const targetRule = (fields.targetRule ?? "Any").trim() || "Any";

    const out = { key, parent: base.parent, defName, label, iconPath, cost, description, cooldownTicks, maxCastsPerDay, targetRule };

    const rangeText = String(fields.range ?? "").trim();
    const range = rangeText ? toNum(rangeText, 0) : 0;
    if (range > 0) out.range = range;

    out.pauseOnClick = (fields.pauseOnClick ?? "false") === "true";

    // Ability-specific parameters (minimal set).
    if (key === "Blast") {
      out.soundCastOverride = (fields.soundCastOverride ?? "").trim();
      out.muteSoundCast = (fields.muteSoundCast ?? "false") === "true";
    } else if (key === "Heal") {
      out.healAmount = toNum(fields.healAmount, 10);
      out.radius = toNum(fields.radius, 0);
    } else if (key === "Stun") {
      out.stunTicks = Math.max(1, Math.floor(toNum(fields.stunTicks, 180)));
      out.radius = toNum(fields.radius, 0);
      out.affectHostilesOnly = (fields.affectHostilesOnly ?? "true") === "true";
    } else if (key === "Barrier") {
      out.radius = toNum(fields.radius, 0);
      out.shieldMaxHp = Math.max(1, Math.floor(toNum(fields.shieldMaxHp, 200)));
    } else if (key === "Aura") {
      out.severity = toNum(fields.severity, 0.12);
      out.radius = toNum(fields.radius, 6);
      out.durationTicks = Math.max(0, Math.floor(toNum(fields.durationTicks, 6000)));
    } else if (key === "Construct") {
      out.thingDef = (fields.thingDef ?? "").trim() || "Sandbags";
      out.spawnCount = Math.max(1, Math.floor(toNum(fields.spawnCount, 1)));
      out.durationTicks = Math.max(0, Math.floor(toNum(fields.durationTicks, 6000)));
    } else if (key === "Summon") {
      out.pawnKind = (fields.pawnKind ?? "").trim();
      out.count = Math.max(1, Math.floor(toNum(fields.count, 1)));
      out.durationTicks = Math.max(0, Math.floor(toNum(fields.durationTicks, 6000)));
    } else if (key === "Teleport") {
      out.allowRoofed = (fields.allowRoofed ?? "true") === "true";
      out.allowOccupied = (fields.allowOccupied ?? "false") === "true";
      out.spawnGasAtOrigin = (fields.spawnGasAtOrigin ?? "false") === "true";
      out.spawnGasAtDestination = (fields.spawnGasAtDestination ?? "false") === "true";
      out.gasType = (fields.gasType ?? "").trim() || "BlindSmoke";
      out.gasRadius = toNum(fields.gasRadius, 2.4);
      out.gasAmount = Math.max(0, Math.floor(toNum(fields.gasAmount, 60)));
      out.gasDurationTicks = Math.max(0, Math.floor(toNum(fields.gasDurationTicks, 0)));
    } else if (key === "Conditional") {
      out.fleshOutcome = (fields.fleshOutcome ?? "Down").trim() || "Down";
      out.mechOutcome = (fields.mechOutcome ?? "Kill").trim() || "Kill";
      out.anomalyOutcome = (fields.anomalyOutcome ?? "Kill").trim() || "Kill";
      out.otherOutcome = (fields.otherOutcome ?? "None").trim() || "None";
    } else if (key === "Displace") {
      out.distance = Math.max(0, Math.floor(toNum(fields.distance, 4)));
      out.pullTowardsCaster = (fields.pullTowardsCaster ?? "false") === "true";
      out.requireLineOfSight = (fields.requireLineOfSight ?? "false") === "true";
    }

    return out;
  });
}

function setDefaults() {
  byId("modName").value = "My Hero Gear Mod";
  byId("modAuthor").value = "";
  byId("packageId").value = "yourname.myherogear";
  byId("modDesc").value = "Adds custom hero gear powered by a resource.";
  if (document.getElementById("autoAddDependencies")) byId("autoAddDependencies").checked = true;
  if (document.getElementById("extraDependencies")) byId("extraDependencies").value = "";

  if (document.getElementById("gearParent")) {
    byId("gearParent").value = "Lantern_RingBase";
    byId("gearParentCustom").value = "";
    if (document.getElementById("gearGraphicClass")) byId("gearGraphicClass").value = "Graphic_Single";
  }

  byId("ringDefName").value = "MyHeroGear_Ring";
  byId("ringLabel").value = "my hero gear";
  byId("ringDesc").value = "A piece of gear fueled by a resource.";
  byId("ringColor").value = "(1, 0, 0, 1)";
  byId("resourceLabel").value = "Willpower";
  if (document.getElementById("showChargeGizmo")) byId("showChargeGizmo").value = "true";
  byId("ringTexPath").value = "MyHeroGear/Items/MyGear";
  byId("marketValue").value = "5000";
  byId("mass").value = "0.1";
  if (document.getElementById("techLevel")) byId("techLevel").value = "default";
  if (document.getElementById("smeltable")) byId("smeltable").value = "default";
  if (document.getElementById("careIfWornByCorpse")) byId("careIfWornByCorpse").value = "default";
  if (document.getElementById("careIfDamaged")) byId("careIfDamaged").value = "default";
  if (document.getElementById("countsAsClothingForNudity")) byId("countsAsClothingForNudity").value = "default";
  if (document.getElementById("flammability")) byId("flammability").value = "";
  if (document.getElementById("equipDelay")) byId("equipDelay").value = "";
  if (document.getElementById("deteriorationRate")) byId("deteriorationRate").value = "";
  if (document.getElementById("gearBodyPartGroupList")) writeGearBodyPartGroups([]);
  if (document.getElementById("gearLayerList")) writeGearLayers([]);
  if (document.getElementById("gearTagList")) writeGearTags([]);

  if (document.getElementById("enableCostume")) {
    byId("enableCostume").value = "no";
    byId("associatedHediff").value = "";

    if (document.getElementById("transformationAllowMaleGender")) byId("transformationAllowMaleGender").checked = true;
    if (document.getElementById("transformationAllowFemaleGender")) byId("transformationAllowFemaleGender").checked = true;
    if (document.getElementById("transformationAllowNoneGender")) byId("transformationAllowNoneGender").checked = true;
    if (document.getElementById("transformationDisallowBodyTypeThin")) byId("transformationDisallowBodyTypeThin").checked = false;
    if (document.getElementById("transformationDisallowBodyTypeFat")) byId("transformationDisallowBodyTypeFat").checked = false;
    if (document.getElementById("transformationDisallowBodyTypeHulk")) byId("transformationDisallowBodyTypeHulk").checked = false;

    byId("transformationOnlyWhenDrafted").checked = false;
    byId("transformationSkipConflictingApparel").checked = false;
    if (document.getElementById("transformationMissingGraphicBehavior")) byId("transformationMissingGraphicBehavior").value = "none";
    if (document.getElementById("transformationToggleGizmo")) byId("transformationToggleGizmo").value = "no";
    if (document.getElementById("transformationToggleDefaultOn")) byId("transformationToggleDefaultOn").value = "yes";
    if (document.getElementById("transformationOverrideBodyType")) byId("transformationOverrideBodyType").value = "no";
    if (document.getElementById("transformationOverrideBodyTypeOnlyIfMissing")) byId("transformationOverrideBodyTypeOnlyIfMissing").value = "yes";
    if (document.getElementById("transformationBodyTypeOverride")) byId("transformationBodyTypeOverride").value = "Male";
    if (document.getElementById("transformationBodyTypeOverrideCustom")) byId("transformationBodyTypeOverrideCustom").value = "";
    byId("allowBatteryManifest").checked = false;
    byId("batteryDef").value = "";
    byId("batteryManifestCost").value = "0.5";
    if (document.getElementById("reactiveEvadeProjectiles")) byId("reactiveEvadeProjectiles").value = "false";
    if (document.getElementById("reactiveEvadeProjectilesCost")) byId("reactiveEvadeProjectilesCost").value = "0.02";
    if (document.getElementById("reactiveEvadeProjectilesCooldownTicks")) byId("reactiveEvadeProjectilesCooldownTicks").value = "60";
    if (document.getElementById("reactiveEvadeAllowExplosiveProjectiles")) byId("reactiveEvadeAllowExplosiveProjectiles").value = "false";
    if (document.getElementById("reactiveEvadeToggleGizmo")) byId("reactiveEvadeToggleGizmo").value = "false";
    if (document.getElementById("reactiveEvadeDefaultEnabled")) byId("reactiveEvadeDefaultEnabled").value = "true";
    if (document.getElementById("reactiveEvadeGasType")) byId("reactiveEvadeGasType").value = "BlindSmoke";
    if (document.getElementById("reactiveEvadeGasRadius")) byId("reactiveEvadeGasRadius").value = "2.4";
    if (document.getElementById("reactiveEvadeGasAmount")) byId("reactiveEvadeGasAmount").value = "60";
    writeExistingCostumeList([]);
    writeGeneratedCostumeList([]);
    if (document.getElementById("statBuffList")) writeStatBuffs([]);
  }

  if (document.getElementById("enableStealth")) {
    byId("enableStealth").value = "no";
    byId("stealthHediff").value = "";
    byId("stealthToggleGizmo").value = "yes";
    byId("stealthDefaultOn").value = "no";
    byId("stealthBreakOnAttack").value = "false";
    byId("stealthPreventTargeting").value = "true";
    byId("stealthGizmoIconPath").value = "";
    byId("stealthGizmoLabelKey").value = "";
    byId("stealthGizmoDescKey").value = "";
    byId("stealthShowEnergyGizmo").value = "false";
    byId("stealthEnergyLabel").value = "Stealth";
    byId("stealthEnergyColor").value = "(0.2, 0.6, 0.8, 1)";
    byId("stealthEnergyMax").value = "1";
    byId("stealthEnergyStartPercent").value = "1";
    byId("stealthEnergyDrainPerSecond").value = "0";
    byId("stealthEnergyRegenPerDay").value = "1";
    writeStealthSeeThroughPawnKinds([]);
    writeStealthSeeThroughHediffs([]);
  }

  if (document.getElementById("corruptionHediff")) {
    byId("corruptionHediff").value = "";
    byId("corruptionInitialSeverity").value = "0.01";
    byId("corruptionGainPerDay").value = "0.05";
    byId("corruptionTickIntervalSeconds").value = "1";
    byId("corruptionStealthMultiplier").value = "1";
    byId("attentionMultiplier").value = "1";
    writeCorruptionMentalStates([]);
  }

  if (document.getElementById("ambientInfluenceEnabled")) {
    byId("ambientInfluenceEnabled").value = "no";
    byId("ambientInfluenceHediff").value = "";
    byId("ambientInfluenceOnlyWhenUnworn").value = "true";
    byId("ambientInfluenceOnlyWhenBuried").value = "false";
    byId("ambientInfluenceSkipWearers").value = "true";
    byId("ambientInfluenceAffectsColonistsOnly").value = "true";
    byId("ambientInfluenceAffectsHumanlikeOnly").value = "true";
    byId("ambientInfluenceRadius").value = "0";
    byId("ambientInfluenceIntervalSeconds").value = "4";
    byId("ambientInfluenceInitialSeverity").value = "0.02";
    byId("ambientInfluenceSeverityPerTick").value = "0.002";
    byId("ambientInfluenceBreakThreshold").value = "0.8";
    byId("ambientInfluenceBreakChance").value = "0.05";
    byId("ambientInfluenceMentalState").value = "";
  }

  if (document.getElementById("wearerInfluenceEnabled")) {
    byId("wearerInfluenceEnabled").value = "no";
    byId("wearerInfluenceHediff").value = "";
    byId("wearerInfluenceAffectsColonistsOnly").value = "false";
    byId("wearerInfluenceAffectsHumanlikeOnly").value = "true";
    byId("wearerInfluenceSkipWearer").value = "true";
    byId("wearerInfluenceRadius").value = "10";
    byId("wearerInfluenceIntervalSeconds").value = "4";
    byId("wearerInfluenceInitialSeverity").value = "0.05";
    byId("wearerInfluenceSeverityPerTick").value = "0.01";
    byId("wearerInfluenceBreakThreshold").value = "0.8";
    byId("wearerInfluenceBreakChance").value = "0.05";
    byId("wearerInfluenceMentalState").value = "";
    writeWearerInfluenceTraitModifiers([]);
  }

  if (document.getElementById("autoEquipEnabled")) {
    byId("autoEquipEnabled").value = "no";
    byId("autoEquipChance").value = "1";
    byId("autoEquipScoreBonus").value = "0";
    byId("autoEquipAllowDrafted").checked = false;
    writeAutoEquipTraitBonuses([]);
    writeAutoEquipHediffBonuses([]);
  }

  if (document.getElementById("refuseRemoval")) {
    byId("refuseRemoval").value = "no";
    byId("refuseRemovalHediff").value = "";
    byId("refuseRemovalMinSeverity").value = "0.5";
    byId("refuseRemovalMessageKey").value = "Lantern_RefuseRemoval";
    byId("forceDropOnWearerDeath").checked = false;
    byId("forceDropOnCorpseDestroy").checked = false;
    byId("forceDropOnGraveEject").checked = false;
  }

  byId("maxCharge").value = "1";
  byId("passiveRegenPerDay").value = "0";
  byId("passiveDrainPerDay").value = "0";

  byId("regenFromMood").checked = false;
  byId("moodMin").value = "0.8";
  byId("moodRegenPerDay").value = "0.1";

  byId("regenFromPain").checked = false;
  byId("painMin").value = "0.2";
  byId("painRegenPerDay").value = "0.1";

  byId("regenFromSunlight").checked = false;
  byId("sunlightMinGlow").value = "0.5";
  byId("sunlightRegenPerDay").value = "0.1";

  byId("regenFromPsyfocus").checked = false;
  byId("psyfocusMin").value = "0.5";
  byId("psyfocusRegenPerDay").value = "0.1";

  byId("regenFromNearbyAllies").checked = false;
  byId("alliesRadius").value = "10";
  byId("alliesMaxCount").value = "5";
  byId("alliesRegenPerDayEach").value = "0.02";

  byId("enableSelection").value = "no";
  byId("selectionDefName").value = "MyHeroGear_Selection";
  byId("selectionTrigger").value = "onJoin";
  byId("excludeIfHasAnyLanternRing").value = "true";

  if (document.getElementById("sel_allowColonists")) {
    byId("sel_allowColonists").checked = true;
    byId("sel_allowPrisoners").checked = false;
    byId("sel_allowSlaves").checked = false;
    byId("sel_allowGuests").checked = false;
    byId("sel_allowAnimals").checked = false;
    byId("sel_allowMechs").checked = false;
    byId("sel_allowHostiles").checked = false;
    byId("sel_allowDead").checked = false;
    byId("sel_allowDowned").checked = false;
    byId("sel_requireViolenceCapable").checked = true;
    writeSelectionConditions([]);
  }

  if (document.getElementById("enableDiscoveryEvent")) {
    byId("enableDiscoveryEvent").value = "no";
    byId("discoveryIncidentDefName").value = "MyHeroGear_Discovery";
    byId("discoveryIncidentCategory").value = "Misc";
    byId("discoveryIncidentBaseChance").value = "0.1";
    if (document.getElementById("discoveryMinRefireDays")) byId("discoveryMinRefireDays").value = "";
    if (document.getElementById("discoveryPointsScaleable")) byId("discoveryPointsScaleable").value = "default";
    byId("discoverySendLetter").value = "yes";
    byId("discoveryLetterLabel").value = "";
    byId("discoveryLetterText").value = "";
    if (document.getElementById("discoveryLetterLabelKey")) byId("discoveryLetterLabelKey").value = "";
    if (document.getElementById("discoveryLetterTextKey")) byId("discoveryLetterTextKey").value = "";
    if (document.getElementById("discoveryLetterDef")) byId("discoveryLetterDef").value = "";
    byId("discoveryTargetType").value = "WorldSite";
    if (document.getElementById("discoveryTargetTags")) byId("discoveryTargetTags").value = "";

    byId("discoverySiteLabel").value = "";
    byId("discoverySiteDescription").value = "";
    byId("discoverySiteTimeoutDays").value = "15";
    byId("discoveryMinDistanceTiles").value = "6";
    byId("discoveryMaxDistanceTiles").value = "40";
    byId("discoveryMapDropRadius").value = "10";
    byId("discoveryMapDropPreferColony").checked = true;

    byId("discoveryGearPlacement").value = "PawnWorn";
    byId("discoveryGearReceiver").value = "PreferAlive";
    byId("discoveryGearCount").value = "1";

    byId("discoveryPawnKind").value = "";
    byId("discoveryPawnFaction").value = "";
    byId("discoveryAliveMin").value = "0";
    byId("discoveryAliveMax").value = "0";
    byId("discoveryDeadMin").value = "1";
    byId("discoveryDeadMax").value = "1";
    byId("discoveryAliveDowned").value = "true";
    byId("discoveryPawnScatterRadius").value = "8";
    byId("discoverySpawnPawnsInDropPods").value = "true";
    byId("discoveryDropPodOpenDelaySeconds").value = "2";

    byId("discoverySpawnCrashDebris").value = "true";
    byId("discoveryCrashChunkDef").value = "ShipChunk";
    byId("discoveryCrashDebrisDef").value = "ChunkSlagSteel";
    byId("discoveryCrashDebrisCount").value = "6";
    byId("discoveryCrashDebrisRadius").value = "6";
  }

  if (document.getElementById("enableTimedIncident")) {
    byId("enableTimedIncident").value = "no";
    byId("timedIncidentMinDays").value = "1";
    byId("timedIncidentMaxDays").value = "2";
    byId("timedIncidentRetryHours").value = "1";
    byId("timedIncidentFireOnce").value = "yes";
    byId("timedIncidentForce").value = "yes";
    byId("timedIncidentTarget").value = "PlayerHomeMap";
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    for (const [id, val] of Object.entries(s)) {
      if (id === "abilities" || id === "enableSelection" || id === "autoAddDependencies") continue;
      const el = document.getElementById(id);
      if (el && "value" in el) el.value = val ?? "";
    }

    if (document.getElementById("autoAddDependencies")) byId("autoAddDependencies").checked = s.autoAddDependencies ?? true;

    byId("regenFromMood").checked = !!s.regenFromMood;
    byId("regenFromPain").checked = !!s.regenFromPain;
    byId("regenFromSunlight").checked = !!s.regenFromSunlight;
    byId("regenFromPsyfocus").checked = !!s.regenFromPsyfocus;
    byId("regenFromNearbyAllies").checked = !!s.regenFromNearbyAllies;

      byId("enableSelection").value = s.enableSelection ? "yes" : "no";
      byId("excludeIfHasAnyLanternRing").value = s.excludeIfHasAnyLanternRing ? "true" : "false";

      if (document.getElementById("gearBodyPartGroupList")) writeGearBodyPartGroups(s.gearBodyPartGroups ?? []);
      if (document.getElementById("gearLayerList")) writeGearLayers(s.gearLayers ?? []);
      if (document.getElementById("gearTagList")) writeGearTags(s.gearTags ?? []);

      if (document.getElementById("enableDiscoveryEvent")) {
        byId("enableDiscoveryEvent").value = s.enableDiscoveryEvent ? "yes" : "no";
        byId("discoverySendLetter").value = s.discoverySendLetter === false ? "no" : "yes";
        byId("discoveryAliveDowned").value = s.discoveryAliveDowned === false ? "false" : "true";
        byId("discoverySpawnPawnsInDropPods").value = s.discoverySpawnPawnsInDropPods === false ? "false" : "true";
        byId("discoverySpawnCrashDebris").value = s.discoverySpawnCrashDebris === false ? "false" : "true";
        byId("discoveryTargetType").value = s.discoveryTargetType || "WorldSite";
        byId("discoveryMapDropPreferColony").checked = s.discoveryMapDropPreferColony ?? true;
        if (document.getElementById("discoveryTargetTags")) {
          const tags = Array.isArray(s.discoveryTargetTags) ? s.discoveryTargetTags : parseCsvList(s.discoveryTargetTags || "");
          byId("discoveryTargetTags").value = tags.join(", ");
        }
      }

    if (document.getElementById("enableTimedIncident")) {
      byId("enableTimedIncident").value = s.enableTimedIncident ? "yes" : "no";
      byId("timedIncidentFireOnce").value = s.timedIncidentFireOnce === false ? "no" : "yes";
      byId("timedIncidentForce").value = s.timedIncidentForce === false ? "no" : "yes";
      byId("timedIncidentTarget").value = s.timedIncidentTarget || "PlayerHomeMap";
    }

    if (document.getElementById("sel_allowColonists")) {
      byId("sel_allowColonists").checked = s.sel_allowColonists ?? true;
      byId("sel_allowPrisoners").checked = s.sel_allowPrisoners ?? false;
      byId("sel_allowSlaves").checked = s.sel_allowSlaves ?? false;
      byId("sel_allowGuests").checked = s.sel_allowGuests ?? false;
      byId("sel_allowAnimals").checked = s.sel_allowAnimals ?? false;
      byId("sel_allowMechs").checked = s.sel_allowMechs ?? false;
      byId("sel_allowHostiles").checked = s.sel_allowHostiles ?? false;
      byId("sel_allowDead").checked = s.sel_allowDead ?? false;
      byId("sel_allowDowned").checked = s.sel_allowDowned ?? false;
      byId("sel_requireViolenceCapable").checked = s.sel_requireViolenceCapable ?? true;
      writeSelectionConditions(s.sel_conditions ?? []);
    }

    if (document.getElementById("enableCostume")) {
      byId("enableCostume").value = s.enableCostume ? "yes" : "no";
      byId("associatedHediff").value = s.associatedHediff ?? "";

      if (document.getElementById("transformationAllowMaleGender")) byId("transformationAllowMaleGender").checked = s.transformationAllowMaleGender ?? true;
      if (document.getElementById("transformationAllowFemaleGender")) byId("transformationAllowFemaleGender").checked = s.transformationAllowFemaleGender ?? true;
      if (document.getElementById("transformationAllowNoneGender")) byId("transformationAllowNoneGender").checked = s.transformationAllowNoneGender ?? true;
      if (document.getElementById("transformationDisallowBodyTypeThin")) byId("transformationDisallowBodyTypeThin").checked = !!s.transformationDisallowBodyTypeThin;
      if (document.getElementById("transformationDisallowBodyTypeFat")) byId("transformationDisallowBodyTypeFat").checked = !!s.transformationDisallowBodyTypeFat;
      if (document.getElementById("transformationDisallowBodyTypeHulk")) byId("transformationDisallowBodyTypeHulk").checked = !!s.transformationDisallowBodyTypeHulk;

      byId("transformationOnlyWhenDrafted").checked = !!s.transformationOnlyWhenDrafted;
      byId("transformationSkipConflictingApparel").checked = !!s.transformationSkipConflictingApparel;
      if (document.getElementById("transformationMissingGraphicBehavior"))
        byId("transformationMissingGraphicBehavior").value = s.transformationMissingGraphicBehavior ?? "none";
      if (document.getElementById("transformationToggleGizmo")) byId("transformationToggleGizmo").value = s.transformationToggleGizmo ? "yes" : "no";
      if (document.getElementById("transformationToggleDefaultOn"))
        byId("transformationToggleDefaultOn").value = s.transformationToggleDefaultOn === false ? "no" : "yes";
      if (document.getElementById("transformationOverrideBodyType")) byId("transformationOverrideBodyType").value = s.transformationOverrideBodyType ? "yes" : "no";
      if (document.getElementById("transformationOverrideBodyTypeOnlyIfMissing"))
        byId("transformationOverrideBodyTypeOnlyIfMissing").value = s.transformationOverrideBodyTypeOnlyIfMissing === false ? "no" : "yes";
      if (document.getElementById("transformationBodyTypeOverride")) {
        const builtin = ["Male", "Female", "Thin", "Fat", "Hulk"];
        const v = String(s.transformationBodyTypeOverride ?? "Male");
        byId("transformationBodyTypeOverride").value = builtin.includes(v) ? v : "custom";
        if (document.getElementById("transformationBodyTypeOverrideCustom")) byId("transformationBodyTypeOverrideCustom").value = builtin.includes(v) ? "" : v;
      }
      byId("allowBatteryManifest").checked = !!s.allowBatteryManifest;
      byId("batteryDef").value = s.batteryDef ?? "";
      byId("batteryManifestCost").value = String(s.batteryManifestCost ?? "0.5");
      writeExistingCostumeList(s.costume_existingApparel ?? []);
      writeGeneratedCostumeList(s.costume_generatedApparel ?? []);
      if (document.getElementById("statBuffList")) writeStatBuffs(s.statBuffs ?? []);
    }

    if (document.getElementById("enableStealth")) {
      byId("enableStealth").value = s.enableStealth ? "yes" : "no";
      byId("stealthHediff").value = s.stealthHediff ?? "";
      byId("stealthToggleGizmo").value = s.stealthToggleGizmo === false ? "no" : "yes";
      byId("stealthDefaultOn").value = s.stealthDefaultOn ? "yes" : "no";
      byId("stealthBreakOnAttack").value = s.stealthBreakOnAttack ? "true" : "false";
      byId("stealthPreventTargeting").value = s.stealthPreventTargeting === false ? "false" : "true";
      byId("stealthGizmoIconPath").value = s.stealthGizmoIconPath ?? "";
      byId("stealthGizmoLabelKey").value = s.stealthGizmoLabelKey ?? "";
      byId("stealthGizmoDescKey").value = s.stealthGizmoDescKey ?? "";
      byId("stealthShowEnergyGizmo").value = s.stealthShowEnergyGizmo ? "true" : "false";
      byId("stealthEnergyLabel").value = s.stealthEnergyLabel ?? "Stealth";
      byId("stealthEnergyColor").value = s.stealthEnergyColor ?? "(0.2, 0.6, 0.8, 1)";
      byId("stealthEnergyMax").value = String(s.stealthEnergyMax ?? 1);
      byId("stealthEnergyStartPercent").value = String(s.stealthEnergyStartPercent ?? 1);
      byId("stealthEnergyDrainPerSecond").value = String(s.stealthEnergyDrainPerSecond ?? 0);
      byId("stealthEnergyRegenPerDay").value = String(s.stealthEnergyRegenPerDay ?? 1);
      writeStealthSeeThroughPawnKinds(s.stealthSeeThroughPawnKinds ?? []);
      writeStealthSeeThroughHediffs(s.stealthSeeThroughHediffs ?? []);
    }

    if (document.getElementById("corruptionHediff")) {
      byId("corruptionHediff").value = s.corruptionHediff ?? "";
      byId("corruptionInitialSeverity").value = String(s.corruptionInitialSeverity ?? 0.01);
      byId("corruptionGainPerDay").value = String(s.corruptionGainPerDay ?? 0.05);
      byId("corruptionTickIntervalSeconds").value = String(s.corruptionTickIntervalSeconds ?? 1);
      byId("corruptionStealthMultiplier").value = String(s.corruptionStealthMultiplier ?? 1);
      byId("attentionMultiplier").value = String(s.attentionMultiplier ?? 1);
      writeCorruptionMentalStates(s.corruptionMentalStates ?? []);
    }

    if (document.getElementById("ambientInfluenceEnabled")) {
      byId("ambientInfluenceEnabled").value = s.ambientInfluenceEnabled ? "yes" : "no";
      byId("ambientInfluenceHediff").value = s.ambientInfluenceHediff ?? "";
      byId("ambientInfluenceOnlyWhenUnworn").value = s.ambientInfluenceOnlyWhenUnworn === false ? "false" : "true";
      byId("ambientInfluenceOnlyWhenBuried").value = s.ambientInfluenceOnlyWhenBuried ? "true" : "false";
      byId("ambientInfluenceSkipWearers").value = s.ambientInfluenceSkipWearers === false ? "false" : "true";
      byId("ambientInfluenceAffectsColonistsOnly").value = s.ambientInfluenceAffectsColonistsOnly === false ? "false" : "true";
      byId("ambientInfluenceAffectsHumanlikeOnly").value = s.ambientInfluenceAffectsHumanlikeOnly === false ? "false" : "true";
      byId("ambientInfluenceRadius").value = String(s.ambientInfluenceRadius ?? 0);
      byId("ambientInfluenceIntervalSeconds").value = String(s.ambientInfluenceIntervalSeconds ?? 4);
      byId("ambientInfluenceInitialSeverity").value = String(s.ambientInfluenceInitialSeverity ?? 0.02);
      byId("ambientInfluenceSeverityPerTick").value = String(s.ambientInfluenceSeverityPerTick ?? 0.002);
      byId("ambientInfluenceBreakThreshold").value = String(s.ambientInfluenceBreakThreshold ?? 0.8);
      byId("ambientInfluenceBreakChance").value = String(s.ambientInfluenceBreakChance ?? 0.05);
      byId("ambientInfluenceMentalState").value = s.ambientInfluenceMentalState ?? "";
    }

    if (document.getElementById("wearerInfluenceEnabled")) {
      byId("wearerInfluenceEnabled").value = s.wearerInfluenceEnabled ? "yes" : "no";
      byId("wearerInfluenceHediff").value = s.wearerInfluenceHediff ?? "";
      byId("wearerInfluenceAffectsColonistsOnly").value = s.wearerInfluenceAffectsColonistsOnly ? "true" : "false";
      byId("wearerInfluenceAffectsHumanlikeOnly").value = s.wearerInfluenceAffectsHumanlikeOnly === false ? "false" : "true";
      byId("wearerInfluenceSkipWearer").value = s.wearerInfluenceSkipWearer === false ? "false" : "true";
      byId("wearerInfluenceRadius").value = String(s.wearerInfluenceRadius ?? 10);
      byId("wearerInfluenceIntervalSeconds").value = String(s.wearerInfluenceIntervalSeconds ?? 4);
      byId("wearerInfluenceInitialSeverity").value = String(s.wearerInfluenceInitialSeverity ?? 0.05);
      byId("wearerInfluenceSeverityPerTick").value = String(s.wearerInfluenceSeverityPerTick ?? 0.01);
      byId("wearerInfluenceBreakThreshold").value = String(s.wearerInfluenceBreakThreshold ?? 0.8);
      byId("wearerInfluenceBreakChance").value = String(s.wearerInfluenceBreakChance ?? 0.05);
      byId("wearerInfluenceMentalState").value = s.wearerInfluenceMentalState ?? "";
      writeWearerInfluenceTraitModifiers(s.wearerInfluenceTraitModifiers ?? []);
    }

    if (document.getElementById("autoEquipEnabled")) {
      byId("autoEquipEnabled").value = s.autoEquipEnabled ? "yes" : "no";
      byId("autoEquipChance").value = String(s.autoEquipChance ?? 1);
      byId("autoEquipScoreBonus").value = String(s.autoEquipScoreBonus ?? 0);
      byId("autoEquipAllowDrafted").checked = s.autoEquipAllowDrafted ?? false;
      writeAutoEquipTraitBonuses(s.autoEquipTraitBonuses ?? []);
      writeAutoEquipHediffBonuses(s.autoEquipHediffBonuses ?? []);
    }

    if (document.getElementById("refuseRemoval")) {
      byId("refuseRemoval").value = s.refuseRemoval ? "yes" : "no";
      byId("refuseRemovalHediff").value = s.refuseRemovalHediff ?? "";
      byId("refuseRemovalMinSeverity").value = String(s.refuseRemovalMinSeverity ?? 0.5);
      byId("refuseRemovalMessageKey").value = s.refuseRemovalMessageKey ?? "Lantern_RefuseRemoval";
      byId("forceDropOnWearerDeath").checked = s.forceDropOnWearerDeath ?? false;
      byId("forceDropOnCorpseDestroy").checked = s.forceDropOnCorpseDestroy ?? false;
      byId("forceDropOnGraveEject").checked = s.forceDropOnGraveEject ?? false;
    }

    const picks = new Set((s.abilities ?? []).map((a) => a.key));
    qsa('input[type="checkbox"][data-ability]').forEach((cb) => {
      cb.checked = picks.has(cb.dataset.ability);
    });
    rebuildAbilityEditors(s.abilities ?? []);
    return true;
  } catch {
    return false;
  }
}

function rebuildAbilityEditors(existing = []) {
  const container = byId("abilityEditors");
  container.innerHTML = "";

  const enabled = qsa('input[type="checkbox"][data-ability]')
    .filter((cb) => cb.checked)
    .map((cb) => cb.dataset.ability);

  enabled.forEach((key) => {
    const editor = buildAbilityEditor(key);
    const match = existing.find((x) => x.key === key);
    if (match) {
      editor.querySelectorAll("[data-field]").forEach((el) => {
        const k = el.dataset.field;
        if (!(k in match)) return;
        el.value = String(match[k] ?? "");
      });
    } else {
      editor.querySelector('[data-field="cost"]').value = "0.05";
      const pause = editor.querySelector('[data-field="pauseOnClick"]');
      if (pause) pause.value = "false";
      const range = editor.querySelector('[data-field="range"]');
      if (range) range.value = "";
      const cd = editor.querySelector('[data-field="cooldownTicks"]');
      if (cd) cd.value = "0";
      const lim = editor.querySelector('[data-field="maxCastsPerDay"]');
      if (lim) lim.value = "0";
      const tr = editor.querySelector('[data-field="targetRule"]');
      if (tr) tr.value = "Any";
      if (key === "Heal") {
        editor.querySelector('[data-field="healAmount"]').value = "10";
        editor.querySelector('[data-field="radius"]').value = "0";
      }
      if (key === "Stun") {
        editor.querySelector('[data-field="stunTicks"]').value = "180";
        editor.querySelector('[data-field="radius"]').value = "0";
        editor.querySelector('[data-field="affectHostilesOnly"]').value = "true";
      }
      if (key === "Barrier") {
        editor.querySelector('[data-field="shieldMaxHp"]').value = "200";
        editor.querySelector('[data-field="radius"]').value = "0";
      }
      if (key === "Aura") {
        editor.querySelector('[data-field="severity"]').value = "0.12";
        editor.querySelector('[data-field="radius"]').value = "6";
        editor.querySelector('[data-field="durationTicks"]').value = "6000";
      }
      if (key === "Construct") {
        editor.querySelector('[data-field="thingDef"]').value = "Sandbags";
        editor.querySelector('[data-field="spawnCount"]').value = "1";
        editor.querySelector('[data-field="durationTicks"]').value = "6000";
      }
      if (key === "Summon") {
        editor.querySelector('[data-field="pawnKind"]').value = "";
        editor.querySelector('[data-field="count"]').value = "1";
        editor.querySelector('[data-field="durationTicks"]').value = "6000";
      }
      if (key === "Teleport") {
        editor.querySelector('[data-field="allowRoofed"]').value = "true";
        editor.querySelector('[data-field="allowOccupied"]').value = "false";
        editor.querySelector('[data-field="spawnGasAtOrigin"]').value = "false";
        editor.querySelector('[data-field="spawnGasAtDestination"]').value = "false";
        editor.querySelector('[data-field="gasType"]').value = "BlindSmoke";
        editor.querySelector('[data-field="gasRadius"]').value = "2.4";
        editor.querySelector('[data-field="gasAmount"]').value = "60";
        editor.querySelector('[data-field="gasDurationTicks"]').value = "0";
      }
      if (key === "Conditional") {
        editor.querySelector('[data-field="fleshOutcome"]').value = "Down";
        editor.querySelector('[data-field="mechOutcome"]').value = "Kill";
        editor.querySelector('[data-field="anomalyOutcome"]').value = "Kill";
        editor.querySelector('[data-field="otherOutcome"]').value = "None";
        // This ability is typically melee-range.
        const r = editor.querySelector('[data-field="range"]');
        if (r) r.value = "1.9";
      }
      if (key === "Displace") {
        editor.querySelector('[data-field="distance"]').value = "4";
        editor.querySelector('[data-field="pullTowardsCaster"]').value = "false";
        editor.querySelector('[data-field="requireLineOfSight"]').value = "false";
      }
    }
    container.appendChild(editor);
  });
}

function validate(state) {
  const issues = [];

  if (!state.modName) issues.push("Mod name is required.");
  if (!state.packageId) issues.push("PackageId is required.");
  if (state.packageId && !isValidPackageId(state.packageId)) issues.push("PackageId should be lowercase letters/numbers/dots (e.g. yourname.myherogear).");

  for (const p of parseExtraDependencies(state.extraDependencies)) {
    if (!isValidDependencyPackageId(p)) issues.push(`Extra dependency packageId is invalid: ${p}`);
  }

  if (!state.ringDefName) issues.push("Ring defName is required.");
  if (state.ringDefName && !isValidDefName(state.ringDefName)) issues.push("Ring defName must be a valid RimWorld defName (letters/numbers/_ and must start with a letter).");
    if (!state.ringLabel) issues.push("Ring label is required.");
    if (!state.ringColor) issues.push("Ring color is required (e.g. (1, 0, 0, 1)).");
    if (!state.resourceLabel) issues.push("Resource label is required.");
    if (!state.ringTexPath) issues.push("Ring texPath is required (no extension).");
    if (state.flammability != null && (state.flammability < 0 || state.flammability > 1))
      issues.push("Flammability must be between 0 and 1.");
    if (state.equipDelay != null && state.equipDelay < 0) issues.push("Equip delay must be >= 0.");
    if (state.deteriorationRate != null && state.deteriorationRate < 0) issues.push("Deterioration rate must be >= 0.");
    for (const defName of state.gearBodyPartGroups || []) {
      if (!isValidDefName(defName)) issues.push(`BodyPartGroupDef invalid: ${defName}`);
    }
    for (const defName of state.gearLayers || []) {
      if (!isValidDefName(defName)) issues.push(`Apparel layer invalid: ${defName}`);
    }
    for (const defName of state.gearTags || []) {
      if (!isValidDefName(defName)) issues.push(`Apparel tag invalid: ${defName}`);
    }

  if (state.gearParent === "custom") {
    if (!state.gearParentCustom) issues.push("Custom ParentName is required when Gear template is Custom.");
  }

  if (!Number.isFinite(state.maxCharge) || state.maxCharge <= 0) issues.push("Max charge must be > 0.");
  if (state.passiveRegenPerDay < 0) issues.push("Passive regen per day must be >= 0.");
  if (state.passiveDrainPerDay < 0) issues.push("Passive drain per day must be >= 0.");

  if (state.abilities.length === 0) issues.push("Select at least one ability (Abilities tab).");

  for (const a of state.abilities) {
    if (!a.defName) issues.push(`Ability ${a.key}: defName required.`);
    if (a.defName && !isValidDefName(a.defName)) issues.push(`Ability ${a.key}: defName is not valid.`);
    if (!a.iconPath) issues.push(`Ability ${a.key}: iconPath required.`);
    if (a.key !== "Flight" && (!Number.isFinite(a.cost) || a.cost < 0 || a.cost > 1)) issues.push(`Ability ${a.key}: cost must be 0..1.`);

    if (a.key === "Summon" && !a.pawnKind) issues.push("Ability Summon: pawnKind is required.");
    if (a.key === "Construct" && !a.thingDef) issues.push("Ability Construct: thingDef is required.");
  }

  if (state.enableSelection) {
    if (!state.selectionDefName) issues.push("Selection defName required if selection is enabled.");
    if (state.selectionDefName && !isValidDefName(state.selectionDefName)) issues.push("Selection defName is not valid.");
  }

  if (state.enableDiscoveryEvent) {
    if (!state.discoveryIncidentDefName) issues.push("Discovery event: incident defName is required.");
    if (state.discoveryIncidentDefName && !isValidDefName(state.discoveryIncidentDefName))
      issues.push("Discovery event: incident defName is not valid.");
      if (!state.discoveryIncidentCategory) issues.push("Discovery event: incident category is required.");
      if (state.discoveryIncidentCategory && !isValidDefName(state.discoveryIncidentCategory))
        issues.push("Discovery event: incident category is not a valid defName.");
      if (!Number.isFinite(state.discoveryIncidentBaseChance) || state.discoveryIncidentBaseChance < 0)
        issues.push("Discovery event: base chance must be >= 0.");
      if (state.discoveryMinRefireDays != null && state.discoveryMinRefireDays < 0)
        issues.push("Discovery event: min refire days must be >= 0.");
      if (!new Set(["default", "true", "false"]).has(state.discoveryPointsScaleable || "default"))
        issues.push("Discovery event: points scaleable must be default/true/false.");
      if (!Number.isFinite(state.discoverySiteTimeoutDays) || state.discoverySiteTimeoutDays < 0)
        issues.push("Discovery event: timeout days must be >= 0.");
    if (!Number.isFinite(state.discoveryMinDistanceTiles) || state.discoveryMinDistanceTiles < 0)
      issues.push("Discovery event: min distance must be >= 0.");
    if (!Number.isFinite(state.discoveryMaxDistanceTiles) || state.discoveryMaxDistanceTiles < 0)
      issues.push("Discovery event: max distance must be >= 0.");
    if (!Number.isFinite(state.discoveryMapDropRadius) || state.discoveryMapDropRadius < 0)
      issues.push("Discovery event: map drop radius must be >= 0.");
    if (state.discoveryMinDistanceTiles > state.discoveryMaxDistanceTiles)
      issues.push("Discovery event: min distance must be <= max distance.");
    if (!Number.isFinite(state.discoveryGearCount) || state.discoveryGearCount < 1)
      issues.push("Discovery event: gear count must be >= 1.");

    const aliveMax = Math.max(0, Number(state.discoveryAliveMax || 0));
    const deadMax = Math.max(0, Number(state.discoveryDeadMax || 0));
    if (Number(state.discoveryAliveMin || 0) > Number(state.discoveryAliveMax || 0))
      issues.push("Discovery event: alive min must be <= alive max.");
    if (Number(state.discoveryDeadMin || 0) > Number(state.discoveryDeadMax || 0))
      issues.push("Discovery event: dead min must be <= dead max.");
    if ((aliveMax > 0 || deadMax > 0) && !state.discoveryPawnKind)
      issues.push("Discovery event: pawnKind is required when spawning pawns.");
      if (state.discoveryPawnKind && !isValidDefName(state.discoveryPawnKind))
        issues.push("Discovery event: pawnKind is not a valid defName.");
      if (state.discoveryPawnFaction && !isValidDefName(state.discoveryPawnFaction))
        issues.push("Discovery event: pawnFaction is not a valid defName.");
      if (state.discoveryLetterDef && !isValidDefName(state.discoveryLetterDef))
        issues.push("Discovery event: letterDef is not a valid defName.");
      const targetTags = Array.isArray(state.discoveryTargetTags)
        ? state.discoveryTargetTags
        : parseCsvList(state.discoveryTargetTags || "");
      for (const tag of targetTags) {
        if (!isValidDefName(tag)) issues.push(`Discovery event: target tag is not valid: ${tag}`);
      }
      if ((state.discoveryGearPlacement === "PawnWorn" || state.discoveryGearPlacement === "PawnInventory") && aliveMax + deadMax <= 0)
        issues.push("Discovery event: pawn gear placement requires alive/dead pawn counts.");
    }

  if (state.enableTimedIncident) {
    if (!state.enableDiscoveryEvent) issues.push("Timed incident requires discovery event to be enabled.");
    if (!Number.isFinite(state.timedIncidentMinDays) || state.timedIncidentMinDays < 0) issues.push("Timed incident: min days must be >= 0.");
    if (!Number.isFinite(state.timedIncidentMaxDays) || state.timedIncidentMaxDays < 0) issues.push("Timed incident: max days must be >= 0.");
    if (
      Number.isFinite(state.timedIncidentMinDays) &&
      Number.isFinite(state.timedIncidentMaxDays) &&
      state.timedIncidentMinDays > state.timedIncidentMaxDays
    ) {
      issues.push("Timed incident: min days must be <= max days.");
    }
    if (!Number.isFinite(state.timedIncidentRetryHours) || state.timedIncidentRetryHours < 0) {
      issues.push("Timed incident: retry hours must be >= 0.");
    }
    const allowedTargets = new Set(["PlayerHomeMap", "CurrentMap", "AnyPlayerMap", "World"]);
    if (!allowedTargets.has(state.timedIncidentTarget)) issues.push("Timed incident: target is invalid.");
  }

  if (state.associatedHediff && !isValidDefName(state.associatedHediff)) issues.push("Associated hediff must be a valid defName.");

  if (state.allowBatteryManifest) {
    if (!state.batteryDef) issues.push("Battery manifest enabled: battery ThingDef is required.");
    if (!Number.isFinite(state.batteryManifestCost) || state.batteryManifestCost < 0 || state.batteryManifestCost > 1)
      issues.push("Battery manifest cost must be 0..1.");
  }

  if (state.enableStealth) {
    if (!state.stealthHediff || !isValidDefName(state.stealthHediff)) issues.push("Stealth enabled: Stealth HediffDef is required.");
    if (!Number.isFinite(state.stealthEnergyMax) || state.stealthEnergyMax <= 0) issues.push("Stealth energy max must be > 0.");
    if (!Number.isFinite(state.stealthEnergyStartPercent) || state.stealthEnergyStartPercent < 0 || state.stealthEnergyStartPercent > 1)
      issues.push("Stealth start energy must be 0..1.");
  }

  if ((state.corruptionGainPerDay > 0 || (state.corruptionMentalStates || []).length) && !state.corruptionHediff) {
    issues.push("Influence settings require an Influence HediffDef.");
  }

  if (state.ambientInfluenceEnabled) {
    if (!state.ambientInfluenceHediff || !isValidDefName(state.ambientInfluenceHediff)) {
      issues.push("Ambient influence enabled: HediffDef is required.");
    }
  }

  if (state.wearerInfluenceEnabled) {
    if (!state.wearerInfluenceHediff || !isValidDefName(state.wearerInfluenceHediff)) {
      issues.push("Wearer influence enabled: HediffDef is required.");
    }
  }
  if (state.wearerInfluenceMentalState && !isValidDefName(state.wearerInfluenceMentalState)) {
    issues.push("Wearer influence: MentalStateDef is not valid.");
  }

  if (state.refuseRemoval && state.refuseRemovalHediff && !isValidDefName(state.refuseRemovalHediff)) {
    issues.push("Refuse removal: HediffDef must be a valid defName.");
  }

  for (const defName of state.stealthSeeThroughPawnKinds || []) {
    if (!isValidDefName(defName)) issues.push(`Stealth see-through PawnKindDef invalid: ${defName}`);
  }
  for (const defName of state.stealthSeeThroughHediffs || []) {
    if (!isValidDefName(defName)) issues.push(`Stealth see-through HediffDef invalid: ${defName}`);
  }
  for (const it of state.corruptionMentalStates || []) {
    if (!it?.mentalState || !isValidDefName(it.mentalState)) issues.push("Influence mental state: MentalStateDef is missing/invalid.");
  }
  for (const it of state.autoEquipTraitBonuses || []) {
    if (!it?.trait || !isValidDefName(it.trait)) issues.push("Auto-equip trait bonus: TraitDef is missing/invalid.");
  }
  for (const it of state.wearerInfluenceTraitModifiers || []) {
    if (!it?.trait || !isValidDefName(it.trait)) issues.push("Wearer influence trait modifier: TraitDef is missing/invalid.");
  }
  for (const it of state.autoEquipHediffBonuses || []) {
    if (!it?.hediff || !isValidDefName(it.hediff)) issues.push("Auto-equip hediff bonus: HediffDef is missing/invalid.");
  }

  for (const sb of state.statBuffs || []) {
    if (!sb?.stat || !isValidDefName(sb.stat)) issues.push("Stat buff: StatDef is missing/invalid.");
    if (!Number.isFinite(Number(sb.offset))) issues.push(`Stat buff ${sb?.stat || "(missing StatDef)"}: offset must be a number.`);
  }

  if (state.transformationOverrideBodyType) {
    if (!state.transformationBodyTypeOverride || !isValidDefName(state.transformationBodyTypeOverride)) {
      issues.push("Body type override enabled: BodyTypeDef must be a valid defName.");
    }
  }

  if (!state.enableCostume && state.transformationToggleGizmo) {
    issues.push("Transformation toggle gizmo requires costume transformation to be enabled.");
  }

  if (state.enableCostume) {
    const allCostume = collectTransformationApparel(state);
    if (allCostume.length === 0) issues.push("Costume enabled: add at least one apparel defName (existing or generated).");

    for (const app of state.costume_generatedApparel || []) {
      if (!app.defName || !isValidDefName(app.defName)) issues.push("Generated apparel: defName is missing/invalid.");
      if (!app.texPath) issues.push(`Generated apparel ${app.defName || "(missing defName)"}: texPath required.`);
      if (!Array.isArray(app.layers) || app.layers.length === 0) issues.push(`Generated apparel ${app.defName}: at least one layer required.`);
      if (!Array.isArray(app.bodyParts) || app.bodyParts.length === 0) issues.push(`Generated apparel ${app.defName}: at least one bodyPartGroup required.`);
    }
  }

  return issues;
}

function buildTextureChecklist(state) {
  const required = [];

  const gearClass = state.gearGraphicClass || "Graphic_Single";
  if (gearClass === "Graphic_Multi") {
    required.push(`Textures/${state.ringTexPath}_north.png`);
    required.push(`Textures/${state.ringTexPath}_south.png`);
    required.push(`Textures/${state.ringTexPath}_east.png`);
  } else {
    required.push(`Textures/${state.ringTexPath}.png`);
  }
  for (const a of state.abilities) {
    required.push(`Textures/${a.iconPath}.png`);
  }
  for (const app of state.costume_generatedApparel || []) {
    if (!app?.texPath) continue;
    required.push(`Textures/${app.texPath}_north.png`);
    required.push(`Textures/${app.texPath}_south.png`);
    required.push(`Textures/${app.texPath}_east.png`);
  }
  if (state.enableStealth && state.stealthGizmoIconPath) {
    required.push(`Textures/${state.stealthGizmoIconPath}.png`);
  }
  // De-dup
  return Array.from(new Set(required)).sort();
}

function parseExtraDependencies(text) {
  const raw = String(text || "");
  const lines = raw
    .split(/\r?\n/g)
    .map((x) => x.trim())
    .filter(Boolean);
  return uniqueSorted(lines);
}

function resolveDependencyDisplayName(packageId) {
  const index = getOrCreateIndex();
  const name = index?.packageMeta?.[packageId]?.displayName;
  return name || packageId;
}

function referencedDefsForDependencies(state) {
  const refs = [];

  if (state.allowBatteryManifest && state.batteryDef) refs.push({ type: "ThingDef", defName: state.batteryDef });
  if (state.associatedHediff) refs.push({ type: "HediffDef", defName: state.associatedHediff });
  if (state.enableStealth && state.stealthHediff) refs.push({ type: "HediffDef", defName: state.stealthHediff });
  if (state.corruptionHediff) refs.push({ type: "HediffDef", defName: state.corruptionHediff });
  if (state.ambientInfluenceHediff) refs.push({ type: "HediffDef", defName: state.ambientInfluenceHediff });
  if (state.wearerInfluenceHediff) refs.push({ type: "HediffDef", defName: state.wearerInfluenceHediff });
  if (state.refuseRemovalHediff) refs.push({ type: "HediffDef", defName: state.refuseRemovalHediff });
  if (state.ambientInfluenceMentalState) refs.push({ type: "MentalStateDef", defName: state.ambientInfluenceMentalState });
  if (state.wearerInfluenceMentalState) refs.push({ type: "MentalStateDef", defName: state.wearerInfluenceMentalState });

  if (state.enableDiscoveryEvent) {
    if (state.discoveryPawnKind) refs.push({ type: "PawnKindDef", defName: state.discoveryPawnKind });
    if (state.discoveryPawnFaction) refs.push({ type: "FactionDef", defName: state.discoveryPawnFaction });
    if (state.discoveryCrashChunkDef) refs.push({ type: "ThingDef", defName: state.discoveryCrashChunkDef });
    if (state.discoveryCrashDebrisDef) refs.push({ type: "ThingDef", defName: state.discoveryCrashDebrisDef });
    if (state.discoveryLetterDef) refs.push({ type: "LetterDef", defName: state.discoveryLetterDef });
  }

  for (const a of state.abilities || []) {
    if (a?.key === "Summon" && a.pawnKind) refs.push({ type: "PawnKindDef", defName: a.pawnKind });
    if (a?.key === "Construct" && a.thingDef) refs.push({ type: "ThingDef", defName: a.thingDef });
  }

  for (const defName of state.stealthSeeThroughPawnKinds || []) {
    if (defName) refs.push({ type: "PawnKindDef", defName });
  }
  for (const defName of state.stealthSeeThroughHediffs || []) {
    if (defName) refs.push({ type: "HediffDef", defName });
  }
  for (const it of state.corruptionMentalStates || []) {
    if (it?.mentalState) refs.push({ type: "MentalStateDef", defName: it.mentalState });
  }
  for (const it of state.autoEquipTraitBonuses || []) {
    if (it?.trait) refs.push({ type: "TraitDef", defName: it.trait });
  }
  for (const it of state.wearerInfluenceTraitModifiers || []) {
    if (it?.trait) refs.push({ type: "TraitDef", defName: it.trait });
  }
  for (const it of state.autoEquipHediffBonuses || []) {
    if (it?.hediff) refs.push({ type: "HediffDef", defName: it.hediff });
  }

  for (const defName of state.costume_existingApparel || []) {
    if (defName) refs.push({ type: "ApparelDef", defName });
  }

  for (const c of state.sel_conditions || []) {
    const t = c?.type;
    const d = c?.def;
    if (!d) continue;
    if (t === "Trait") refs.push({ type: "TraitDef", defName: d });
    if (t === "Stat") refs.push({ type: "StatDef", defName: d });
    if (t === "Skill") refs.push({ type: "SkillDef", defName: d });
    if (t === "Need") refs.push({ type: "NeedDef", defName: d });
    if (t === "Thought") refs.push({ type: "ThoughtDef", defName: d });
    if (t === "Record") refs.push({ type: "RecordDef", defName: d });
  }

  return refs;
}

function computeDependencies(state) {
  const deps = new Map();

  // Always depend on LanternsCore.
  deps.set("DrAke.LanternsCore", "Lantern Core Framework");

  // Manual overrides.
  for (const p of parseExtraDependencies(state.extraDependencies)) {
    if (p === "DrAke.LanternsCore") continue;
    if (!isValidDependencyPackageId(p)) continue;
    deps.set(p, resolveDependencyDisplayName(p));
  }

  if (!state.autoAddDependencies) {
    return Array.from(deps.entries())
      .map(([packageId, displayName]) => ({ packageId, displayName }))
      .sort((a, b) => a.packageId.localeCompare(b.packageId));
  }

  const index = getOrCreateIndex();
  const origins = index?.defOrigins || {};

  for (const r of referencedDefsForDependencies(state)) {
    const pkg = origins?.[r.type]?.[r.defName];
    if (pkg && !shouldIgnorePackageIdForDependency(pkg) && pkg !== state.packageId) {
      deps.set(pkg, resolveDependencyDisplayName(pkg));
      continue;
    }

    // Costume defs are often ThingDefs with <apparel/>; allow fallback lookup.
    if (r.type === "ApparelDef") {
      const pkg2 = origins?.ThingDef?.[r.defName];
      if (pkg2 && !shouldIgnorePackageIdForDependency(pkg2) && pkg2 !== state.packageId) deps.set(pkg2, resolveDependencyDisplayName(pkg2));
    }
  }

  return Array.from(deps.entries())
    .map(([packageId, displayName]) => ({ packageId, displayName }))
    .sort((a, b) => a.packageId.localeCompare(b.packageId));
}

function buildAboutXml(state) {
  const desc = state.modDesc || "";
  const deps = computeDependencies(state);
  const depXml =
    deps
      .map(
        (d) =>
          `    <li>\n` +
          `      <packageId>${escapeXml(d.packageId)}</packageId>\n` +
          `      <displayName>${escapeXml(d.displayName || d.packageId)}</displayName>\n` +
          `    </li>\n`
      )
      .join("") || "";

  const loadAfterXml =
    deps.map((d) => `    <li>${escapeXml(d.packageId)}</li>\n`).join("") || "";

  return `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<ModMetaData>\n` +
    `  <name>${escapeXml(state.modName)}</name>\n` +
    `  <author>${escapeXml(state.modAuthor || "unknown")}</author>\n` +
    `  <packageId>${escapeXml(state.packageId)}</packageId>\n` +
    `  <supportedVersions>\n` +
    `    <li>1.6</li>\n` +
    `  </supportedVersions>\n` +
    `  <description>${escapeXml(desc)}</description>\n` +
    `  <modDependencies>\n` +
    depXml +
    `  </modDependencies>\n` +
    `  <loadAfter>\n` +
    loadAfterXml +
    `  </loadAfter>\n` +
    `</ModMetaData>\n`;
}

function buildDefsXml(state) {
  const extLines = [];
  const extraDefs = [];

  extLines.push(`      <ringColor>${escapeXml(state.ringColor)}</ringColor>`);
  extLines.push(`      <resourceLabel>${escapeXml(state.resourceLabel)}</resourceLabel>`);
  if (state.showChargeGizmo === false) extLines.push(`      <showChargeGizmo>false</showChargeGizmo>`);

  if (state.maxCharge !== 1) extLines.push(`      <maxCharge>${state.maxCharge}</maxCharge>`);
  if (state.passiveRegenPerDay !== 0) extLines.push(`      <passiveRegenPerDay>${state.passiveRegenPerDay}</passiveRegenPerDay>`);
  if (state.passiveDrainPerDay !== 0) extLines.push(`      <passiveDrainPerDay>${state.passiveDrainPerDay}</passiveDrainPerDay>`);

  if (state.regenFromMood) {
    extLines.push(`      <regenFromMood>true</regenFromMood>`);
    extLines.push(`      <moodMin>${state.moodMin}</moodMin>`);
    extLines.push(`      <moodRegenPerDay>${state.moodRegenPerDay}</moodRegenPerDay>`);
  }
  if (state.regenFromPain) {
    extLines.push(`      <regenFromPain>true</regenFromPain>`);
    extLines.push(`      <painMin>${state.painMin}</painMin>`);
    extLines.push(`      <painRegenPerDay>${state.painRegenPerDay}</painRegenPerDay>`);
  }
  if (state.regenFromSunlight) {
    extLines.push(`      <regenFromSunlight>true</regenFromSunlight>`);
    extLines.push(`      <sunlightMinGlow>${state.sunlightMinGlow}</sunlightMinGlow>`);
    extLines.push(`      <sunlightRegenPerDay>${state.sunlightRegenPerDay}</sunlightRegenPerDay>`);
  }
  if (state.regenFromPsyfocus) {
    extLines.push(`      <regenFromPsyfocus>true</regenFromPsyfocus>`);
    extLines.push(`      <psyfocusMin>${state.psyfocusMin}</psyfocusMin>`);
    extLines.push(`      <psyfocusRegenPerDay>${state.psyfocusRegenPerDay}</psyfocusRegenPerDay>`);
  }
  if (state.regenFromNearbyAllies) {
    extLines.push(`      <regenFromNearbyAllies>true</regenFromNearbyAllies>`);
    extLines.push(`      <alliesRadius>${state.alliesRadius}</alliesRadius>`);
    extLines.push(`      <alliesMaxCount>${state.alliesMaxCount}</alliesMaxCount>`);
    extLines.push(`      <alliesRegenPerDayEach>${state.alliesRegenPerDayEach}</alliesRegenPerDayEach>`);
  }

  extLines.push(`      <abilities>`);
  for (const a of state.abilities) {
    extLines.push(`        <li>${escapeXml(a.defName)}</li>`);
  }
  extLines.push(`      </abilities>`);

  if (state.associatedHediff) extLines.push(`      <associatedHediff>${escapeXml(state.associatedHediff)}</associatedHediff>`);

  if (state.allowBatteryManifest) {
    extLines.push(`      <allowBatteryManifest>true</allowBatteryManifest>`);
    if (state.batteryDef) extLines.push(`      <batteryDef>${escapeXml(state.batteryDef)}</batteryDef>`);
    extLines.push(`      <batteryManifestCost>${toNum(state.batteryManifestCost, 0.5)}</batteryManifestCost>`);
  }

  if (state.reactiveEvadeProjectiles) {
    extLines.push(`      <reactiveEvadeProjectiles>true</reactiveEvadeProjectiles>`);
    extLines.push(`      <reactiveEvadeProjectilesCost>${toNum(state.reactiveEvadeProjectilesCost, 0.02)}</reactiveEvadeProjectilesCost>`);
    extLines.push(
      `      <reactiveEvadeProjectilesCooldownTicks>${Math.max(0, Math.floor(toNum(state.reactiveEvadeProjectilesCooldownTicks, 60)))}</reactiveEvadeProjectilesCooldownTicks>`
    );
    if (state.reactiveEvadeAllowExplosiveProjectiles)
      extLines.push(`      <reactiveEvadeAllowExplosiveProjectiles>true</reactiveEvadeAllowExplosiveProjectiles>`);
    if (state.reactiveEvadeToggleGizmo) extLines.push(`      <reactiveEvadeToggleGizmo>true</reactiveEvadeToggleGizmo>`);
    if (state.reactiveEvadeDefaultEnabled === false) extLines.push(`      <reactiveEvadeDefaultEnabled>false</reactiveEvadeDefaultEnabled>`);
    if (state.reactiveEvadeGasType) extLines.push(`      <reactiveEvadeGasType>${escapeXml(state.reactiveEvadeGasType)}</reactiveEvadeGasType>`);
    extLines.push(`      <reactiveEvadeGasRadius>${toNum(state.reactiveEvadeGasRadius, 2.4)}</reactiveEvadeGasRadius>`);
    extLines.push(`      <reactiveEvadeGasAmount>${Math.max(0, Math.floor(toNum(state.reactiveEvadeGasAmount, 60)))}</reactiveEvadeGasAmount>`);
  }

  if (state.enableStealth) {
    extLines.push(`      <stealthEnabled>true</stealthEnabled>`);
    if (state.stealthHediff) extLines.push(`      <stealthHediff>${escapeXml(state.stealthHediff)}</stealthHediff>`);
    if (state.stealthToggleGizmo === false) extLines.push(`      <stealthToggleGizmo>false</stealthToggleGizmo>`);
    if (state.stealthDefaultOn) extLines.push(`      <stealthDefaultOn>true</stealthDefaultOn>`);
    if (state.stealthBreakOnAttack) extLines.push(`      <stealthBreakOnAttack>true</stealthBreakOnAttack>`);
    if (state.stealthPreventTargeting === false) extLines.push(`      <stealthPreventTargeting>false</stealthPreventTargeting>`);
    if (state.stealthGizmoIconPath) extLines.push(`      <stealthGizmoIconPath>${escapeXml(state.stealthGizmoIconPath)}</stealthGizmoIconPath>`);
    if (state.stealthGizmoLabelKey) extLines.push(`      <stealthGizmoLabelKey>${escapeXml(state.stealthGizmoLabelKey)}</stealthGizmoLabelKey>`);
    if (state.stealthGizmoDescKey) extLines.push(`      <stealthGizmoDescKey>${escapeXml(state.stealthGizmoDescKey)}</stealthGizmoDescKey>`);
    if (state.stealthShowEnergyGizmo) extLines.push(`      <stealthShowEnergyGizmo>true</stealthShowEnergyGizmo>`);
    if (state.stealthEnergyLabel && state.stealthEnergyLabel !== "Stealth")
      extLines.push(`      <stealthEnergyLabel>${escapeXml(state.stealthEnergyLabel)}</stealthEnergyLabel>`);
    if (state.stealthEnergyColor) extLines.push(`      <stealthEnergyColor>${escapeXml(state.stealthEnergyColor)}</stealthEnergyColor>`);
    if (state.stealthEnergyMax !== 1) extLines.push(`      <stealthEnergyMax>${state.stealthEnergyMax}</stealthEnergyMax>`);
    if (state.stealthEnergyStartPercent !== 1)
      extLines.push(`      <stealthEnergyStartPercent>${state.stealthEnergyStartPercent}</stealthEnergyStartPercent>`);
    if (state.stealthEnergyDrainPerSecond !== 0)
      extLines.push(`      <stealthEnergyDrainPerSecond>${state.stealthEnergyDrainPerSecond}</stealthEnergyDrainPerSecond>`);
    if (state.stealthEnergyRegenPerDay !== 1)
      extLines.push(`      <stealthEnergyRegenPerDay>${state.stealthEnergyRegenPerDay}</stealthEnergyRegenPerDay>`);

    if ((state.stealthSeeThroughPawnKinds || []).length) {
      extLines.push(`      <stealthSeeThroughPawnKinds>`);
      for (const defName of state.stealthSeeThroughPawnKinds) extLines.push(`        <li>${escapeXml(defName)}</li>`);
      extLines.push(`      </stealthSeeThroughPawnKinds>`);
    }
    if ((state.stealthSeeThroughHediffs || []).length) {
      extLines.push(`      <stealthSeeThroughHediffs>`);
      for (const defName of state.stealthSeeThroughHediffs) extLines.push(`        <li>${escapeXml(defName)}</li>`);
      extLines.push(`      </stealthSeeThroughHediffs>`);
    }
  }

  if (state.corruptionHediff) extLines.push(`      <corruptionHediff>${escapeXml(state.corruptionHediff)}</corruptionHediff>`);
  if (state.corruptionInitialSeverity !== 0.01)
    extLines.push(`      <corruptionInitialSeverity>${state.corruptionInitialSeverity}</corruptionInitialSeverity>`);
  if (state.corruptionGainPerDay !== 0.05) extLines.push(`      <corruptionGainPerDay>${state.corruptionGainPerDay}</corruptionGainPerDay>`);
  if (state.corruptionTickIntervalSeconds !== 1)
    extLines.push(`      <corruptionTickIntervalSeconds>${Math.max(1, Math.floor(state.corruptionTickIntervalSeconds))}</corruptionTickIntervalSeconds>`);
  if (state.corruptionStealthMultiplier !== 1)
    extLines.push(`      <corruptionStealthMultiplier>${state.corruptionStealthMultiplier}</corruptionStealthMultiplier>`);
  if (state.attentionMultiplier !== 1) extLines.push(`      <attentionMultiplier>${state.attentionMultiplier}</attentionMultiplier>`);

  if ((state.corruptionMentalStates || []).length) {
    extLines.push(`      <corruptionMentalStates>`);
    for (const it of state.corruptionMentalStates) {
      extLines.push(`        <li>`);
      extLines.push(`          <mentalState>${escapeXml(it.mentalState)}</mentalState>`);
      if (it.minSeverity != null) extLines.push(`          <minSeverity>${it.minSeverity}</minSeverity>`);
      if (it.maxSeverity != null) extLines.push(`          <maxSeverity>${it.maxSeverity}</maxSeverity>`);
      if (it.chancePerCheck != null) extLines.push(`          <chancePerCheck>${it.chancePerCheck}</chancePerCheck>`);
      if (it.checkIntervalTicks != null) extLines.push(`          <checkIntervalTicks>${Math.max(1, Math.floor(it.checkIntervalTicks))}</checkIntervalTicks>`);
      if (it.requireNotAlreadyInState === false)
        extLines.push(`          <requireNotAlreadyInState>false</requireNotAlreadyInState>`);
      extLines.push(`        </li>`);
    }
    extLines.push(`      </corruptionMentalStates>`);
  }

  if (state.ambientInfluenceEnabled) {
    extLines.push(`      <ambientInfluenceEnabled>true</ambientInfluenceEnabled>`);
    if (state.ambientInfluenceHediff) extLines.push(`      <ambientInfluenceHediff>${escapeXml(state.ambientInfluenceHediff)}</ambientInfluenceHediff>`);
    if (state.ambientInfluenceOnlyWhenUnworn === false)
      extLines.push(`      <ambientInfluenceOnlyWhenUnworn>false</ambientInfluenceOnlyWhenUnworn>`);
    if (state.ambientInfluenceOnlyWhenBuried) extLines.push(`      <ambientInfluenceOnlyWhenBuried>true</ambientInfluenceOnlyWhenBuried>`);
    if (state.ambientInfluenceSkipWearers === false) extLines.push(`      <ambientInfluenceSkipWearers>false</ambientInfluenceSkipWearers>`);
    if (state.ambientInfluenceAffectsColonistsOnly === false)
      extLines.push(`      <ambientInfluenceAffectsColonistsOnly>false</ambientInfluenceAffectsColonistsOnly>`);
    if (state.ambientInfluenceAffectsHumanlikeOnly === false)
      extLines.push(`      <ambientInfluenceAffectsHumanlikeOnly>false</ambientInfluenceAffectsHumanlikeOnly>`);
    if (state.ambientInfluenceRadius !== 0) extLines.push(`      <ambientInfluenceRadius>${state.ambientInfluenceRadius}</ambientInfluenceRadius>`);
    if (state.ambientInfluenceIntervalSeconds !== 4)
      extLines.push(`      <ambientInfluenceIntervalSeconds>${state.ambientInfluenceIntervalSeconds}</ambientInfluenceIntervalSeconds>`);
    if (state.ambientInfluenceInitialSeverity !== 0.02)
      extLines.push(`      <ambientInfluenceInitialSeverity>${state.ambientInfluenceInitialSeverity}</ambientInfluenceInitialSeverity>`);
    if (state.ambientInfluenceSeverityPerTick !== 0.002)
      extLines.push(`      <ambientInfluenceSeverityPerTick>${state.ambientInfluenceSeverityPerTick}</ambientInfluenceSeverityPerTick>`);
    if (state.ambientInfluenceBreakThreshold !== 0.8)
      extLines.push(`      <ambientInfluenceBreakThreshold>${state.ambientInfluenceBreakThreshold}</ambientInfluenceBreakThreshold>`);
    if (state.ambientInfluenceBreakChance !== 0.05)
      extLines.push(`      <ambientInfluenceBreakChance>${state.ambientInfluenceBreakChance}</ambientInfluenceBreakChance>`);
    if (state.ambientInfluenceMentalState)
      extLines.push(`      <ambientInfluenceMentalState>${escapeXml(state.ambientInfluenceMentalState)}</ambientInfluenceMentalState>`);
  }

  if (state.wearerInfluenceEnabled) {
    extLines.push(`      <wearerInfluenceEnabled>true</wearerInfluenceEnabled>`);
    if (state.wearerInfluenceHediff)
      extLines.push(`      <wearerInfluenceHediff>${escapeXml(state.wearerInfluenceHediff)}</wearerInfluenceHediff>`);
    if (state.wearerInfluenceAffectsColonistsOnly)
      extLines.push(`      <wearerInfluenceAffectsColonistsOnly>true</wearerInfluenceAffectsColonistsOnly>`);
    if (state.wearerInfluenceAffectsHumanlikeOnly === false)
      extLines.push(`      <wearerInfluenceAffectsHumanlikeOnly>false</wearerInfluenceAffectsHumanlikeOnly>`);
    if (state.wearerInfluenceSkipWearer === false) extLines.push(`      <wearerInfluenceSkipWearer>false</wearerInfluenceSkipWearer>`);
    if (state.wearerInfluenceRadius !== 10) extLines.push(`      <wearerInfluenceRadius>${state.wearerInfluenceRadius}</wearerInfluenceRadius>`);
    if (state.wearerInfluenceIntervalSeconds !== 4)
      extLines.push(`      <wearerInfluenceIntervalSeconds>${state.wearerInfluenceIntervalSeconds}</wearerInfluenceIntervalSeconds>`);
    if (state.wearerInfluenceInitialSeverity !== 0.05)
      extLines.push(`      <wearerInfluenceInitialSeverity>${state.wearerInfluenceInitialSeverity}</wearerInfluenceInitialSeverity>`);
    if (state.wearerInfluenceSeverityPerTick !== 0.01)
      extLines.push(`      <wearerInfluenceSeverityPerTick>${state.wearerInfluenceSeverityPerTick}</wearerInfluenceSeverityPerTick>`);
    if (state.wearerInfluenceBreakThreshold !== 0.8)
      extLines.push(`      <wearerInfluenceBreakThreshold>${state.wearerInfluenceBreakThreshold}</wearerInfluenceBreakThreshold>`);
    if (state.wearerInfluenceBreakChance !== 0.05)
      extLines.push(`      <wearerInfluenceBreakChance>${state.wearerInfluenceBreakChance}</wearerInfluenceBreakChance>`);
    if (state.wearerInfluenceMentalState)
      extLines.push(`      <wearerInfluenceMentalState>${escapeXml(state.wearerInfluenceMentalState)}</wearerInfluenceMentalState>`);
    if ((state.wearerInfluenceTraitModifiers || []).length) {
      extLines.push(`      <wearerInfluenceTraitModifiers>`);
      for (const it of state.wearerInfluenceTraitModifiers) {
        extLines.push(`        <li>`);
        extLines.push(`          <trait>${escapeXml(it.trait)}</trait>`);
        if ((it.degree || 0) !== 0) extLines.push(`          <degree>${it.degree}</degree>`);
        if (it.severityMultiplier != null) extLines.push(`          <severityMultiplier>${it.severityMultiplier}</severityMultiplier>`);
        if (it.severityOffset != null) extLines.push(`          <severityOffset>${it.severityOffset}</severityOffset>`);
        extLines.push(`        </li>`);
      }
      extLines.push(`      </wearerInfluenceTraitModifiers>`);
    }
  }

  if (state.autoEquipEnabled) {
    extLines.push(`      <autoEquipEnabled>true</autoEquipEnabled>`);
    if (state.autoEquipChance !== 1) extLines.push(`      <autoEquipChance>${state.autoEquipChance}</autoEquipChance>`);
    if (state.autoEquipScoreBonus !== 0) extLines.push(`      <autoEquipScoreBonus>${state.autoEquipScoreBonus}</autoEquipScoreBonus>`);
    if (state.autoEquipAllowDrafted) extLines.push(`      <autoEquipAllowDrafted>true</autoEquipAllowDrafted>`);

    if ((state.autoEquipTraitBonuses || []).length) {
      extLines.push(`      <autoEquipTraitBonuses>`);
      for (const it of state.autoEquipTraitBonuses) {
        extLines.push(`        <li>`);
        extLines.push(`          <trait>${escapeXml(it.trait)}</trait>`);
        if ((it.degree || 0) !== 0) extLines.push(`          <degree>${it.degree}</degree>`);
        if (it.scoreOffset != null) extLines.push(`          <scoreOffset>${it.scoreOffset}</scoreOffset>`);
        extLines.push(`        </li>`);
      }
      extLines.push(`      </autoEquipTraitBonuses>`);
    }

    if ((state.autoEquipHediffBonuses || []).length) {
      extLines.push(`      <autoEquipHediffBonuses>`);
      for (const it of state.autoEquipHediffBonuses) {
        extLines.push(`        <li>`);
        extLines.push(`          <hediff>${escapeXml(it.hediff)}</hediff>`);
        if (it.minSeverity != null) extLines.push(`          <minSeverity>${it.minSeverity}</minSeverity>`);
        if (it.maxSeverity != null) extLines.push(`          <maxSeverity>${it.maxSeverity}</maxSeverity>`);
        if (it.scoreOffset != null) extLines.push(`          <scoreOffset>${it.scoreOffset}</scoreOffset>`);
        if (it.severityMultiplier != null) extLines.push(`          <severityMultiplier>${it.severityMultiplier}</severityMultiplier>`);
        extLines.push(`        </li>`);
      }
      extLines.push(`      </autoEquipHediffBonuses>`);
    }
  }

  if (state.refuseRemoval) {
    extLines.push(`      <refuseRemoval>true</refuseRemoval>`);
    if (state.refuseRemovalHediff) extLines.push(`      <refuseRemovalHediff>${escapeXml(state.refuseRemovalHediff)}</refuseRemovalHediff>`);
    if (state.refuseRemovalMinSeverity !== 0.5)
      extLines.push(`      <refuseRemovalMinSeverity>${state.refuseRemovalMinSeverity}</refuseRemovalMinSeverity>`);
    if (state.refuseRemovalMessageKey && state.refuseRemovalMessageKey !== "Lantern_RefuseRemoval")
      extLines.push(`      <refuseRemovalMessageKey>${escapeXml(state.refuseRemovalMessageKey)}</refuseRemovalMessageKey>`);
  }
  if (state.forceDropOnWearerDeath) extLines.push(`      <forceDropOnWearerDeath>true</forceDropOnWearerDeath>`);
  if (state.forceDropOnCorpseDestroy) extLines.push(`      <forceDropOnCorpseDestroy>true</forceDropOnCorpseDestroy>`);
  if (state.forceDropOnGraveEject) extLines.push(`      <forceDropOnGraveEject>true</forceDropOnGraveEject>`);

  if ((state.statBuffs || []).length) {
    const statHediff = derivedDefName(state.ringDefName, "Hediff_GearBuffs");
    extraDefs.push(buildStatBuffHediffDefXml(statHediff, state.ringLabel, state.statBuffs));
    extLines.push(`      <hediffsWhileWorn>`);
    extLines.push(`        <li>${escapeXml(statHediff)}</li>`);
    extLines.push(`      </hediffsWhileWorn>`);
  }

  // Costume / outfit (transformationApparel)
  if (state.enableCostume) {
    const apparel = collectTransformationApparel(state);
    if (apparel.length) {
      extLines.push(`      <transformationApparel>`);
      for (const defName of apparel) extLines.push(`        <li>${escapeXml(defName)}</li>`);
      extLines.push(`      </transformationApparel>`);
    }
    if (state.transformationOnlyWhenDrafted) extLines.push(`      <transformationOnlyWhenDrafted>true</transformationOnlyWhenDrafted>`);
    if (state.transformationSkipConflictingApparel)
      extLines.push(`      <transformationSkipConflictingApparel>true</transformationSkipConflictingApparel>`);

    if (state.transformationAllowMaleGender === false) extLines.push(`      <transformationAllowMaleGender>false</transformationAllowMaleGender>`);
    if (state.transformationAllowFemaleGender === false) extLines.push(`      <transformationAllowFemaleGender>false</transformationAllowFemaleGender>`);
    if (state.transformationAllowNoneGender === false) extLines.push(`      <transformationAllowNoneGender>false</transformationAllowNoneGender>`);

    const disallowed = [];
    if (state.transformationDisallowBodyTypeThin) disallowed.push("Thin");
    if (state.transformationDisallowBodyTypeFat) disallowed.push("Fat");
    if (state.transformationDisallowBodyTypeHulk) disallowed.push("Hulk");
    if (disallowed.length) {
      extLines.push(`      <transformationDisallowedBodyTypes>`);
      for (const b of disallowed) extLines.push(`        <li>${b}</li>`);
      extLines.push(`      </transformationDisallowedBodyTypes>`);
    }

    const missingBehavior = state.transformationMissingGraphicBehavior || "none";
    if (missingBehavior === "skip") {
      extLines.push(`      <transformationSkipIfMissingWornGraphic>true</transformationSkipIfMissingWornGraphic>`);
    }

    if (state.transformationToggleGizmo) {
      extLines.push(`      <transformationToggleGizmo>true</transformationToggleGizmo>`);
      if (state.transformationToggleDefaultOn === false) {
        extLines.push(`      <transformationToggleDefaultOn>false</transformationToggleDefaultOn>`);
      }
    }

    if (missingBehavior === "override" && state.transformationBodyTypeOverride) {
      extLines.push(`      <transformationOverrideBodyType>true</transformationOverrideBodyType>`);
      if (state.transformationOverrideBodyTypeOnlyIfMissing) {
        extLines.push(`      <transformationOverrideBodyTypeOnlyIfMissing>true</transformationOverrideBodyTypeOnlyIfMissing>`);
      } else {
        extLines.push(`      <transformationOverrideBodyTypeOnlyIfMissing>false</transformationOverrideBodyTypeOnlyIfMissing>`);
      }
      extLines.push(`      <transformationBodyTypeOverride>${escapeXml(state.transformationBodyTypeOverride)}</transformationBodyTypeOverride>`);
    } else if (state.transformationOverrideBodyType && state.transformationBodyTypeOverride) {
      // Backward compatibility if user toggled the legacy override switches directly.
      extLines.push(`      <transformationOverrideBodyType>true</transformationOverrideBodyType>`);
      if (state.transformationOverrideBodyTypeOnlyIfMissing) {
        extLines.push(`      <transformationOverrideBodyTypeOnlyIfMissing>true</transformationOverrideBodyTypeOnlyIfMissing>`);
      } else {
        extLines.push(`      <transformationOverrideBodyTypeOnlyIfMissing>false</transformationOverrideBodyTypeOnlyIfMissing>`);
      }
      extLines.push(`      <transformationBodyTypeOverride>${escapeXml(state.transformationBodyTypeOverride)}</transformationBodyTypeOverride>`);
    }
  }

  const gearParent =
    state.gearParent === "custom" ? (state.gearParentCustom || "").trim() : (state.gearParent || "").trim();
  const parentName = gearParent || "Lantern_RingBase";
  const gearGraphicClass = (state.gearGraphicClass || "Graphic_Single").trim() || "Graphic_Single";

  const statBasesLines = [
    `      <MarketValue>${state.marketValue}</MarketValue>`,
    `      <Mass>${state.mass}</Mass>`,
  ];
  if (state.flammability != null) statBasesLines.push(`      <Flammability>${state.flammability}</Flammability>`);
  if (state.equipDelay != null) statBasesLines.push(`      <EquipDelay>${state.equipDelay}</EquipDelay>`);
  if (state.deteriorationRate != null)
    statBasesLines.push(`      <DeteriorationRate>${state.deteriorationRate}</DeteriorationRate>`);

  const apparelLines = [];
  if (state.careIfWornByCorpse === "true") apparelLines.push(`      <careIfWornByCorpse>true</careIfWornByCorpse>`);
  if (state.careIfWornByCorpse === "false") apparelLines.push(`      <careIfWornByCorpse>false</careIfWornByCorpse>`);
  if (state.careIfDamaged === "true") apparelLines.push(`      <careIfDamaged>true</careIfDamaged>`);
  if (state.careIfDamaged === "false") apparelLines.push(`      <careIfDamaged>false</careIfDamaged>`);
  if (state.countsAsClothingForNudity === "true")
    apparelLines.push(`      <countsAsClothingForNudity>true</countsAsClothingForNudity>`);
  if (state.countsAsClothingForNudity === "false")
    apparelLines.push(`      <countsAsClothingForNudity>false</countsAsClothingForNudity>`);
  if ((state.gearBodyPartGroups || []).length) {
    apparelLines.push(`      <bodyPartGroups>`);
    for (const defName of state.gearBodyPartGroups) {
      apparelLines.push(`        <li>${escapeXml(defName)}</li>`);
    }
    apparelLines.push(`      </bodyPartGroups>`);
  }
  if ((state.gearLayers || []).length) {
    apparelLines.push(`      <layers>`);
    for (const defName of state.gearLayers) {
      apparelLines.push(`        <li>${escapeXml(defName)}</li>`);
    }
    apparelLines.push(`      </layers>`);
  }
  if ((state.gearTags || []).length) {
    apparelLines.push(`      <tags>`);
    for (const defName of state.gearTags) {
      apparelLines.push(`        <li>${escapeXml(defName)}</li>`);
    }
    apparelLines.push(`      </tags>`);
  }

  const apparelXml = apparelLines.length ? `    <apparel>\n${apparelLines.join("\n")}\n    </apparel>\n` : "";

  const ringXml =
    `  <ThingDef ParentName="${escapeXml(parentName)}">\n` +
    `    <defName>${escapeXml(state.ringDefName)}</defName>\n` +
    `    <label>${escapeXml(state.ringLabel)}</label>\n` +
    `    <description>${escapeXml(state.ringDesc || "")}</description>\n` +
    (state.techLevel && state.techLevel !== "default" ? `    <techLevel>${escapeXml(state.techLevel)}</techLevel>\n` : "") +
    (state.smeltable && state.smeltable !== "default" ? `    <smeltable>${state.smeltable}</smeltable>\n` : "") +
    `    <graphicData>\n` +
    `      <texPath>${escapeXml(state.ringTexPath)}</texPath>\n` +
    `      <graphicClass>${escapeXml(gearGraphicClass)}</graphicClass>\n` +
    (gearGraphicClass === "Graphic_Multi" ? `      <allowFlip>true</allowFlip>\n` : "") +
    `      <color>${escapeXml(state.ringColor)}</color>\n` +
    `    </graphicData>\n` +
    `    <statBases>\n` +
    `${statBasesLines.join("\n")}\n` +
    `    </statBases>\n` +
    apparelXml +
    `    <modExtensions>\n` +
    `      <li Class="DrAke.LanternsFramework.LanternDefExtension">\n` +
    `${extLines.map((l) => "        " + l.trimStart()).join("\n")}\n` +
    `      </li>\n` +
    `    </modExtensions>\n` +
    `  </ThingDef>\n`;

  const abilitiesXml = state.abilities
    .map((a) => buildAbilityDefXml(state, a, extraDefs))
    .join("\n");

  const selectionXml = state.enableSelection ? buildSelectionDefXml(state) : "";
  const discoveryXml = state.enableDiscoveryEvent ? buildDiscoveryIncidentDefXml(state) : "";

  const costumeDefsXml = buildGeneratedCostumeDefsXml(state);

  return `<?xml version="1.0" encoding="utf-8"?>\n<Defs>\n\n${ringXml}\n${abilitiesXml}\n${extraDefs.join("\n")}\n${costumeDefsXml}\n${selectionXml}\n${discoveryXml}</Defs>\n`;
}

function collectTransformationApparel(state) {
  const existing = (state.costume_existingApparel || []).filter(Boolean);
  const generated = (state.costume_generatedApparel || []).map((x) => x.defName).filter(Boolean);
  return uniqueSorted([...existing, ...generated]);
}

function parseCsvList(text) {
  return String(text || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildGeneratedCostumeDefsXml(state) {
  const items = state.costume_generatedApparel || [];
  if (!items.length) return "";
  return items.map((it) => buildGeneratedApparelDefXml(it)).join("\n");
}

function buildGeneratedApparelDefXml(it) {
  const layers = (it.layers || []).filter(Boolean);
  const bodyParts = (it.bodyParts || []).filter(Boolean);

  return (
    `\n  <ThingDef ParentName="ApparelBase">\n` +
    `    <defName>${escapeXml(it.defName)}</defName>\n` +
    `    <label>${escapeXml(it.label || it.defName)}</label>\n` +
    `    <apparel>\n` +
    `      <layers>\n${layers.map((x) => `        <li>${escapeXml(x)}</li>`).join("\n")}\n      </layers>\n` +
    `      <bodyPartGroups>\n${bodyParts.map((x) => `        <li>${escapeXml(x)}</li>`).join("\n")}\n      </bodyPartGroups>\n` +
    `      <wornGraphicPath>${escapeXml(it.texPath)}</wornGraphicPath>\n` +
    `    </apparel>\n` +
    `    <graphicData>\n` +
    `      <texPath>${escapeXml(it.texPath)}</texPath>\n` +
    `      <graphicClass>Graphic_Multi</graphicClass>\n` +
    `      <allowFlip>true</allowFlip>\n` +
    `    </graphicData>\n` +
    `  </ThingDef>\n`
  );
}

function derivedDefName(base, suffix) {
  const safe = String(base || "").replaceAll(/[^A-Za-z0-9_]/g, "_");
  const name = `${safe}_${suffix}`;
  return isValidDefName(name) ? name : `Generated_${suffix}`;
}

function buildAbilityDefXml(state, a, extraDefsOut) {
  const descLine = a.description ? `  <description>${escapeXml(a.description)}</description>\n` : "";
  const lines = [];

  // Flight is custom-coded and does not use standard effect comps here.
  const includeCostComp = a.key !== "Flight";

  if (a.key === "Heal") {
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternHeal">`);
    lines.push(`        <healAmount>${a.healAmount}</healAmount>`);
    lines.push(`        <radius>${a.radius}</radius>`);
    lines.push(`      </li>`);
  } else if (a.key === "Stun") {
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternStun">`);
    lines.push(`        <stunTicks>${a.stunTicks}</stunTicks>`);
    lines.push(`        <radius>${a.radius}</radius>`);
    lines.push(`        <affectHostilesOnly>${a.affectHostilesOnly ? "true" : "false"}</affectHostilesOnly>`);
    lines.push(`      </li>`);
  } else if (a.key === "Barrier") {
    const shieldHediff = derivedDefName(state.ringDefName, "Hediff_Shield");
    extraDefsOut.push(buildShieldHediffDefXml(shieldHediff, a.shieldMaxHp));
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternShieldAbility">`);
    lines.push(`        <shieldHediffDef>${shieldHediff}</shieldHediffDef>`);
    lines.push(`        <radius>${a.radius}</radius>`);
    lines.push(`      </li>`);
  } else if (a.key === "Aura") {
    const auraHediff = derivedDefName(state.ringDefName, "Hediff_Aura");
    extraDefsOut.push(buildBasicHediffDefXml(auraHediff, `${state.ringLabel} aura`));
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternBuffAura">`);
    lines.push(`        <hediffDef>${auraHediff}</hediffDef>`);
    lines.push(`        <severity>${a.severity}</severity>`);
    lines.push(`        <radius>${a.radius}</radius>`);
    lines.push(`        <durationTicks>${a.durationTicks}</durationTicks>`);
    lines.push(`      </li>`);
  } else if (a.key === "Construct") {
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternConstructSpawn">`);
    lines.push(`        <thingDef>${escapeXml(a.thingDef)}</thingDef>`);
    lines.push(`        <spawnCount>${a.spawnCount}</spawnCount>`);
    lines.push(`        <durationTicks>${a.durationTicks}</durationTicks>`);
    lines.push(`      </li>`);
  } else if (a.key === "Summon") {
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternSummon">`);
    lines.push(`        <pawnKind>${escapeXml(a.pawnKind)}</pawnKind>`);
    lines.push(`        <count>${a.count}</count>`);
    lines.push(`        <durationTicks>${a.durationTicks}</durationTicks>`);
    lines.push(`      </li>`);
  } else if (a.key === "Teleport") {
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternTeleport">`);
    lines.push(`        <allowRoofed>${a.allowRoofed ? "true" : "false"}</allowRoofed>`);
    lines.push(`        <allowOccupied>${a.allowOccupied ? "true" : "false"}</allowOccupied>`);
    if (a.spawnGasAtOrigin) lines.push(`        <spawnGasAtOrigin>true</spawnGasAtOrigin>`);
    if (a.spawnGasAtDestination) lines.push(`        <spawnGasAtDestination>true</spawnGasAtDestination>`);
    if (a.gasType) lines.push(`        <gasType>${escapeXml(a.gasType)}</gasType>`);
    if ((a.gasRadius ?? 0) > 0) lines.push(`        <gasRadius>${a.gasRadius}</gasRadius>`);
    if ((a.gasAmount ?? 0) > 0) lines.push(`        <gasAmount>${Math.floor(a.gasAmount)}</gasAmount>`);
    if ((a.gasDurationTicks ?? 0) > 0) lines.push(`        <gasDurationTicks>${Math.floor(a.gasDurationTicks)}</gasDurationTicks>`);
    lines.push(`      </li>`);
  } else if (a.key === "Conditional") {
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternConditionalPawnOutcome">`);
    lines.push(`        <fleshOutcome>${escapeXml(a.fleshOutcome || "Down")}</fleshOutcome>`);
    lines.push(`        <mechOutcome>${escapeXml(a.mechOutcome || "Kill")}</mechOutcome>`);
    lines.push(`        <anomalyOutcome>${escapeXml(a.anomalyOutcome || "Kill")}</anomalyOutcome>`);
    lines.push(`        <otherOutcome>${escapeXml(a.otherOutcome || "None")}</otherOutcome>`);
    lines.push(`      </li>`);
  } else if (a.key === "Displace") {
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternDisplace">`);
    lines.push(`        <distance>${a.distance}</distance>`);
    lines.push(`        <pullTowardsCaster>${a.pullTowardsCaster ? "true" : "false"}</pullTowardsCaster>`);
    lines.push(`        <requireLineOfSight>${a.requireLineOfSight ? "true" : "false"}</requireLineOfSight>`);
    lines.push(`      </li>`);
  } else if (a.key === "Blast") {
    // No effect comp; base verb handles it.
  } else if (a.key === "Flight") {
    // Cost is handled by the flight system.
  }

  if (a.pauseOnClick) {
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternPauseOnInput">`);
    lines.push(`        <pause>true</pause>`);
    lines.push(`      </li>`);
  }

  if (includeCostComp) {
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternCost">`);
    lines.push(`        <cost>${a.cost}</cost>`);
    lines.push(`      </li>`);
  }

  if ((a.cooldownTicks || 0) > 0 || (a.maxCastsPerDay || 0) > 0) {
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternCastLimits">`);
    if ((a.cooldownTicks || 0) > 0) lines.push(`        <cooldownTicks>${Math.floor(a.cooldownTicks)}</cooldownTicks>`);
    if ((a.maxCastsPerDay || 0) > 0) lines.push(`        <maxCastsPerDay>${Math.floor(a.maxCastsPerDay)}</maxCastsPerDay>`);
    lines.push(`      </li>`);
  }

  const rule = (a.targetRule || "Any").trim();
  if (rule && rule !== "Any") {
    const r = targetRuleToFlags(rule);
    lines.push(`      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternTargetRules">`);
    lines.push(`        <allowSelf>${r.allowSelf ? "true" : "false"}</allowSelf>`);
    lines.push(`        <allowAllies>${r.allowAllies ? "true" : "false"}</allowAllies>`);
    lines.push(`        <allowNeutral>${r.allowNeutral ? "true" : "false"}</allowNeutral>`);
    lines.push(`        <allowHostiles>${r.allowHostiles ? "true" : "false"}</allowHostiles>`);
    lines.push(`        <allowNoFaction>${r.allowNoFaction ? "true" : "false"}</allowNoFaction>`);
    lines.push(`      </li>`);
  }

  const compsBlock = lines.length
    ? `    <comps Inherit="False">\n${lines.join("\n")}\n    </comps>\n`
    : "";

  let verbOverride = "";
  if (a.key === "Blast") {
    const hasSound = (a.soundCastOverride || "").trim().length > 0;
    const mute = !!a.muteSoundCast;
    const hasRange = (a.range || 0) > 0;
    if (hasSound || mute || hasRange) {
      const cls = "DrAke.LanternsFramework.Abilities.VerbProperties_LanternBlast";
      const v = [];
      v.push(`    <verbProperties Class="${cls}">`);
      if (hasRange) v.push(`      <range>${a.range}</range>`);
      if (mute) v.push(`      <muteSoundCast>true</muteSoundCast>`);
      if (hasSound) v.push(`      <soundCastOverride>${escapeXml(a.soundCastOverride)}</soundCastOverride>`);
      v.push(`    </verbProperties>`);
      verbOverride = v.join("\n") + "\n";
    }
  } else {
    verbOverride = (a.range || 0) > 0 ? `    <verbProperties>\n      <range>${a.range}</range>\n    </verbProperties>\n` : "";
  }

  return (
    `  <AbilityDef ParentName="${escapeXml(a.parent)}">\n` +
    `    <defName>${escapeXml(a.defName)}</defName>\n` +
    `    <label>${escapeXml(a.label)}</label>\n` +
    descLine +
    `    <iconPath>${escapeXml(a.iconPath)}</iconPath>\n` +
    verbOverride +
    compsBlock +
    `  </AbilityDef>\n`
  );
}

function targetRuleToFlags(rule) {
  switch (rule) {
    case "HostilesOnly":
      return { allowSelf: false, allowAllies: false, allowNeutral: false, allowHostiles: true, allowNoFaction: false };
    case "AlliesOnly":
      return { allowSelf: true, allowAllies: true, allowNeutral: false, allowHostiles: false, allowNoFaction: false };
    case "NonHostilesOnly":
      return { allowSelf: true, allowAllies: true, allowNeutral: true, allowHostiles: false, allowNoFaction: true };
    case "SelfOnly":
      return { allowSelf: true, allowAllies: false, allowNeutral: false, allowHostiles: false, allowNoFaction: false };
    default:
      return { allowSelf: true, allowAllies: true, allowNeutral: true, allowHostiles: true, allowNoFaction: true };
  }
}

function buildStatBuffHediffDefXml(defName, gearLabel, items) {
  const buffs = (items || [])
    .map((x) => ({ stat: String(x.stat || "").trim(), offset: Number(x.offset) }))
    .filter((x) => x.stat && Number.isFinite(x.offset) && x.offset !== 0);

  const lines = [];
  lines.push(`\n  <HediffDef>`);
  lines.push(`    <defName>${escapeXml(defName)}</defName>`);
  lines.push(`    <label>${escapeXml((gearLabel || "gear") + " buffs")}</label>`);
  lines.push(`    <hediffClass>HediffWithComps</hediffClass>`);
  lines.push(`    <stages>`);
  lines.push(`      <li>`);
  lines.push(`        <statOffsets>`);
  for (const b of buffs) {
    lines.push(`          <${b.stat}>${b.offset}</${b.stat}>`);
  }
  lines.push(`        </statOffsets>`);
  lines.push(`      </li>`);
  lines.push(`    </stages>`);
  lines.push(`  </HediffDef>\n`);
  return lines.join("\n");
}

function buildShieldHediffDefXml(defName, maxHp) {
  return (
    `\n  <HediffDef>\n` +
    `    <defName>${escapeXml(defName)}</defName>\n` +
    `    <label>shield</label>\n` +
    `    <hediffClass>HediffWithComps</hediffClass>\n` +
    `    <comps>\n` +
    `      <li Class="DrAke.LanternsFramework.Abilities.HediffCompProperties_LanternShield">\n` +
    `        <defaultMaxHp>${maxHp}</defaultMaxHp>\n` +
    `      </li>\n` +
    `    </comps>\n` +
    `  </HediffDef>\n`
  );
}

function buildBasicHediffDefXml(defName, label) {
  return (
    `\n  <HediffDef>\n` +
    `    <defName>${escapeXml(defName)}</defName>\n` +
    `    <label>${escapeXml(label)}</label>\n` +
    `    <hediffClass>HediffWithComps</hediffClass>\n` +
    `  </HediffDef>\n`
  );
}

function buildSelectionDefXml(state) {
  const triggerLines = [];
  if (state.selectionTrigger === "onJoin") triggerLines.push("<triggerOnJoinPlayerFaction>true</triggerOnJoinPlayerFaction>");
  if (state.selectionTrigger === "onSpawn") triggerLines.push("<triggerOnSpawnedOnMap>true</triggerOnSpawnedOnMap>");
  if (state.selectionTrigger === "onMental") triggerLines.push("<triggerMentalState>true</triggerMentalState>");

  const filterLines = [
    `<allowColonists>${state.sel_allowColonists ? "true" : "false"}</allowColonists>`,
    `<allowPrisoners>${state.sel_allowPrisoners ? "true" : "false"}</allowPrisoners>`,
    `<allowSlaves>${state.sel_allowSlaves ? "true" : "false"}</allowSlaves>`,
    `<allowGuests>${state.sel_allowGuests ? "true" : "false"}</allowGuests>`,
    `<allowAnimals>${state.sel_allowAnimals ? "true" : "false"}</allowAnimals>`,
    `<allowMechs>${state.sel_allowMechs ? "true" : "false"}</allowMechs>`,
    `<allowHostiles>${state.sel_allowHostiles ? "true" : "false"}</allowHostiles>`,
    `<allowDead>${state.sel_allowDead ? "true" : "false"}</allowDead>`,
    `<allowDowned>${state.sel_allowDowned ? "true" : "false"}</allowDowned>`,
    `<requireViolenceCapable>${state.sel_requireViolenceCapable ? "true" : "false"}</requireViolenceCapable>`,
  ];

  const condXml = buildSelectionConditionsXml(state.sel_conditions || []);

  return (
    `\n  <DrAke.LanternsFramework.RingSelectionDef>\n` +
    `    <defName>${escapeXml(state.selectionDefName)}</defName>\n` +
    `    <ringDef>${escapeXml(state.ringDefName)}</ringDef>\n` +
    `${triggerLines.map((l) => `    ${l}`).join("\n")}\n` +
    `    <excludeIfHasAnyLanternRing>${state.excludeIfHasAnyLanternRing ? "true" : "false"}</excludeIfHasAnyLanternRing>\n` +
    `${filterLines.map((l) => `    ${l}`).join("\n")}\n` +
    `${condXml}` +
    `  </DrAke.LanternsFramework.RingSelectionDef>\n\n`
  );
}

function buildDiscoveryIncidentDefXml(state) {
  const defName = state.discoveryIncidentDefName || derivedDefName(state.ringDefName, "Discovery");
  const category = (state.discoveryIncidentCategory || "Misc").trim() || "Misc";
  const baseChance = Number.isFinite(state.discoveryIncidentBaseChance) ? state.discoveryIncidentBaseChance : 0.1;
  const label = state.discoverySiteLabel || state.ringLabel || "discovery site";
  const targetType = state.discoveryTargetType || "WorldSite";
  const targetTag = targetType === "ActiveMap" ? "Map" : "World";
  const rawTargetTags = Array.isArray(state.discoveryTargetTags)
    ? state.discoveryTargetTags
    : parseCsvList(state.discoveryTargetTags || "");
  const targetTags = rawTargetTags.length ? rawTargetTags : [targetTag];

  const extLines = [];
  extLines.push(`        <gearDef>${escapeXml(state.ringDefName)}</gearDef>`);
  if (state.discoveryGearCount !== 1) extLines.push(`        <gearCount>${Math.max(1, Math.floor(state.discoveryGearCount))}</gearCount>`);

  if (targetType !== "WorldSite") extLines.push(`        <targetType>${escapeXml(targetType)}</targetType>`);
  if (state.discoveryMapDropRadius !== 10) extLines.push(`        <mapDropRadius>${state.discoveryMapDropRadius}</mapDropRadius>`);
  if (state.discoveryMapDropPreferColony === false) extLines.push(`        <mapDropPreferColony>false</mapDropPreferColony>`);

  if (state.discoverySiteLabel) extLines.push(`        <siteLabel>${escapeXml(state.discoverySiteLabel)}</siteLabel>`);
  if (state.discoverySiteDescription) extLines.push(`        <siteDescription>${escapeXml(state.discoverySiteDescription)}</siteDescription>`);
  if (state.discoverySiteTimeoutDays !== 15) extLines.push(`        <siteTimeoutDays>${state.discoverySiteTimeoutDays}</siteTimeoutDays>`);
  if (state.discoveryMinDistanceTiles !== 6) extLines.push(`        <minDistanceFromPlayerTiles>${Math.max(0, Math.floor(state.discoveryMinDistanceTiles))}</minDistanceFromPlayerTiles>`);
  if (state.discoveryMaxDistanceTiles !== 40) extLines.push(`        <maxDistanceFromPlayerTiles>${Math.max(0, Math.floor(state.discoveryMaxDistanceTiles))}</maxDistanceFromPlayerTiles>`);

  if (state.discoverySendLetter === false) extLines.push(`        <sendLetter>false</sendLetter>`);
  if (state.discoveryLetterLabel) extLines.push(`        <letterLabel>${escapeXml(state.discoveryLetterLabel)}</letterLabel>`);
  if (state.discoveryLetterLabelKey)
    extLines.push(`        <letterLabelKey>${escapeXml(state.discoveryLetterLabelKey)}</letterLabelKey>`);
  if (state.discoveryLetterText) extLines.push(`        <letterText>${escapeXml(state.discoveryLetterText)}</letterText>`);
  if (state.discoveryLetterTextKey)
    extLines.push(`        <letterTextKey>${escapeXml(state.discoveryLetterTextKey)}</letterTextKey>`);
  if (state.discoveryLetterDef) extLines.push(`        <letterDef>${escapeXml(state.discoveryLetterDef)}</letterDef>`);

  if (state.discoverySpawnCrashDebris === false) extLines.push(`        <spawnCrashDebris>false</spawnCrashDebris>`);
  if (state.discoveryCrashChunkDef) extLines.push(`        <crashChunkDef>${escapeXml(state.discoveryCrashChunkDef)}</crashChunkDef>`);
  if (state.discoveryCrashDebrisDef) extLines.push(`        <crashDebrisDef>${escapeXml(state.discoveryCrashDebrisDef)}</crashDebrisDef>`);
  if (state.discoveryCrashDebrisCount !== 6) extLines.push(`        <crashDebrisCount>${Math.max(0, Math.floor(state.discoveryCrashDebrisCount))}</crashDebrisCount>`);
  if (state.discoveryCrashDebrisRadius !== 6) extLines.push(`        <crashDebrisRadius>${state.discoveryCrashDebrisRadius}</crashDebrisRadius>`);

  if (state.discoveryPawnKind) extLines.push(`        <pawnKind>${escapeXml(state.discoveryPawnKind)}</pawnKind>`);
  if (state.discoveryPawnFaction) extLines.push(`        <pawnFaction>${escapeXml(state.discoveryPawnFaction)}</pawnFaction>`);
  if (state.discoveryAliveMin !== 0) extLines.push(`        <alivePawnsMin>${Math.max(0, Math.floor(state.discoveryAliveMin))}</alivePawnsMin>`);
  if (state.discoveryAliveMax !== 0) extLines.push(`        <alivePawnsMax>${Math.max(0, Math.floor(state.discoveryAliveMax))}</alivePawnsMax>`);
  if (state.discoveryDeadMin !== 1) extLines.push(`        <deadPawnsMin>${Math.max(0, Math.floor(state.discoveryDeadMin))}</deadPawnsMin>`);
  if (state.discoveryDeadMax !== 1) extLines.push(`        <deadPawnsMax>${Math.max(0, Math.floor(state.discoveryDeadMax))}</deadPawnsMax>`);
  if (state.discoveryAliveDowned === false) extLines.push(`        <alivePawnsDowned>false</alivePawnsDowned>`);
  if (state.discoveryPawnScatterRadius !== 8) extLines.push(`        <pawnScatterRadius>${state.discoveryPawnScatterRadius}</pawnScatterRadius>`);
  if (state.discoverySpawnPawnsInDropPods === false) extLines.push(`        <spawnPawnsInDropPods>false</spawnPawnsInDropPods>`);
  if (state.discoveryDropPodOpenDelaySeconds !== 2) extLines.push(`        <dropPodOpenDelaySeconds>${state.discoveryDropPodOpenDelaySeconds}</dropPodOpenDelaySeconds>`);

  if (state.discoveryGearPlacement && state.discoveryGearPlacement !== "PawnWorn")
    extLines.push(`        <gearPlacement>${escapeXml(state.discoveryGearPlacement)}</gearPlacement>`);
  if (state.discoveryGearReceiver && state.discoveryGearReceiver !== "PreferAlive")
    extLines.push(`        <gearReceiver>${escapeXml(state.discoveryGearReceiver)}</gearReceiver>`);

  const timedExtLines = [];
  if (state.enableTimedIncident) {
    if (state.timedIncidentMinDays !== 1) timedExtLines.push(`        <minDays>${state.timedIncidentMinDays}</minDays>`);
    if (state.timedIncidentMaxDays !== 2) timedExtLines.push(`        <maxDays>${state.timedIncidentMaxDays}</maxDays>`);
    if (state.timedIncidentRetryHours !== 1) timedExtLines.push(`        <retryHours>${state.timedIncidentRetryHours}</retryHours>`);
    if (state.timedIncidentFireOnce === false) timedExtLines.push(`        <fireOnce>false</fireOnce>`);
    if (state.timedIncidentForce === false) timedExtLines.push(`        <force>false</force>`);
    if (state.timedIncidentTarget && state.timedIncidentTarget !== "PlayerHomeMap")
      timedExtLines.push(`        <target>${escapeXml(state.timedIncidentTarget)}</target>`);
  }

  return (
    `\n  <IncidentDef>\n` +
    `    <defName>${escapeXml(defName)}</defName>\n` +
    `    <label>${escapeXml(label)}</label>\n` +
    `    <category>${escapeXml(category)}</category>\n` +
    `    <targetTags>\n` +
    `${targetTags.map((tag) => `      <li>${escapeXml(tag)}</li>`).join("\n")}\n` +
    `    </targetTags>\n` +
    (state.discoveryMinRefireDays != null ? `    <minRefireDays>${state.discoveryMinRefireDays}</minRefireDays>\n` : "") +
    (state.discoveryPointsScaleable && state.discoveryPointsScaleable !== "default"
      ? `    <pointsScaleable>${state.discoveryPointsScaleable}</pointsScaleable>\n`
      : "") +
    `    <baseChance>${baseChance}</baseChance>\n` +
    `    <workerClass>DrAke.LanternsFramework.IncidentWorker_LanternDiscovery</workerClass>\n` +
    `    <modExtensions>\n` +
    `      <li Class="DrAke.LanternsFramework.LanternDiscoveryIncidentExtension">\n` +
    `${extLines.join("\n")}\n` +
    `      </li>\n` +
    (state.enableTimedIncident
      ? `      <li Class="DrAke.LanternsFramework.LanternTimedIncidentExtension">\n${timedExtLines.join("\n")}\n      </li>\n`
      : "") +
    `    </modExtensions>\n` +
    `  </IncidentDef>\n`
  );
}

function buildSelectionConditionsXml(items) {
  if (!items || !items.length) return "";
  const lines = [];
  lines.push("    <conditions>");

  for (const it of items) {
    const type = it.type;
    const def = it.def;
    const p = it.params || {};

    if (type === "Trait") {
      lines.push(`      <li Class="DrAke.LanternsFramework.Condition_Trait">`);
      lines.push(`        <trait>${escapeXml(def)}</trait>`);
      if (p.degree != null) lines.push(`        <degree>${escapeXml(p.degree)}</degree>`);
      if (p.scoreBonus != null) lines.push(`        <scoreBonus>${escapeXml(p.scoreBonus)}</scoreBonus>`);
      lines.push(`      </li>`);
    } else if (type === "Stat") {
      lines.push(`      <li Class="DrAke.LanternsFramework.Condition_Stat">`);
      lines.push(`        <stat>${escapeXml(def)}</stat>`);
      if (p.lowerIsBetter != null) lines.push(`        <lowerIsBetter>${escapeXml(p.lowerIsBetter)}</lowerIsBetter>`);
      if (p.scoreMultiplier != null) lines.push(`        <scoreMultiplier>${escapeXml(p.scoreMultiplier)}</scoreMultiplier>`);
      lines.push(`      </li>`);
    } else if (type === "Skill") {
      lines.push(`      <li Class="DrAke.LanternsFramework.Condition_Skill">`);
      lines.push(`        <skill>${escapeXml(def)}</skill>`);
      if (p.minLevel != null) lines.push(`        <minLevel>${escapeXml(p.minLevel)}</minLevel>`);
      if (p.scoreMultiplier != null) lines.push(`        <scoreMultiplier>${escapeXml(p.scoreMultiplier)}</scoreMultiplier>`);
      if (p.flatBonus != null) lines.push(`        <flatBonus>${escapeXml(p.flatBonus)}</flatBonus>`);
      lines.push(`      </li>`);
    } else if (type === "Mood") {
      lines.push(`      <li Class="DrAke.LanternsFramework.Condition_Mood">`);
      if (p.lowerIsBetter != null) lines.push(`        <lowerIsBetter>${escapeXml(p.lowerIsBetter)}</lowerIsBetter>`);
      if (p.scoreMultiplier != null) lines.push(`        <scoreMultiplier>${escapeXml(p.scoreMultiplier)}</scoreMultiplier>`);
      if (p.flatBonus != null) lines.push(`        <flatBonus>${escapeXml(p.flatBonus)}</flatBonus>`);
      lines.push(`      </li>`);
    } else if (type === "Need") {
      lines.push(`      <li Class="DrAke.LanternsFramework.Condition_Need">`);
      lines.push(`        <need>${escapeXml(def)}</need>`);
      if (p.minLevel != null) lines.push(`        <minLevel>${escapeXml(p.minLevel)}</minLevel>`);
      if (p.maxLevel != null) lines.push(`        <maxLevel>${escapeXml(p.maxLevel)}</maxLevel>`);
      if (p.lowerIsBetter != null) lines.push(`        <lowerIsBetter>${escapeXml(p.lowerIsBetter)}</lowerIsBetter>`);
      if (p.scoreMultiplier != null) lines.push(`        <scoreMultiplier>${escapeXml(p.scoreMultiplier)}</scoreMultiplier>`);
      if (p.flatBonus != null) lines.push(`        <flatBonus>${escapeXml(p.flatBonus)}</flatBonus>`);
      lines.push(`      </li>`);
    } else if (type === "Thought") {
      lines.push(`      <li Class="DrAke.LanternsFramework.Condition_Thought">`);
      lines.push(`        <thought>${escapeXml(def)}</thought>`);
      if (p.scoreBonus != null) lines.push(`        <scoreBonus>${escapeXml(p.scoreBonus)}</scoreBonus>`);
      lines.push(`      </li>`);
    } else if (type === "Record") {
      lines.push(`      <li Class="DrAke.LanternsFramework.Condition_Record">`);
      lines.push(`        <record>${escapeXml(def)}</record>`);
      if (p.minValue != null) lines.push(`        <minValue>${escapeXml(p.minValue)}</minValue>`);
      if (p.maxValue != null) lines.push(`        <maxValue>${escapeXml(p.maxValue)}</maxValue>`);
      if (p.lowerIsBetter != null) lines.push(`        <lowerIsBetter>${escapeXml(p.lowerIsBetter)}</lowerIsBetter>`);
      if (p.scoreMultiplier != null) lines.push(`        <scoreMultiplier>${escapeXml(p.scoreMultiplier)}</scoreMultiplier>`);
      if (p.flatBonus != null) lines.push(`        <flatBonus>${escapeXml(p.flatBonus)}</flatBonus>`);
      lines.push(`      </li>`);
    }
  }

  lines.push("    </conditions>");
  return lines.join("\n") + "\n";
}

function buildReadme(state, textureChecklist) {
  const multiNote =
    state.gearGraphicClass === "Graphic_Multi" || (state.costume_generatedApparel || []).length
      ? `\nNotes:\n- For Graphic_Multi textures, RimWorld commonly mirrors east to west if you don't provide a west texture.\n`
      : "";

  return `# ${state.modName}\n\n` +
    `This mod was generated by Hero Gear Builder and depends on Lantern Core Framework (LanternsCore).\n\n` +
    `## Install\n\n` +
    `- Place this mod folder into your RimWorld Mods directory.\n` +
    `- Ensure Lantern Core Framework is enabled and loaded before this mod.\n\n` +
    `## Textures required\n\n` +
    textureChecklist.map((p) => `- \`${p}\``).join("\n") +
    `\n` +
    multiNote;
}

function renderExportPanel() {
  const state = getState();
  const issues = validate(state);
  byId("validation").textContent = issues.length ? issues.map((x) => `- ${x}`).join("\n") : "No issues detected.";

  const deps = computeDependencies(state);
  const depText = deps.length
    ? deps.map((d) => `- ${d.packageId}${d.displayName && d.displayName !== d.packageId ? ` (${d.displayName})` : ""}`).join("\n")
    : "(none)";
  const depEl = document.getElementById("dependencyChecklist");
  if (depEl) depEl.textContent = depText;

  const textures = buildTextureChecklist(state);
  byId("textureChecklist").textContent = textures.map((p) => `- ${p}`).join("\n");

  const xml = buildDefsXml(state);
  byId("xmlPreview").textContent = xml;
}

async function exportZip() {
  const state = getState();
  const issues = validate(state);
  if (issues.length) {
    alert(`Fix these issues before exporting:\n\n${issues.map((x) => `- ${x}`).join("\n")}`);
    return;
  }

  const modFolder = state.modName.replaceAll(/[^A-Za-z0-9 _-]/g, "").trim() || "HeroGearMod";
  const textures = buildTextureChecklist(state);

  const zip = new JSZip();
  zip.file(`${modFolder}/About/About.xml`, buildAboutXml(state));
  zip.file(`${modFolder}/Defs/Generated_Gear.xml`, buildDefsXml(state));
  zip.file(`${modFolder}/README.txt`, buildReadme(state, textures));

  // Empty folders (so users see where to put things)
  zip.folder(`${modFolder}/Textures`);
  zip.folder(`${modFolder}/Languages/English/Keyed`);

  const blob = await zip.generateAsync({ type: "blob" });
  const name = `${modFolder}.zip`;

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function wireTabs() {
  const tabs = qsa(".tab");
  const panels = qsa(".panel");

  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.remove("tab--active"));
      panels.forEach((p) => p.classList.remove("panel--active"));

      t.classList.add("tab--active");
      const key = t.dataset.tab;
      document.querySelector(`.panel[data-panel="${key}"]`)?.classList.add("panel--active");
      if (key === "export") renderExportPanel();
    });
  });
}

function wireAbilityPickers() {
  qsa('input[type="checkbox"][data-ability]').forEach((cb) => {
    cb.addEventListener("change", () => {
      rebuildAbilityEditors(readAbilityEditors());
      saveState();
    });
  });
}

function wireAutosave() {
  qsa("input,textarea,select").forEach((el) => {
    el.addEventListener("input", () => {
      saveState();
      const activePanel = document.querySelector(".panel.panel--active")?.dataset.panel;
      if (activePanel === "export") renderExportPanel();
    });
    el.addEventListener("change", () => {
      saveState();
      const activePanel = document.querySelector(".panel.panel--active")?.dataset.panel;
      if (activePanel === "export") renderExportPanel();
    });
  });
}

function wireActions() {
  byId("btnExport").addEventListener("click", exportZip);
  byId("btnReset").addEventListener("click", () => {
    if (!confirm("Reset all fields?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setDefaults();
    rebuildAbilityEditors([]);
    saveState();
    renderExportPanel();
  });

  const btnImportZip = document.getElementById("btnImportZip");
  const fileImportZip = document.getElementById("fileImportZip");
  if (btnImportZip && fileImportZip) {
    btnImportZip.addEventListener("click", () => fileImportZip.click());
    fileImportZip.addEventListener("change", async () => {
      const file = fileImportZip.files?.[0];
      fileImportZip.value = "";
      if (!file) return;
      if (!confirm("Import this ZIP and overwrite the current builder fields?")) return;
      try {
        await importBuilderZip(file);
        saveState();
        renderExportPanel();
        alert("Import complete.");
      } catch (e) {
        console.error(e);
        alert(`ZIP import failed: ${e?.message || e}`);
      }
    });
  }

  const btnImport = document.getElementById("btnImportFolder");
  if (btnImport) {
    btnImport.addEventListener("click", async () => {
      try {
        await importFromFolder();
      } catch (e) {
        console.error(e);
        alert(`Import failed: ${e?.message || e}`);
      }
    });
  }

  const btnClear = document.getElementById("btnClearImport");
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      if (!confirm("Clear all imported defs?")) return;
      clearDefIndex();
      applyDefIndexToDatalists(getOrCreateIndex());
    });
  }

  const btnAddExisting = document.getElementById("btnAddExistingApparel");
  if (btnAddExisting) {
    btnAddExisting.addEventListener("click", () => {
      const input = byId("existingApparelInput");
      const val = input.value.trim();
      if (!val) return;
      if (!isValidDefName(val)) {
        alert("Apparel defName is not valid.");
        return;
      }
      const items = readExistingCostumeList();
      writeExistingCostumeList([...items, val]);
      input.value = "";
      saveState();
      renderExportPanel();
    });
  }

    const btnAddGen = document.getElementById("btnAddGeneratedApparel");
    if (btnAddGen) {
      btnAddGen.addEventListener("click", () => {
      const defName = byId("genApparelDefName").value.trim();
      const label = byId("genApparelLabel").value.trim();
      const texPath = byId("genApparelTexPath").value.trim();
      const layers = parseCsvList(byId("genApparelLayers").value);
      const bodyParts = parseCsvList(byId("genApparelBodyParts").value);

      if (!defName || !isValidDefName(defName)) {
        alert("Generated apparel defName is missing/invalid.");
        return;
      }
      if (!texPath) {
        alert("Generated apparel texPath is required.");
        return;
      }
      if (!layers.length) {
        alert("Generated apparel needs at least one layer (e.g. Middle).");
        return;
      }
      if (!bodyParts.length) {
        alert("Generated apparel needs at least one bodyPartGroup (e.g. Torso).");
        return;
      }

      const items = readGeneratedCostumeList();
      if (items.some((x) => x.defName === defName)) {
        alert("That generated apparel defName already exists in this builder.");
        return;
      }

      writeGeneratedCostumeList([...items, { defName, label, texPath, layers, bodyParts }]);

      byId("genApparelDefName").value = "";
      byId("genApparelLabel").value = "";
      byId("genApparelTexPath").value = "";
      byId("genApparelLayers").value = "";
      byId("genApparelBodyParts").value = "";

      saveState();
      renderExportPanel();
      });
    }

    const btnAddGearBodyPartGroup = document.getElementById("btnAddGearBodyPartGroup");
    if (btnAddGearBodyPartGroup) {
      btnAddGearBodyPartGroup.addEventListener("click", () => {
        const input = byId("gearBodyPartGroupInput");
        const val = input.value.trim();
        if (!val) return;
        if (!isValidDefName(val)) {
          alert("BodyPartGroupDef is not valid.");
          return;
        }
        const items = readGearBodyPartGroups();
        writeGearBodyPartGroups([...items, val]);
        input.value = "";
        saveState();
        renderExportPanel();
      });
    }

    const btnAddGearLayer = document.getElementById("btnAddGearLayer");
    if (btnAddGearLayer) {
      btnAddGearLayer.addEventListener("click", () => {
        const input = byId("gearLayerInput");
        const val = input.value.trim();
        if (!val) return;
        if (!isValidDefName(val)) {
          alert("Apparel layer is not valid.");
          return;
        }
        const items = readGearLayers();
        writeGearLayers([...items, val]);
        input.value = "";
        saveState();
        renderExportPanel();
      });
    }

    const btnAddGearTag = document.getElementById("btnAddGearTag");
    if (btnAddGearTag) {
      btnAddGearTag.addEventListener("click", () => {
        const input = byId("gearTagInput");
        const val = input.value.trim();
        if (!val) return;
        const items = readGearTags();
        writeGearTags([...items, val]);
        input.value = "";
        saveState();
        renderExportPanel();
      });
    }

    const btnAddStat = document.getElementById("btnAddStatBuff");
    if (btnAddStat) {
      btnAddStat.addEventListener("click", () => {
      const stat = byId("statBuffStat").value.trim();
      const offset = toNum(byId("statBuffOffset").value, NaN);
      if (!stat || !isValidDefName(stat)) {
        alert("StatDef is missing/invalid.");
        return;
      }
      if (!Number.isFinite(offset) || offset === 0) {
        alert("Offset must be a non-zero number.");
        return;
      }

      const items = readStatBuffs();
      const without = items.filter((x) => x.stat !== stat);
      writeStatBuffs([...without, { stat, offset }]);
      byId("statBuffStat").value = "";
      byId("statBuffOffset").value = "";
      saveState();
      renderExportPanel();
    });
  }

  const btnAddCond = document.getElementById("btnAddCondition");
  if (btnAddCond) {
    btnAddCond.addEventListener("click", () => {
      const type = byId("condType").value;
      const def = byId("condDef").value.trim();
      const params = parseKeyValueParams(byId("condParamA").value);

      if (type !== "Mood" && !def) {
        alert("Condition def is required for this type.");
        return;
      }

      const items = readSelectionConditions();
      writeSelectionConditions([...items, { type, def: type === "Mood" ? "" : def, params }]);
      byId("condDef").value = "";
      byId("condParamA").value = "";
      saveState();
      renderExportPanel();
    });
  }
}

function parseXmlOrThrow(xmlText, context) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(xmlText || ""), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error(`Failed to parse XML (${context}).`);
  }
  return doc;
}

function xmlText(node, selector, fallback = "") {
  if (!node) return fallback;
  const el = selector ? node.querySelector(selector) : node;
  const t = el?.textContent?.trim();
  return t != null && t !== "" ? t : fallback;
}

function xmlBool(node, selector, fallback = false) {
  const t = xmlText(node, selector, "");
  if (!t) return fallback;
  return t.toLowerCase() === "true";
}

function xmlNum(node, selector, fallback) {
  const t = xmlText(node, selector, "");
  if (!t) return fallback;
  const n = Number(t);
  return Number.isFinite(n) ? n : fallback;
}

function xmlMaybeNum(node, selector) {
  const t = xmlText(node, selector, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function xmlTriState(node, selector) {
  const t = xmlText(node, selector, "");
  if (!t) return "default";
  return t.toLowerCase() === "true" ? "true" : "false";
}

function findDefsByTagAndDefName(doc, tagName, defName) {
  const all = Array.from(doc.getElementsByTagName(tagName) || []);
  for (const el of all) {
    const dn = xmlText(el, "defName", "");
    if (dn === defName) return el;
  }
  return null;
}

function abilityParentToKey(parentName) {
  const map = {
    Lantern_Ability_BlastBase: "Blast",
    Lantern_Ability_HealBase: "Heal",
    Lantern_Ability_StunBase: "Stun",
    Lantern_Ability_BarrierBase: "Barrier",
    Lantern_Ability_ConstructBase: "Construct",
    Lantern_Ability_SummonBase: "Summon",
    Lantern_Ability_AuraBase: "Aura",
    Lantern_Ability_FlightBase: "Flight",
    Lantern_Ability_TeleportBase: "Teleport",
    Lantern_Ability_DisplaceBase: "Displace",
    Lantern_Ability_PawnEffectBase: "Conditional",
  };
  return map[parentName] || null;
}

function flagsToTargetRule(flags) {
  const f = flags || {};
  const allowSelf = !!f.allowSelf;
  const allowAllies = !!f.allowAllies;
  const allowNeutral = !!f.allowNeutral;
  const allowHostiles = !!f.allowHostiles;
  const allowNoFaction = !!f.allowNoFaction;

  if (allowHostiles && !allowSelf && !allowAllies && !allowNeutral && !allowNoFaction) return "HostilesOnly";
  if (allowSelf && allowAllies && !allowNeutral && !allowHostiles && !allowNoFaction) return "AlliesOnly";
  if (allowSelf && allowAllies && allowNeutral && !allowHostiles && allowNoFaction) return "NonHostilesOnly";
  if (allowSelf && !allowAllies && !allowNeutral && !allowHostiles && !allowNoFaction) return "SelfOnly";
  return "Any";
}

function setValueIfPresent(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value == null ? "" : String(value);
}

function setCheckedIfPresent(id, checked) {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = !!checked;
}

function setSelectYesNoIfPresent(id, enabled) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = enabled ? "yes" : "no";
}

async function importBuilderZip(file) {
  if (!file) throw new Error("No ZIP file selected.");
  const zip = await JSZip.loadAsync(file);
  const paths = Object.keys(zip.files || {});

  const aboutPath = paths.find((p) => /\/About\/About\.xml$/i.test(p));
  if (!aboutPath) throw new Error("ZIP does not contain About/About.xml.");

  let defsPath = paths.find((p) => /\/Defs\/Generated_Gear\.xml$/i.test(p));
  if (!defsPath) {
    // Fallback: scan Defs/*.xml for LanternDefExtension (builder-generated gear)
    const defCandidates = paths.filter((p) => /\/Defs\/.+\.xml$/i.test(p));
    for (const p of defCandidates) {
      const text = await zip.file(p).async("text");
      if (text.includes("DrAke.LanternsFramework.LanternDefExtension")) {
        defsPath = p;
        break;
      }
    }
  }
  if (!defsPath) throw new Error("ZIP does not contain a LanternsCore gear defs XML (expected Defs/Generated_Gear.xml).");

  const aboutText = await zip.file(aboutPath).async("text");
  const defsText = await zip.file(defsPath).async("text");

  const aboutDoc = parseXmlOrThrow(aboutText, aboutPath);
  const defsDoc = parseXmlOrThrow(defsText, defsPath);

  const parsed = parseBuilderModFromXml(aboutDoc, defsDoc);
  applyImportedStateToUi(parsed);
}

function parseBuilderModFromXml(aboutDoc, defsDoc) {
  const out = {};

  const meta = aboutDoc.documentElement;
  out.modName = xmlText(meta, "name", "");
  out.modAuthor = xmlText(meta, "author", "");
  out.packageId = xmlText(meta, "packageId", "");
  out.modDesc = xmlText(meta, "description", "");

  const depIds = Array.from(meta.querySelectorAll("modDependencies > li > packageId"))
    .map((x) => x.textContent?.trim())
    .filter(Boolean);
  const extra = depIds.filter((p) => p !== "DrAke.LanternsCore");
  out.autoAddDependencies = false;
  out.extraDependencies = uniqueSorted(extra).join("\n");

  // Find the gear ThingDef (has LanternDefExtension)
  const thingDefs = Array.from(defsDoc.getElementsByTagName("ThingDef") || []);
  let gearThing = null;
  let ext = null;
  for (const td of thingDefs) {
    const e = td.querySelector('modExtensions > li[Class="DrAke.LanternsFramework.LanternDefExtension"]');
    if (e) {
      gearThing = td;
      ext = e;
      break;
    }
  }
  if (!gearThing || !ext) throw new Error("Could not find gear ThingDef with LanternDefExtension in defs XML.");

  out.ringDefName = xmlText(gearThing, "defName", "");
  out.ringLabel = xmlText(gearThing, "label", "");
  out.ringDesc = xmlText(gearThing, "description", "");

  const parentName = gearThing.getAttribute("ParentName") || "";
  const knownParents = new Set([
    "Lantern_RingBase",
    "Lantern_GearBeltBase",
    "Lantern_GearSuitBase",
    "Lantern_GearMaskBase",
    "Lantern_GearApparelBase",
  ]);
  if (knownParents.has(parentName)) {
    out.gearParent = parentName;
    out.gearParentCustom = "";
  } else {
    out.gearParent = "custom";
    out.gearParentCustom = parentName;
  }

    out.ringTexPath = xmlText(gearThing, "graphicData > texPath", "");
    const gc = xmlText(gearThing, "graphicData > graphicClass", "Graphic_Single");
    out.gearGraphicClass = gc === "Graphic_Multi" ? "Graphic_Multi" : "Graphic_Single";

    out.marketValue = xmlNum(gearThing, "statBases > MarketValue", 5000);
    out.mass = xmlNum(gearThing, "statBases > Mass", 0.1);
    out.techLevel = xmlText(gearThing, "techLevel", "default");
    out.smeltable = xmlTriState(gearThing, "smeltable");
    out.flammability = xmlMaybeNum(gearThing, "statBases > Flammability");
    out.equipDelay = xmlMaybeNum(gearThing, "statBases > EquipDelay");
    out.deteriorationRate = xmlMaybeNum(gearThing, "statBases > DeteriorationRate");

    const apparelNode = gearThing.querySelector("apparel");
    out.careIfWornByCorpse = apparelNode ? xmlTriState(apparelNode, "careIfWornByCorpse") : "default";
    out.careIfDamaged = apparelNode ? xmlTriState(apparelNode, "careIfDamaged") : "default";
    out.countsAsClothingForNudity = apparelNode ? xmlTriState(apparelNode, "countsAsClothingForNudity") : "default";
    out.gearBodyPartGroups = Array.from(gearThing.querySelectorAll("apparel > bodyPartGroups > li"))
      .map((x) => x.textContent?.trim())
      .filter(Boolean);
    out.gearLayers = Array.from(gearThing.querySelectorAll("apparel > layers > li"))
      .map((x) => x.textContent?.trim())
      .filter(Boolean);
    out.gearTags = Array.from(gearThing.querySelectorAll("apparel > tags > li"))
      .map((x) => x.textContent?.trim())
      .filter(Boolean);

  // Extension basics
  out.ringColor = xmlText(ext, "ringColor", "(1, 1, 1, 1)");
  out.resourceLabel = xmlText(ext, "resourceLabel", "Willpower");
  out.showChargeGizmo = xmlBool(ext, "showChargeGizmo", true);
  out.maxCharge = xmlNum(ext, "maxCharge", 1);
  out.passiveRegenPerDay = xmlNum(ext, "passiveRegenPerDay", 0);
  out.passiveDrainPerDay = xmlNum(ext, "passiveDrainPerDay", 0);

  out.regenFromMood = xmlBool(ext, "regenFromMood", false);
  out.moodMin = xmlNum(ext, "moodMin", 0.8);
  out.moodRegenPerDay = xmlNum(ext, "moodRegenPerDay", 0.1);

  out.regenFromPain = xmlBool(ext, "regenFromPain", false);
  out.painMin = xmlNum(ext, "painMin", 0.2);
  out.painRegenPerDay = xmlNum(ext, "painRegenPerDay", 0.1);

  out.regenFromSunlight = xmlBool(ext, "regenFromSunlight", false);
  out.sunlightMinGlow = xmlNum(ext, "sunlightMinGlow", 0.5);
  out.sunlightRegenPerDay = xmlNum(ext, "sunlightRegenPerDay", 0.1);

  out.regenFromPsyfocus = xmlBool(ext, "regenFromPsyfocus", false);
  out.psyfocusMin = xmlNum(ext, "psyfocusMin", 0.5);
  out.psyfocusRegenPerDay = xmlNum(ext, "psyfocusRegenPerDay", 0.1);

  out.regenFromNearbyAllies = xmlBool(ext, "regenFromNearbyAllies", false);
  out.alliesRadius = xmlNum(ext, "alliesRadius", 10);
  out.alliesMaxCount = xmlNum(ext, "alliesMaxCount", 5);
  out.alliesRegenPerDayEach = xmlNum(ext, "alliesRegenPerDayEach", 0.02);

  out.associatedHediff = xmlText(ext, "associatedHediff", "");

  out.allowBatteryManifest = xmlBool(ext, "allowBatteryManifest", false);
  out.batteryDef = xmlText(ext, "batteryDef", "");
  out.batteryManifestCost = xmlNum(ext, "batteryManifestCost", 0.5);

  out.reactiveEvadeProjectiles = xmlBool(ext, "reactiveEvadeProjectiles", false);
  out.reactiveEvadeProjectilesCost = xmlNum(ext, "reactiveEvadeProjectilesCost", 0.02);
  out.reactiveEvadeProjectilesCooldownTicks = Math.max(0, Math.floor(xmlNum(ext, "reactiveEvadeProjectilesCooldownTicks", 60)));
  out.reactiveEvadeAllowExplosiveProjectiles = xmlBool(ext, "reactiveEvadeAllowExplosiveProjectiles", false);
  out.reactiveEvadeToggleGizmo = xmlBool(ext, "reactiveEvadeToggleGizmo", false);
  out.reactiveEvadeDefaultEnabled = xmlBool(ext, "reactiveEvadeDefaultEnabled", true);
  out.reactiveEvadeGasType = xmlText(ext, "reactiveEvadeGasType", "BlindSmoke");
  out.reactiveEvadeGasRadius = xmlNum(ext, "reactiveEvadeGasRadius", 2.4);
  out.reactiveEvadeGasAmount = Math.max(0, Math.floor(xmlNum(ext, "reactiveEvadeGasAmount", 60)));

  // Stealth
  out.enableStealth = xmlBool(ext, "stealthEnabled", false);
  out.stealthHediff = xmlText(ext, "stealthHediff", "");
  out.stealthToggleGizmo = xmlBool(ext, "stealthToggleGizmo", true);
  out.stealthDefaultOn = xmlBool(ext, "stealthDefaultOn", false);
  out.stealthBreakOnAttack = xmlBool(ext, "stealthBreakOnAttack", false);
  out.stealthPreventTargeting = xmlBool(ext, "stealthPreventTargeting", true);
  out.stealthGizmoIconPath = xmlText(ext, "stealthGizmoIconPath", "");
  out.stealthGizmoLabelKey = xmlText(ext, "stealthGizmoLabelKey", "");
  out.stealthGizmoDescKey = xmlText(ext, "stealthGizmoDescKey", "");
  out.stealthShowEnergyGizmo = xmlBool(ext, "stealthShowEnergyGizmo", false);
  out.stealthEnergyLabel = xmlText(ext, "stealthEnergyLabel", "Stealth");
  out.stealthEnergyColor = xmlText(ext, "stealthEnergyColor", "(0.2, 0.6, 0.8, 1)");
  out.stealthEnergyMax = xmlNum(ext, "stealthEnergyMax", 1);
  out.stealthEnergyStartPercent = xmlNum(ext, "stealthEnergyStartPercent", 1);
  out.stealthEnergyDrainPerSecond = xmlNum(ext, "stealthEnergyDrainPerSecond", 0);
  out.stealthEnergyRegenPerDay = xmlNum(ext, "stealthEnergyRegenPerDay", 1);
  out.stealthSeeThroughPawnKinds = Array.from(ext.querySelectorAll("stealthSeeThroughPawnKinds > li"))
    .map((x) => x.textContent?.trim())
    .filter(Boolean);
  out.stealthSeeThroughHediffs = Array.from(ext.querySelectorAll("stealthSeeThroughHediffs > li"))
    .map((x) => x.textContent?.trim())
    .filter(Boolean);

  // Influence (persistent)
  out.corruptionHediff = xmlText(ext, "corruptionHediff", "");
  out.corruptionInitialSeverity = xmlNum(ext, "corruptionInitialSeverity", 0.01);
  out.corruptionGainPerDay = xmlNum(ext, "corruptionGainPerDay", 0.05);
  out.corruptionTickIntervalSeconds = xmlNum(ext, "corruptionTickIntervalSeconds", 1);
  out.corruptionStealthMultiplier = xmlNum(ext, "corruptionStealthMultiplier", 1);
  out.attentionMultiplier = xmlNum(ext, "attentionMultiplier", 1);
  out.corruptionMentalStates = Array.from(ext.querySelectorAll("corruptionMentalStates > li")).map((li) => ({
    mentalState: xmlText(li, "mentalState", ""),
    minSeverity: xmlNum(li, "minSeverity", 0.5),
    maxSeverity: xmlNum(li, "maxSeverity", 1),
    chancePerCheck: xmlNum(li, "chancePerCheck", 0.05),
    checkIntervalTicks: Math.max(1, Math.floor(xmlNum(li, "checkIntervalTicks", 1000))),
    requireNotAlreadyInState: xmlBool(li, "requireNotAlreadyInState", true),
  })).filter((x) => x.mentalState);

  // Ambient influence
  out.ambientInfluenceEnabled = xmlBool(ext, "ambientInfluenceEnabled", false);
  out.ambientInfluenceHediff = xmlText(ext, "ambientInfluenceHediff", "");
  out.ambientInfluenceOnlyWhenUnworn = xmlBool(ext, "ambientInfluenceOnlyWhenUnworn", true);
  out.ambientInfluenceOnlyWhenBuried = xmlBool(ext, "ambientInfluenceOnlyWhenBuried", false);
  out.ambientInfluenceSkipWearers = xmlBool(ext, "ambientInfluenceSkipWearers", true);
  out.ambientInfluenceAffectsColonistsOnly = xmlBool(ext, "ambientInfluenceAffectsColonistsOnly", true);
  out.ambientInfluenceAffectsHumanlikeOnly = xmlBool(ext, "ambientInfluenceAffectsHumanlikeOnly", true);
  out.ambientInfluenceRadius = xmlNum(ext, "ambientInfluenceRadius", 0);
  out.ambientInfluenceIntervalSeconds = xmlNum(ext, "ambientInfluenceIntervalSeconds", 4);
  out.ambientInfluenceInitialSeverity = xmlNum(ext, "ambientInfluenceInitialSeverity", 0.02);
  out.ambientInfluenceSeverityPerTick = xmlNum(ext, "ambientInfluenceSeverityPerTick", 0.002);
  out.ambientInfluenceBreakThreshold = xmlNum(ext, "ambientInfluenceBreakThreshold", 0.8);
  out.ambientInfluenceBreakChance = xmlNum(ext, "ambientInfluenceBreakChance", 0.05);
  out.ambientInfluenceMentalState = xmlText(ext, "ambientInfluenceMentalState", "");

  // Wearer influence
  out.wearerInfluenceEnabled = xmlBool(ext, "wearerInfluenceEnabled", false);
  out.wearerInfluenceHediff = xmlText(ext, "wearerInfluenceHediff", "");
  out.wearerInfluenceAffectsColonistsOnly = xmlBool(ext, "wearerInfluenceAffectsColonistsOnly", false);
  out.wearerInfluenceAffectsHumanlikeOnly = xmlBool(ext, "wearerInfluenceAffectsHumanlikeOnly", true);
  out.wearerInfluenceSkipWearer = xmlBool(ext, "wearerInfluenceSkipWearer", true);
  out.wearerInfluenceRadius = xmlNum(ext, "wearerInfluenceRadius", 10);
  out.wearerInfluenceIntervalSeconds = xmlNum(ext, "wearerInfluenceIntervalSeconds", 4);
  out.wearerInfluenceInitialSeverity = xmlNum(ext, "wearerInfluenceInitialSeverity", 0.05);
  out.wearerInfluenceSeverityPerTick = xmlNum(ext, "wearerInfluenceSeverityPerTick", 0.01);
  out.wearerInfluenceBreakThreshold = xmlNum(ext, "wearerInfluenceBreakThreshold", 0.8);
  out.wearerInfluenceBreakChance = xmlNum(ext, "wearerInfluenceBreakChance", 0.05);
  out.wearerInfluenceMentalState = xmlText(ext, "wearerInfluenceMentalState", "");
  out.wearerInfluenceTraitModifiers = Array.from(ext.querySelectorAll("wearerInfluenceTraitModifiers > li")).map((li) => ({
    trait: xmlText(li, "trait", ""),
    degree: xmlNum(li, "degree", 0),
    severityMultiplier: xmlNum(li, "severityMultiplier", 1),
    severityOffset: xmlNum(li, "severityOffset", 0),
  })).filter((x) => x.trait);

  // Autonomy
  out.autoEquipEnabled = xmlBool(ext, "autoEquipEnabled", false);
  out.autoEquipChance = xmlNum(ext, "autoEquipChance", 1);
  out.autoEquipScoreBonus = xmlNum(ext, "autoEquipScoreBonus", 0);
  out.autoEquipAllowDrafted = xmlBool(ext, "autoEquipAllowDrafted", false);
  out.autoEquipTraitBonuses = Array.from(ext.querySelectorAll("autoEquipTraitBonuses > li")).map((li) => ({
    trait: xmlText(li, "trait", ""),
    degree: xmlNum(li, "degree", 0),
    scoreOffset: xmlNum(li, "scoreOffset", 10),
  })).filter((x) => x.trait);
  out.autoEquipHediffBonuses = Array.from(ext.querySelectorAll("autoEquipHediffBonuses > li")).map((li) => ({
    hediff: xmlText(li, "hediff", ""),
    minSeverity: xmlNum(li, "minSeverity", 0),
    maxSeverity: xmlNum(li, "maxSeverity", 9999),
    scoreOffset: xmlNum(li, "scoreOffset", 10),
    severityMultiplier: xmlNum(li, "severityMultiplier", 0),
  })).filter((x) => x.hediff);

  // Persistence
  out.refuseRemoval = xmlBool(ext, "refuseRemoval", false);
  out.refuseRemovalHediff = xmlText(ext, "refuseRemovalHediff", "");
  out.refuseRemovalMinSeverity = xmlNum(ext, "refuseRemovalMinSeverity", 0.5);
  out.refuseRemovalMessageKey = xmlText(ext, "refuseRemovalMessageKey", "Lantern_RefuseRemoval");
  out.forceDropOnWearerDeath = xmlBool(ext, "forceDropOnWearerDeath", false);
  out.forceDropOnCorpseDestroy = xmlBool(ext, "forceDropOnCorpseDestroy", false);
  out.forceDropOnGraveEject = xmlBool(ext, "forceDropOnGraveEject", false);

  // Costume/transformation
  const apparel = Array.from(ext.querySelectorAll("transformationApparel > li"))
    .map((x) => x.textContent?.trim())
    .filter(Boolean);
  out.enableCostume = apparel.length > 0;
  out.transformationOnlyWhenDrafted = xmlBool(ext, "transformationOnlyWhenDrafted", false);
  out.transformationSkipConflictingApparel = xmlBool(ext, "transformationSkipConflictingApparel", false);

  out.transformationAllowMaleGender = xmlBool(ext, "transformationAllowMaleGender", true);
  out.transformationAllowFemaleGender = xmlBool(ext, "transformationAllowFemaleGender", true);
  out.transformationAllowNoneGender = xmlBool(ext, "transformationAllowNoneGender", true);

  const disallowed = new Set(
    Array.from(ext.querySelectorAll("transformationDisallowedBodyTypes > li"))
      .map((x) => x.textContent?.trim())
      .filter(Boolean)
  );
  out.transformationDisallowBodyTypeThin = disallowed.has("Thin");
  out.transformationDisallowBodyTypeFat = disallowed.has("Fat");
  out.transformationDisallowBodyTypeHulk = disallowed.has("Hulk");

  out.transformationToggleGizmo = xmlBool(ext, "transformationToggleGizmo", false);
  out.transformationToggleDefaultOn = xmlBool(ext, "transformationToggleDefaultOn", true);

  const skipIfMissing = xmlBool(ext, "transformationSkipIfMissingWornGraphic", false);
  const overrideBodyType = xmlBool(ext, "transformationOverrideBodyType", false);
  if (skipIfMissing) out.transformationMissingGraphicBehavior = "skip";
  else if (overrideBodyType) out.transformationMissingGraphicBehavior = "override";
  else out.transformationMissingGraphicBehavior = "none";

  out.transformationOverrideBodyType = overrideBodyType;
  out.transformationOverrideBodyTypeOnlyIfMissing = xmlBool(ext, "transformationOverrideBodyTypeOnlyIfMissing", true);
  out.transformationBodyTypeOverride = xmlText(ext, "transformationBodyTypeOverride", "Male");

  // Costume lists: generated vs existing
  const generated = [];
  const existing = [];
  for (const defName of apparel) {
    const td = findDefsByTagAndDefName(defsDoc, "ThingDef", defName);
    const worn = td ? xmlText(td, "apparel > wornGraphicPath", "") : "";
    if (td && worn) {
      generated.push({
        defName,
        label: xmlText(td, "label", defName),
        texPath: worn,
        layers: Array.from(td.querySelectorAll("apparel > layers > li")).map((x) => x.textContent?.trim()).filter(Boolean),
        bodyParts: Array.from(td.querySelectorAll("apparel > bodyPartGroups > li")).map((x) => x.textContent?.trim()).filter(Boolean),
      });
    } else {
      existing.push(defName);
    }
  }
  out.costume_generatedApparel = generated;
  out.costume_existingApparel = existing;

  // Stat buffs (hediffsWhileWorn -> HediffDef stages/statOffsets)
  const hediffsWhileWorn = Array.from(ext.querySelectorAll("hediffsWhileWorn > li"))
    .map((x) => x.textContent?.trim())
    .filter(Boolean);
  out.statBuffs = [];
  if (hediffsWhileWorn.length) {
    for (const hd of hediffsWhileWorn) {
      const h = findDefsByTagAndDefName(defsDoc, "HediffDef", hd);
      const statOffsets = h?.querySelector("stages > li > statOffsets");
      if (!statOffsets) continue;
      const buffs = [];
      for (const child of Array.from(statOffsets.children || [])) {
        const stat = child.tagName;
        const offset = Number(child.textContent?.trim() || "0");
        if (stat && Number.isFinite(offset) && offset !== 0) buffs.push({ stat, offset });
      }
      if (buffs.length) {
        out.statBuffs = buffs;
        break;
      }
    }
  }

  // Abilities
  const abilityDefNames = Array.from(ext.querySelectorAll("abilities > li"))
    .map((x) => x.textContent?.trim())
    .filter(Boolean);

  const abilities = [];
  for (const defName of abilityDefNames) {
    const ad = findDefsByTagAndDefName(defsDoc, "AbilityDef", defName);
    if (!ad) continue;
    const parent = ad.getAttribute("ParentName") || "";
    const key = abilityParentToKey(parent);
    if (!key) continue;

    const a = {
      key,
      parent,
      defName,
      label: xmlText(ad, "label", ""),
      iconPath: xmlText(ad, "iconPath", ""),
      description: xmlText(ad, "description", ""),
      cost: 0.05,
      cooldownTicks: 0,
      maxCastsPerDay: 0,
      targetRule: "Any",
      pauseOnClick: false,
    };

    a.range = xmlNum(ad, "verbProperties > range", 0);
    if (!(a.range > 0)) delete a.range;

    if (key === "Blast") {
      a.muteSoundCast = xmlBool(ad, "verbProperties > muteSoundCast", false);
      a.soundCastOverride = xmlText(ad, "verbProperties > soundCastOverride", "");
    }

    const comps = Array.from(ad.querySelectorAll("comps > li"));
    const getComp = (cls) => comps.find((c) => c.getAttribute("Class") === cls) || null;

    const pause = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternPauseOnInput");
    if (pause) a.pauseOnClick = xmlBool(pause, "pause", true);

    const costComp = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternCost");
    if (costComp) a.cost = xmlNum(costComp, "cost", 0.05);
    if (key === "Flight" && !costComp) a.cost = 0;

    const lim = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternCastLimits");
    if (lim) {
      a.cooldownTicks = Math.max(0, Math.floor(xmlNum(lim, "cooldownTicks", 0)));
      a.maxCastsPerDay = Math.max(0, Math.floor(xmlNum(lim, "maxCastsPerDay", 0)));
    }

    const rules = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternTargetRules");
    if (rules) {
      a.targetRule = flagsToTargetRule({
        allowSelf: xmlBool(rules, "allowSelf", true),
        allowAllies: xmlBool(rules, "allowAllies", true),
        allowNeutral: xmlBool(rules, "allowNeutral", true),
        allowHostiles: xmlBool(rules, "allowHostiles", true),
        allowNoFaction: xmlBool(rules, "allowNoFaction", true),
      });
    }

    // Ability-specific
    const heal = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternHeal");
    if (heal) {
      a.healAmount = xmlNum(heal, "healAmount", 10);
      a.radius = xmlNum(heal, "radius", 0);
    }

    const stun = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternStun");
    if (stun) {
      a.stunTicks = Math.max(1, Math.floor(xmlNum(stun, "stunTicks", 180)));
      a.radius = xmlNum(stun, "radius", 0);
      a.affectHostilesOnly = xmlBool(stun, "affectHostilesOnly", true);
    }

    const aura = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternBuffAura");
    if (aura) {
      a.severity = xmlNum(aura, "severity", 0.12);
      a.radius = xmlNum(aura, "radius", 6);
      a.durationTicks = Math.max(0, Math.floor(xmlNum(aura, "durationTicks", 6000)));
    }

    const construct = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternConstructSpawn");
    if (construct) {
      a.thingDef = xmlText(construct, "thingDef", "Sandbags");
      a.spawnCount = Math.max(1, Math.floor(xmlNum(construct, "spawnCount", 1)));
      a.durationTicks = Math.max(0, Math.floor(xmlNum(construct, "durationTicks", 6000)));
    }

    const summon = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternSummon");
    if (summon) {
      a.pawnKind = xmlText(summon, "pawnKind", "");
      a.count = Math.max(1, Math.floor(xmlNum(summon, "count", 1)));
      a.durationTicks = Math.max(0, Math.floor(xmlNum(summon, "durationTicks", 6000)));
    }

    const tp = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternTeleport");
    if (tp) {
      a.allowRoofed = xmlBool(tp, "allowRoofed", true);
      a.allowOccupied = xmlBool(tp, "allowOccupied", false);
      a.spawnGasAtOrigin = xmlBool(tp, "spawnGasAtOrigin", false);
      a.spawnGasAtDestination = xmlBool(tp, "spawnGasAtDestination", false);
      a.gasType = xmlText(tp, "gasType", "BlindSmoke");
      a.gasRadius = xmlNum(tp, "gasRadius", 2.4);
      a.gasAmount = Math.max(0, Math.floor(xmlNum(tp, "gasAmount", 60)));
      a.gasDurationTicks = Math.max(0, Math.floor(xmlNum(tp, "gasDurationTicks", 0)));
    }

    const conditional = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternConditionalPawnOutcome");
    if (conditional) {
      a.fleshOutcome = xmlText(conditional, "fleshOutcome", "Down");
      a.mechOutcome = xmlText(conditional, "mechOutcome", "Kill");
      a.anomalyOutcome = xmlText(conditional, "anomalyOutcome", "Kill");
      a.otherOutcome = xmlText(conditional, "otherOutcome", "None");
    }

    const disp = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternDisplace");
    if (disp) {
      a.distance = Math.max(0, Math.floor(xmlNum(disp, "distance", 4)));
      a.pullTowardsCaster = xmlBool(disp, "pullTowardsCaster", false);
      a.requireLineOfSight = xmlBool(disp, "requireLineOfSight", false);
    }

    const shield = getComp("DrAke.LanternsFramework.Abilities.CompProperties_LanternShieldAbility");
    if (shield) {
      a.radius = xmlNum(shield, "radius", 0);
      const shieldHediff = xmlText(shield, "shieldHediffDef", "");
      a.shieldMaxHp = 200;
      if (shieldHediff) {
        const h = findDefsByTagAndDefName(defsDoc, "HediffDef", shieldHediff);
        const hp = h
          ? xmlNum(h, 'comps > li[Class="DrAke.LanternsFramework.Abilities.HediffCompProperties_LanternShield"] > defaultMaxHp', 200)
          : 200;
        a.shieldMaxHp = Math.max(1, Math.floor(hp));
      }
    }

    abilities.push(a);
  }
  out.abilities = abilities;

  // Selection def
  const sel = defsDoc.getElementsByTagName("DrAke.LanternsFramework.RingSelectionDef")?.[0] || null;
  out.enableSelection = !!sel;
  out.selectionDefName = sel ? xmlText(sel, "defName", derivedDefName(out.ringDefName, "Selection")) : derivedDefName(out.ringDefName, "Selection");
  out.selectionTrigger = "onJoin";
  if (sel) {
    if (xmlBool(sel, "triggerOnSpawnedOnMap", false)) out.selectionTrigger = "onSpawn";
    if (xmlBool(sel, "triggerMentalState", false)) out.selectionTrigger = "onMental";
    if (xmlBool(sel, "triggerOnJoinPlayerFaction", false)) out.selectionTrigger = "onJoin";
  }
  out.excludeIfHasAnyLanternRing = sel ? xmlBool(sel, "excludeIfHasAnyLanternRing", true) : true;

  const filterDefaults = {
    sel_allowColonists: true,
    sel_allowPrisoners: false,
    sel_allowSlaves: false,
    sel_allowGuests: false,
    sel_allowAnimals: false,
    sel_allowMechs: false,
    sel_allowHostiles: false,
    sel_allowDead: false,
    sel_allowDowned: false,
    sel_requireViolenceCapable: true,
  };
  for (const [k, v] of Object.entries(filterDefaults)) out[k] = v;
  if (sel) {
    out.sel_allowColonists = xmlBool(sel, "allowColonists", true);
    out.sel_allowPrisoners = xmlBool(sel, "allowPrisoners", false);
    out.sel_allowSlaves = xmlBool(sel, "allowSlaves", false);
    out.sel_allowGuests = xmlBool(sel, "allowGuests", false);
    out.sel_allowAnimals = xmlBool(sel, "allowAnimals", false);
    out.sel_allowMechs = xmlBool(sel, "allowMechs", false);
    out.sel_allowHostiles = xmlBool(sel, "allowHostiles", false);
    out.sel_allowDead = xmlBool(sel, "allowDead", false);
    out.sel_allowDowned = xmlBool(sel, "allowDowned", false);
    out.sel_requireViolenceCapable = xmlBool(sel, "requireViolenceCapable", true);
  }

  const conds = [];
  if (sel) {
    for (const li of Array.from(sel.querySelectorAll("conditions > li") || [])) {
      const cls = li.getAttribute("Class") || "";
      const params = {};
      let type = null;
      let def = "";

      if (cls.endsWith(".Condition_Trait")) {
        type = "Trait";
        def = xmlText(li, "trait", "");
        if (li.querySelector("degree")) params.degree = xmlText(li, "degree", "");
        if (li.querySelector("scoreBonus")) params.scoreBonus = xmlText(li, "scoreBonus", "");
      } else if (cls.endsWith(".Condition_Stat")) {
        type = "Stat";
        def = xmlText(li, "stat", "");
        if (li.querySelector("lowerIsBetter")) params.lowerIsBetter = xmlText(li, "lowerIsBetter", "");
        if (li.querySelector("scoreMultiplier")) params.scoreMultiplier = xmlText(li, "scoreMultiplier", "");
      } else if (cls.endsWith(".Condition_Skill")) {
        type = "Skill";
        def = xmlText(li, "skill", "");
        if (li.querySelector("minLevel")) params.minLevel = xmlText(li, "minLevel", "");
        if (li.querySelector("scoreMultiplier")) params.scoreMultiplier = xmlText(li, "scoreMultiplier", "");
        if (li.querySelector("flatBonus")) params.flatBonus = xmlText(li, "flatBonus", "");
      } else if (cls.endsWith(".Condition_Mood")) {
        type = "Mood";
        def = "";
        if (li.querySelector("lowerIsBetter")) params.lowerIsBetter = xmlText(li, "lowerIsBetter", "");
        if (li.querySelector("scoreMultiplier")) params.scoreMultiplier = xmlText(li, "scoreMultiplier", "");
        if (li.querySelector("flatBonus")) params.flatBonus = xmlText(li, "flatBonus", "");
      } else if (cls.endsWith(".Condition_Need")) {
        type = "Need";
        def = xmlText(li, "need", "");
        if (li.querySelector("minLevel")) params.minLevel = xmlText(li, "minLevel", "");
        if (li.querySelector("maxLevel")) params.maxLevel = xmlText(li, "maxLevel", "");
        if (li.querySelector("lowerIsBetter")) params.lowerIsBetter = xmlText(li, "lowerIsBetter", "");
        if (li.querySelector("scoreMultiplier")) params.scoreMultiplier = xmlText(li, "scoreMultiplier", "");
        if (li.querySelector("flatBonus")) params.flatBonus = xmlText(li, "flatBonus", "");
      } else if (cls.endsWith(".Condition_Thought")) {
        type = "Thought";
        def = xmlText(li, "thought", "");
        if (li.querySelector("scoreBonus")) params.scoreBonus = xmlText(li, "scoreBonus", "");
      } else if (cls.endsWith(".Condition_Record")) {
        type = "Record";
        def = xmlText(li, "record", "");
        if (li.querySelector("minValue")) params.minValue = xmlText(li, "minValue", "");
        if (li.querySelector("maxValue")) params.maxValue = xmlText(li, "maxValue", "");
        if (li.querySelector("lowerIsBetter")) params.lowerIsBetter = xmlText(li, "lowerIsBetter", "");
        if (li.querySelector("scoreMultiplier")) params.scoreMultiplier = xmlText(li, "scoreMultiplier", "");
        if (li.querySelector("flatBonus")) params.flatBonus = xmlText(li, "flatBonus", "");
      }

      if (type) conds.push({ type, def, params });
    }
  }
  out.sel_conditions = conds;

  // Discovery incident
  const incidentDefs = Array.from(defsDoc.getElementsByTagName("IncidentDef") || []);
  let discoveryIncident = null;
  let discoveryExt = null;
  for (const id of incidentDefs) {
    const e = id.querySelector('modExtensions > li[Class="DrAke.LanternsFramework.LanternDiscoveryIncidentExtension"]');
    if (e) {
      discoveryIncident = id;
      discoveryExt = e;
      break;
    }
  }

  out.enableDiscoveryEvent = !!discoveryIncident;
  out.discoveryIncidentDefName = discoveryIncident
    ? xmlText(discoveryIncident, "defName", derivedDefName(out.ringDefName, "Discovery"))
    : derivedDefName(out.ringDefName, "Discovery");
  out.discoveryIncidentCategory = discoveryIncident ? xmlText(discoveryIncident, "category", "Misc") : "Misc";
  out.discoveryIncidentBaseChance = discoveryIncident ? xmlNum(discoveryIncident, "baseChance", 0.1) : 0.1;
  out.discoveryMinRefireDays = discoveryIncident ? xmlMaybeNum(discoveryIncident, "minRefireDays") : null;
  out.discoveryPointsScaleable = discoveryIncident ? xmlTriState(discoveryIncident, "pointsScaleable") : "default";

  out.discoverySendLetter = discoveryExt ? xmlBool(discoveryExt, "sendLetter", true) : true;
  out.discoveryLetterLabel = discoveryExt ? xmlText(discoveryExt, "letterLabel", "") : "";
  out.discoveryLetterText = discoveryExt ? xmlText(discoveryExt, "letterText", "") : "";
  out.discoveryLetterLabelKey = discoveryExt ? xmlText(discoveryExt, "letterLabelKey", "") : "";
  out.discoveryLetterTextKey = discoveryExt ? xmlText(discoveryExt, "letterTextKey", "") : "";
  out.discoveryLetterDef = discoveryExt ? xmlText(discoveryExt, "letterDef", "") : "";
  if (out.discoveryLetterLabelKey === "Lantern_DiscoveryEvent_LetterLabel") out.discoveryLetterLabelKey = "";
  if (out.discoveryLetterTextKey === "Lantern_DiscoveryEvent_LetterText") out.discoveryLetterTextKey = "";
  if (out.discoveryLetterDef === "NeutralEvent") out.discoveryLetterDef = "";

  out.discoverySiteLabel = discoveryExt ? xmlText(discoveryExt, "siteLabel", "") : "";
  out.discoverySiteDescription = discoveryExt ? xmlText(discoveryExt, "siteDescription", "") : "";
  out.discoverySiteTimeoutDays = discoveryExt ? xmlNum(discoveryExt, "siteTimeoutDays", 15) : 15;
  out.discoveryMinDistanceTiles = discoveryExt ? xmlNum(discoveryExt, "minDistanceFromPlayerTiles", 6) : 6;
  out.discoveryMaxDistanceTiles = discoveryExt ? xmlNum(discoveryExt, "maxDistanceFromPlayerTiles", 40) : 40;
  out.discoveryTargetType = discoveryExt ? xmlText(discoveryExt, "targetType", "WorldSite") : "WorldSite";
  const incidentTags = discoveryIncident
    ? Array.from(discoveryIncident.querySelectorAll("targetTags > li")).map((x) => x.textContent?.trim()).filter(Boolean)
    : [];
  if (discoveryIncident && (!discoveryExt || !discoveryExt.querySelector("targetType"))) {
    if (incidentTags.includes("Map")) out.discoveryTargetType = "ActiveMap";
  }
  const expectedTag = out.discoveryTargetType === "ActiveMap" ? "Map" : "World";
  if (incidentTags.length === 1 && incidentTags[0] === expectedTag) {
    out.discoveryTargetTags = [];
  } else {
    out.discoveryTargetTags = incidentTags;
  }
  out.discoveryMapDropRadius = discoveryExt ? xmlNum(discoveryExt, "mapDropRadius", 10) : 10;
  out.discoveryMapDropPreferColony = discoveryExt ? xmlBool(discoveryExt, "mapDropPreferColony", true) : true;

  out.discoveryGearPlacement = discoveryExt ? xmlText(discoveryExt, "gearPlacement", "PawnWorn") : "PawnWorn";
  out.discoveryGearReceiver = discoveryExt ? xmlText(discoveryExt, "gearReceiver", "PreferAlive") : "PreferAlive";
  out.discoveryGearCount = discoveryExt ? xmlNum(discoveryExt, "gearCount", 1) : 1;

  out.discoveryPawnKind = discoveryExt ? xmlText(discoveryExt, "pawnKind", "") : "";
  out.discoveryPawnFaction = discoveryExt ? xmlText(discoveryExt, "pawnFaction", "") : "";
  out.discoveryAliveMin = discoveryExt ? xmlNum(discoveryExt, "alivePawnsMin", 0) : 0;
  out.discoveryAliveMax = discoveryExt ? xmlNum(discoveryExt, "alivePawnsMax", 0) : 0;
  out.discoveryDeadMin = discoveryExt ? xmlNum(discoveryExt, "deadPawnsMin", 1) : 1;
  out.discoveryDeadMax = discoveryExt ? xmlNum(discoveryExt, "deadPawnsMax", 1) : 1;
  out.discoveryAliveDowned = discoveryExt ? xmlBool(discoveryExt, "alivePawnsDowned", true) : true;
  out.discoveryPawnScatterRadius = discoveryExt ? xmlNum(discoveryExt, "pawnScatterRadius", 8) : 8;
  out.discoverySpawnPawnsInDropPods = discoveryExt ? xmlBool(discoveryExt, "spawnPawnsInDropPods", true) : true;
  out.discoveryDropPodOpenDelaySeconds = discoveryExt ? xmlNum(discoveryExt, "dropPodOpenDelaySeconds", 2) : 2;

  out.discoverySpawnCrashDebris = discoveryExt ? xmlBool(discoveryExt, "spawnCrashDebris", true) : true;
  out.discoveryCrashChunkDef = discoveryExt ? xmlText(discoveryExt, "crashChunkDef", "") : "";
  out.discoveryCrashDebrisDef = discoveryExt ? xmlText(discoveryExt, "crashDebrisDef", "") : "";
  out.discoveryCrashDebrisCount = discoveryExt ? xmlNum(discoveryExt, "crashDebrisCount", 6) : 6;
  out.discoveryCrashDebrisRadius = discoveryExt ? xmlNum(discoveryExt, "crashDebrisRadius", 6) : 6;

  const timedExt = discoveryIncident
    ? discoveryIncident.querySelector('modExtensions > li[Class="DrAke.LanternsFramework.LanternTimedIncidentExtension"]')
    : null;
  out.enableTimedIncident = timedExt ? xmlBool(timedExt, "enabled", true) : false;
  out.timedIncidentMinDays = timedExt ? xmlNum(timedExt, "minDays", 1) : 1;
  out.timedIncidentMaxDays = timedExt ? xmlNum(timedExt, "maxDays", 2) : 2;
  out.timedIncidentRetryHours = timedExt ? xmlNum(timedExt, "retryHours", 1) : 1;
  out.timedIncidentFireOnce = timedExt ? xmlBool(timedExt, "fireOnce", true) : true;
  out.timedIncidentForce = timedExt ? xmlBool(timedExt, "force", true) : true;
  out.timedIncidentTarget = timedExt ? xmlText(timedExt, "target", "PlayerHomeMap") : "PlayerHomeMap";

  return out;
}

function applyImportedStateToUi(s) {
  setDefaults();

  setValueIfPresent("modName", s.modName);
  setValueIfPresent("modAuthor", s.modAuthor);
  setValueIfPresent("packageId", s.packageId);
  setValueIfPresent("modDesc", s.modDesc);
  setCheckedIfPresent("autoAddDependencies", !!s.autoAddDependencies);
  setValueIfPresent("extraDependencies", s.extraDependencies);

  setValueIfPresent("gearParent", s.gearParent || "Lantern_RingBase");
  setValueIfPresent("gearParentCustom", s.gearParentCustom || "");
  setValueIfPresent("gearGraphicClass", s.gearGraphicClass || "Graphic_Single");

  setValueIfPresent("ringDefName", s.ringDefName);
  setValueIfPresent("ringLabel", s.ringLabel);
  setValueIfPresent("ringDesc", s.ringDesc);
  setValueIfPresent("ringColor", s.ringColor);
  setValueIfPresent("resourceLabel", s.resourceLabel);
  setValueIfPresent("showChargeGizmo", s.showChargeGizmo === false ? "false" : "true");
    setValueIfPresent("ringTexPath", s.ringTexPath);
    setValueIfPresent("marketValue", s.marketValue);
    setValueIfPresent("mass", s.mass);
    setValueIfPresent("techLevel", s.techLevel || "default");
    setValueIfPresent("smeltable", s.smeltable || "default");
    setValueIfPresent("careIfWornByCorpse", s.careIfWornByCorpse || "default");
    setValueIfPresent("careIfDamaged", s.careIfDamaged || "default");
    setValueIfPresent("countsAsClothingForNudity", s.countsAsClothingForNudity || "default");
    setValueIfPresent("flammability", s.flammability ?? "");
    setValueIfPresent("equipDelay", s.equipDelay ?? "");
    setValueIfPresent("deteriorationRate", s.deteriorationRate ?? "");
    writeGearBodyPartGroups(s.gearBodyPartGroups || []);
    writeGearLayers(s.gearLayers || []);
    writeGearTags(s.gearTags || []);

    setSelectYesNoIfPresent("enableCostume", !!s.enableCostume);
  setValueIfPresent("associatedHediff", s.associatedHediff || "");

  setCheckedIfPresent("transformationAllowMaleGender", s.transformationAllowMaleGender ?? true);
  setCheckedIfPresent("transformationAllowFemaleGender", s.transformationAllowFemaleGender ?? true);
  setCheckedIfPresent("transformationAllowNoneGender", s.transformationAllowNoneGender ?? true);
  setCheckedIfPresent("transformationDisallowBodyTypeThin", !!s.transformationDisallowBodyTypeThin);
  setCheckedIfPresent("transformationDisallowBodyTypeFat", !!s.transformationDisallowBodyTypeFat);
  setCheckedIfPresent("transformationDisallowBodyTypeHulk", !!s.transformationDisallowBodyTypeHulk);
  setCheckedIfPresent("transformationOnlyWhenDrafted", !!s.transformationOnlyWhenDrafted);
  setCheckedIfPresent("transformationSkipConflictingApparel", !!s.transformationSkipConflictingApparel);
  setValueIfPresent("transformationMissingGraphicBehavior", s.transformationMissingGraphicBehavior || "none");
  setValueIfPresent("transformationToggleGizmo", s.transformationToggleGizmo ? "yes" : "no");
  setValueIfPresent("transformationToggleDefaultOn", s.transformationToggleDefaultOn === false ? "no" : "yes");
  setValueIfPresent("transformationOverrideBodyType", s.transformationOverrideBodyType ? "yes" : "no");
  setValueIfPresent("transformationOverrideBodyTypeOnlyIfMissing", s.transformationOverrideBodyTypeOnlyIfMissing === false ? "no" : "yes");
  // Body type override selector
  if (document.getElementById("transformationBodyTypeOverride")) {
    const builtin = ["Male", "Female", "Thin", "Fat", "Hulk"];
    const v = String(s.transformationBodyTypeOverride ?? "Male");
    byId("transformationBodyTypeOverride").value = builtin.includes(v) ? v : "custom";
    if (document.getElementById("transformationBodyTypeOverrideCustom")) byId("transformationBodyTypeOverrideCustom").value = builtin.includes(v) ? "" : v;
  }

  setCheckedIfPresent("allowBatteryManifest", !!s.allowBatteryManifest);
  setValueIfPresent("batteryDef", s.batteryDef || "");
  setValueIfPresent("batteryManifestCost", s.batteryManifestCost ?? 0.5);
  setValueIfPresent("reactiveEvadeProjectiles", s.reactiveEvadeProjectiles ? "true" : "false");
  setValueIfPresent("reactiveEvadeProjectilesCost", s.reactiveEvadeProjectilesCost ?? 0.02);
  setValueIfPresent("reactiveEvadeProjectilesCooldownTicks", s.reactiveEvadeProjectilesCooldownTicks ?? 60);
  setValueIfPresent("reactiveEvadeAllowExplosiveProjectiles", s.reactiveEvadeAllowExplosiveProjectiles ? "true" : "false");
  setValueIfPresent("reactiveEvadeToggleGizmo", s.reactiveEvadeToggleGizmo ? "true" : "false");
  setValueIfPresent("reactiveEvadeDefaultEnabled", s.reactiveEvadeDefaultEnabled === false ? "false" : "true");
  setValueIfPresent("reactiveEvadeGasType", s.reactiveEvadeGasType || "BlindSmoke");
  setValueIfPresent("reactiveEvadeGasRadius", s.reactiveEvadeGasRadius ?? 2.4);
  setValueIfPresent("reactiveEvadeGasAmount", s.reactiveEvadeGasAmount ?? 60);

  setSelectYesNoIfPresent("enableStealth", !!s.enableStealth);
  setValueIfPresent("stealthHediff", s.stealthHediff || "");
  setValueIfPresent("stealthToggleGizmo", s.stealthToggleGizmo === false ? "no" : "yes");
  setValueIfPresent("stealthDefaultOn", s.stealthDefaultOn ? "yes" : "no");
  setValueIfPresent("stealthBreakOnAttack", s.stealthBreakOnAttack ? "true" : "false");
  setValueIfPresent("stealthPreventTargeting", s.stealthPreventTargeting === false ? "false" : "true");
  setValueIfPresent("stealthGizmoIconPath", s.stealthGizmoIconPath || "");
  setValueIfPresent("stealthGizmoLabelKey", s.stealthGizmoLabelKey || "");
  setValueIfPresent("stealthGizmoDescKey", s.stealthGizmoDescKey || "");
  setValueIfPresent("stealthShowEnergyGizmo", s.stealthShowEnergyGizmo ? "true" : "false");
  setValueIfPresent("stealthEnergyLabel", s.stealthEnergyLabel || "Stealth");
  setValueIfPresent("stealthEnergyColor", s.stealthEnergyColor || "(0.2, 0.6, 0.8, 1)");
  setValueIfPresent("stealthEnergyMax", s.stealthEnergyMax ?? 1);
  setValueIfPresent("stealthEnergyStartPercent", s.stealthEnergyStartPercent ?? 1);
  setValueIfPresent("stealthEnergyDrainPerSecond", s.stealthEnergyDrainPerSecond ?? 0);
  setValueIfPresent("stealthEnergyRegenPerDay", s.stealthEnergyRegenPerDay ?? 1);
  writeStealthSeeThroughPawnKinds(s.stealthSeeThroughPawnKinds || []);
  writeStealthSeeThroughHediffs(s.stealthSeeThroughHediffs || []);

  setValueIfPresent("corruptionHediff", s.corruptionHediff || "");
  setValueIfPresent("corruptionInitialSeverity", s.corruptionInitialSeverity ?? 0.01);
  setValueIfPresent("corruptionGainPerDay", s.corruptionGainPerDay ?? 0.05);
  setValueIfPresent("corruptionTickIntervalSeconds", s.corruptionTickIntervalSeconds ?? 1);
  setValueIfPresent("corruptionStealthMultiplier", s.corruptionStealthMultiplier ?? 1);
  setValueIfPresent("attentionMultiplier", s.attentionMultiplier ?? 1);
  writeCorruptionMentalStates(s.corruptionMentalStates || []);

  setSelectYesNoIfPresent("ambientInfluenceEnabled", !!s.ambientInfluenceEnabled);
  setValueIfPresent("ambientInfluenceHediff", s.ambientInfluenceHediff || "");
  setValueIfPresent("ambientInfluenceOnlyWhenUnworn", s.ambientInfluenceOnlyWhenUnworn === false ? "false" : "true");
  setValueIfPresent("ambientInfluenceOnlyWhenBuried", s.ambientInfluenceOnlyWhenBuried ? "true" : "false");
  setValueIfPresent("ambientInfluenceSkipWearers", s.ambientInfluenceSkipWearers === false ? "false" : "true");
  setValueIfPresent("ambientInfluenceAffectsColonistsOnly", s.ambientInfluenceAffectsColonistsOnly === false ? "false" : "true");
  setValueIfPresent("ambientInfluenceAffectsHumanlikeOnly", s.ambientInfluenceAffectsHumanlikeOnly === false ? "false" : "true");
  setValueIfPresent("ambientInfluenceRadius", s.ambientInfluenceRadius ?? 0);
  setValueIfPresent("ambientInfluenceIntervalSeconds", s.ambientInfluenceIntervalSeconds ?? 4);
  setValueIfPresent("ambientInfluenceInitialSeverity", s.ambientInfluenceInitialSeverity ?? 0.02);
  setValueIfPresent("ambientInfluenceSeverityPerTick", s.ambientInfluenceSeverityPerTick ?? 0.002);
  setValueIfPresent("ambientInfluenceBreakThreshold", s.ambientInfluenceBreakThreshold ?? 0.8);
  setValueIfPresent("ambientInfluenceBreakChance", s.ambientInfluenceBreakChance ?? 0.05);
  setValueIfPresent("ambientInfluenceMentalState", s.ambientInfluenceMentalState || "");

  setSelectYesNoIfPresent("wearerInfluenceEnabled", !!s.wearerInfluenceEnabled);
  setValueIfPresent("wearerInfluenceHediff", s.wearerInfluenceHediff || "");
  setValueIfPresent("wearerInfluenceAffectsColonistsOnly", s.wearerInfluenceAffectsColonistsOnly ? "true" : "false");
  setValueIfPresent("wearerInfluenceAffectsHumanlikeOnly", s.wearerInfluenceAffectsHumanlikeOnly === false ? "false" : "true");
  setValueIfPresent("wearerInfluenceSkipWearer", s.wearerInfluenceSkipWearer === false ? "false" : "true");
  setValueIfPresent("wearerInfluenceRadius", s.wearerInfluenceRadius ?? 10);
  setValueIfPresent("wearerInfluenceIntervalSeconds", s.wearerInfluenceIntervalSeconds ?? 4);
  setValueIfPresent("wearerInfluenceInitialSeverity", s.wearerInfluenceInitialSeverity ?? 0.05);
  setValueIfPresent("wearerInfluenceSeverityPerTick", s.wearerInfluenceSeverityPerTick ?? 0.01);
  setValueIfPresent("wearerInfluenceBreakThreshold", s.wearerInfluenceBreakThreshold ?? 0.8);
  setValueIfPresent("wearerInfluenceBreakChance", s.wearerInfluenceBreakChance ?? 0.05);
  setValueIfPresent("wearerInfluenceMentalState", s.wearerInfluenceMentalState || "");
  writeWearerInfluenceTraitModifiers(s.wearerInfluenceTraitModifiers || []);

  setSelectYesNoIfPresent("autoEquipEnabled", !!s.autoEquipEnabled);
  setValueIfPresent("autoEquipChance", s.autoEquipChance ?? 1);
  setValueIfPresent("autoEquipScoreBonus", s.autoEquipScoreBonus ?? 0);
  setCheckedIfPresent("autoEquipAllowDrafted", !!s.autoEquipAllowDrafted);
  writeAutoEquipTraitBonuses(s.autoEquipTraitBonuses || []);
  writeAutoEquipHediffBonuses(s.autoEquipHediffBonuses || []);

  setSelectYesNoIfPresent("refuseRemoval", !!s.refuseRemoval);
  setValueIfPresent("refuseRemovalHediff", s.refuseRemovalHediff || "");
  setValueIfPresent("refuseRemovalMinSeverity", s.refuseRemovalMinSeverity ?? 0.5);
  setValueIfPresent("refuseRemovalMessageKey", s.refuseRemovalMessageKey || "Lantern_RefuseRemoval");
  setCheckedIfPresent("forceDropOnWearerDeath", !!s.forceDropOnWearerDeath);
  setCheckedIfPresent("forceDropOnCorpseDestroy", !!s.forceDropOnCorpseDestroy);
  setCheckedIfPresent("forceDropOnGraveEject", !!s.forceDropOnGraveEject);

  // Lists
  if (document.getElementById("existingApparelList")) writeExistingCostumeList(s.costume_existingApparel || []);
  if (document.getElementById("generatedApparelList")) writeGeneratedCostumeList(s.costume_generatedApparel || []);
  if (document.getElementById("statBuffList")) writeStatBuffs(s.statBuffs || []);

  // Charge
  setValueIfPresent("maxCharge", s.maxCharge ?? 1);
  setValueIfPresent("passiveRegenPerDay", s.passiveRegenPerDay ?? 0);
  setValueIfPresent("passiveDrainPerDay", s.passiveDrainPerDay ?? 0);

  setCheckedIfPresent("regenFromMood", !!s.regenFromMood);
  setValueIfPresent("moodMin", s.moodMin ?? 0.8);
  setValueIfPresent("moodRegenPerDay", s.moodRegenPerDay ?? 0.1);

  setCheckedIfPresent("regenFromPain", !!s.regenFromPain);
  setValueIfPresent("painMin", s.painMin ?? 0.2);
  setValueIfPresent("painRegenPerDay", s.painRegenPerDay ?? 0.1);

  setCheckedIfPresent("regenFromSunlight", !!s.regenFromSunlight);
  setValueIfPresent("sunlightMinGlow", s.sunlightMinGlow ?? 0.5);
  setValueIfPresent("sunlightRegenPerDay", s.sunlightRegenPerDay ?? 0.1);

  setCheckedIfPresent("regenFromPsyfocus", !!s.regenFromPsyfocus);
  setValueIfPresent("psyfocusMin", s.psyfocusMin ?? 0.5);
  setValueIfPresent("psyfocusRegenPerDay", s.psyfocusRegenPerDay ?? 0.1);

  setCheckedIfPresent("regenFromNearbyAllies", !!s.regenFromNearbyAllies);
  setValueIfPresent("alliesRadius", s.alliesRadius ?? 10);
  setValueIfPresent("alliesMaxCount", s.alliesMaxCount ?? 5);
  setValueIfPresent("alliesRegenPerDayEach", s.alliesRegenPerDayEach ?? 0.02);

  // Abilities
  const picks = new Set((s.abilities || []).map((a) => a.key));
  qsa('input[type="checkbox"][data-ability]').forEach((cb) => {
    cb.checked = picks.has(cb.dataset.ability);
  });
  rebuildAbilityEditors(s.abilities || []);

  // Selection
  setSelectYesNoIfPresent("enableSelection", !!s.enableSelection);
  setValueIfPresent("selectionDefName", s.selectionDefName || "");
  setValueIfPresent("selectionTrigger", s.selectionTrigger || "onJoin");
  setValueIfPresent("excludeIfHasAnyLanternRing", s.excludeIfHasAnyLanternRing ? "true" : "false");

  setCheckedIfPresent("sel_allowColonists", s.sel_allowColonists ?? true);
  setCheckedIfPresent("sel_allowPrisoners", !!s.sel_allowPrisoners);
  setCheckedIfPresent("sel_allowSlaves", !!s.sel_allowSlaves);
  setCheckedIfPresent("sel_allowGuests", !!s.sel_allowGuests);
  setCheckedIfPresent("sel_allowAnimals", !!s.sel_allowAnimals);
  setCheckedIfPresent("sel_allowMechs", !!s.sel_allowMechs);
  setCheckedIfPresent("sel_allowHostiles", !!s.sel_allowHostiles);
  setCheckedIfPresent("sel_allowDead", !!s.sel_allowDead);
  setCheckedIfPresent("sel_allowDowned", !!s.sel_allowDowned);
  setCheckedIfPresent("sel_requireViolenceCapable", s.sel_requireViolenceCapable ?? true);

  if (document.getElementById("conditionList")) {
    writeSelectionConditions(s.sel_conditions || []);
    renderSelectionConditions();
  }

  // Discovery event
  setSelectYesNoIfPresent("enableDiscoveryEvent", !!s.enableDiscoveryEvent);
    setValueIfPresent("discoveryIncidentDefName", s.discoveryIncidentDefName || "");
    setValueIfPresent("discoveryIncidentCategory", s.discoveryIncidentCategory || "Misc");
    setValueIfPresent("discoveryIncidentBaseChance", s.discoveryIncidentBaseChance ?? 0.1);
    setValueIfPresent("discoveryMinRefireDays", s.discoveryMinRefireDays ?? "");
    setValueIfPresent("discoveryPointsScaleable", s.discoveryPointsScaleable || "default");
    setValueIfPresent("discoverySendLetter", s.discoverySendLetter === false ? "no" : "yes");
    setValueIfPresent("discoveryLetterLabel", s.discoveryLetterLabel || "");
    setValueIfPresent("discoveryLetterText", s.discoveryLetterText || "");
    setValueIfPresent("discoveryLetterLabelKey", s.discoveryLetterLabelKey || "");
    setValueIfPresent("discoveryLetterTextKey", s.discoveryLetterTextKey || "");
    setValueIfPresent("discoveryLetterDef", s.discoveryLetterDef || "");
    setValueIfPresent("discoveryTargetType", s.discoveryTargetType || "WorldSite");
    const targetTags = Array.isArray(s.discoveryTargetTags) ? s.discoveryTargetTags : parseCsvList(s.discoveryTargetTags || "");
    setValueIfPresent("discoveryTargetTags", targetTags.length ? targetTags.join(", ") : "");
  setValueIfPresent("discoverySiteLabel", s.discoverySiteLabel || "");
  setValueIfPresent("discoverySiteDescription", s.discoverySiteDescription || "");
  setValueIfPresent("discoverySiteTimeoutDays", s.discoverySiteTimeoutDays ?? 15);
  setValueIfPresent("discoveryMinDistanceTiles", s.discoveryMinDistanceTiles ?? 6);
  setValueIfPresent("discoveryMaxDistanceTiles", s.discoveryMaxDistanceTiles ?? 40);
  setValueIfPresent("discoveryMapDropRadius", s.discoveryMapDropRadius ?? 10);
  setCheckedIfPresent("discoveryMapDropPreferColony", s.discoveryMapDropPreferColony ?? true);
  setValueIfPresent("discoveryGearPlacement", s.discoveryGearPlacement || "PawnWorn");
  setValueIfPresent("discoveryGearReceiver", s.discoveryGearReceiver || "PreferAlive");
  setValueIfPresent("discoveryGearCount", s.discoveryGearCount ?? 1);
  setValueIfPresent("discoveryPawnKind", s.discoveryPawnKind || "");
  setValueIfPresent("discoveryPawnFaction", s.discoveryPawnFaction || "");
  setValueIfPresent("discoveryAliveMin", s.discoveryAliveMin ?? 0);
  setValueIfPresent("discoveryAliveMax", s.discoveryAliveMax ?? 0);
  setValueIfPresent("discoveryDeadMin", s.discoveryDeadMin ?? 1);
  setValueIfPresent("discoveryDeadMax", s.discoveryDeadMax ?? 1);
  setValueIfPresent("discoveryAliveDowned", s.discoveryAliveDowned === false ? "false" : "true");
  setValueIfPresent("discoveryPawnScatterRadius", s.discoveryPawnScatterRadius ?? 8);
  setValueIfPresent("discoverySpawnPawnsInDropPods", s.discoverySpawnPawnsInDropPods === false ? "false" : "true");
  setValueIfPresent("discoveryDropPodOpenDelaySeconds", s.discoveryDropPodOpenDelaySeconds ?? 2);
  setValueIfPresent("discoverySpawnCrashDebris", s.discoverySpawnCrashDebris === false ? "false" : "true");
  setValueIfPresent("discoveryCrashChunkDef", s.discoveryCrashChunkDef || "ShipChunk");
  setValueIfPresent("discoveryCrashDebrisDef", s.discoveryCrashDebrisDef || "ChunkSlagSteel");
  setValueIfPresent("discoveryCrashDebrisCount", s.discoveryCrashDebrisCount ?? 6);
  setValueIfPresent("discoveryCrashDebrisRadius", s.discoveryCrashDebrisRadius ?? 6);

  setSelectYesNoIfPresent("enableTimedIncident", !!s.enableTimedIncident);
  setValueIfPresent("timedIncidentMinDays", s.timedIncidentMinDays ?? 1);
  setValueIfPresent("timedIncidentMaxDays", s.timedIncidentMaxDays ?? 2);
  setValueIfPresent("timedIncidentRetryHours", s.timedIncidentRetryHours ?? 1);
  setValueIfPresent("timedIncidentFireOnce", s.timedIncidentFireOnce === false ? "no" : "yes");
  setValueIfPresent("timedIncidentForce", s.timedIncidentForce === false ? "no" : "yes");
  setValueIfPresent("timedIncidentTarget", s.timedIncidentTarget || "PlayerHomeMap");

  // Refresh any derived UI rules/help (without re-wiring event listeners)
  document.getElementById("gearParent")?.dispatchEvent(new Event("change"));
  document.getElementById("gearGraphicClass")?.dispatchEvent(new Event("change"));
  document.getElementById("enableCostume")?.dispatchEvent(new Event("change"));
  document.getElementById("transformationMissingGraphicBehavior")?.dispatchEvent(new Event("change"));
  document.getElementById("transformationToggleGizmo")?.dispatchEvent(new Event("change"));
  document.getElementById("transformationOverrideBodyType")?.dispatchEvent(new Event("change"));
  refreshSelectHelpText();
  renderExistingCostumeList();
  renderGeneratedCostumeList();
  renderStatBuffs();
}

function init() {
  wireTabs();
  wireAbilityPickers();
  wireAutosave();
  wireActions();

  setDefaults();
  const loaded = loadState();
  if (!loaded) {
    // default ability selection
    const blast = document.querySelector('input[data-ability="Blast"]');
    if (blast) blast.checked = true;
    rebuildAbilityEditors([]);
    saveState();
  }

  // Init imported defs
  applyDefIndexToDatalists(getOrCreateIndex());
    wireGearParentUi();
    wireSelectHelpText();
    wireCostumeEnableUi();

    if (document.getElementById("gearBodyPartGroupList")) {
      if (!document.getElementById("gearBodyPartGroupList").dataset.items) writeGearBodyPartGroups([]);
      renderGearBodyPartGroups();
    }
    if (document.getElementById("gearLayerList")) {
      if (!document.getElementById("gearLayerList").dataset.items) writeGearLayers([]);
      renderGearLayers();
    }
    if (document.getElementById("gearTagList")) {
      if (!document.getElementById("gearTagList").dataset.items) writeGearTags([]);
      renderGearTags();
    }

    // Init costume UI lists
    if (document.getElementById("existingApparelList")) {
      if (!document.getElementById("existingApparelList").dataset.items) writeExistingCostumeList([]);
      if (!document.getElementById("generatedApparelList").dataset.items) writeGeneratedCostumeList([]);
    if (document.getElementById("statBuffList") && !document.getElementById("statBuffList").dataset.items) writeStatBuffs([]);
    renderExistingCostumeList();
    renderGeneratedCostumeList();
    renderStatBuffs();
  }

  if (document.getElementById("conditionList")) {
    if (!document.getElementById("conditionList").dataset.items) writeSelectionConditions([]);
    renderSelectionConditions();
  }

  if (document.getElementById("stealthSeeThroughPawnKindsList")) {
    if (!document.getElementById("stealthSeeThroughPawnKindsList").dataset.items) writeStealthSeeThroughPawnKinds([]);
    renderStealthSeeThroughPawnKinds();
  }
  if (document.getElementById("stealthSeeThroughHediffsList")) {
    if (!document.getElementById("stealthSeeThroughHediffsList").dataset.items) writeStealthSeeThroughHediffs([]);
    renderStealthSeeThroughHediffs();
  }
  if (document.getElementById("corruptionMentalStateList")) {
    if (!document.getElementById("corruptionMentalStateList").dataset.items) writeCorruptionMentalStates([]);
    renderCorruptionMentalStates();
  }
  if (document.getElementById("autoEquipTraitList")) {
    if (!document.getElementById("autoEquipTraitList").dataset.items) writeAutoEquipTraitBonuses([]);
    renderAutoEquipTraitBonuses();
  }
  if (document.getElementById("autoEquipHediffList")) {
    if (!document.getElementById("autoEquipHediffList").dataset.items) writeAutoEquipHediffBonuses([]);
    renderAutoEquipHediffBonuses();
  }
  if (document.getElementById("wearerInfluenceTraitList")) {
    if (!document.getElementById("wearerInfluenceTraitList").dataset.items) writeWearerInfluenceTraitModifiers([]);
    renderWearerInfluenceTraitModifiers();
  }

  wireConditionDefAutocomplete();
  wireBodyTypeOverrideUi();
  wireMissingGraphicBehaviorUi();
  wireTransformationToggleUi();
  wireBehaviorActions();
  refreshSelectHelpText();
}

init();

function wireCostumeEnableUi() {
  const enable = document.getElementById("enableCostume");
  const toggle = document.getElementById("transformationToggleGizmo");
  const defOn = document.getElementById("transformationToggleDefaultOn");
  if (!enable || !toggle || !defOn) return;

  const apply = () => {
    const on = enable.value === "yes";
    toggle.disabled = !on;
    defOn.disabled = !on || toggle.value !== "yes";
    if (!on) {
      toggle.value = "no";
      defOn.value = "yes";
    }
    refreshSelectHelpText();
  };

  enable.addEventListener("change", () => {
    apply();
    saveState();
    renderExportPanel();
  });

  apply();
}

function applySelectHelp(selectId, descId, helpByValue) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const desc = descId ? document.getElementById(descId) : null;

  for (const opt of Array.from(sel.options || [])) {
    const t = helpByValue?.[opt.value];
    if (t) opt.title = t;
  }

  const help = helpByValue?.[sel.value] || "";
  if (help) sel.title = help;
  if (desc) desc.textContent = help;
}

function refreshSelectHelpText() {
  applySelectHelp("enableCostume", "enableCostumeDesc", {
    no: "No costume is auto-equipped. Gear still grants charge + abilities.",
    yes: "Auto-equip listed apparel while worn, then restore the previous outfit when removed.",
  });

  applySelectHelp("transformationMissingGraphicBehavior", "transformationMissingGraphicBehaviorDesc", {
    none: "Do nothing if a worn graphic can't be resolved for the pawn's body type (may look wrong).",
    skip: "If any costume piece can't render, skip costume for that pawn (powers still work).",
    override: "Temporarily force a body type while transformed so the costume can render.",
  });

  applySelectHelp("transformationToggleGizmo", null, {
    no: "No in-game toggle; transformation follows the usual wear/draft rules.",
    yes: "Adds an in-game button to toggle the costume/body swap on/off without removing the gear.",
  });

  applySelectHelp("transformationToggleDefaultOn", null, {
    yes: "Transformation starts enabled when the item is first created/spawned.",
    no: "Transformation starts disabled until manually toggled on.",
  });

  applySelectHelp("transformationOverrideBodyType", "transformationOverrideBodyTypeDesc", {
    no: "Never force body type (costume uses the pawn's current body type).",
    yes: "Temporarily force the chosen body type while transformed; restores original on revert/unequip.",
  });

  applySelectHelp("transformationOverrideBodyTypeOnlyIfMissing", null, {
    yes: "Only force body type if the costume cannot render for the pawn's current body type.",
    no: "Always force body type while transformed (even if the costume could render).",
  });

  applySelectHelp("transformationBodyTypeOverride", "transformationBodyTypeOverrideDesc", {
    Male: "Use the vanilla Male body type while transformed.",
    Female: "Use the vanilla Female body type while transformed.",
    Thin: "Use the vanilla Thin body type while transformed.",
    Fat: "Use the vanilla Fat body type while transformed.",
    Hulk: "Use the vanilla Hulk body type while transformed.",
    custom: "Type your own BodyTypeDef name (advanced).",
  });

  applySelectHelp("enableSelection", "enableSelectionDesc", {
    no: "No selection def generated.",
    yes: "Generates a RingSelectionDef (auto-delivery) using your trigger + conditions.",
  });

  applySelectHelp("selectionTrigger", "selectionTriggerDesc", {
    onJoin: "Runs selection when a pawn joins the player faction.",
    onSpawn: "Runs selection when a pawn spawns on a player home map.",
    onMental: "Runs selection when a pawn enters any mental state.",
  });

  applySelectHelp("excludeIfHasAnyLanternRing", "excludeIfHasAnyLanternRingDesc", {
    true: "Skips pawns who already have any LanternsCore gear.",
    false: "Allows pawns even if they already have LanternsCore gear.",
  });

  applySelectHelp("enableDiscoveryEvent", null, {
    no: "No discovery incident generated.",
    yes: "Generates a discovery incident (world site or active map drop).",
  });

  applySelectHelp("discoveryTargetType", null, {
    WorldSite: "Creates a world-map site that caravans can visit.",
    ActiveMap: "Drops the crash directly onto a player home map.",
  });

  applySelectHelp("enableTimedIncident", null, {
    no: "No timed incident scheduling.",
    yes: "Schedules the discovery incident after a random delay.",
  });

  applySelectHelp("timedIncidentTarget", null, {
    PlayerHomeMap: "Targets a random player home map.",
    CurrentMap: "Targets the current map (when the incident fires).",
    AnyPlayerMap: "Targets any player map (home or temporary).",
    World: "Targets the world (for world-site incidents).",
  });

  applySelectHelp("condType", "condTypeDesc", {
    Trait: "Scores candidates based on having (or not having) a TraitDef.",
    Stat: "Scores candidates based on a StatDef value (e.g. MeleeHitChance).",
    Skill: "Scores candidates based on a SkillDef level.",
    Mood: "Scores candidates based on current mood percent.",
    Need: "Scores candidates based on a NeedDef value (e.g. Rest).",
    Thought: "Scores candidates based on having a ThoughtDef active.",
    Record: "Scores candidates based on a RecordDef (history).",
  });
}

function wireSelectHelpText() {
  qsa("select").forEach((el) => el.addEventListener("change", refreshSelectHelpText));
  refreshSelectHelpText();
}

function wireGearParentUi() {
  const sel = document.getElementById("gearParent");
  const custom = document.getElementById("gearParentCustom");
  const desc = document.getElementById("gearParentDesc");
  const gearGraphic = document.getElementById("gearGraphicClass");
  const gearGraphicDesc = document.getElementById("gearGraphicDesc");
  const gearTexHint = document.getElementById("gearTexHint");
  if (!sel || !custom) return;

  const applyGraphicHelp = () => {
    if (!gearGraphic) return;
    const v = gearGraphic.value;
    for (const opt of Array.from(gearGraphic.options || [])) {
      if (opt.value === "Graphic_Multi") opt.title = "Directional textures: _north/_south/_east (west is usually optional).";
      if (opt.value === "Graphic_Single") opt.title = "Single texture: .png";
    }
    if (gearGraphicDesc) {
      gearGraphicDesc.textContent =
        v === "Graphic_Multi"
          ? "Requires 3 directional textures: _north/_south/_east. (West is usually mirrored from east.)"
          : "Requires 1 texture: .png";
    }
    gearGraphic.title = gearGraphicDesc?.textContent || gearGraphic.title || "";
    if (gearTexHint) {
      gearTexHint.textContent =
        v === "Graphic_Multi"
          ? "Points to Textures/<texPath>_north.png, _south.png, _east.png (west is optional)."
          : "Points to Textures/<texPath>.png";
    }
  };

  const apply = () => {
    const isCustom = sel.value === "custom";
    custom.disabled = !isCustom;
    if (!isCustom) custom.value = "";

    if (desc) {
      const map = {
        Lantern_RingBase: "Waist/Belt slot ring template (classic Lantern ring behavior).",
        Lantern_GearBeltBase: "Utility belt template (Waist/Belt).",
        Lantern_GearSuitBase: "Suit template (Torso/Shell).",
        Lantern_GearMaskBase: "Mask template (FullHead/Overhead).",
        Lantern_GearApparelBase: "Generic powered apparel base (you can override layers/body parts in XML later).",
        custom: "Uses your custom ParentName. Good for advanced modders with their own base apparel defs.",
      };
      for (const opt of Array.from(sel.options || [])) {
        const t = map[opt.value];
        if (t) opt.title = t;
      }
      desc.textContent = map[sel.value] || "";
      sel.title = desc.textContent || sel.title || "";
    }

    // Sensible defaults: suits/masks are usually multi-directional; rings/belts can be single.
    if (gearGraphic) {
      if (sel.value === "Lantern_GearSuitBase" || sel.value === "Lantern_GearMaskBase" || sel.value === "Lantern_GearApparelBase") {
        gearGraphic.value = "Graphic_Multi";
      } else {
        gearGraphic.value = "Graphic_Single";
      }
    }
    applyGraphicHelp();
  };

  sel.addEventListener("change", apply);
  if (gearGraphic) gearGraphic.addEventListener("change", applyGraphicHelp);
  apply();
}

function wireBodyTypeOverrideUi() {
  const enabled = document.getElementById("transformationOverrideBodyType");
  const onlyIfMissing = document.getElementById("transformationOverrideBodyTypeOnlyIfMissing");
  const mode = document.getElementById("transformationBodyTypeOverride");
  const custom = document.getElementById("transformationBodyTypeOverrideCustom");
  const behavior = document.getElementById("transformationMissingGraphicBehavior");
  if (!enabled || !onlyIfMissing || !mode || !custom) return;

  const apply = () => {
    const on = enabled.value === "yes";
    onlyIfMissing.disabled = !on;
    mode.disabled = !on;
    custom.disabled = !on || mode.value !== "custom";
    if (!on) {
      onlyIfMissing.value = "yes";
      mode.value = "Male";
      custom.value = "";
      if (behavior && behavior.value === "override") behavior.value = "none";
    } else if (mode.value !== "custom") {
      custom.value = "";
    }
  };

  enabled.addEventListener("change", apply);
  onlyIfMissing.addEventListener("change", apply);
  mode.addEventListener("change", apply);
  apply();
  refreshSelectHelpText();
}

function wireMissingGraphicBehaviorUi() {
  const behavior = document.getElementById("transformationMissingGraphicBehavior");
  const overrideEnabled = document.getElementById("transformationOverrideBodyType");
  if (!behavior || !overrideEnabled) return;

  const apply = () => {
    if (behavior.value === "override") {
      overrideEnabled.value = "yes";
    } else if (behavior.value === "skip" || behavior.value === "none") {
      overrideEnabled.value = "no";
    }
  };

  behavior.addEventListener("change", () => {
    apply();
    wireBodyTypeOverrideUi();
    refreshSelectHelpText();
    saveState();
    renderExportPanel();
  });
  apply();
  refreshSelectHelpText();
}

function wireTransformationToggleUi() {
  const on = document.getElementById("transformationToggleGizmo");
  const defOn = document.getElementById("transformationToggleDefaultOn");
  if (!on || !defOn) return;

  const apply = () => {
    const enabled = on.value === "yes";
    defOn.disabled = !enabled;
    if (!enabled) defOn.value = "yes";
  };

  on.addEventListener("change", () => {
    apply();
    refreshSelectHelpText();
    saveState();
    renderExportPanel();
  });
  apply();
  refreshSelectHelpText();
}

function wireConditionDefAutocomplete() {
  const typeEl = document.getElementById("condType");
  const defEl = document.getElementById("condDef");
  if (!typeEl || !defEl) return;

  const apply = () => {
    const type = typeEl.value;
    const map = {
      Trait: "defs_TraitDef",
      Stat: "defs_StatDef",
      Skill: "defs_SkillDef",
      Need: "defs_NeedDef",
      Thought: "defs_ThoughtDef",
      Record: "defs_RecordDef",
      Mood: null,
    };
    const listId = map[type] || "";
    if (type === "Mood") {
      defEl.value = "";
      defEl.disabled = true;
      defEl.placeholder = "(not used for Mood)";
      defEl.removeAttribute("list");
      return;
    }

    defEl.disabled = false;
    defEl.placeholder = "TraitDef / StatDef / NeedDef / ...";
    if (listId) defEl.setAttribute("list", listId);
    else defEl.removeAttribute("list");
  };

  typeEl.addEventListener("change", apply);
  apply();
  refreshSelectHelpText();
}

function wireBehaviorActions() {
  const btnAddKind = document.getElementById("btnAddStealthSeeThroughPawnKind");
  if (btnAddKind) {
    btnAddKind.addEventListener("click", () => {
      const val = byId("stealthSeeThroughPawnKindInput").value.trim();
      if (!val) return;
      const items = readStealthSeeThroughPawnKinds();
      writeStealthSeeThroughPawnKinds([...items, val]);
      byId("stealthSeeThroughPawnKindInput").value = "";
      saveState();
      renderExportPanel();
    });
  }

  const btnAddHediff = document.getElementById("btnAddStealthSeeThroughHediff");
  if (btnAddHediff) {
    btnAddHediff.addEventListener("click", () => {
      const val = byId("stealthSeeThroughHediffInput").value.trim();
      if (!val) return;
      const items = readStealthSeeThroughHediffs();
      writeStealthSeeThroughHediffs([...items, val]);
      byId("stealthSeeThroughHediffInput").value = "";
      saveState();
      renderExportPanel();
    });
  }

  const btnAddMental = document.getElementById("btnAddCorruptionMentalState");
  if (btnAddMental) {
    btnAddMental.addEventListener("click", () => {
      const def = byId("corruptionMentalStateDef").value.trim();
      if (!def) return;
      const item = {
        mentalState: def,
        minSeverity: toNum(byId("corruptionMentalStateMinSeverity").value, 0.5),
        maxSeverity: toNum(byId("corruptionMentalStateMaxSeverity").value, 1),
        chancePerCheck: toNum(byId("corruptionMentalStateChance").value, 0.05),
        checkIntervalTicks: Math.max(1, Math.floor(toNum(byId("corruptionMentalStateInterval").value, 1000))),
        requireNotAlreadyInState: byId("corruptionMentalStateRequireNotAlready").value !== "false",
      };
      const items = readCorruptionMentalStates();
      writeCorruptionMentalStates([...items, item]);
      byId("corruptionMentalStateDef").value = "";
      saveState();
      renderExportPanel();
    });
  }

  const btnAddTrait = document.getElementById("btnAddAutoEquipTrait");
  if (btnAddTrait) {
    btnAddTrait.addEventListener("click", () => {
      const trait = byId("autoEquipTraitDef").value.trim();
      if (!trait) return;
      const item = {
        trait,
        degree: Math.floor(toNum(byId("autoEquipTraitDegree").value, 0)),
        scoreOffset: toNum(byId("autoEquipTraitScoreOffset").value, 10),
      };
      const items = readAutoEquipTraitBonuses();
      writeAutoEquipTraitBonuses([...items, item]);
      byId("autoEquipTraitDef").value = "";
      saveState();
      renderExportPanel();
    });
  }

  const btnAddWearerTrait = document.getElementById("btnAddWearerInfluenceTrait");
  if (btnAddWearerTrait) {
    btnAddWearerTrait.addEventListener("click", () => {
      const trait = byId("wearerInfluenceTraitDef").value.trim();
      if (!trait) return;
      const item = {
        trait,
        degree: Math.floor(toNum(byId("wearerInfluenceTraitDegree").value, 0)),
        severityMultiplier: toNum(byId("wearerInfluenceTraitSeverityMultiplier").value, 1),
        severityOffset: toNum(byId("wearerInfluenceTraitSeverityOffset").value, 0),
      };
      const items = readWearerInfluenceTraitModifiers();
      writeWearerInfluenceTraitModifiers([...items, item]);
      byId("wearerInfluenceTraitDef").value = "";
      saveState();
      renderExportPanel();
    });
  }

  const btnAddAutoHediff = document.getElementById("btnAddAutoEquipHediff");
  if (btnAddAutoHediff) {
    btnAddAutoHediff.addEventListener("click", () => {
      const hediff = byId("autoEquipHediffDef").value.trim();
      if (!hediff) return;
      const item = {
        hediff,
        minSeverity: toNum(byId("autoEquipHediffMinSeverity").value, 0),
        maxSeverity: toNum(byId("autoEquipHediffMaxSeverity").value, 9999),
        scoreOffset: toNum(byId("autoEquipHediffScoreOffset").value, 10),
        severityMultiplier: toNum(byId("autoEquipHediffSeverityMultiplier").value, 0),
      };
      const items = readAutoEquipHediffBonuses();
      writeAutoEquipHediffBonuses([...items, item]);
      byId("autoEquipHediffDef").value = "";
      saveState();
      renderExportPanel();
    });
  }
}
