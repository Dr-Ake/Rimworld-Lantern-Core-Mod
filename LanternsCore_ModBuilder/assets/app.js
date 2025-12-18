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
    ringTexPath: byId("ringTexPath").value.trim(),
    marketValue: toNum(byId("marketValue").value, 5000),
    mass: toNum(byId("mass").value, 0.1),

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
    if (key === "Heal") {
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
  byId("ringTexPath").value = "MyHeroGear/Items/MyGear";
  byId("marketValue").value = "5000";
  byId("mass").value = "0.1";

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

  if (state.associatedHediff && !isValidDefName(state.associatedHediff)) issues.push("Associated hediff must be a valid defName.");

  if (state.allowBatteryManifest) {
    if (!state.batteryDef) issues.push("Battery manifest enabled: battery ThingDef is required.");
    if (!Number.isFinite(state.batteryManifestCost) || state.batteryManifestCost < 0 || state.batteryManifestCost > 1)
      issues.push("Battery manifest cost must be 0..1.");
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

  for (const a of state.abilities || []) {
    if (a?.key === "Summon" && a.pawnKind) refs.push({ type: "PawnKindDef", defName: a.pawnKind });
    if (a?.key === "Construct" && a.thingDef) refs.push({ type: "ThingDef", defName: a.thingDef });
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

  const ringXml =
    `  <ThingDef ParentName="${escapeXml(parentName)}">\n` +
    `    <defName>${escapeXml(state.ringDefName)}</defName>\n` +
    `    <label>${escapeXml(state.ringLabel)}</label>\n` +
    `    <description>${escapeXml(state.ringDesc || "")}</description>\n` +
    `    <graphicData>\n` +
    `      <texPath>${escapeXml(state.ringTexPath)}</texPath>\n` +
    `      <graphicClass>${escapeXml(gearGraphicClass)}</graphicClass>\n` +
    (gearGraphicClass === "Graphic_Multi" ? `      <allowFlip>true</allowFlip>\n` : "") +
    `      <color>${escapeXml(state.ringColor)}</color>\n` +
    `    </graphicData>\n` +
    `    <statBases>\n` +
    `      <MarketValue>${state.marketValue}</MarketValue>\n` +
    `      <Mass>${state.mass}</Mass>\n` +
    `    </statBases>\n` +
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

  const costumeDefsXml = buildGeneratedCostumeDefsXml(state);

  return `<?xml version="1.0" encoding="utf-8"?>\n<Defs>\n\n${ringXml}\n${abilitiesXml}\n${extraDefs.join("\n")}\n${costumeDefsXml}\n${selectionXml}</Defs>\n`;
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

  const verbOverride = (a.range || 0) > 0 ? `    <verbProperties>\n      <range>${a.range}</range>\n    </verbProperties>\n` : "";

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

  // Extension basics
  out.ringColor = xmlText(ext, "ringColor", "(1, 1, 1, 1)");
  out.resourceLabel = xmlText(ext, "resourceLabel", "Willpower");
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
  setValueIfPresent("ringTexPath", s.ringTexPath);
  setValueIfPresent("marketValue", s.marketValue);
  setValueIfPresent("mass", s.mass);

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

  wireConditionDefAutocomplete();
  wireBodyTypeOverrideUi();
  wireMissingGraphicBehaviorUi();
  wireTransformationToggleUi();
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
