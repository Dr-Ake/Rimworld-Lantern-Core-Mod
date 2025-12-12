using System.Linq;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class CompProperties_LanternBuffAura : CompProperties_AbilityEffect
    {
        public HediffDef hediffDef;
        public float severity = 0.2f;
        public float radius = 4f;
        public int durationTicks = 6000;
        public bool removeOnExpire = true;
        public bool affectAlliesOnly = true;
        public bool affectSelf = true;
        public bool affectAnimals = false;
        public EffecterDef effecterDef;

        public CompProperties_LanternBuffAura()
        {
            compClass = typeof(CompAbilityEffect_LanternBuffAura);
        }
    }

    // Lore: emotional auras (hope boost, rage frenzy, fear suppression, etc.).
    public class CompAbilityEffect_LanternBuffAura : CompAbilityEffect
    {
        public new CompProperties_LanternBuffAura Props => (CompProperties_LanternBuffAura)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);

            Pawn caster = parent?.pawn;
            if (caster == null || Props.hediffDef == null) return;
            Map map = caster.Map;
            if (map == null) return;

            IntVec3 center = target.Cell.IsValid ? target.Cell : caster.Position;

            if (Props.effecterDef != null)
            {
                Props.effecterDef.Spawn(center, map, 1f);
            }

            foreach (IntVec3 cell in GenRadial.RadialCellsAround(center, Props.radius, true))
            {
                if (!cell.InBounds(map)) continue;
                foreach (Thing t in cell.GetThingList(map))
                {
                    if (t is Pawn p && ShouldAffect(p, caster))
                    {
                        ApplyBuff(p);
                    }
                }
            }
        }

        private bool ShouldAffect(Pawn p, Pawn caster)
        {
            if (p == null || p.Dead) return false;
            if (!Props.affectAnimals && p.RaceProps.Animal) return false;
            if (!Props.affectSelf && p == caster) return false;
            if (Props.affectAlliesOnly && p.Faction != null && caster.Faction != null)
            {
                if (p.Faction != caster.Faction) return false;
            }
            return true;
        }

        private void ApplyBuff(Pawn p)
        {
            Hediff hediff = p.health.hediffSet.GetFirstHediffOfDef(Props.hediffDef);
            if (hediff == null)
            {
                hediff = HediffMaker.MakeHediff(Props.hediffDef, p);
                hediff.Severity = Props.severity;
                p.health.AddHediff(hediff);
            }
            else
            {
                hediff.Severity += Props.severity;
            }

            if (Props.durationTicks > 0 && Props.removeOnExpire)
            {
                HediffComp_Disappears disappears = hediff.TryGetComp<HediffComp_Disappears>();
                if (disappears != null)
                {
                    disappears.ticksToDisappear = Mathf.Max(disappears.ticksToDisappear, Props.durationTicks);
                }
                else
                {
                    LanternConstructs.RegisterBuff(p, Props.hediffDef, Props.durationTicks);
                }
            }
        }
    }
}

