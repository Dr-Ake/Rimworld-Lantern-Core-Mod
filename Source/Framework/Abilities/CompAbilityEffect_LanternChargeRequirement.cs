using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    // Adds a charge threshold requirement to an ability without consuming charge.
    public class CompAbilityEffect_LanternChargeRequirement : CompAbilityEffect
    {
        public new CompProperties_LanternChargeRequirement Props => (CompProperties_LanternChargeRequirement)props;

        public override bool GizmoDisabled(out string reason)
        {
            Pawn pawn = parent.pawn;
            if (pawn == null)
            {
                reason = "Lantern_NoRing".Translate();
                return true;
            }

            CompLanternRing ring = LanternResources.GetRing(pawn);
            if (ring == null)
            {
                reason = "Lantern_NoRing".Translate();
                return true;
            }

            if (!ring.IsActive)
            {
                reason = "Lantern_RingInert".Translate();
                return true;
            }

            float required = Mathf.Clamp01(ring.GetEffectiveCostFraction(Props.minChargePercent));
            if (ring.ChargePercent < required)
            {
                reason = "Lantern_RequiresCharge".Translate(required.ToString("P0"));
                return true;
            }

            reason = null;
            return false;
        }

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            // No-op: this comp is purely a requirement gate.
            base.Apply(target, dest);
        }
    }

    public class CompProperties_LanternChargeRequirement : CompProperties_AbilityEffect
    {
        // Fraction (0..1) of ring charge required to use the ability.
        public float minChargePercent = 0.20f;

        public CompProperties_LanternChargeRequirement()
        {
            compClass = typeof(CompAbilityEffect_LanternChargeRequirement);
        }
    }
}
