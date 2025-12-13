using System.Collections.Generic;
using System.Linq;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public abstract class CompAbilityEffect_LanternPawnAoeBase : CompAbilityEffect
    {
        protected IEnumerable<Pawn> GetTargetPawns(LocalTargetInfo target, float radius, int maxTargets = 0)
        {
            Pawn caster = parent.pawn;
            if (caster?.Map == null) yield break;

            if (radius > 0.1f && target.Cell.IsValid)
            {
                Map map = caster.Map;
                var list = new List<Pawn>();
                foreach (IntVec3 cell in GenRadial.RadialCellsAround(target.Cell, radius, true))
                {
                    if (!cell.InBounds(map)) continue;
                    foreach (Thing t in cell.GetThingList(map).ToList())
                    {
                        if (t is Pawn p) list.Add(p);
                    }
                }
                if (maxTargets > 0)
                {
                    foreach (var p in list.OrderBy(p => p.Position.DistanceToSquared(target.Cell)).Take(maxTargets))
                        yield return p;
                    yield break;
                }
                foreach (var p in list) yield return p;
                yield break;
            }

            if (target.Pawn != null)
            {
                yield return target.Pawn;
            }
            else if (caster != null)
            {
                yield return caster;
            }
        }

        protected static bool ShouldAffectPawn(Pawn target, Pawn caster, bool affectSelf, bool affectAlliesOnly, bool affectHostilesOnly,
            bool affectDowned, bool affectNotDowned, bool affectAnimals, bool affectMechs, bool requireLineOfSight)
        {
            if (target == null || target.Dead) return false;
            if (!affectSelf && target == caster) return false;

            if (!affectDowned && target.Downed) return false;
            if (!affectNotDowned && !target.Downed) return false;

            if (!affectAnimals && target.RaceProps?.Animal == true) return false;
            if (!affectMechs && target.RaceProps?.IsMechanoid == true) return false;

            if (caster?.Faction != null && target.Faction != null)
            {
                bool hostile = target.HostileTo(caster.Faction);
                if (affectAlliesOnly && hostile) return false;
                if (affectHostilesOnly && !hostile) return false;
            }
            else
            {
                if (affectAlliesOnly || affectHostilesOnly) return false;
            }

            if (requireLineOfSight && caster?.Map != null && target.Map == caster.Map)
            {
                if (!GenSight.LineOfSight(caster.Position, target.Position, caster.Map)) return false;
            }

            return true;
        }
    }

    // ================== Apply/Adjust Hediff ==================
    public class CompAbilityEffect_LanternApplyHediff : CompAbilityEffect_LanternPawnAoeBase
    {
        public new CompProperties_LanternApplyHediff Props => (CompProperties_LanternApplyHediff)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);
            Pawn caster = parent.pawn;
            if (caster?.Map == null || Props.hediffDef == null) return;

            foreach (Pawn p in GetTargetPawns(target, Props.radius, Props.maxTargets))
            {
                if (!ShouldAffectPawn(p, caster, Props.affectSelf, Props.affectAlliesOnly, Props.affectHostilesOnly,
                        Props.affectDowned, Props.affectNotDowned, Props.affectAnimals, Props.affectMechs, Props.requireLineOfSight))
                {
                    continue;
                }
                if (p.health?.hediffSet == null) continue;

                Hediff existing = p.health.hediffSet.GetFirstHediffOfDef(Props.hediffDef);
                if (existing == null)
                {
                    if (!Props.addIfMissing) continue;
                    Hediff created = HediffMaker.MakeHediff(Props.hediffDef, p);
                    if (Props.severity > 0f) created.Severity = Props.severity;
                    p.health.AddHediff(created);
                    continue;
                }

                if (Props.severity <= 0f) continue;
                if (Props.addSeverityIfPresent)
                {
                    existing.Severity += Props.severity;
                }
                else
                {
                    existing.Severity = Props.severity;
                }
            }
        }
    }

    public class CompProperties_LanternApplyHediff : CompProperties_AbilityEffect
    {
        public HediffDef hediffDef;
        public float severity = 0.1f;
        public bool addIfMissing = true;
        public bool addSeverityIfPresent = true;

        public float radius = 0f;
        public int maxTargets = 0; // 0 = unlimited
        public bool affectAlliesOnly = false;
        public bool affectHostilesOnly = false;
        public bool affectSelf = true;
        public bool affectDowned = true;
        public bool affectNotDowned = true;
        public bool affectAnimals = true;
        public bool affectMechs = true;
        public bool requireLineOfSight = false;

        public CompProperties_LanternApplyHediff()
        {
            compClass = typeof(CompAbilityEffect_LanternApplyHediff);
        }
    }

    // ================== Remove Hediff ==================
    public class CompAbilityEffect_LanternRemoveHediff : CompAbilityEffect_LanternPawnAoeBase
    {
        public new CompProperties_LanternRemoveHediff Props => (CompProperties_LanternRemoveHediff)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);
            Pawn caster = parent.pawn;
            if (caster?.Map == null || Props.hediffDef == null) return;

            foreach (Pawn p in GetTargetPawns(target, Props.radius, Props.maxTargets))
            {
                if (!ShouldAffectPawn(p, caster, Props.affectSelf, Props.affectAlliesOnly, Props.affectHostilesOnly,
                        Props.affectDowned, Props.affectNotDowned, Props.affectAnimals, Props.affectMechs, Props.requireLineOfSight))
                {
                    continue;
                }
                if (p.health?.hediffSet == null) continue;

                Hediff existing = p.health.hediffSet.GetFirstHediffOfDef(Props.hediffDef);
                if (existing != null)
                {
                    p.health.RemoveHediff(existing);
                }
            }
        }
    }

    public class CompProperties_LanternRemoveHediff : CompProperties_AbilityEffect
    {
        public HediffDef hediffDef;

        public float radius = 0f;
        public int maxTargets = 0; // 0 = unlimited
        public bool affectAlliesOnly = false;
        public bool affectHostilesOnly = false;
        public bool affectSelf = true;
        public bool affectDowned = true;
        public bool affectNotDowned = true;
        public bool affectAnimals = true;
        public bool affectMechs = true;
        public bool requireLineOfSight = false;

        public CompProperties_LanternRemoveHediff()
        {
            compClass = typeof(CompAbilityEffect_LanternRemoveHediff);
        }
    }
}
