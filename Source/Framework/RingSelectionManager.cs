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
            // Periodic checks
            if (Find.TickManager.TicksGame % 250 == 0) // Optimization: Don't check every tick, checking every ~4s is fine for intervals
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
                    // Check if we are verifying "roughly now" based on the interval.
                    // Since this loop runs every 250 ticks, we check if the modulo falls within this window 
                    // to avoid missing it if the interval is large but not a perfect multiple of 250.
                    // For small intervals (<250), this will trigger roughly every 250 ticks, which is fine.
                    long ticks = Find.TickManager.TicksGame;
                    if (ticks % def.periodicInterval < 250)
                    {
                         // Basic debounce: To prevent firing multiple times within the 250-tick window if interval is very small,
                         // we could just trust generic "TryRun" safeguards. 
                         // But TryRunSelection doesn't have a cooldown logic yet. 
                         // We should rely on standard storytelling intervals or assume the def interval is large enough.
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
                float score = worker.ScorePawn(p, def);
                if (score > bestScore)
                {
                    bestScore = score;
                    bestCandidate = p;
                }
            }

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
            ThingDef orbDef = def.orbDef;
            if (orbDef == null) orbDef = ThingDef.Named("GL_SectorScanOrb"); // Fallback

            IntVec3 start = target.Map.AllCells.Where(c => c.OnEdge(target.Map)).RandomElement();
            
            Thing orbThing = ThingMaker.MakeThing(orbDef);
            
            // We need to support the Generic Orb interface or check type using Reflection/Interface?
            // Since we don't have "SectorScanOrb" in Framework (it's in GL mod currently?), we should move SectorScanOrb to Framework OR use reflection.
            // BETTER: Move SectorScanOrb to Framework as "LanternRingDeliveryOrb"
            // For now, I will assume we are moving SectorScanOrb logic to a generic class in Framework.
            // Let's create "RingDeliveryOrb" in Framework.
            
            if (orbThing is RingDeliveryOrb orb)
            {
                orb.targetPawn = target;
                orb.ringToGive = def.ringDef;
                GenSpawn.Spawn(orb, start, target.Map);
            }
            else
            {
                // Simple spawn backup
                GenSpawn.Spawn(def.ringDef, target.Position, target.Map);
            }
        }
    }
}
