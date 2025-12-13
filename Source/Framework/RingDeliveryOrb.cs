using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    // Generic replacement for SectorScanOrb
    public class RingDeliveryOrb : ThingWithComps
    {
        public Pawn targetPawn;
        public ThingDef ringToGive; // Defines which ring to spawn

        private float angle;
        private int circleDuration;
        private const float Radius = 2f;
        private Vector3 exactPosition;
        private const float Speed = 12f; // Faster



        public override void SpawnSetup(Map map, bool respawningAfterLoad)
        {
            base.SpawnSetup(map, respawningAfterLoad);
            if (!respawningAfterLoad)
            {
                exactPosition = Position.ToVector3Shifted();
            }
        }

        public override Vector3 DrawPos => exactPosition;

        protected override void Tick()
        {
            base.Tick();
            if (targetPawn == null || targetPawn.Dead || targetPawn.Map != Map)
            {
                Destroy();
                return;
            }

            // Init exactPos if missing (e.g. existing save)
            if (exactPosition == Vector3.zero) exactPosition = Position.ToVector3Shifted();

            Vector3 targetPos = targetPawn.DrawPos;
            float dist = (targetPos - exactPosition).MagnitudeHorizontal();

            if (dist > Radius && circleDuration == 0)
            {
                // Approach
                Vector3 dir = (targetPos - exactPosition).normalized;
                exactPosition += dir * Speed * 0.01667f; // 60 ticks/sec
                
                // Update logical position
                IntVec3 newCell = exactPosition.ToIntVec3();
                if (newCell != Position && newCell.InBounds(Map))
                {
                    Position = newCell;
                }
            }
            else
            {
                // Circle behavior
                if (circleDuration == 0 && LanternDebug.LoggingEnabled)
                {
                    Log.Message($"[LanternsDebug] Orb reached target {targetPawn}. Entering Circle Mode.");
                }
                
                circleDuration++;
                angle += 5f; // Spin speed
                
                // Calculate circle pos relative to PAWN
                Vector3 offset = new Vector3(Mathf.Cos(angle * Mathf.Deg2Rad), 0, Mathf.Sin(angle * Mathf.Deg2Rad)) * Radius;
                exactPosition = targetPawn.DrawPos + offset;
                 
                 // Update logical position
                IntVec3 newCell = exactPosition.ToIntVec3();
                if (newCell != Position && newCell.InBounds(Map))
                {
                    Position = newCell;
                }
                
                if (circleDuration > 180) // 3 seconds
                {
                    EquipRing();
                    Destroy();
                }
            }
        }

        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_Values.Look(ref exactPosition, "exactPosition");
            Scribe_References.Look(ref targetPawn, "targetPawn");
            Scribe_Defs.Look(ref ringToGive, "ringToGive");
            Scribe_Values.Look(ref circleDuration, "circleDuration");
            Scribe_Values.Look(ref angle, "angle");
            Scribe_Values.Look(ref hasDelivered, "hasDelivered"); // Save the flag!
        }

        private bool hasDelivered = false;

        private void EquipRing()
        {
            if (hasDelivered) return;
            
            if (LanternDebug.LoggingEnabled)
            {
                Log.Message($"[LanternsDebug] EquipRing called for {targetPawn}");
            }
            if (targetPawn == null || ringToGive == null) 
            {
                Log.Error("[LanternsDebug] targetPawn or ringToGive is null");
                return;
            }

            // Strict Check: Does pawn already have it?
            if (targetPawn.apparel.WornApparel.Any(a => a.def == ringToGive))
            {
                if (LanternDebug.LoggingEnabled)
                {
                    Log.Message($"[LanternsDebug] Pawn {targetPawn} already has ring. Aborting delivery.");
                }
                hasDelivered = true;
                return;
            }

            hasDelivered = true;

            Thing ring = ThingMaker.MakeThing(ringToGive);
            if (ring == null)
            {
                Log.Error($"[LanternsDebug] Failed to make ring thing from {ringToGive.defName}");
                return;
            }
            
            if (LanternDebug.LoggingEnabled)
            {
                Log.Message($"[LanternsDebug] Attempting to force wear {ring} on {targetPawn}...");
            }
            targetPawn.apparel.Wear(ring as Apparel, true); // true = drop replaced
            
            if (targetPawn.apparel.WornApparel.Contains(ring as Apparel))
            {
                 if (LanternDebug.LoggingEnabled)
                 {
                     Log.Message($"[LanternsDebug] SUCCESS! {targetPawn} is now wearing {ring}");
                 }
                 Messages.Message($"{targetPawn.NameShortColored} has been chosen by the {ring.Label}!", targetPawn, MessageTypeDefOf.PositiveEvent);
            }
            else
            {
                 Log.Error($"[LanternsDebug] FAILED to wear ring. Check apparel constraints/layers.");
                 // Fallback: Drop at feet
                 GenSpawn.Spawn(ring, targetPawn.Position, targetPawn.Map);
            }
        }
    }
}
