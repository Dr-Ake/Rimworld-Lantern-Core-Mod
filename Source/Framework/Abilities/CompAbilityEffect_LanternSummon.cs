using System;
using System.Linq;
using System.Reflection;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class CompProperties_LanternSummon : CompProperties_AbilityEffect
    {
        public PawnKindDef pawnKind;
        public int count = 1;
        public float spawnRadius = 2f;
        public int durationTicks = 6000; // default ~1 day
        public bool setFactionToCaster = true;
        public FactionDef factionDefOverride;
        public EffecterDef effecterDef;

        public CompProperties_LanternSummon()
        {
            compClass = typeof(CompAbilityEffect_LanternSummon);
        }
    }

    // Lore: autonomous projections / summoned constructs (e.g., Orange stolen identities).
    public class CompAbilityEffect_LanternSummon : CompAbilityEffect
    {
        public new CompProperties_LanternSummon Props => (CompProperties_LanternSummon)props;

        private static MethodInfo cachedGeneratePawnMethod;
        private static ParameterInfo[] cachedGeneratePawnParams;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);

            Pawn caster = parent?.pawn;
            if (caster == null || Props.pawnKind == null) return;
            Map map = caster.Map;
            if (map == null) return;

            IntVec3 baseCell = target.Cell.IsValid ? target.Cell : caster.Position;

            Faction faction = null;
            if (Props.factionDefOverride != null)
            {
                faction = Find.FactionManager.FirstFactionOfDef(Props.factionDefOverride);
            }
            if (faction == null && Props.setFactionToCaster)
            {
                faction = caster.Faction;
            }

            if (Props.effecterDef != null)
            {
                Props.effecterDef.Spawn(baseCell, map, 1f);
            }

            for (int i = 0; i < Mathf.Max(1, Props.count); i++)
            {
                IntVec3 cell = baseCell;
                if (Props.spawnRadius > 0.1f)
                {
                    CellFinder.TryFindRandomCellNear(baseCell, map, Mathf.CeilToInt(Props.spawnRadius), c => c.Standable(map), out cell);
                }

                Pawn pawn = GeneratePawnStable(Props.pawnKind, faction);
                if (pawn == null) continue;
                GenSpawn.Spawn(pawn, cell, map);

                if (Props.durationTicks > 0)
                {
                    LanternConstructs.RegisterTemporary(pawn, Props.durationTicks);
                }
            }
        }

        private static Pawn GeneratePawnStable(PawnKindDef kind, Faction faction)
        {
            try
            {
                EnsureCachedGeneratePawn();
                if (cachedGeneratePawnMethod == null) return null;

                object[] args = new object[cachedGeneratePawnParams.Length];
                args[0] = kind;
                args[1] = faction;
                for (int i = 2; i < cachedGeneratePawnParams.Length; i++)
                {
                    ParameterInfo p = cachedGeneratePawnParams[i];
                    if (p.HasDefaultValue)
                    {
                        args[i] = p.DefaultValue;
                    }
                    else
                    {
                        args[i] = GetDefault(p.ParameterType);
                    }
                }

                return (Pawn)cachedGeneratePawnMethod.Invoke(null, args);
            }
            catch (Exception e)
            {
                Log.ErrorOnce($"[LanternsCore] Failed to generate summon pawn: {e}", 93451277);
                return null;
            }
        }

        private static void EnsureCachedGeneratePawn()
        {
            if (cachedGeneratePawnMethod != null) return;

            var methods = typeof(PawnGenerator).GetMethods(BindingFlags.Public | BindingFlags.Static)
                .Where(m => m.Name == "GeneratePawn")
                .Select(m => new { Method = m, Params = m.GetParameters() })
                .Where(x => x.Params.Length >= 2
                            && x.Params[0].ParameterType == typeof(PawnKindDef)
                            && x.Params[1].ParameterType == typeof(Faction))
                .OrderBy(x => x.Params.Length)
                .ToList();

            var best = methods.FirstOrDefault();
            cachedGeneratePawnMethod = best?.Method;
            cachedGeneratePawnParams = best?.Params;

            if (cachedGeneratePawnMethod == null)
            {
                Log.ErrorOnce("[LanternsCore] Could not find a compatible PawnGenerator.GeneratePawn overload.", 93451278);
            }
        }

        private static object GetDefault(Type t)
        {
            return t.IsValueType ? Activator.CreateInstance(t) : null;
        }
    }
}
