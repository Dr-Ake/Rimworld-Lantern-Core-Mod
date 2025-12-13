using RimWorld;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class CompAbilityEffect_LanternStartMentalState : CompAbilityEffect_LanternPawnAoeBase
    {
        public new CompProperties_LanternStartMentalState Props => (CompProperties_LanternStartMentalState)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);
            Pawn caster = parent.pawn;
            if (caster?.Map == null || Props.mentalStateDef == null) return;

            foreach (Pawn p in GetTargetPawns(target, Props.radius, Props.maxTargets))
            {
                if (!ShouldAffectPawn(p, caster, Props.affectSelf, Props.affectAlliesOnly, Props.affectHostilesOnly,
                        Props.affectDowned, Props.affectNotDowned, Props.affectAnimals, Props.affectMechs, Props.requireLineOfSight))
                {
                    continue;
                }
                p.mindState?.mentalStateHandler?.TryStartMentalState(Props.mentalStateDef);
            }
        }
    }

    public class CompProperties_LanternStartMentalState : CompProperties_AbilityEffect
    {
        public MentalStateDef mentalStateDef;

        public float radius = 0f;
        public int maxTargets = 0; // 0 = unlimited
        public bool affectAlliesOnly = false;
        public bool affectHostilesOnly = false;
        public bool affectSelf = false;
        public bool affectDowned = true;
        public bool affectNotDowned = true;
        public bool affectAnimals = true;
        public bool affectMechs = true;
        public bool requireLineOfSight = false;

        public CompProperties_LanternStartMentalState()
        {
            compClass = typeof(CompAbilityEffect_LanternStartMentalState);
        }
    }

    public class CompAbilityEffect_LanternEndMentalState : CompAbilityEffect_LanternPawnAoeBase
    {
        public new CompProperties_LanternEndMentalState Props => (CompProperties_LanternEndMentalState)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);
            Pawn caster = parent.pawn;
            if (caster?.Map == null) return;

            foreach (Pawn p in GetTargetPawns(target, Props.radius, Props.maxTargets))
            {
                if (!ShouldAffectPawn(p, caster, Props.affectSelf, Props.affectAlliesOnly, Props.affectHostilesOnly,
                        Props.affectDowned, Props.affectNotDowned, Props.affectAnimals, Props.affectMechs, Props.requireLineOfSight))
                {
                    continue;
                }
                var handler = p.mindState?.mentalStateHandler;
                handler?.CurState?.RecoverFromState();
            }
        }
    }

    public class CompProperties_LanternEndMentalState : CompProperties_AbilityEffect
    {
        public float radius = 0f;
        public int maxTargets = 0; // 0 = unlimited
        public bool affectAlliesOnly = false;
        public bool affectHostilesOnly = false;
        public bool affectSelf = false;
        public bool affectDowned = true;
        public bool affectNotDowned = true;
        public bool affectAnimals = true;
        public bool affectMechs = true;
        public bool requireLineOfSight = false;

        public CompProperties_LanternEndMentalState()
        {
            compClass = typeof(CompAbilityEffect_LanternEndMentalState);
        }
    }
}
