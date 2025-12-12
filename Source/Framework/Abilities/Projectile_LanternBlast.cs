using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    // Traveling Lantern blast projectile that can take ring-based damage overrides
    // and optionally draw a beam from caster to the projectile while in flight.
    public class Projectile_LanternBlast : Bullet
    {
        public int damageAmountOverride = -1;
        public float armorPenetrationOverride = -1f;

        // Optional in-flight beam (MoteDualAttached).
        public ThingDef beamMoteDef;
        public Vector3 beamOffsetA = Vector3.zero;
        public Vector3 beamOffsetB = Vector3.zero;
        public float beamScale = 0.5f;
        public bool tintBeamToRingColor = true;
        public Color ringColor = Color.white;
        public Color beamColorOverride = Color.white;

        private MoteDualAttached beamMote;

        public override int DamageAmount => damageAmountOverride > 0 ? damageAmountOverride : base.DamageAmount;

        public override float ArmorPenetration => armorPenetrationOverride >= 0f ? armorPenetrationOverride : base.ArmorPenetration;

        public override void Launch(Thing launcher, Vector3 origin, LocalTargetInfo usedTarget, LocalTargetInfo intendedTarget,
            ProjectileHitFlags hitFlags, bool preventFriendlyFire = false, Thing equipment = null, ThingDef targetCoverDef = null)
        {
            base.Launch(launcher, origin, usedTarget, intendedTarget, hitFlags, preventFriendlyFire, equipment, targetCoverDef);

            if (beamMoteDef != null && launcher is Pawn pawn && pawn.Map != null)
            {
                beamMote = MoteMaker.MakeInteractionOverlay(beamMoteDef, pawn, this, beamOffsetA, beamOffsetB);
                if (beamMote != null)
                {
                    beamMote.Scale = beamScale > 0f ? beamScale : 0.5f;
                    if (!tintBeamToRingColor)
                    {
                        beamMote.instanceColor = beamColorOverride;
                    }
                    else
                    {
                        beamMote.instanceColor = ringColor;
                    }
                    beamMote.Maintain();
                }
            }
        }

        protected override void Impact(Thing hitThing, bool blockedByShield = false)
        {
            if (beamMote != null && !beamMote.Destroyed)
            {
                beamMote.Destroy(DestroyMode.Vanish);
            }
            beamMote = null;
            base.Impact(hitThing, blockedByShield);
        }
    }
}
