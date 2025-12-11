using HarmonyLib;
using RimWorld;
using Verse;
using Verse.AI;
using System;
using System.Collections.Generic;

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
        private static readonly HashSet<string> BlockedHediffKeywords = new HashSet<string>
        {
            "vacuum", "hypoxia", "decompression", "suffocation", 
            "oxygen", "breath", "hypothermia", "heatstroke" 
        };

        private static bool Prefix(Pawn_HealthTracker __instance, Hediff hediff, Pawn ___pawn)
        {
            if (hediff == null || ___pawn == null) return true;

            CompLanternRing ring = LanternResources.GetRing(___pawn);
            if (ring == null) return true;

            if (!ring.IsActive || ring.charge <= 0f) return true;

            if (hediff.def != null)
            {
                 if (hediff.def == HediffDefOf.Hypothermia || hediff.def == HediffDefOf.Heatstroke || hediff.def == HediffDefOf.ToxicBuildup)
                 {
                     return false; 
                 }

                 string defName = hediff.def.defName.ToLower();
                 foreach (var keyword in BlockedHediffKeywords)
                 {
                     if (defName.Contains(keyword))
                     {
                         return false;
                     }
                 }
            }
            return true; 
        }
    }

    [HarmonyPatch(typeof(Pawn_HealthTracker), "PreApplyDamage")]
    public static class Patch_PreventSpacePhysicalDamage
    {
        private static readonly HashSet<string> BlockedDamageKeywords = new HashSet<string>
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

            bool isSpaceDamage = false;

            if (dinfo.Def != null)
            {
                if (dinfo.Def.defName == "VacuumBurn")
                {
                    isSpaceDamage = true;
                }
                else
                {
                    string defName = dinfo.Def.defName.ToLower();
                    foreach (var keyword in BlockedDamageKeywords)
                    {
                        if (defName.Contains(keyword))
                        {
                            isSpaceDamage = true;
                            break;
                        }
                    }
                }

                if (isSpaceDamage)
                {
                    absorbed = true;
                    return false; // Block Space Damage (Free)
                }
                
                // NOT Space Damage (Combat Damage) - Only block if config allows?
                // For now kept simple: Block 2% charge per hit
                if (ring.TryConsumeCharge(0.02f)) 
                {
                    absorbed = true; 
                    return false; // Block Combat Damage
                }
            }

            return true;
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
    [HarmonyPatch(typeof(Game), MethodType.Constructor)]
    public static class Patch_Game_Constructor
    {
        public static void Postfix(Game __instance)
        {
            if (__instance.components != null)
            {
                __instance.components.Add(new RingSelectionManager(__instance));
            }
        }
    }
}
