/* global JSZip */

const STORAGE_KEY = "hero_gear_builder_v1";
const DEF_INDEX_KEY = "lanternscore_defindex_v1";

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
      </label>
      ${abilityExtraFieldsHtml(abilityKey)}
      <label class="field field--wide">
        <span>Description (optional)</span>
        <textarea rows="2" data-field="description" placeholder=""></textarea>
      </label>
    </div>
  `;

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
}

function setImportStatus(text) {
  const el = document.getElementById("importStatus");
  if (el) el.textContent = text;
}

function getOrCreateIndex() {
  return (
    loadDefIndex() || {
      importedAt: null,
      sources: [],
      byType: {},
    }
  );
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

function collectDefsFromXmlText(xmlText, index) {
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

    if (type === "ThingDef") {
      const isApparel = !!child.querySelector("apparel");
      if (isApparel) ensureType(index, "ApparelDef").push(defName);
    }
  }
}

function safePersistDefIndex(index) {
  try {
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
      collectDefsFromXmlText(text, index);
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

    gearParent: byId("gearParent")?.value || "Lantern_RingBase",
    gearParentCustom: byId("gearParentCustom")?.value.trim() || "",

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
    transformationOnlyWhenDrafted: byId("transformationOnlyWhenDrafted")?.checked || false,
    transformationSkipConflictingApparel: byId("transformationSkipConflictingApparel")?.checked || false,
    allowBatteryManifest: byId("allowBatteryManifest")?.checked || false,
    batteryDef: byId("batteryDef")?.value.trim() || "",
    batteryManifestCost: toNum(byId("batteryManifestCost")?.value, 0.5),
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

  if (document.getElementById("gearParent")) {
    byId("gearParent").value = "Lantern_RingBase";
    byId("gearParentCustom").value = "";
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
    byId("transformationOnlyWhenDrafted").checked = false;
    byId("transformationSkipConflictingApparel").checked = false;
    byId("allowBatteryManifest").checked = false;
    byId("batteryDef").value = "";
    byId("batteryManifestCost").value = "0.5";
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
      if (id === "abilities" || id === "enableSelection") continue;
      const el = document.getElementById(id);
      if (el && "value" in el) el.value = val ?? "";
    }

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
      byId("transformationOnlyWhenDrafted").checked = !!s.transformationOnlyWhenDrafted;
      byId("transformationSkipConflictingApparel").checked = !!s.transformationSkipConflictingApparel;
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
  required.push(`Textures/${state.ringTexPath}.png`);
  for (const a of state.abilities) {
    required.push(`Textures/${a.iconPath}.png`);
  }
  for (const app of state.costume_generatedApparel || []) {
    if (app?.texPath) required.push(`Textures/${app.texPath}.png`);
  }
  // De-dup
  return Array.from(new Set(required)).sort();
}

function buildAboutXml(state) {
  const desc = state.modDesc || "";
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
    `    <li>\n` +
    `      <packageId>DrAke.LanternsCore</packageId>\n` +
    `      <displayName>Lantern Core Framework</displayName>\n` +
    `    </li>\n` +
    `  </modDependencies>\n` +
    `  <loadAfter>\n` +
    `    <li>DrAke.LanternsCore</li>\n` +
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
  }

  const gearParent =
    state.gearParent === "custom" ? (state.gearParentCustom || "").trim() : (state.gearParent || "").trim();
  const parentName = gearParent || "Lantern_RingBase";

  const ringXml =
    `  <ThingDef ParentName="${escapeXml(parentName)}">\n` +
    `    <defName>${escapeXml(state.ringDefName)}</defName>\n` +
    `    <label>${escapeXml(state.ringLabel)}</label>\n` +
    `    <description>${escapeXml(state.ringDesc || "")}</description>\n` +
    `    <graphicData>\n` +
    `      <texPath>${escapeXml(state.ringTexPath)}</texPath>\n` +
    `      <graphicClass>Graphic_Single</graphicClass>\n` +
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
    `    </apparel>\n` +
    `    <graphicData>\n` +
    `      <texPath>${escapeXml(it.texPath)}</texPath>\n` +
    `      <graphicClass>Graphic_Multi</graphicClass>\n` +
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

  return (
    `  <AbilityDef ParentName="${escapeXml(a.parent)}">\n` +
    `    <defName>${escapeXml(a.defName)}</defName>\n` +
    `    <label>${escapeXml(a.label)}</label>\n` +
    descLine +
    `    <iconPath>${escapeXml(a.iconPath)}</iconPath>\n` +
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
  return `# ${state.modName}\n\n` +
    `This mod was generated by Hero Gear Builder and depends on Lantern Core Framework (LanternsCore).\n\n` +
    `## Install\n\n` +
    `- Place this mod folder into your RimWorld Mods directory.\n` +
    `- Ensure Lantern Core Framework is enabled and loaded before this mod.\n\n` +
    `## Textures required\n\n` +
    textureChecklist.map((p) => `- \`${p}\``).join("\n") +
    `\n`;
}

function renderExportPanel() {
  const state = getState();
  const issues = validate(state);
  byId("validation").textContent = issues.length ? issues.map((x) => `- ${x}`).join("\n") : "No issues detected.";

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
}

init();

function wireGearParentUi() {
  const sel = document.getElementById("gearParent");
  const custom = document.getElementById("gearParentCustom");
  if (!sel || !custom) return;

  const apply = () => {
    const isCustom = sel.value === "custom";
    custom.disabled = !isCustom;
    if (!isCustom) custom.value = "";
  };

  sel.addEventListener("change", apply);
  apply();
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
}
