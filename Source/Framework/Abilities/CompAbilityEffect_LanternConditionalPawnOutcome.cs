using RimWorld;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public enum LanternPawnOutcome
    {
        None,
        Down,
        Kill
    }

    public class CompAbilityEffect_LanternConditionalPawnOutcome : CompAbilityEffect
    {
        public new CompProperties_LanternConditionalPawnOutcome Props => (CompProperties_LanternConditionalPawnOutcome)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);

            Pawn victim = target.Pawn;
            if (victim == null || victim.Dead) return;

            LanternPawnOutcome outcome = Props.otherOutcome;

            if (victim.RaceProps != null)
            {
                if (victim.RaceProps.IsFlesh)
                {
                    outcome = Props.fleshOutcome;
                }
                else if (victim.RaceProps.IsMechanoid)
                {
                    outcome = Props.mechOutcome;
                }
                else if (victim.RaceProps.IsAnomalyEntity)
                {
                    outcome = Props.anomalyOutcome;
                }
            }

            switch (outcome)
            {
                case LanternPawnOutcome.Down:
                    HealthUtility.DamageUntilDowned(victim, allowBleedingWounds: false);
                    break;
                case LanternPawnOutcome.Kill:
                    victim.Kill(null);
                    break;
            }
        }
    }

    public class CompProperties_LanternConditionalPawnOutcome : CompProperties_AbilityEffect
    {
        public LanternPawnOutcome fleshOutcome = LanternPawnOutcome.Down;
        public LanternPawnOutcome mechOutcome = LanternPawnOutcome.Kill;
        public LanternPawnOutcome anomalyOutcome = LanternPawnOutcome.Kill;
        public LanternPawnOutcome otherOutcome = LanternPawnOutcome.None;

        public CompProperties_LanternConditionalPawnOutcome()
        {
            compClass = typeof(CompAbilityEffect_LanternConditionalPawnOutcome);
        }
    }
}

