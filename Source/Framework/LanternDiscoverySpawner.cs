using System.Collections.Generic;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    public struct LanternDiscoverySpawnInfo
    {
        public ThingDef gearDef;
        public int gearCount;

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
    }

    public static class LanternDiscoverySpawner
    {
        public static LanternDiscoverySpawnInfo CreateFromExtension(LanternDiscoveryIncidentExtension ext)
        {
            LanternDiscoverySpawnInfo info = new LanternDiscoverySpawnInfo
            {
                gearDef = ext.gearDef,
                gearCount = Mathf.Max(1, ext.gearCount),
                pawnKind = ext.pawnKind,
                pawnFaction = ext.pawnFaction,
                alivePawns = RollCount(ext.alivePawnsMin, ext.alivePawnsMax),
                deadPawns = RollCount(ext.deadPawnsMin, ext.deadPawnsMax),
                alivePawnsDowned = ext.alivePawnsDowned,
                pawnScatterRadius = Mathf.Max(0f, ext.pawnScatterRadius),
                spawnPawnsInDropPods = ext.spawnPawnsInDropPods,
                dropPodOpenDelaySeconds = Mathf.Max(0f, ext.dropPodOpenDelaySeconds),
                spawnCrashDebris = ext.spawnCrashDebris,
                crashChunkDef = ext.crashChunkDef,
                crashDebrisDef = ext.crashDebrisDef,
                crashDebrisCount = Mathf.Max(0, ext.crashDebrisCount),
                crashDebrisRadius = Mathf.Max(0f, ext.crashDebrisRadius),
                gearPlacement = ext.gearPlacement,
                gearReceiver = ext.gearReceiver,
                mapDropRadius = Mathf.Max(0f, ext.mapDropRadius),
                mapDropPreferColony = ext.mapDropPreferColony
            };

            if (info.pawnKind == null && (info.alivePawns > 0 || info.deadPawns > 0))
            {
                info.alivePawns = 0;
                info.deadPawns = 0;
            }

            return info;
        }

        public static IntVec3 SpawnAtMap(Map map, LanternDiscoverySpawnInfo info, IntVec3? centerOverride = null)
        {
            if (map == null) return IntVec3.Invalid;

            IntVec3 anchor = centerOverride ?? FindAnchor(map, info.mapDropPreferColony);
            float dropRadius = info.mapDropRadius > 0f ? info.mapDropRadius : info.crashDebrisRadius;
            int anchorRadius = Mathf.Max(4, Mathf.RoundToInt(dropRadius));
            IntVec3 center = CellFinder.RandomClosewalkCellNear(anchor, map, anchorRadius);

            if (info.spawnCrashDebris)
            {
                SpawnCrashDebris(map, center, info);
            }

            List<Pawn> alive = GeneratePawns(info, info.alivePawns);
            List<Pawn> dead = GeneratePawns(info, info.deadPawns);

            List<Thing> gearItems = CreateGearItems(info);
            bool gearAssigned = false;

            if (gearItems.Count > 0 && (info.gearPlacement == LanternDiscoveryGearPlacement.PawnWorn || info.gearPlacement == LanternDiscoveryGearPlacement.PawnInventory))
            {
                Pawn receiver = ChooseReceiver(info, alive, dead);
                if (receiver != null)
                {
                    gearAssigned = TryGiveGearToPawn(receiver, gearItems[0], info.gearPlacement);
                    if (gearAssigned) gearItems.RemoveAt(0);
                }
            }

            List<Thing> dropPodThings = new List<Thing>();
            if (info.spawnPawnsInDropPods)
            {
                foreach (Pawn pawn in alive)
                {
                    if (info.alivePawnsDowned) HealthUtility.DamageUntilDowned(pawn);
                    dropPodThings.Add(pawn);
                }
            }
            else
            {
                foreach (Pawn pawn in alive)
                {
                    IntVec3 cell = RandomCellNear(map, center, info.pawnScatterRadius);
                    GenSpawn.Spawn(pawn, cell, map);
                    if (info.alivePawnsDowned) HealthUtility.DamageUntilDowned(pawn);
                }
            }

            for (int i = 0; i < dead.Count; i++)
            {
                Pawn pawn = dead[i];
                pawn.Kill(null);
                if (pawn.Corpse == null) continue;

                if (info.spawnPawnsInDropPods)
                {
                    dropPodThings.Add(pawn.Corpse);
                }
                else
                {
                    IntVec3 cell = RandomCellNear(map, center, info.pawnScatterRadius);
                    GenSpawn.Spawn(pawn.Corpse, cell, map);
                }
            }

            if (gearItems.Count > 0)
            {
                if (info.gearPlacement == LanternDiscoveryGearPlacement.DropPod)
                {
                    if (info.spawnPawnsInDropPods)
                    {
                        dropPodThings.AddRange(gearItems);
                    }
                    else
                    {
                        DropPodUtility.DropThingsNear(center, map, gearItems, GetDropPodDelayTicks(info));
                    }
                }
                else if (info.gearPlacement == LanternDiscoveryGearPlacement.Ground || !gearAssigned)
                {
                    foreach (Thing gear in gearItems)
                    {
                        IntVec3 cell = RandomCellNear(map, center, info.pawnScatterRadius);
                        GenSpawn.Spawn(gear, cell, map);
                    }
                }
            }

            if (info.spawnPawnsInDropPods && dropPodThings.Count > 0)
            {
                DropPodUtility.DropThingsNear(center, map, dropPodThings, GetDropPodDelayTicks(info));
            }

            return center;
        }

        private static int RollCount(int min, int max)
        {
            int safeMin = Mathf.Max(0, min);
            int safeMax = Mathf.Max(safeMin, max);
            return Rand.RangeInclusive(safeMin, safeMax);
        }

        private static List<Pawn> GeneratePawns(LanternDiscoverySpawnInfo info, int count)
        {
            List<Pawn> pawns = new List<Pawn>();
            if (count <= 0 || info.pawnKind == null) return pawns;

            Faction faction = ResolveFaction(info);
            for (int i = 0; i < count; i++)
            {
                Pawn pawn = PawnGenerator.GeneratePawn(info.pawnKind, faction);
                if (pawn != null) pawns.Add(pawn);
            }
            return pawns;
        }

        private static Faction ResolveFaction(LanternDiscoverySpawnInfo info)
        {
            if (info.pawnFaction != null)
            {
                Faction f = Find.FactionManager.FirstFactionOfDef(info.pawnFaction);
                if (f != null) return f;
            }

            Faction fallback = Find.FactionManager.FirstFactionOfDef(FactionDefOf.Ancients);
            if (fallback != null) return fallback;
            return Find.FactionManager.FirstFactionOfDef(FactionDefOf.AncientsHostile);
        }

        private static Pawn ChooseReceiver(LanternDiscoverySpawnInfo info, List<Pawn> alive, List<Pawn> dead)
        {
            switch (info.gearReceiver)
            {
                case LanternDiscoveryGearReceiver.AliveOnly:
                    return alive.Count > 0 ? alive[Rand.Range(0, alive.Count)] : null;
                case LanternDiscoveryGearReceiver.DeadOnly:
                    return dead.Count > 0 ? dead[Rand.Range(0, dead.Count)] : null;
                case LanternDiscoveryGearReceiver.PreferDead:
                    if (dead.Count > 0) return dead[Rand.Range(0, dead.Count)];
                    return alive.Count > 0 ? alive[Rand.Range(0, alive.Count)] : null;
                case LanternDiscoveryGearReceiver.AnyPawn:
                    if (alive.Count + dead.Count == 0) return null;
                    if (alive.Count == 0) return dead[Rand.Range(0, dead.Count)];
                    if (dead.Count == 0) return alive[Rand.Range(0, alive.Count)];
                    return Rand.Value < 0.5f ? alive[Rand.Range(0, alive.Count)] : dead[Rand.Range(0, dead.Count)];
                default:
                    if (alive.Count > 0) return alive[Rand.Range(0, alive.Count)];
                    return dead.Count > 0 ? dead[Rand.Range(0, dead.Count)] : null;
            }
        }

        private static bool TryGiveGearToPawn(Pawn pawn, Thing gear, LanternDiscoveryGearPlacement placement)
        {
            if (pawn == null || gear == null) return false;

            if (placement == LanternDiscoveryGearPlacement.PawnWorn && gear is Apparel apparel)
            {
                if (pawn.apparel == null) pawn.apparel = new Pawn_ApparelTracker(pawn);
                pawn.apparel.Wear(apparel, true);
                return pawn.apparel.WornApparel.Contains(apparel);
            }

            if (pawn.inventory == null) pawn.inventory = new Pawn_InventoryTracker(pawn);
            return pawn.inventory.innerContainer.TryAdd(gear);
        }

        private static List<Thing> CreateGearItems(LanternDiscoverySpawnInfo info)
        {
            List<Thing> items = new List<Thing>();
            if (info.gearDef == null) return items;

            for (int i = 0; i < Mathf.Max(1, info.gearCount); i++)
            {
                Thing gear = ThingMaker.MakeThing(info.gearDef);
                if (gear != null) items.Add(gear);
            }
            return items;
        }

        private static void SpawnCrashDebris(Map map, IntVec3 center, LanternDiscoverySpawnInfo info)
        {
            ThingDef chunk = info.crashChunkDef ?? DefDatabase<ThingDef>.GetNamedSilentFail("ShipChunk");
            ThingDef debris = info.crashDebrisDef ?? DefDatabase<ThingDef>.GetNamedSilentFail("ChunkSlagSteel");

            if (chunk != null)
            {
                IntVec3 chunkCell = RandomCellNear(map, center, info.crashDebrisRadius);
                GenSpawn.Spawn(ThingMaker.MakeThing(chunk), chunkCell, map);
            }

            if (debris == null || info.crashDebrisCount <= 0) return;

            for (int i = 0; i < info.crashDebrisCount; i++)
            {
                IntVec3 debrisCell = RandomCellNear(map, center, info.crashDebrisRadius);
                GenSpawn.Spawn(ThingMaker.MakeThing(debris), debrisCell, map);
            }
        }

        private static IntVec3 RandomCellNear(Map map, IntVec3 center, float radius)
        {
            int r = Mathf.Max(1, Mathf.RoundToInt(radius));
            return CellFinder.RandomClosewalkCellNear(center, map, r);
        }

        private static int GetDropPodDelayTicks(LanternDiscoverySpawnInfo info)
        {
            return Mathf.Max(0, Mathf.RoundToInt(info.dropPodOpenDelaySeconds * 60f));
        }

        private static IntVec3 FindAnchor(Map map, bool preferColony)
        {
            if (map == null) return IntVec3.Invalid;

            if (preferColony)
            {
                List<Building> buildings = map.listerBuildings?.allBuildingsColonist;
                if (!buildings.NullOrEmpty())
                {
                    return buildings[Rand.Range(0, buildings.Count)].Position;
                }

                List<Pawn> colonists = map.mapPawns?.FreeColonistsSpawned;
                if (!colonists.NullOrEmpty())
                {
                    return colonists[Rand.Range(0, colonists.Count)].Position;
                }
            }

            return map.Center;
        }
    }
}
