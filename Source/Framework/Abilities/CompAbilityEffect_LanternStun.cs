using System.Collections.Generic;
using RimWorld;
using Verse;
using UnityEngine;

namespace DrAke.LanternsFramework.Abilities
{
    public class CompProperties_LanternStun : CompProperties_AbilityEffect
    {
        public int stunTicks = 180; // 3 seconds
        public float radius = 0f; // 0 = single, >0 = AOE
        public bool affectHostilesOnly = true;
        public bool affectAnimals = true;
        public EffecterDef effecterDef;

        // Optional VFX/SFX.
        public FleckDef castFleckDef;
        public float castFleckScale = 1f;
        public FleckDef impactFleckDef;
        public float impactFleckScale = 1f;
        public ThingDef moteDefOnTarget;
        public float moteScaleOnTarget = 1f;
        public bool attachMoteToTarget = true;
        public SoundDef soundCastOverride;

        public CompProperties_LanternStun()
        {
            compClass = typeof(CompAbilityEffect_LanternStun);
        }
    }

    // Lore: hard-light binds, nets, bubbles, or paralyzing constructs.
    public class CompAbilityEffect_LanternStun : CompAbilityEffect
    {
        public new CompProperties_LanternStun Props => (CompProperties_LanternStun)props;

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

            LanternVfx.PlayCast(parent.pawn, target.Cell, map, Props.castFleckDef, Props.castFleckScale, Props.soundCastOverride);

            if (Props.radius > 0.1f)
            {
                foreach (IntVec3 cell in GenRadial.RadialCellsAround(target.Cell, Props.radius, true))
                {
                    if (!cell.InBounds(map)) continue;
                    foreach (Thing t in cell.GetThingList(map))
                    {
                        if (t is Pawn p && ShouldAffect(p))
                        {
                            LanternVfx.PlayImpact(new LocalTargetInfo(p), p.Position, map, Props.impactFleckDef, Props.impactFleckScale,
                                Props.moteDefOnTarget, Props.moteScaleOnTarget, Props.attachMoteToTarget);
                            p.stances?.stunner?.StunFor(Props.stunTicks, parent.pawn);
                        }
                    }
                }
            }
            else
            {
                Pawn p = target.Pawn;
                if (p != null && ShouldAffect(p))
                {
                    LanternVfx.PlayImpact(new LocalTargetInfo(p), p.Position, map, Props.impactFleckDef, Props.impactFleckScale,
                        Props.moteDefOnTarget, Props.moteScaleOnTarget, Props.attachMoteToTarget);
                    p.stances?.stunner?.StunFor(Props.stunTicks, parent.pawn);
                }
            }
        }

        private bool ShouldAffect(Pawn p)
        {
            if (p == null || p.Dead) return false;
            if (!Props.affectAnimals && p.RaceProps.Animal) return false;
            if (!Props.affectHostilesOnly) return true;

            if (p.Faction == null || parent.pawn.Faction == null) return true;
            return p.HostileTo(parent.pawn);
        }
    }
}
