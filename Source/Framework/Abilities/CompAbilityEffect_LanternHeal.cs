using System.Collections.Generic;
using System.Linq;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class CompProperties_LanternHeal : CompProperties_AbilityEffect
    {
        public float healAmount = 10f;
        public float radius = 0f; // 0 = single target, >0 = AOE around target cell
        public bool affectAlliesOnly = true;
        public bool affectSelf = true;
        public bool affectAnimals = false;
        public List<HediffDef> hediffsToRemove;
        public EffecterDef effecterDef;

        public CompProperties_LanternHeal()
        {
            compClass = typeof(CompAbilityEffect_LanternHeal);
        }
    }

    // Lore: restorative constructs (medical field, bandage construct, healing light).
    public class CompAbilityEffect_LanternHeal : CompAbilityEffect
    {
        public new CompProperties_LanternHeal Props => (CompProperties_LanternHeal)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);

            if (parent?.pawn == null) return;
            Map map = parent.pawn.Map;
            if (map == null) return;

            if (Props.effecterDef != null)
            {
                Props.effecterDef.Spawn(target.Cell, map, 1f);
            }

            if (Props.radius > 0.1f)
            {
                foreach (IntVec3 cell in GenRadial.RadialCellsAround(target.Cell, Props.radius, true))
                {
                    if (!cell.InBounds(map)) continue;
                    foreach (Thing t in cell.GetThingList(map))
                    {
                        if (t is Pawn p && ShouldAffect(p))
                        {
                            HealPawn(p, Props.healAmount);
                            RemoveHediffs(p);
                        }
                    }
                }
            }
            else
            {
                Pawn p = target.Pawn ?? (Props.affectSelf ? parent.pawn : null);
                if (p != null && ShouldAffect(p))
                {
                    HealPawn(p, Props.healAmount);
                    RemoveHediffs(p);
                }
            }
        }

        private bool ShouldAffect(Pawn p)
        {
            if (p == null || p.Dead) return false;
            if (!Props.affectAnimals && p.RaceProps.Animal) return false;
            if (!Props.affectSelf && p == parent.pawn) return false;
            if (Props.affectAlliesOnly && p.Faction != null && parent.pawn.Faction != null)
            {
                if (p.Faction != parent.pawn.Faction) return false;
            }
            return true;
        }

        private static void HealPawn(Pawn p, float amount)
        {
            if (amount <= 0f) return;
            float remaining = amount;

            IEnumerable<Hediff_Injury> injuries = p.health.hediffSet.hediffs
                .OfType<Hediff_Injury>()
                .Where(h => h.CanHealNaturally() && !h.IsPermanent())
                .OrderByDescending(h => h.Severity);

            foreach (Hediff_Injury injury in injuries)
            {
                if (remaining <= 0f) break;
                float healNow = Mathf.Min(remaining, injury.Severity);
                injury.Heal(healNow);
                remaining -= healNow;
            }
        }

        private void RemoveHediffs(Pawn p)
        {
            if (Props.hediffsToRemove == null || Props.hediffsToRemove.Count == 0) return;
            foreach (HediffDef def in Props.hediffsToRemove)
            {
                Hediff h = p.health.hediffSet.GetFirstHediffOfDef(def);
                if (h != null)
                {
                    p.health.RemoveHediff(h);
                }
            }
        }
    }
}

