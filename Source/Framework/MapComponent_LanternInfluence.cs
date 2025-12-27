using System.Collections.Generic;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    public class MapComponent_LanternInfluence : MapComponent
    {
        private Dictionary<string, int> nextTickByDef = new Dictionary<string, int>();

        public MapComponent_LanternInfluence(Map map) : base(map)
        {
        }

        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_Collections.Look(ref nextTickByDef, "lanternInfluenceNextTick", LookMode.Value, LookMode.Value);
            if (Scribe.mode == LoadSaveMode.PostLoadInit && nextTickByDef == null)
            {
                nextTickByDef = new Dictionary<string, int>();
            }
        }

        public override void MapComponentTick()
        {
            base.MapComponentTick();

            if (map == null || LanternInfluenceRegistry.Entries.Count == 0) return;

            int now = Find.TickManager.TicksGame;
            foreach (LanternInfluenceEntry entry in LanternInfluenceRegistry.Entries)
            {
                if (entry?.def == null || entry.ext == null) continue;
                if (entry.intervalTicks <= 0) continue;

                if (!nextTickByDef.TryGetValue(entry.def.defName, out int next) || now >= next)
                {
                    TryApplyInfluence(entry.def, entry.ext);
                    nextTickByDef[entry.def.defName] = now + entry.intervalTicks;
                }
            }
        }

        private void TryApplyInfluence(ThingDef def, LanternDefExtension ext)
        {
            if (def == null || ext == null || ext.ambientInfluenceHediff == null) return;

            List<IntVec3> sources = CollectInfluenceSources(def, ext);
            if (sources.Count == 0) return;

            IEnumerable<Pawn> pawns = ext.ambientInfluenceAffectsColonistsOnly
                ? map.mapPawns.FreeColonistsSpawned
                : map.mapPawns.AllPawnsSpawned;

            float radius = Mathf.Max(0f, ext.ambientInfluenceRadius);
            float initialSeverity = Mathf.Max(0f, ext.ambientInfluenceInitialSeverity);
            float perTick = Mathf.Max(0f, ext.ambientInfluenceSeverityPerTick);
            float breakThreshold = Mathf.Clamp01(ext.ambientInfluenceBreakThreshold);
            float breakChance = Mathf.Clamp01(ext.ambientInfluenceBreakChance);

            foreach (Pawn pawn in pawns)
            {
                if (pawn == null || pawn.Dead || pawn.Downed) continue;
                if (ext.ambientInfluenceAffectsHumanlikeOnly && pawn.RaceProps?.Humanlike != true) continue;
                if (ext.ambientInfluenceSkipWearers && PawnIsWearing(pawn, def)) continue;
                if (pawn.health?.hediffSet == null) continue;

                if (radius > 0f && !IsWithinAnySource(pawn.Position, sources, radius)) continue;

                Hediff h = pawn.health.hediffSet.GetFirstHediffOfDef(ext.ambientInfluenceHediff);
                if (h == null)
                {
                    h = pawn.health.AddHediff(ext.ambientInfluenceHediff);
                    h.Severity = Mathf.Clamp01(initialSeverity);
                }
                else if (perTick > 0f)
                {
                    h.Severity = Mathf.Clamp01(h.Severity + perTick);
                }

                if (ext.ambientInfluenceMentalState != null && h.Severity > breakThreshold && breakChance > 0f)
                {
                    if (pawn.mindState?.mentalStateHandler?.CurStateDef != ext.ambientInfluenceMentalState)
                    {
                        if (Rand.Value < breakChance)
                        {
                            pawn.mindState.mentalStateHandler.TryStartMentalState(ext.ambientInfluenceMentalState, null, true);
                        }
                    }
                }
            }
        }

        private List<IntVec3> CollectInfluenceSources(ThingDef def, LanternDefExtension ext)
        {
            var sources = new List<IntVec3>();

            if (ext.ambientInfluenceOnlyWhenBuried)
            {
                AddBuriedSources(def, sources);
                return sources;
            }

            foreach (Thing t in map.listerThings.ThingsOfDef(def))
            {
                sources.Add(t.Position);
            }

            foreach (Pawn p in map.mapPawns.AllPawnsSpawned)
            {
                if (p == null) continue;
                if (!ext.ambientInfluenceOnlyWhenUnworn && PawnIsWearing(p, def))
                {
                    sources.Add(p.Position);
                }
                if (PawnHasInInventory(p, def))
                {
                    sources.Add(p.Position);
                }
            }

            AddBuriedSources(def, sources);
            AddCorpseSources(def, sources);

            return sources;
        }

        private void AddBuriedSources(ThingDef def, List<IntVec3> sources)
        {
            foreach (Thing t in map.listerThings.ThingsInGroup(ThingRequestGroup.Grave))
            {
                Building_Grave grave = t as Building_Grave;
                if (grave?.Corpse == null) continue;
                if (CorpseContainsDef(grave.Corpse, def))
                {
                    sources.Add(grave.Position);
                }
            }
        }

        private void AddCorpseSources(ThingDef def, List<IntVec3> sources)
        {
            foreach (Thing t in map.listerThings.ThingsInGroup(ThingRequestGroup.Corpse))
            {
                Corpse corpse = t as Corpse;
                if (corpse == null) continue;
                if (CorpseContainsDef(corpse, def))
                {
                    sources.Add(corpse.PositionHeld);
                }
            }
        }

        private static bool CorpseContainsDef(Corpse corpse, ThingDef def)
        {
            Pawn pawn = corpse?.InnerPawn;
            if (pawn == null || def == null) return false;

            if (PawnIsWearing(pawn, def)) return true;
            if (PawnHasInInventory(pawn, def)) return true;

            return false;
        }

        private static bool PawnIsWearing(Pawn pawn, ThingDef def)
        {
            if (pawn?.apparel == null || def == null) return false;
            for (int i = 0; i < pawn.apparel.WornApparel.Count; i++)
            {
                if (pawn.apparel.WornApparel[i]?.def == def) return true;
            }
            return false;
        }

        private static bool PawnHasInInventory(Pawn pawn, ThingDef def)
        {
            if (pawn?.inventory == null || def == null) return false;
            for (int i = 0; i < pawn.inventory.innerContainer.Count; i++)
            {
                if (pawn.inventory.innerContainer[i]?.def == def) return true;
            }
            return false;
        }

        private static bool IsWithinAnySource(IntVec3 pos, List<IntVec3> sources, float radius)
        {
            for (int i = 0; i < sources.Count; i++)
            {
                if (pos.InHorDistOf(sources[i], radius)) return true;
            }
            return false;
        }
    }

    [StaticConstructorOnStartup]
    public static class LanternInfluenceRegistry
    {
        public static readonly List<LanternInfluenceEntry> Entries = new List<LanternInfluenceEntry>();

        static LanternInfluenceRegistry()
        {
            Rebuild();
        }

        public static void Rebuild()
        {
            Entries.Clear();
            foreach (ThingDef def in DefDatabase<ThingDef>.AllDefsListForReading)
            {
                LanternDefExtension ext = def.GetModExtension<LanternDefExtension>();
                if (ext == null || !ext.ambientInfluenceEnabled || ext.ambientInfluenceHediff == null) continue;

                int intervalTicks = Mathf.Max(1, (int)(Mathf.Max(0.1f, ext.ambientInfluenceIntervalSeconds) * 60f));
                Entries.Add(new LanternInfluenceEntry(def, ext, intervalTicks));
            }
        }
    }

    public class LanternInfluenceEntry
    {
        public ThingDef def;
        public LanternDefExtension ext;
        public int intervalTicks;

        public LanternInfluenceEntry(ThingDef def, LanternDefExtension ext, int intervalTicks)
        {
            this.def = def;
            this.ext = ext;
            this.intervalTicks = intervalTicks;
        }
    }
}
