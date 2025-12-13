using System.Collections.Generic;
using System.Linq;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class CompAbilityEffect_LanternDisplace : CompAbilityEffect_LanternPawnAoeBase
    {
        public new CompProperties_LanternDisplace Props => (CompProperties_LanternDisplace)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);
            Pawn caster = parent.pawn;
            if (caster?.Map == null) return;

            List<Pawn> targets = GetTargetPawns(target, Props.radius).Distinct().ToList();
            if (Props.maxTargets > 0)
            {
                targets = targets.OrderBy(p => p.Position.DistanceToSquared(target.Cell.IsValid ? target.Cell : caster.Position))
                    .Take(Props.maxTargets).ToList();
            }
            if (targets.Count == 0) return;

            foreach (Pawn p in targets)
            {
                if (!ShouldAffectPawn(p, caster, Props.affectSelf, Props.affectAlliesOnly, Props.affectHostilesOnly,
                        Props.affectDowned, Props.affectNotDowned, Props.affectAnimals, Props.affectMechs, Props.requireLineOfSight))
                {
                    continue;
                }
                if (!p.Spawned || p.Map != caster.Map) continue;
                if (p.Dead) continue;

                IntVec3 destCell = FindDisplaceCell(caster.Map, p.Position, caster.Position, Props.pullTowardsCaster, Props.distance);
                if (destCell == p.Position) continue;

                LanternVfx.PlayImpact(new LocalTargetInfo(p), p.Position, p.Map, Props.impactFleckDef, Props.impactFleckScale,
                    Props.moteDefOnTarget, Props.moteScaleOnTarget, Props.attachMoteToTarget);

                p.pather?.StopDead();
                p.DeSpawn(DestroyMode.Vanish);
                GenSpawn.Spawn(p, destCell, caster.Map);
            }
        }

        private static IntVec3 FindDisplaceCell(Map map, IntVec3 pawnPos, IntVec3 casterPos, bool pullTowardsCaster, int distance)
        {
            int dist = Mathf.Clamp(distance, 0, 50);
            if (dist <= 0) return pawnPos;

            int dx = pullTowardsCaster ? (casterPos.x - pawnPos.x) : (pawnPos.x - casterPos.x);
            int dz = pullTowardsCaster ? (casterPos.z - pawnPos.z) : (pawnPos.z - casterPos.z);

            IntVec3 step = new IntVec3(Mathf.Clamp(dx, -1, 1), 0, Mathf.Clamp(dz, -1, 1));
            if (step == IntVec3.Zero) return pawnPos;

            IntVec3 current = pawnPos;
            for (int i = 0; i < dist; i++)
            {
                IntVec3 candidate = current + step;
                if (!candidate.InBounds(map)) break;
                if (!candidate.Standable(map)) break;
                if (candidate.GetThingList(map).Any(t => t is Pawn)) break;
                current = candidate;
            }
            return current;
        }
    }

    public class CompProperties_LanternDisplace : CompProperties_AbilityEffect
    {
        public bool pullTowardsCaster = false; // false = push away from caster
        public int distance = 3;
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

        public FleckDef impactFleckDef;
        public float impactFleckScale = 1f;
        public ThingDef moteDefOnTarget;
        public float moteScaleOnTarget = 1f;
        public bool attachMoteToTarget = true;

        public CompProperties_LanternDisplace()
        {
            compClass = typeof(CompAbilityEffect_LanternDisplace);
        }
    }
}
