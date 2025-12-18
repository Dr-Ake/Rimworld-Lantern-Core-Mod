using System.Linq;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class CompAbilityEffect_LanternTeleport : CompAbilityEffect
    {
        public new CompProperties_LanternTeleport Props => (CompProperties_LanternTeleport)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);
            Pawn caster = parent.pawn;
            if (caster?.Map == null) return;

            IntVec3 cell = target.Cell;
            Map map = caster.Map;

            if (!cell.IsValid || !cell.InBounds(map)) return;
            if (!Props.allowRoofed && cell.Roofed(map)) return;
            if (Props.requireStandable && !cell.Standable(map)) return;

            if (!Props.allowOccupied)
            {
                if (cell.GetThingList(map).Any(t => t is Pawn)) return;
            }

            if (!caster.Spawned) return;

            LanternVfx.PlayCast(caster, cell, map, Props.castFleckDef, Props.castFleckScale, Props.soundCastOverride);

            IntVec3 origin = caster.Position;
            if (Props.spawnGasAtOrigin)
            {
                SpawnGas(origin, map);
            }

            caster.pather?.StopDead();
            caster.DeSpawn(DestroyMode.Vanish);
            GenSpawn.Spawn(caster, cell, map);

            LanternVfx.PlayImpact(new LocalTargetInfo(caster), origin, map, Props.impactFleckDef, Props.impactFleckScale,
                Props.moteDefOnCaster, Props.moteScaleOnCaster, Props.attachMoteToCaster);

            if (Props.spawnGasAtDestination)
            {
                SpawnGas(caster.Position, map);
            }
        }

        private void SpawnGas(IntVec3 center, Map map)
        {
            if (map == null) return;
            float radius = Mathf.Max(0f, Props.gasRadius);
            if (radius <= 0f) return;

            int amount = Mathf.Clamp(Props.gasAmount, 0, 1000);
            if (amount <= 0) return;

            GenExplosion.DoExplosion(
                center,
                map,
                radius,
                DamageDefOf.Smoke,
                parent.pawn,
                postExplosionGasType: Props.gasType,
                postExplosionGasAmount: amount);

            int durationTicks = Mathf.Max(0, Props.gasDurationTicks);
            if (durationTicks > 0)
            {
                LanternConstructs.RegisterGas(map, center, radius, Props.gasType, durationTicks);
            }
        }
    }

    public class CompProperties_LanternTeleport : CompProperties_AbilityEffect
    {
        public bool requireStandable = true;
        public bool allowRoofed = true;
        public bool allowOccupied = false;

        // Optional smoke/gas on teleport (origin and/or destination).
        public bool spawnGasAtOrigin = false;
        public bool spawnGasAtDestination = false;
        public GasType gasType = GasType.BlindSmoke;
        public float gasRadius = 2.4f;
        public int gasAmount = 60;
        // If >0, forcibly clears the gas after this many ticks (otherwise uses vanilla dissipation).
        public int gasDurationTicks = 0;

        public FleckDef castFleckDef;
        public float castFleckScale = 1f;
        public FleckDef impactFleckDef;
        public float impactFleckScale = 1f;
        public ThingDef moteDefOnCaster;
        public float moteScaleOnCaster = 1f;
        public bool attachMoteToCaster = true;
        public SoundDef soundCastOverride;

        public CompProperties_LanternTeleport()
        {
            compClass = typeof(CompAbilityEffect_LanternTeleport);
        }
    }
}
