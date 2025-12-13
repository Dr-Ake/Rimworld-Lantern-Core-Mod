using System;
using System.Linq;
using RimWorld;
using Verse;

namespace DrAke.LanternsFramework
{
    [StaticConstructorOnStartup]
    public static class LanternFrameworkValidator
    {
        static LanternFrameworkValidator()
        {
            try
            {
                ValidateRings();
                ValidateSelectionDefs();
            }
            catch (Exception e)
            {
                Log.Error($"[LanternsCore] Validator failed: {e}");
            }
        }

        private static void ValidateRings()
        {
            foreach (ThingDef def in DefDatabase<ThingDef>.AllDefsListForReading)
            {
                if (def?.comps == null) continue;
                bool hasRingComp = def.comps.Any(c => c?.compClass == typeof(CompLanternRing));
                if (!hasRingComp) continue;

                var ext = def.GetModExtension<LanternDefExtension>();
                if (ext == null)
                {
                    Log.WarningOnce($"[LanternsCore] Ring ThingDef '{def.defName}' is missing LanternDefExtension (required).", def.defName.GetHashCode());
                    continue;
                }

                if (ext.maxCharge <= 0f)
                {
                    Log.WarningOnce($"[LanternsCore] Ring '{def.defName}' has maxCharge <= 0; defaulting to 1.0 at runtime.", (def.defName + "_maxCharge").GetHashCode());
                }

                if (ext.abilities != null && ext.abilities.Any(a => a == null))
                {
                    Log.WarningOnce($"[LanternsCore] Ring '{def.defName}' has one or more missing ability refs in LanternDefExtension.abilities.", (def.defName + "_abilitiesNull").GetHashCode());
                }

                ValidateFraction(def.defName, "batteryManifestCost", ext.batteryManifestCost);
                ValidateFraction(def.defName, "passiveRegenPerDay", ext.passiveRegenPerDay, allowAboveOne: true);
                ValidateFraction(def.defName, "passiveDrainPerDay", ext.passiveDrainPerDay, allowAboveOne: true);
                ValidateFraction(def.defName, "blockEnvironmentalHediffsCost", ext.blockEnvironmentalHediffsCost, allowAboveOne: true);
                ValidateFraction(def.defName, "absorbEnvironmentalDamageCost", ext.absorbEnvironmentalDamageCost, allowAboveOne: true);
                ValidateFraction(def.defName, "absorbCombatDamageCost", ext.absorbCombatDamageCost, allowAboveOne: true);
            }
        }

        private static void ValidateSelectionDefs()
        {
            foreach (RingSelectionDef def in DefDatabase<RingSelectionDef>.AllDefsListForReading)
            {
                if (def == null) continue;

                if (def.ringDef == null)
                {
                    Log.WarningOnce($"[LanternsCore] RingSelectionDef '{def.defName}' has no ringDef set.", (def.defName + "_ringDefNull").GetHashCode());
                }

                if (def.workerClass == null || !typeof(RingSelectionWorker).IsAssignableFrom(def.workerClass))
                {
                    Log.WarningOnce($"[LanternsCore] RingSelectionDef '{def.defName}' has workerClass '{def.workerClass?.FullName ?? "null"}' that does not extend RingSelectionWorker.", (def.defName + "_worker").GetHashCode());
                }

                if (def.triggerPeriodic && def.periodicInterval <= 0)
                {
                    Log.WarningOnce($"[LanternsCore] RingSelectionDef '{def.defName}' has triggerPeriodic=true but periodicInterval <= 0.", (def.defName + "_periodicInterval").GetHashCode());
                }

                if (def.minScoreToSelect <= 0f)
                {
                    Log.WarningOnce($"[LanternsCore] RingSelectionDef '{def.defName}' has minScoreToSelect <= 0; it may select nearly anyone.", (def.defName + "_minScore").GetHashCode());
                }

                if (def.conditions != null && def.conditions.Any(c => c == null))
                {
                    Log.WarningOnce($"[LanternsCore] RingSelectionDef '{def.defName}' has a null entry in conditions (XML class name typo?).", (def.defName + "_conditionsNull").GetHashCode());
                }
            }
        }

        private static void ValidateFraction(string defName, string field, float value, bool allowAboveOne = false)
        {
            if (float.IsNaN(value) || float.IsInfinity(value))
            {
                Log.WarningOnce($"[LanternsCore] '{defName}' has invalid '{field}' value (NaN/Inf).", (defName + "_" + field + "_nan").GetHashCode());
                return;
            }
            if (value < 0f)
            {
                Log.WarningOnce($"[LanternsCore] '{defName}' has '{field}' < 0; expected >= 0.", (defName + "_" + field + "_neg").GetHashCode());
            }
            if (!allowAboveOne && value > 1f)
            {
                Log.WarningOnce($"[LanternsCore] '{defName}' has '{field}' > 1; expected 0..1 (fraction).", (defName + "_" + field + "_gt1").GetHashCode());
            }
        }
    }
}
