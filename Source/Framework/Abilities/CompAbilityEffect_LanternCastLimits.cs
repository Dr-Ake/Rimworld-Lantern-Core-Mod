using RimWorld;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class CompAbilityEffect_LanternCastLimits : CompAbilityEffect
    {
        public new CompProperties_LanternCastLimits Props => (CompProperties_LanternCastLimits)props;

        public override bool GizmoDisabled(out string reason)
        {
            var pawn = parent?.pawn;
            if (pawn == null)
            {
                reason = "No pawn";
                return true;
            }

            var ring = LanternResources.GetRing(pawn);
            if (ring == null)
            {
                reason = "No Lantern gear";
                return true;
            }

            if (!ring.CanCastWithLimits(parent.def, Props.cooldownTicks, Props.maxCastsPerDay, out reason))
            {
                return true;
            }

            reason = null;
            return false;
        }

        public override bool Valid(LocalTargetInfo target, bool throwMessages = false)
        {
            if (!base.Valid(target, throwMessages)) return false;

            var pawn = parent?.pawn;
            if (pawn == null) return false;
            var ring = LanternResources.GetRing(pawn);
            if (ring == null) return false;

            if (!ring.CanCastWithLimits(parent.def, Props.cooldownTicks, Props.maxCastsPerDay, out var reason))
            {
                if (throwMessages && !reason.NullOrEmpty())
                {
                    Messages.Message(reason, pawn, MessageTypeDefOf.RejectInput, historical: false);
                }
                return false;
            }
            return true;
        }

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);
            var pawn = parent?.pawn;
            if (pawn == null) return;
            var ring = LanternResources.GetRing(pawn);
            ring?.RecordCast(parent.def, Props.cooldownTicks, Props.maxCastsPerDay);
        }
    }

    public class CompProperties_LanternCastLimits : CompProperties_AbilityEffect
    {
        // Additional cooldown beyond RimWorld's built-in ability cooldowns.
        public int cooldownTicks = 0;
        // 0 = unlimited.
        public int maxCastsPerDay = 0;

        public CompProperties_LanternCastLimits()
        {
            compClass = typeof(CompAbilityEffect_LanternCastLimits);
        }
    }
}

