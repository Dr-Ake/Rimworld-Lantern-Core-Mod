using System.Text;
using RimWorld;
using RimWorld.Planet;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    public class LanternDiscoverySite : MapParent
    {
        public ThingDef gearDef;
        public int gearCount = 1;

        public PawnKindDef pawnKind;
        public FactionDef pawnFaction;
        public int alivePawns;
        public int deadPawns;
        public bool alivePawnsDowned;
        public float pawnScatterRadius;

        public bool spawnPawnsInDropPods;
        public float dropPodOpenDelaySeconds;

        public bool spawnCrashDebris;
        public ThingDef crashChunkDef;
        public ThingDef crashDebrisDef;
        public int crashDebrisCount;
        public float crashDebrisRadius;

        public LanternDiscoveryGearPlacement gearPlacement;
        public LanternDiscoveryGearReceiver gearReceiver;

        public float mapDropRadius;
        public bool mapDropPreferColony;

        public int timeoutTicks = -1;

        private string siteLabel;
        private string siteDescription;
        private bool spawnedContents;

        public string GearLabelCap => gearDef?.LabelCap ?? "gear";

        public void ConfigureFromExtension(LanternDiscoveryIncidentExtension ext)
        {
            if (ext == null) return;

            gearDef = ext.gearDef;
            gearCount = Mathf.Max(1, ext.gearCount);

            pawnKind = ext.pawnKind;
            pawnFaction = ext.pawnFaction;

            alivePawns = ClampCount(ext.alivePawnsMin, ext.alivePawnsMax);
            deadPawns = ClampCount(ext.deadPawnsMin, ext.deadPawnsMax);

            if (pawnKind == null && (alivePawns > 0 || deadPawns > 0))
            {
                alivePawns = 0;
                deadPawns = 0;
            }

            alivePawnsDowned = ext.alivePawnsDowned;
            pawnScatterRadius = Mathf.Max(0f, ext.pawnScatterRadius);

            spawnPawnsInDropPods = ext.spawnPawnsInDropPods;
            dropPodOpenDelaySeconds = Mathf.Max(0f, ext.dropPodOpenDelaySeconds);

            spawnCrashDebris = ext.spawnCrashDebris;
            crashChunkDef = ext.crashChunkDef;
            crashDebrisDef = ext.crashDebrisDef;
            crashDebrisCount = Mathf.Max(0, ext.crashDebrisCount);
            crashDebrisRadius = Mathf.Max(0f, ext.crashDebrisRadius);

            gearPlacement = ext.gearPlacement;
            gearReceiver = ext.gearReceiver;
            mapDropRadius = Mathf.Max(0f, ext.mapDropRadius);
            mapDropPreferColony = ext.mapDropPreferColony;

            siteLabel = ResolveText(ext.siteLabel, ext.siteLabelKey, "Lantern_DiscoveryEvent_SiteLabel");
            siteDescription = ResolveText(ext.siteDescription, ext.siteDescriptionKey, "Lantern_DiscoveryEvent_SiteDesc");

            if (ext.siteTimeoutDays > 0f)
            {
                timeoutTicks = Mathf.Max(1, Mathf.RoundToInt(ext.siteTimeoutDays * GenDate.TicksPerDay));
            }
            else
            {
                timeoutTicks = -1;
            }
        }

        public override string Label => !siteLabel.NullOrEmpty() ? siteLabel : base.Label;

        public override void PostMapGenerate()
        {
            base.PostMapGenerate();
            if (spawnedContents) return;
            spawnedContents = true;
            if (Map != null)
            {
                SpawnContents(Map);
            }
        }

        protected override void Tick()
        {
            base.Tick();
            if (timeoutTicks <= 0) return;

            timeoutTicks--;
            if (timeoutTicks == 0)
            {
                Destroy();
            }
        }

        public override string GetInspectString()
        {
            StringBuilder sb = new StringBuilder();
            string baseString = base.GetInspectString();
            if (!baseString.NullOrEmpty())
            {
                sb.Append(baseString.TrimEnd());
            }

            if (!siteDescription.NullOrEmpty())
            {
                if (sb.Length > 0) sb.AppendLine();
                sb.Append(siteDescription);
            }

            if (timeoutTicks > 0)
            {
                float days = timeoutTicks / (float)GenDate.TicksPerDay;
                if (sb.Length > 0) sb.AppendLine();
                sb.Append("Lantern_DiscoverySite_ExpiresIn".Translate(days.ToString("0.#")));
            }

            return sb.ToString();
        }

        public void SpawnContents(Map map)
        {
            if (map == null) return;

            LanternDiscoverySpawnInfo info = new LanternDiscoverySpawnInfo
            {
                gearDef = gearDef,
                gearCount = Mathf.Max(1, gearCount),
                pawnKind = pawnKind,
                pawnFaction = pawnFaction,
                alivePawns = alivePawns,
                deadPawns = deadPawns,
                alivePawnsDowned = alivePawnsDowned,
                pawnScatterRadius = pawnScatterRadius,
                spawnPawnsInDropPods = spawnPawnsInDropPods,
                dropPodOpenDelaySeconds = dropPodOpenDelaySeconds,
                spawnCrashDebris = spawnCrashDebris,
                crashChunkDef = crashChunkDef,
                crashDebrisDef = crashDebrisDef,
                crashDebrisCount = crashDebrisCount,
                crashDebrisRadius = crashDebrisRadius,
                gearPlacement = gearPlacement,
                gearReceiver = gearReceiver,
                mapDropRadius = mapDropRadius,
                mapDropPreferColony = mapDropPreferColony
            };

            LanternDiscoverySpawner.SpawnAtMap(map, info);
        }

        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_Defs.Look(ref gearDef, "lanternDiscovery_gearDef");
            Scribe_Values.Look(ref gearCount, "lanternDiscovery_gearCount", 1);
            Scribe_Defs.Look(ref pawnKind, "lanternDiscovery_pawnKind");
            Scribe_Defs.Look(ref pawnFaction, "lanternDiscovery_pawnFaction");
            Scribe_Values.Look(ref alivePawns, "lanternDiscovery_alivePawns", 0);
            Scribe_Values.Look(ref deadPawns, "lanternDiscovery_deadPawns", 0);
            Scribe_Values.Look(ref alivePawnsDowned, "lanternDiscovery_alivePawnsDowned", true);
            Scribe_Values.Look(ref pawnScatterRadius, "lanternDiscovery_pawnScatterRadius", 8f);
            Scribe_Values.Look(ref spawnPawnsInDropPods, "lanternDiscovery_spawnPawnsInDropPods", true);
            Scribe_Values.Look(ref dropPodOpenDelaySeconds, "lanternDiscovery_dropPodOpenDelaySeconds", 2f);
            Scribe_Values.Look(ref spawnCrashDebris, "lanternDiscovery_spawnCrashDebris", true);
            Scribe_Defs.Look(ref crashChunkDef, "lanternDiscovery_crashChunkDef");
            Scribe_Defs.Look(ref crashDebrisDef, "lanternDiscovery_crashDebrisDef");
            Scribe_Values.Look(ref crashDebrisCount, "lanternDiscovery_crashDebrisCount", 6);
            Scribe_Values.Look(ref crashDebrisRadius, "lanternDiscovery_crashDebrisRadius", 6f);
            Scribe_Values.Look(ref gearPlacement, "lanternDiscovery_gearPlacement", LanternDiscoveryGearPlacement.PawnWorn);
            Scribe_Values.Look(ref gearReceiver, "lanternDiscovery_gearReceiver", LanternDiscoveryGearReceiver.PreferAlive);
            Scribe_Values.Look(ref mapDropRadius, "lanternDiscovery_mapDropRadius", 10f);
            Scribe_Values.Look(ref mapDropPreferColony, "lanternDiscovery_mapDropPreferColony", true);
            Scribe_Values.Look(ref timeoutTicks, "lanternDiscovery_timeoutTicks", -1);
            Scribe_Values.Look(ref siteLabel, "lanternDiscovery_siteLabel");
            Scribe_Values.Look(ref siteDescription, "lanternDiscovery_siteDescription");
            Scribe_Values.Look(ref spawnedContents, "lanternDiscovery_spawnedContents", false);
        }

        private static int ClampCount(int min, int max)
        {
            int safeMin = Mathf.Max(0, min);
            int safeMax = Mathf.Max(safeMin, max);
            return Rand.RangeInclusive(safeMin, safeMax);
        }

        private static string ResolveText(string literal, string key, string fallbackKey)
        {
            if (!literal.NullOrEmpty()) return literal;
            if (!key.NullOrEmpty() && key.CanTranslate()) return key.Translate();
            if (!fallbackKey.NullOrEmpty() && fallbackKey.CanTranslate()) return fallbackKey.Translate();
            return string.Empty;
        }
    }
}
