using HarmonyLib;
using RimWorld;
using UnityEngine;
using Verse;
using Verse.AI;
using System;
using System.Collections.Generic;
using System.Linq;
using DrAke.LanternsFramework.Abilities;

namespace DrAke.LanternsFramework.HarmonyPatches
{
    [StaticConstructorOnStartup]
    public static class FrameworkPatches
    {
        static FrameworkPatches()
        {
            var harmony = new Harmony("DrAke.LanternsCore");
            harmony.PatchAll();
        }
    }

    [HarmonyPatch(typeof(Pawn_HealthTracker), "AddHediff", new Type[] { typeof(Hediff), typeof(BodyPartRecord), typeof(DamageInfo?), typeof(DamageWorker.DamageResult) })]
    public static class Patch_PreventSpaceDamage
    {
        private static readonly HashSet<string> DefaultBlockedHediffKeywords = new HashSet<string>
        {
            "vacuum", "hypoxia", "decompression", "suffocation", 
            "oxygen", "breath", "hypothermia", "heatstroke", "toxic"
        };

        private static bool Prefix(Pawn_HealthTracker __instance, Hediff hediff, Pawn ___pawn)
        {
            if (hediff == null || ___pawn == null) return true;

            CompLanternRing ring = LanternResources.GetRing(___pawn);
            if (ring == null) return true;

            if (!ring.IsActive || ring.charge <= 0f) return true;

            var ext = ring.Extension;
            if (ext == null || !ext.blockEnvironmentalHediffs) return true;
            if (LanternCoreMod.Settings?.disableEnvironmentalProtectionGlobally == true) return true;

            if (hediff.def != null)
            {
                if (!ShouldBlockHediff(hediff.def, ext)) return true;

                float cost = Mathf.Max(0f, ext.blockEnvironmentalHediffsCost);
                if (cost > 0f && !ring.TryConsumeCharge(cost)) return true;

                return false;
            }
            return true; 
        }

        private static bool ShouldBlockHediff(HediffDef def, LanternDefExtension ext)
        {
            if (def == null) return false;

            if (ext.blockedHediffs != null && ext.blockedHediffs.Count > 0)
            {
                return ext.blockedHediffs.Contains(def);
            }

            string defName = def.defName?.ToLowerInvariant() ?? string.Empty;

            if (ext.blockedHediffDefNameKeywords != null && ext.blockedHediffDefNameKeywords.Count > 0)
            {
                for (int i = 0; i < ext.blockedHediffDefNameKeywords.Count; i++)
                {
                    string kw = ext.blockedHediffDefNameKeywords[i];
                    if (kw.NullOrEmpty()) continue;
                    if (defName.Contains(kw.ToLowerInvariant())) return true;
                }
                return false;
            }

            if (def == HediffDefOf.Hypothermia || def == HediffDefOf.Heatstroke || def == HediffDefOf.ToxicBuildup)
            {
                return true;
            }

            foreach (var keyword in DefaultBlockedHediffKeywords)
            {
                if (defName.Contains(keyword)) return true;
            }
            return false;
        }

        private static void Postfix(Hediff hediff, Pawn ___pawn)
        {
            if (hediff == null || ___pawn == null) return;
            if (___pawn.health?.hediffSet == null) return;
            if (!___pawn.health.hediffSet.hediffs.Contains(hediff)) return; // not actually applied

            Current.Game?.GetComponent<RingSelectionManager>()?.Notify_HediffAdded(___pawn, hediff);
        }
    }

    [HarmonyPatch(typeof(Pawn_HealthTracker), "PreApplyDamage")]
    public static class Patch_PreventSpacePhysicalDamage
    {
        private static readonly HashSet<string> DefaultBlockedDamageKeywords = new HashSet<string>
        {
            "vacuum", "decompression", "hypoxia", "suffocation"
        };

        private static bool Prefix(Pawn_HealthTracker __instance, DamageInfo dinfo, out bool absorbed, Pawn ___pawn)
        {
            absorbed = false;
            Pawn pawn = ___pawn;
            if (pawn == null) return true;

            CompLanternRing ring = LanternResources.GetRing(pawn);
            if (ring == null) return true;
            if (!ring.IsActive || ring.charge <= 0f) return true;

            var ext = ring.Extension;
            if (ext == null) return true;
            if (LanternCoreMod.Settings?.disableEnvironmentalProtectionGlobally == true)
            {
                // Also implies no combat absorption override; handled below.
            }

            bool isSpaceDamage = false;

            if (dinfo.Def != null)
            {
                if (IsEnvironmentalDamage(dinfo.Def, ext))
                {
                    isSpaceDamage = true;
                }

                if (isSpaceDamage && ext.absorbEnvironmentalDamage && LanternCoreMod.Settings?.disableEnvironmentalProtectionGlobally != true)
                {
                    float cost = Mathf.Max(0f, ext.absorbEnvironmentalDamageCost);
                    if (cost <= 0f || ring.TryConsumeCharge(cost))
                    {
                        absorbed = true;
                        return false;
                    }
                }
                
                // Non-environmental damage: optional combat absorption (opt-in).
                if (!isSpaceDamage && ext.absorbCombatDamage && LanternCoreMod.Settings?.disableCombatAbsorbGlobally != true)
                {
                    if (ext.combatDamageDefs != null && ext.combatDamageDefs.Count > 0 && !ext.combatDamageDefs.Contains(dinfo.Def))
                    {
                        return true;
                    }

                    float cost = Mathf.Max(0f, ext.absorbCombatDamageCost);
                    if (cost <= 0f || ring.TryConsumeCharge(cost))
                    {
                        absorbed = true;
                        return false;
                    }
                }
            }

            return true;
        }

        private static bool IsEnvironmentalDamage(DamageDef def, LanternDefExtension ext)
        {
            if (def == null) return false;

            if (ext.environmentalDamageDefs != null && ext.environmentalDamageDefs.Count > 0)
            {
                return ext.environmentalDamageDefs.Contains(def);
            }

            string defName = def.defName ?? string.Empty;
            if (ext.environmentalDamageDefNameKeywords != null && ext.environmentalDamageDefNameKeywords.Count > 0)
            {
                string lower = defName.ToLowerInvariant();
                for (int i = 0; i < ext.environmentalDamageDefNameKeywords.Count; i++)
                {
                    string kw = ext.environmentalDamageDefNameKeywords[i];
                    if (kw.NullOrEmpty()) continue;
                    if (lower.Contains(kw.ToLowerInvariant())) return true;
                }
                return false;
            }

            if (defName == "VacuumBurn") return true;

            string lowerName = defName.ToLowerInvariant();
            foreach (var keyword in DefaultBlockedDamageKeywords)
            {
                if (lowerName.Contains(keyword)) return true;
            }
            return false;
        }
    }

    [HarmonyPatch(typeof(MentalState), "PostStart")]
    public static class Patch_MentalState_PostStart
    {
        static void Postfix(MentalState __instance, string reason)
        {
            if (__instance.pawn == null) return;
            // Notify Manager
            Current.Game.GetComponent<RingSelectionManager>()?.Notify_MentalStateStarted(__instance.pawn, __instance.def);
        }
    }

    // Trigger ring selection when a pawn joins the player's faction.
    [HarmonyPatch(typeof(Pawn), "SetFaction", new Type[] { typeof(Faction), typeof(Pawn) })]
    public static class Patch_Pawn_SetFaction
    {
        static void Prefix(Pawn __instance, out Faction __state)
        {
            __state = __instance?.Faction;
        }

        static void Postfix(Pawn __instance, Faction newFaction, Pawn recruiter, Faction __state)
        {
            if (__instance == null || Current.Game == null) return;
            Current.Game.GetComponent<RingSelectionManager>()?.Notify_PawnJoinedFaction(__instance, __state, newFaction);
        }
    }

    // Trigger ring selection when a pawn spawns on a player home map.
    [HarmonyPatch(typeof(Pawn), "SpawnSetup")]
    public static class Patch_Pawn_SpawnSetup
    {
        static void Postfix(Pawn __instance, Map map, bool respawningAfterLoad)
        {
            Current.Game?.GetComponent<RingSelectionManager>()?.Notify_PawnSpawned(__instance, map, respawningAfterLoad);
        }
    }

    // Trigger ring selection when a pawn is downed.
    [HarmonyPatch(typeof(Pawn_HealthTracker), "MakeDowned")]
    public static class Patch_Pawn_HealthTracker_MakeDowned
    {
        static void Postfix(Pawn ___pawn)
        {
            if (___pawn != null && ___pawn.Downed)
            {
                Current.Game?.GetComponent<RingSelectionManager>()?.Notify_PawnDowned(___pawn);
            }
        }
    }

    // Trigger ring selection when a pawn kills another pawn.
    [HarmonyPatch(typeof(Pawn), "Kill")]
    public static class Patch_Pawn_Kill
    {
        static void Postfix(Pawn __instance, object[] __args)
        {
            if (__instance == null) return;

            Pawn killer = null;
            if (__args != null)
            {
                foreach (object arg in __args)
                {
                    if (arg is DamageInfo dinfo)
                    {
                        killer = dinfo.Instigator as Pawn;
                        if (killer != null) break;
                    }
                }
            }

            if (killer == null || killer == __instance) return;
            Current.Game?.GetComponent<RingSelectionManager>()?.Notify_PawnKilled(killer, __instance);
        }
    }
    [HarmonyPatch(typeof(Game), MethodType.Constructor)]
    public static class Patch_Game_Constructor
    {
        public static void Postfix(Game __instance)
        {
            if (__instance.components != null)
            {
                if (!__instance.components.Any(c => c is RingSelectionManager))
                {
                    __instance.components.Add(new RingSelectionManager(__instance));
                }
                if (!__instance.components.Any(c => c is ConstructLifetimeManager))
                {
                    __instance.components.Add(new ConstructLifetimeManager(__instance));
                }
            }
        }
    }
}
