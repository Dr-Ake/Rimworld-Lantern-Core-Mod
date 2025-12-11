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
        public RingSelectionManager(Game game)
        {
        }

        public override void GameComponentTick()
        {
            // Debug: Prove existence
            if (Find.TickManager.TicksGame % 5000 == 0) Log.Message($"[LanternsDebug] RingSelectionManager is Alive. Tick: {Find.TickManager.TicksGame}");

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
                    long ticks = Find.TickManager.TicksGame;
                    // Log.Message($"[LanternsDebug] Checking {def.defName}: Interval {def.periodicInterval}. Modulo: {ticks % def.periodicInterval}");
                    
                    if (ticks % def.periodicInterval < 250)
                    {
                         Log.Message($"[LanternsDebug] Triggering Periodic Selection for {def.defName} at tick {ticks} (Interval {def.periodicInterval})");
                         TryRunSelection(def);
                    }
                }
            }
        }

        public void Notify_MentalStateStarted(Pawn pawn, MentalStateDef stateDef)
        {
            if (pawn == null || stateDef == null) return;
            if (!pawn.IsColonist) return; // Only care about colonists for now?

            foreach (RingSelectionDef def in DefDatabase<RingSelectionDef>.AllDefs)
            {
                if (def.triggerMentalState)
                {
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

        public void TryRunSelection(RingSelectionDef def)
        {
            Map map = Find.AnyPlayerHomeMap;
            if (map == null) return;

            Pawn bestCandidate = null;
            float bestScore = 0f;

            RingSelectionWorker worker = (RingSelectionWorker)Activator.CreateInstance(def.workerClass);

            foreach (Pawn p in map.mapPawns.FreeColonistsSpawned)
            {
                // Skip if already has this ring
                if (def.ringDef != null && p.apparel != null && p.apparel.WornApparel.Any(a => a.def == def.ringDef))
                {
                    continue;
                }

                float score = worker.ScorePawn(p, def);
                // Log.Message($"[LanternsDebug] Scoring {p}: {score}");
                if (score > bestScore)
                {
                    bestScore = score;
                    bestCandidate = p;
                }
            }
            Log.Message($"[LanternsDebug] Best Candidate for {def.defName}: {bestCandidate} (Score: {bestScore})");

            if (bestCandidate != null && bestScore > 0)
            {
                TriggerEvent(bestCandidate, def);
            }
        }
        
        public void TryAssignRingToPawn(Pawn p, RingSelectionDef def)
        {
            RingSelectionWorker worker = (RingSelectionWorker)Activator.CreateInstance(def.workerClass);
            float score = worker.ScorePawn(p, def);
            
            // Threshold check? For now assume > 0 is valid.
            if (score > 0)
            {
                TriggerEvent(p, def);
            }
        }

        private void TriggerEvent(Pawn target, RingSelectionDef def)
        {
            Log.Message($"[LanternsDebug] Triggering Event for {target}. Def: {def.defName}");
            ThingDef orbDef = def.orbDef;
            if (orbDef == null) 
            {
                orbDef = ThingDef.Named("GL_SectorScanOrb"); // Fallback
                Log.Message("[LanternsDebug] Using fallback orbDef: GL_SectorScanOrb");
            }
            else
            {
                Log.Message($"[LanternsDebug] Using orbDef from XML: {orbDef.defName}");
            }

            if (orbDef == null)
            {
                 Log.Error("[LanternsDebug] OrbDef is null!");
                 return;
            }

            IntVec3 start = target.Map.AllCells.Where(c => c.OnEdge(target.Map)).RandomElement();
            Log.Message($"[LanternsDebug] Spawning at edge: {start}");
            
            Thing orbThing = ThingMaker.MakeThing(orbDef);
            if (orbThing == null)
            {
                Log.Error($"[LanternsDebug] Failed to make thing for {orbDef.defName}");
                return;
            }
            
            if (orbThing is RingDeliveryOrb orb)
            {
                Log.Message("[LanternsDebug] Thing IS RingDeliveryOrb. configuring...");
                orb.targetPawn = target;
                orb.ringToGive = def.ringDef;
                GenSpawn.Spawn(orb, start, target.Map);
                Log.Message("[LanternsDebug] Orb Spawned.");
            }
            else
            {
                Log.Message($"[LanternsDebug] Thing is NOT RingDeliveryOrb (Type: {orbThing.GetType().Name}). Spawning ring directly at {target.Position}");
                // Simple spawn backup
                GenSpawn.Spawn(def.ringDef, target.Position, target.Map);
            }
        }
    }
}
