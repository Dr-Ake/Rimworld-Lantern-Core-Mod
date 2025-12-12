using System.Linq;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class CompProperties_LanternConstructSpawn : CompProperties_AbilityEffect
    {
        public ThingDef thingDef;
        public int spawnCount = 1;
        public float spreadRadius = 0f;
        public int durationTicks = 0; // 0 = permanent
        public bool setFaction = true;
        public bool replaceExisting = false;
        public EffecterDef effecterDef;

        public CompProperties_LanternConstructSpawn()
        {
            compClass = typeof(CompAbilityEffect_LanternConstructSpawn);
        }
    }

    // Lore: hard-light constructs (walls, cages, platforms, turrets, etc.).
    public class CompAbilityEffect_LanternConstructSpawn : CompAbilityEffect
    {
        public new CompProperties_LanternConstructSpawn Props => (CompProperties_LanternConstructSpawn)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);
            Pawn caster = parent?.pawn;
            if (caster == null || Props.thingDef == null) return;
            Map map = caster.Map;
            if (map == null) return;

            IntVec3 baseCell = target.Cell.IsValid ? target.Cell : caster.Position;

            if (Props.effecterDef != null)
            {
                Props.effecterDef.Spawn(baseCell, map, 1f);
            }

            for (int i = 0; i < Mathf.Max(1, Props.spawnCount); i++)
            {
                IntVec3 cell = baseCell;
                if (i > 0 && Props.spreadRadius > 0.1f)
                {
                    CellFinder.TryFindRandomCellNear(baseCell, map, Mathf.CeilToInt(Props.spreadRadius), c => c.Standable(map), out cell);
                }

                if (!cell.InBounds(map)) continue;

                if (Props.replaceExisting)
                {
                    Thing existing = cell.GetFirstThing(map, Props.thingDef);
                    existing?.Destroy(DestroyMode.Vanish);
                }

                ThingDef stuff = null;
                if (Props.thingDef.MadeFromStuff)
                {
                    stuff = GenStuff.DefaultStuffFor(Props.thingDef);
                    if (stuff == null)
                    {
                        stuff = GenStuff.AllowedStuffsFor(Props.thingDef).FirstOrDefault();
                    }
                }

                Thing makeThing = ThingMaker.MakeThing(Props.thingDef, stuff);
                Thing spawned = GenSpawn.Spawn(makeThing, cell, map);
                if (spawned == null) continue;

                if (Props.setFaction && caster.Faction != null && spawned.def.CanHaveFaction)
                {
                    spawned.SetFaction(caster.Faction);
                }

                if (Props.durationTicks > 0)
                {
                    LanternConstructs.RegisterTemporary(spawned, Props.durationTicks);
                }
            }
        }
    }
}
