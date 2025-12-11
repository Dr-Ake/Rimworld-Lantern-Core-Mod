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
        private const float Speed = 2f;

        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_References.Look(ref targetPawn, "targetPawn");
            Scribe_Defs.Look(ref ringToGive, "ringToGive");
            Scribe_Values.Look(ref angle, "angle");
            Scribe_Values.Look(ref circleDuration, "circleDuration");
        }

        public override void Tick()
        {
            base.Tick();
            if (targetPawn == null || targetPawn.Dead || targetPawn.Map != Map)
            {
                Destroy();
                return;
            }

            Vector3 targetPos = targetPawn.DrawPos;
            Vector3 myPos = DrawPos;

            float dist = (targetPos - myPos).MagnitudeHorizontal();

            if (dist > Radius + 1f && circleDuration == 0)
            {
                // Approach
                Vector3 dir = (targetPos - myPos).normalized;
                Position = (myPos + dir * Speed * 0.016f).ToIntVec3(); // Approximate tick movement
            }
            else
            {
                // Circle
                circleDuration++;
                angle += 2f; // Spin speed
                Vector3 offset = new Vector3(Mathf.Cos(angle * Mathf.Deg2Rad), 0, Mathf.Sin(angle * Mathf.Deg2Rad)) * Radius;
                
                // Visual update (Teleporting slightly for visual smoothness? Or use generic ticker?)
                // Actually true position setting in Tick is jerky. 
                // Ideally this is a Mote or Projectile. But ThingWithComps works for logic.
                // Keeping simple logic for now.
                
                if (circleDuration > 300) // 5 seconds of circling
                {
                    EquipRing();
                    Destroy();
                }
            }
        }

        private void EquipRing()
        {
            if (targetPawn == null || ringToGive == null) return;

            Thing ring = ThingMaker.MakeThing(ringToGive);
            targetPawn.apparel.Wear(ring as Apparel);
            
            // Visuals? 
            // MoteMaker.ThrowMicroSparks(targetPawn.Position.ToVector3(), targetPawn.Map);
            Messages.Message($"{targetPawn.NameShortColored} has been chosen by the {ring.Label}!", targetPawn, MessageTypeDefOf.PositiveEvent);
        }
    }
}
