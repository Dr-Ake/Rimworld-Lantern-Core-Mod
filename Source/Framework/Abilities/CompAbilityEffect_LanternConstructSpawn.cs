using System;
using System.Collections.Generic;
using System.Linq;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public enum ConstructSpawnPattern
    {
        Single,
        Scatter,
        Line,
        Wall,
        Ring
    }

    public class CompProperties_LanternConstructSpawn : CompProperties_AbilityEffect
    {
        public ThingDef thingDef;
        public int spawnCount = 1;
        public float spreadRadius = 0f;
        public int durationTicks = 0; // 0 = permanent
        public bool setFaction = true;
        public bool replaceExisting = false;

        // Optional stuff for stuff-made constructs.
        public ThingDef stuffDef;

        // Patterned spawning (optional). Defaults preserve legacy scatter behavior.
        public ConstructSpawnPattern spawnPattern = ConstructSpawnPattern.Scatter;
        public bool requireStandableCell = false;

        // Optional VFX/SFX.
        public FleckDef castFleckDef;
        public float castFleckScale = 1f;
        public FleckDef impactFleckDef;
        public float impactFleckScale = 1f;
        public ThingDef moteDefOnTarget;
        public float moteScaleOnTarget = 1f;
        public bool attachMoteToTarget = true;
        public SoundDef soundCastOverride;

        // Line/Wall pattern options.
        public int lineLength = 0; // 0 = use spawnCount

        // Ring pattern options.
        public float ringRadius = 0f; // >0 enables ring placement around target
        public float ringThickness = 1f;

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

            LanternVfx.PlayCast(caster, baseCell, map, Props.castFleckDef, Props.castFleckScale, Props.soundCastOverride);

            foreach (IntVec3 cell in ResolveSpawnCells(caster, baseCell, map))
            {
                if (!cell.InBounds(map)) continue;
                if (Props.requireStandableCell && !cell.Standable(map)) continue;

                LanternVfx.PlayImpact(new LocalTargetInfo(cell), cell, map, Props.impactFleckDef, Props.impactFleckScale,
                    Props.moteDefOnTarget, Props.moteScaleOnTarget, Props.attachMoteToTarget);

                if (Props.replaceExisting)
                {
                    Thing existing = cell.GetFirstThing(map, Props.thingDef);
                    existing?.Destroy(DestroyMode.Vanish);
                }

                ThingDef stuff = null;
                if (Props.thingDef.MadeFromStuff)
                {
                    stuff = Props.stuffDef ?? GenStuff.DefaultStuffFor(Props.thingDef) ?? GenStuff.AllowedStuffsFor(Props.thingDef).FirstOrDefault();
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

        private IEnumerable<IntVec3> ResolveSpawnCells(Pawn caster, IntVec3 baseCell, Map map)
        {
            int count = Mathf.Max(1, Props.spawnCount);

            switch (Props.spawnPattern)
            {
                case ConstructSpawnPattern.Single:
                    for (int i = 0; i < count; i++) yield return baseCell;
                    yield break;

                case ConstructSpawnPattern.Line:
                case ConstructSpawnPattern.Wall:
                    foreach (var cell in ResolveLineCells(caster, baseCell)) yield return cell;
                    yield break;

                case ConstructSpawnPattern.Ring:
                    foreach (var cell in ResolveRingCells(baseCell, map)) yield return cell;
                    yield break;

                case ConstructSpawnPattern.Scatter:
                default:
                    yield return baseCell;
                    if (count <= 1) yield break;

                    for (int i = 1; i < count; i++)
                    {
                        IntVec3 cell = baseCell;
                        if (Props.spreadRadius > 0.1f)
                        {
                            CellFinder.TryFindRandomCellNear(baseCell, map, Mathf.CeilToInt(Props.spreadRadius), c => c.InBounds(map), out cell);
                        }
                        yield return cell;
                    }
                    yield break;
            }
        }

        private IEnumerable<IntVec3> ResolveLineCells(Pawn caster, IntVec3 baseCell)
        {
            int length = Props.lineLength > 0 ? Props.lineLength : Mathf.Max(1, Props.spawnCount);
            IntVec3 delta = baseCell - caster.Position;
            IntVec3 dir = new IntVec3(Math.Sign(delta.x), 0, Math.Sign(delta.z));
            if (dir == IntVec3.Zero) dir = IntVec3.East;

            IntVec3 cur = baseCell;
            for (int i = 0; i < length; i++)
            {
                yield return cur;
                cur += dir;
            }
        }

        private IEnumerable<IntVec3> ResolveRingCells(IntVec3 center, Map map)
        {
            float radius = Props.ringRadius > 0.1f ? Props.ringRadius : Props.spreadRadius;
            if (radius <= 0.1f)
            {
                yield return center;
                yield break;
            }

            float thickness = Mathf.Max(0.5f, Props.ringThickness);
            float inner = Mathf.Max(0f, radius - thickness * 0.5f);
            float outer = radius + thickness * 0.5f;

            List<IntVec3> ringCells = new List<IntVec3>();
            foreach (IntVec3 cell in GenRadial.RadialCellsAround(center, outer, true))
            {
                if (!cell.InBounds(map)) continue;
                float dist = cell.DistanceTo(center);
                if (dist >= inner && dist <= outer)
                {
                    ringCells.Add(cell);
                }
            }

            if (ringCells.Count == 0)
            {
                yield return center;
                yield break;
            }

            int cap = Props.spawnCount;
            if (cap > 0 && cap < ringCells.Count)
            {
                foreach (var cell in ringCells.InRandomOrder().Take(cap)) yield return cell;
            }
            else
            {
                foreach (var cell in ringCells) yield return cell;
            }
        }
    }
}
