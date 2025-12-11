using System.Collections.Generic;
using Verse;
using RimWorld;
using DrAke.LanternsFramework;

namespace DrAke.LanternsFramework.Abilities
{
    public class HediffCompProperties_GiveAbilities : HediffCompProperties
    {
        public List<AbilityDef> abilities = new List<AbilityDef>();

        public HediffCompProperties_GiveAbilities()
        {
            this.compClass = typeof(HediffComp_GiveAbilities);
        }
    }

    public class HediffComp_GiveAbilities : HediffComp
    {
        public HediffCompProperties_GiveAbilities Props => (HediffCompProperties_GiveAbilities)props;

        public override void CompPostPostAdd(DamageInfo? dinfo)
        {
            base.CompPostPostAdd(dinfo);
            CheckAbilities();
        }

        public override void CompPostTick(ref float severityAdjustment)
        {
            base.CompPostTick(ref severityAdjustment);
            if (Pawn.IsHashIntervalTick(60))
            {
                CheckAbilities();
            }
        }

        private void CheckAbilities()
        {
            if (Pawn.abilities == null) return;
            foreach (var def in Props.abilities)
            {
                if (Pawn.abilities.GetAbility(def) == null)
                {
                    Pawn.abilities.GainAbility(def);
                }
            }
        }

        public override void CompPostPostRemoved()
        {
            base.CompPostPostRemoved();
            if (Pawn.abilities == null) return;
            foreach (var def in Props.abilities)
            {
                Pawn.abilities.RemoveAbility(def);
            }
        }
    }
}
