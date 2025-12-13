using RimWorld;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class CompAbilityEffect_LanternTargetRules : CompAbilityEffect
    {
        public new CompProperties_LanternTargetRules Props => (CompProperties_LanternTargetRules)props;

        public override bool Valid(LocalTargetInfo target, bool throwMessages = false)
        {
            if (!base.Valid(target, throwMessages)) return false;

            var caster = parent?.pawn;
            if (caster == null) return false;

            if (!IsTargetAllowed(caster, target, out var reason))
            {
                if (throwMessages && !reason.NullOrEmpty())
                {
                    Messages.Message(reason, caster, MessageTypeDefOf.RejectInput, historical: false);
                }
                return false;
            }

            return true;
        }

        private bool IsTargetAllowed(Pawn caster, LocalTargetInfo target, out string reason)
        {
            reason = null;

            Thing t = target.Thing;
            if (t == null)
            {
                // Location targeting is always allowed.
                return true;
            }

            if (t == caster)
            {
                if (!Props.allowSelf)
                {
                    reason = "Cannot target self.";
                    return false;
                }
                return true;
            }

            Faction casterFaction = caster.Faction;
            Faction targetFaction = t.Faction;

            if (targetFaction == null)
            {
                if (t is Pawn p && p.HostileTo(caster))
                {
                    if (!Props.allowHostiles)
                    {
                        reason = "Cannot target hostiles.";
                        return false;
                    }
                    return true;
                }
                if (!Props.allowNoFaction)
                {
                    reason = "Target has no faction.";
                    return false;
                }
                return true;
            }

            if (casterFaction == null)
            {
                // Non-faction pawns: allow unless the caller explicitly disabled this bucket via allowNeutral.
                if (!Props.allowNeutral)
                {
                    reason = "Caster has no faction; target not allowed.";
                    return false;
                }
                return true;
            }

            if (targetFaction == casterFaction)
            {
                if (!Props.allowAllies)
                {
                    reason = "Cannot target allies.";
                    return false;
                }
                return true;
            }

            bool hostile = targetFaction.HostileTo(casterFaction);
            if (hostile)
            {
                if (!Props.allowHostiles)
                {
                    reason = "Cannot target hostiles.";
                    return false;
                }
                return true;
            }

            if (!Props.allowNeutral)
            {
                reason = "Cannot target non-hostiles.";
                return false;
            }
            return true;
        }
    }

    public class CompProperties_LanternTargetRules : CompProperties_AbilityEffect
    {
        public bool allowSelf = true;
        public bool allowAllies = true;
        public bool allowNeutral = true;
        public bool allowHostiles = true;
        public bool allowNoFaction = true;

        public CompProperties_LanternTargetRules()
        {
            compClass = typeof(CompAbilityEffect_LanternTargetRules);
        }
    }
}
