using System.Collections.Generic;
using RimWorld;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class CompProperties_LanternStun : CompProperties_AbilityEffect
    {
        public int stunTicks = 180; // 3 seconds
        public float radius = 0f; // 0 = single, >0 = AOE
        public bool affectHostilesOnly = true;
        public bool affectAnimals = true;
        public EffecterDef effecterDef;

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

            if (Props.radius > 0.1f)
            {
                foreach (IntVec3 cell in GenRadial.RadialCellsAround(target.Cell, Props.radius, true))
                {
                    if (!cell.InBounds(map)) continue;
                    foreach (Thing t in cell.GetThingList(map))
                    {
                        if (t is Pawn p && ShouldAffect(p))
                        {
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

