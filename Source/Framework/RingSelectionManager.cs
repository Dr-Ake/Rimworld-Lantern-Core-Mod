using System; // Added for Activator
using System.Collections.Generic;
using System.Linq;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    public class RingSelectionManager : GameComponent
    {
        // Persistent state per RingSelectionDef.
        private List<RingSelectionStateEntry> selectionStates = new List<RingSelectionStateEntry>();

        public RingSelectionManager(Game game)
        {
        }

        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_Collections.Look(ref selectionStates, "selectionStates", LookMode.Deep);
            if (Scribe.mode == LoadSaveMode.PostLoadInit && selectionStates == null)
            {
                selectionStates = new List<RingSelectionStateEntry>();
            }
        }

        public override void GameComponentTick()
        {
            // Debug: Prove existence
            if (LanternDebug.LoggingEnabled && Find.TickManager.TicksGame % 5000 == 0)
            {
                Log.Message($"[LanternsDebug] RingSelectionManager is Alive. Tick: {Find.TickManager.TicksGame}");
            }

            // Periodic checks
            if (Find.TickManager.TicksGame % 250 == 0) 
            {
                CheckPeriodicTriggers();
            }
        }

        private void CheckPeriodicTriggers()
        {
            foreach (RingSelectionDef def in DefDatabase<RingSelectionDef>.AllDefs)
            {
                if (def.triggerPeriodic && def.periodicInterval > 0)
                {
                    if (ShouldSkip(def)) continue;
                    long ticks = Find.TickManager.TicksGame;
                    // Log.Message($"[LanternsDebug] Checking {def.defName}: Interval {def.periodicInterval}. Modulo: {ticks % def.periodicInterval}");
                    
                    if (ticks % def.periodicInterval < 250)
                    {
                         if (LanternDebug.LoggingEnabled)
                         {
                             Log.Message($"[LanternsDebug] Triggering Periodic Selection for {def.defName} at tick {ticks} (Interval {def.periodicInterval})");
                         }
                         TryRunSelection(def);
                    }
                }
            }
        }

        public void Notify_MentalStateStarted(Pawn pawn, MentalStateDef stateDef)
        {
            if (pawn == null || stateDef == null) return;

            foreach (RingSelectionDef def in DefDatabase<RingSelectionDef>.AllDefs)
            {
                if (def.triggerMentalState)
                {
                    if (ShouldSkip(def)) continue;
                    bool match = false;
                    if (def.mentalStates.NullOrEmpty())
                    {
                        match = true; // Any mental state
                    }
                    else
                    {
                        if (def.mentalStates.Contains(stateDef.defName)) match = true;
                    }

                    if (match)
                    {
                        TryAssignRingToPawn(pawn, def);
                    }
                }
            }
        }

        public void Notify_PawnJoinedFaction(Pawn pawn, Faction oldFaction, Faction newFaction)
        {
            if (pawn == null || newFaction != Faction.OfPlayer) return;
            if (oldFaction == Faction.OfPlayer) return;

            foreach (RingSelectionDef def in DefDatabase<RingSelectionDef>.AllDefs)
            {
                if (def.triggerOnJoinPlayerFaction)
                {
                    if (ShouldSkip(def)) continue;
                    TryAssignRingToPawn(pawn, def);
                }
            }
        }

        public void Notify_PawnSpawned(Pawn pawn, Map map, bool respawningAfterLoad)
        {
            if (respawningAfterLoad) return;
            if (pawn == null || map == null || !map.IsPlayerHome) return;

            foreach (RingSelectionDef def in DefDatabase<RingSelectionDef>.AllDefs)
            {
                if (def.triggerOnSpawnedOnMap)
                {
                    if (ShouldSkip(def)) continue;
                    TryAssignRingToPawn(pawn, def);
                }
            }
        }

        public void Notify_PawnDowned(Pawn pawn)
        {
            if (pawn == null || pawn.Dead) return;

            foreach (RingSelectionDef def in DefDatabase<RingSelectionDef>.AllDefs)
            {
                if (def.triggerOnDowned)
                {
                    if (ShouldSkip(def)) continue;
                    TryAssignRingToPawn(pawn, def);
                }
            }
        }

        public void Notify_PawnKilled(Pawn killer, Pawn victim)
        {
            if (killer == null || victim == null) return;
            if (killer.Dead || killer.Destroyed) return;

            bool victimWasHostile = victim.HostileTo(Faction.OfPlayer);

            foreach (RingSelectionDef def in DefDatabase<RingSelectionDef>.AllDefs)
            {
                if (def.triggerOnKillAny)
                {
                    if (ShouldSkip(def)) continue;
                    TryAssignRingToPawn(killer, def);
                    continue;
                }

                if (def.triggerOnKillHostile && victimWasHostile)
                {
                    if (ShouldSkip(def)) continue;
                    TryAssignRingToPawn(killer, def);
                }
            }
        }

        public void Notify_HediffAdded(Pawn pawn, Hediff hediff)
        {
            if (pawn == null || hediff?.def == null) return;

            foreach (RingSelectionDef def in DefDatabase<RingSelectionDef>.AllDefs)
            {
                if (!def.triggerOnHediffAdded) continue;
                if (ShouldSkip(def)) continue;

                if (!def.hediffsToTriggerOn.NullOrEmpty() && !def.hediffsToTriggerOn.Contains(hediff.def))
                {
                    continue;
                }

                TryAssignRingToPawn(pawn, def);
            }
        }

        public void TryRunSelection(RingSelectionDef def)
        {
            if (ShouldSkip(def)) return;
            var state = GetState(def);
            if (def.runOnlyOnce) state.hasRunOnce = true;

            Map map = Find.AnyPlayerHomeMap;
            if (map == null) return;

            RingSelectionWorker worker = (RingSelectionWorker)Activator.CreateInstance(def.workerClass);

            var scored = new List<(Pawn pawn, float score)>();

            foreach (Pawn p in map.mapPawns.AllPawnsSpawned)
            {
                if (p == null) continue;
                // Skip if already has this ring
                if (def.ringDef != null && p.apparel != null && p.apparel.WornApparel.Any(a => a.def == def.ringDef))
                {
                    continue;
                }

                float score = worker.ScorePawn(p, def);
                if (score >= def.minScoreToSelect)
                {
                    scored.Add((p, score));
                }
            }

            Pawn chosen = ChooseCandidate(def, scored);
            float chosenScore = scored.FirstOrDefault(s => s.pawn == chosen).score;

            if (LanternDebug.LoggingEnabled)
            {
                Log.Message($"[LanternsDebug] Candidate for {def.defName}: {chosen} (Score: {chosenScore})");
                if (chosen != null && def.conditions != null && def.conditions.Count > 0)
                {
                    var parts = def.conditions.Select(c => $"{c.GetType().Name}:{c.CalculateScore(chosen, def):0.###}");
                    Log.Message($"[LanternsDebug] Score breakdown for {chosen}: {string.Join(", ", parts)}");
                }
            }

            if (chosen != null)
            {
                GiveRingToPawn(chosen, def);
            }
        }
        
        public void TryAssignRingToPawn(Pawn p, RingSelectionDef def)
        {
            if (ShouldSkip(def)) return;
            var state = GetState(def);
            if (def.runOnlyOnce) state.hasRunOnce = true;

            RingSelectionWorker worker = (RingSelectionWorker)Activator.CreateInstance(def.workerClass);
            float score = worker.ScorePawn(p, def);
            
            // Threshold check? For now assume > 0 is valid.
            if (score >= def.minScoreToSelect)
            {
                GiveRingToPawn(p, def);
            }
        }

        private static Pawn ChooseCandidate(RingSelectionDef def, List<(Pawn pawn, float score)> scored)
        {
            if (scored.NullOrEmpty()) return null;

            switch (def.selectionMode)
            {
                case SelectionMode.RandomAboveThreshold:
                    return scored.RandomElement().pawn;

                case SelectionMode.WeightedRandom:
                    float total = scored.Sum(s => Mathf.Max(0f, s.score));
                    if (total <= 0f) return null;
                    float pick = Rand.Value * total;
                    float acc = 0f;
                    foreach (var s in scored)
                    {
                        acc += Mathf.Max(0f, s.score);
                        if (acc >= pick) return s.pawn;
                    }
                    return scored.Last().pawn;

                case SelectionMode.HighestScore:
                default:
                    return scored.OrderByDescending(s => s.score).First().pawn;
            }
        }

        private void TriggerEvent(Pawn target, RingSelectionDef def)
        {
            if (LanternDebug.LoggingEnabled)
            {
                Log.Message($"[LanternsDebug] Triggering Event for {target}. Def: {def.defName}");
            }
            ThingDef orbDef = def.orbDef;
            if (orbDef == null) 
            {
                orbDef =
                    DefDatabase<ThingDef>.GetNamed("Lantern_RingDeliveryOrb", false) ??
                    DefDatabase<ThingDef>.GetNamed("GL_SectorScanOrb", false);

                if (LanternDebug.LoggingEnabled)
                {
                    Log.Message($"[LanternsDebug] Using fallback orbDef: {orbDef?.defName ?? "none"}");
                }
            }
            else
            {
                if (LanternDebug.LoggingEnabled)
                {
                    Log.Message($"[LanternsDebug] Using orbDef from XML: {orbDef.defName}");
                }
            }

            if (orbDef == null)
            {
                 Log.Error("[LanternsDebug] OrbDef is null!");
                 return;
            }

            IntVec3 start = target.Map.AllCells.Where(c => c.OnEdge(target.Map)).RandomElement();
            if (LanternDebug.LoggingEnabled)
            {
                Log.Message($"[LanternsDebug] Spawning at edge: {start}");
            }
            
            Thing orbThing = ThingMaker.MakeThing(orbDef);
            if (orbThing == null)
            {
                Log.Error($"[LanternsDebug] Failed to make thing for {orbDef.defName}");
                return;
            }
            
            if (orbThing is RingDeliveryOrb orb)
            {
                if (LanternDebug.LoggingEnabled)
                {
                    Log.Message("[LanternsDebug] Thing IS RingDeliveryOrb. configuring...");
                }
                orb.targetPawn = target;
                orb.ringToGive = def.ringDef;
                GenSpawn.Spawn(orb, start, target.Map);
                if (LanternDebug.LoggingEnabled)
                {
                    Log.Message("[LanternsDebug] Orb Spawned.");
                }
            }
            else
            {
                if (LanternDebug.LoggingEnabled)
                {
                    Log.Message($"[LanternsDebug] Thing is NOT RingDeliveryOrb (Type: {orbThing.GetType().Name}). Spawning ring directly at {target.Position}");
                }
                // Simple spawn backup
                GenSpawn.Spawn(def.ringDef, target.Position, target.Map);
            }
        }

        private bool GiveRingToPawn(Pawn target, RingSelectionDef def)
        {
            if (target == null || def?.ringDef == null) return false;
            if (PawnHasRing(target, def.ringDef)) return false;

            if (def.maxActiveRingsInColony > 0 && CountActiveRingsInColony(def.ringDef) >= def.maxActiveRingsInColony)
            {
                return false;
            }

            TriggerEvent(target, def);

            var state = GetState(def);
            state.ringsGiven++;

            if (def.stopAfterFirstSuccess) state.completed = true;
            if (def.maxRingsTotal > 0 && state.ringsGiven >= def.maxRingsTotal) state.completed = true;

            return true;
        }

        private static bool PawnHasRing(Pawn p, ThingDef ringDef)
        {
            return ringDef != null && p?.apparel != null && p.apparel.WornApparel.Any(a => a.def == ringDef);
        }

        private bool ShouldSkip(RingSelectionDef def)
        {
            if (def == null) return true;
            var state = GetState(def);
            if (state.completed) return true;
            if (def.runOnlyOnce && state.hasRunOnce) return true;
            if (def.maxRingsTotal > 0 && state.ringsGiven >= def.maxRingsTotal)
            {
                state.completed = true;
                return true;
            }
            if (def.maxActiveRingsInColony > 0 && CountActiveRingsInColony(def.ringDef) >= def.maxActiveRingsInColony)
            {
                return true;
            }
            return false;
        }

        private static int CountActiveRingsInColony(ThingDef ringDef)
        {
            if (ringDef == null) return 0;
            int count = 0;
            foreach (Pawn p in PawnsFinder.AllMapsCaravansAndTravellingTransporters_Alive_FreeColonists)
            {
                if (p?.apparel == null) continue;
                if (p.apparel.WornApparel.Any(a => a.def == ringDef))
                {
                    count++;
                }
            }
            return count;
        }

        private RingSelectionStateEntry GetState(RingSelectionDef def)
        {
            if (def == null) return null;
            var existing = selectionStates.FirstOrDefault(s => s != null && s.defName == def.defName);
            if (existing != null) return existing;
            var created = new RingSelectionStateEntry { defName = def.defName };
            selectionStates.Add(created);
            return created;
        }
    }

    public class RingSelectionStateEntry : IExposable
    {
        public string defName;
        public int ringsGiven = 0;
        public bool completed = false;
        public bool hasRunOnce = false;

        public void ExposeData()
        {
            Scribe_Values.Look(ref defName, "defName");
            Scribe_Values.Look(ref ringsGiven, "ringsGiven", 0);
            Scribe_Values.Look(ref completed, "completed", false);
            Scribe_Values.Look(ref hasRunOnce, "hasRunOnce", false);
        }
    }
}
