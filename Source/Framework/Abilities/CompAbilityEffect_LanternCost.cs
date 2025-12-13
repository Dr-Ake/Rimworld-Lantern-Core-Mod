using RimWorld;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class CompAbilityEffect_LanternCost : CompAbilityEffect
    {
        public new CompProperties_LanternCost Props => (CompProperties_LanternCost)props;

        public override bool GizmoDisabled(out string reason)
        {
            if (parent.pawn == null)
            {
                reason = "No pawn";
                return true;
            }

            CompLanternRing ring = LanternResources.GetRing(parent.pawn);
            if (ring == null)
            {
                reason = "No Lantern Ring";
                return true;
            }

            if (ring.ChargePercent < ring.GetEffectiveCostFraction(Props.cost))
            {
                reason = "Not enough charge";
                return true;
            }

            reason = null;
            return false;
        }

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);
            CompLanternRing ring = LanternResources.GetRing(parent.pawn);
            if (ring != null)
            {
                ring.TryConsumeCharge(Props.cost);
            }
        }
    }

    public class CompProperties_LanternCost : CompProperties_AbilityEffect
    {
        public float cost = 0.05f;

        public CompProperties_LanternCost()
        {
            this.compClass = typeof(CompAbilityEffect_LanternCost);
        }
    }
}
